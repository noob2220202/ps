'use strict';
// 시드 데이터 — 두 영상(v1 11:05:58~, v2 11:16:14~, 2026-11-21)의 거래내역 전사(스크래치 ledger.json) 그대로.
//   사람 이름·계좌번호는 더미(정우진, 한지호, 1002-123-456789 …). 금액·잔액·날짜·시각·회사 이름은 영상 그대로.
//
// source
//   'video'      영상에 보인 거래 84건 (ledger 3절, 순서·금액·잔액·표시 이름 그대로)
//   'synthetic'  영상에 없는 지어낸 행 22건 — 잔액이 모든 행에서 이어지게 꼭 필요한 곳에만 (BRIEF D7, README '지어낸 행')
//                (a) 11/12 23:23:13 이전 출금 사이 잔액이 끊기는 곳을 메우는 입금 18건
//                (b) 입금 목록 맨 아래에 날짜 줄 윗부분만 걸친 11/12 행 (+20,000원) 1건 — 마지막 끊김(19번째)을 메운다
//                (c) 출금 목록 '2026년 9월' 머리글 아래 출금 3건 (머리글만 보이고 행은 안 보임)
//   'app'        앱에서 이체해서 생긴 행 (시드에는 없음)
//
// 지어낸 행의 시각 규칙: 영상이 보여 준 범위 밖으로만.
//   전체 목록은 11/18 13:24:42 까지, 입금 목록은 11/12 23:23:13 까지, 출금 목록은 10/8 14:24:56 까지 보였다
//   → 지어낸 입금은 11/12 23:23:13 보다 이전, 지어낸 출금은 10/8 14:24:56 보다 이전 (VISIBLE_FROM, buildSeed 가 검사).
//   끊김을 메우는 입금은 앞뒤 거래 사이(대개 다음 출금 1~2분 전)에 둔다.
//
// 시나리오 (POST /api/dev/reset {scenario})
//   'v1-start' v1 녹화 시작: 잔액 345원 (11:02:40 농협정우진 -1원 = 녹화 전 이체까지)
//   'v2-start' v1 1원 이체(11:09:11 농협정우진 -1원) 뒤 = v2 녹화 시작: 잔액 344원
//   'v2-end'   v2 2원 이체(11:17:39 카카정우진 -2원) 뒤: 잔액 342원
//   v1-start 에서 영상과 같은 이체를 하면 v2-start 와, v2-start 에서 영상과 같은 이체를 하면 v2-end 와 API 결과가 같다 (테스트).

const { BANKS, getBank, transferDisplayName } = require('./banks');
const { withTransaction } = require('./schema');
const { setOverride } = require('./clock');
const { isValidLocalIso } = require('./util');
const { getStatement } = require('./statement');

const MAIN_ACCOUNT_ID = 1;
/** 계좌 비밀번호 (더미, README). WOORI_ACCOUNT_PIN 으로 바꿀 수 있다 */
const DEFAULT_ACCOUNT_PIN = '1234';
/** 한도제한 계좌(금융거래한도계좌) 1일 이체한도 — 설계값 1,000,000원 (이 앱에서 한 이체만 센다) */
const DAILY_LIMIT = 1_000_000;

/** 내 계좌 (ledger 2절). balance 는 거래내역 잔액 연결로 계산해 넣는다 */
const ACCOUNT = {
  id: MAIN_ACCOUNT_ID,
  bankCode: 'WOORI',
  digits: '1002123456789', // 화면 '1002-123-456789' (더미 — 실제와 자리수·하이픈 모양·앞 4자리 1002 같음)
  product: 'WON 통장',
  ownerName: '정우진', // 영상의 받는 분/본인 더미 (privacy.json). 받는 분 통장표기 기본값
  badge: null, // 예전엔 '한도제한' 칩 (홈 · 거래내역) — 뺐다
  dailyLimit: null, // 예전엔 DAILY_LIMIT(1,000,000원) — 한도 없앰 (transfer.checkLimits 는 null 이면 제한 없음)
};

/** 받는 분 계좌 (더미). key 로 거래·최근입금계좌·조회 디렉터리를 묶는다 */
const PEOPLE = {
  nh: { name: '정우진', bankCode: 'NHLOCAL', digits: '12345652789012' }, // v1 최근입금계좌 '지역농축협' (더미 '52' 유지)
  kakao: { name: '정우진', bankCode: 'KAKAO', digits: '3333123456789' }, // v2 계좌번호 직접 입력 '카카오뱅크'
};

/** 조회 디렉터리에만 있는 더미 계좌 (테스트·수동 확인용, 영상에 없음) */
const EXTRA_DIRECTORY = [
  { bankCode: 'SHINHAN', digits: '110987654321', holderName: '강다은' },
  { bankCode: 'KB', digits: '56780101876543', holderName: '오민재' },
  { bankCode: 'NH', digits: '3021987654321', holderName: '남궁솔' }, // 농협은행(중앙회) 계좌 → '농협'
];

/** 영상이 보여 준 목록 범위의 맨 아래 행 시각 (지어낸 행은 이보다 이전이어야 한다) */
const VISIBLE_FROM = {
  all: '2026-11-18T13:24:42', // 전체 목록 v1 A1 (27행)
  deposit: '2026-11-12T23:23:13', // 입금 목록 v1 D3 (26행)
  withdraw: '2026-10-08T14:24:56', // 출금 목록 v1 W1 (56행)
};

/** 시나리오 — order 순서로 쌓인다. clock: 영상 녹화 시작·이체 시각 (POST /api/dev/reset {now:'video'} → transferAt) */
const SCENARIOS = {
  'v1-start': { order: 0, balance: 345, clock: { recordStart: '2026-11-21T11:05:58', transferAt: '2026-11-21T11:09:11' } },
  'v2-start': { order: 1, balance: 344, clock: { recordStart: '2026-11-21T11:16:14', transferAt: '2026-11-21T11:17:39' } },
  'v2-end': { order: 2, balance: 342, clock: { recordStart: '2026-11-21T11:16:14', transferAt: '2026-11-21T11:17:39' } },
};
/** inventory.json 의 이름도 받는다 */
const SCENARIO_ALIASES = { v1: 'v1-start', 'v1-end': 'v2-start', v2: 'v2-start' };

function resolveScenario(name) {
  const s = SCENARIO_ALIASES[name] ?? name;
  return Object.prototype.hasOwnProperty.call(SCENARIOS, s) ? s : null;
}

// ───────────────────────── 거래내역 (오래된 순) ─────────────────────────
// 상세 화면이 영상에 나온 것은 2건뿐 (ledger 7절): 입금 tx-20261120-212947(한지호), 이체 tx-20261121-110240(농협정우진).
// 나머지 행의 상세는 같은 종류의 영상 상세를 본뜬 설계값 (detailSrc 'rule').
const DEPOSIT_DETAIL = { code: '0543', branch: '플랫폼사업부' }; // 영상 상세 ① (입금)
const TRANSFER_DETAIL = { code: '모바일', branch: '디지털영업부' }; // 영상 상세 ② (이 앱의 이체)
const WITHDRAW_DETAIL = { code: '모바일', branch: '디지털영업부' }; // 설계값: 그 밖의 출금 상세는 영상에 없음

/** 영상 입금 행: [시각, 표시 이름, 금액, 영상의 거래 후 잔액] */
const dep = (t, name, a, b, extra = {}) => ({ t, name, a, b, kind: 'deposit', source: 'video', ...extra });
/** 영상 출금 행 (이 앱의 이체가 아닌 것: 토뱅·토스·카카오페이·삼성월렛머니 …) */
const wd = (t, name, a, b, extra = {}) => ({ t, name, a, b, kind: 'withdraw', source: 'video', ...extra });
/** 영상 속 이 앱의 이체 출금 행 (받는 분 key). name 은 표시 이름 규칙으로 만든 값과 같아야 한다 (검사) */
const xfer = (t, key, a, b, name, extra = {}) => ({ t, key, name, a, b, kind: 'transfer', source: 'video', ...extra });
/** 지어낸 행 (영상에 없음) */
const syn = (t, name, a, note) => ({ t, name, a, kind: a > 0 ? 'deposit' : 'withdraw', source: 'synthetic', note });

const ROWS = [
  // ── (c) 지어낸 출금: '2026년 9월' 머리글 아래 (영상은 머리글만, v1 74.412 #3048). 마지막 잔액 18원 → 10/8 -1원 → 17원 ──
  syn('2026-09-05T10:21:37', '삼성월렛머니', -30_000, "(c) '2026년 9월' 머리글 아래 출금 — 영상에 안 보임"),
  syn('2026-09-19T13:42:51', '카카오페이', -12_000, "(c) '2026년 9월' 머리글 아래 출금 — 영상에 안 보임"),
  syn('2026-09-27T21:14:05', '토뱅 정우진', -50_000, "(c) '2026년 9월' 머리글 아래 출금 — 영상에 안 보임"),
  // ── 영상: 출금 목록 10월 (v1 W1) ──
  wd('2026-10-08T14:24:56', '토뱅 정우진', -1, 17), // v1 W1 74.127
  syn('2026-10-08T22:45:18', '정우진', 4_243_563, '(a) 잔액 연결: 10/8 14:24:56 잔액 17원 → 22:46:52 -1원 → 4,243,579원'),
  wd('2026-10-08T22:46:52', '토뱅 정우진', -1, 4_243_579), // v1 W1 73.834
  wd('2026-10-09T08:10:39', '카카오페이', -1_000_000, 3_243_579), // v1 W1 73.684
  wd('2026-10-09T08:50:39', '토뱅 정우진', -300_000, 2_943_579), // v1 W1 73.425
  wd('2026-10-09T14:48:01', '카카오페이', -1_000_000, 1_943_579), // v1 W1 73.241
  wd('2026-10-09T22:59:44', '카카오페이', -500_000, 1_443_579), // v1 W1 73.149
  wd('2026-10-09T23:32:59', '카카오페이', -400_000, 1_043_579), // v1 W1 72.932
  syn('2026-10-10T09:12:44', '정우진', 1, '(a) 잔액 연결: 10/9 23:32:59 잔액 1,043,579원 → 10/10 18:04:28 -500,000원 → 543,580원'),
  wd('2026-10-10T18:04:28', '카카오페이', -500_000, 543_580), // v1 W1 72.782
  wd('2026-10-10T18:29:37', '토뱅 정우진', -300_000, 243_580), // v1 W1 72.691
  wd('2026-10-10T18:48:47', '카카오페이', -243_580, 0), // v1 W1 72.539
  syn('2026-10-12T17:36:52', '정우진', 50_000, '(a) 잔액 연결: 10/10 18:48:47 잔액 0원 → 10/12 17:38:40 -50,000원 → 0원'),
  wd('2026-10-12T17:38:40', '토스 정우진_', -50_000, 0), // v1 W1 72.455
  syn('2026-10-12T17:39:05', '정우진', 50_000, '(a) 잔액 연결: 10/12 17:38:40 잔액 0원 → 17:39:32 -50,000원 → 0원'),
  wd('2026-10-12T17:39:32', '토뱅 정우진', -50_000, 0), // v1 W1 72.406
  syn('2026-10-13T20:27:48', '정우진', 100_000, '(a) 잔액 연결: 10/12 17:39:32 잔액 0원 → 10/13 20:29:36 -100,000원 → 0원'),
  wd('2026-10-13T20:29:36', '토뱅 정우진', -100_000, 0), // v1 W1 72.355
  syn('2026-10-19T00:42:31', '정우진', 50_000, '(a) 잔액 연결: 10/13 20:29:36 잔액 0원 → 10/19 00:44:15 -50,000원 → 0원'),
  wd('2026-10-19T00:44:15', '토뱅 정우진', -50_000, 0), // v1 W1 72.154
  // ── 영상: 출금 목록 11월 (v1 W1) ──
  syn('2026-11-06T18:42:09', '정우진', 10_041, '(a) 잔액 연결: 10/19 00:44:15 잔액 0원 → 11/6 18:44:42 -10,000원 → 41원'),
  wd('2026-11-06T18:44:42', '토스 (주)앤', -10_000, 41), // v1 W1 71.964
  syn('2026-11-06T23:24:37', '정우진', 20_000, '(a) 잔액 연결: 11/6 18:44:42 잔액 41원 → 23:26:04 -20,000원 → 41원'),
  wd('2026-11-06T23:26:04', '토뱅 정우진', -20_000, 41), // v1 W1 71.855
  syn('2026-11-07T19:05:12', '정우진', 100_000, '(a) 잔액 연결: 11/6 23:26:04 잔액 41원 → 11/7 19:06:43 -50,000원 → 50,041원'),
  wd('2026-11-07T19:06:43', '토스 정우진_', -50_000, 50_041), // v1 W1 71.611
  syn('2026-11-07T19:06:50', '정우진', 50_000, '(a) 잔액 연결: 11/7 19:06:43 잔액 50,041원 → 19:06:58 -50,000원 → 50,041원'),
  wd('2026-11-07T19:06:58', '토스 정우진_', -50_000, 50_041), // v1 W1 71.511
  syn('2026-11-07T19:07:05', '정우진', 50_000, '(a) 잔액 연결: 11/7 19:06:58 잔액 50,041원 → 19:07:13 -100,000원 → 41원'),
  wd('2026-11-07T19:07:13', '토뱅 정우진', -100_000, 41), // v1 W1 71.378
  syn('2026-11-07T23:20:41', '정우진', 30_000, '(a) 잔액 연결: 11/7 19:07:13 잔액 41원 → 23:21:56 -30,000원 → 41원'),
  wd('2026-11-07T23:21:56', '토스 정우진_', -30_000, 41), // v1 W1 71.059
  syn('2026-11-07T23:22:03', '정우진', 30_000, '(a) 잔액 연결: 11/7 23:21:56 잔액 41원 → 23:22:10 -30,000원 → 41원'),
  wd('2026-11-07T23:22:10', '토뱅 정우진', -30_000, 41), // v1 W1 70.959
  syn('2026-11-08T07:51:20', '정우진', 50_000, '(a) 잔액 연결: 11/7 23:22:10 잔액 41원 → 11/8 07:52:43 -50,000원 → 41원'),
  wd('2026-11-08T07:52:43', '토뱅 정우진', -50_000, 41), // v1 W1 70.875
  syn('2026-11-09T19:15:38', '정우진', 300_000, '(a) 잔액 연결: 11/8 07:52:43 잔액 41원 → 11/9 19:17:04 -300,000원 → 41원'),
  wd('2026-11-09T19:17:04', '토뱅 정우진', -300_000, 41), // v1 W1 70.716
  syn('2026-11-11T21:57:02', '정우진', 20_000, '(a) 잔액 연결: 11/9 19:17:04 잔액 41원 → 11/11 21:58:35 -20,000원 → 41원'),
  wd('2026-11-11T21:58:35', '삼성월렛머니', -20_000, 41), // v1 W1 70.533
  syn('2026-11-11T22:55:46', '정우진', 1_000, '(a) 잔액 연결: 11/11 21:58:35 잔액 41원 → 22:57:11 -1,000원 → 41원'),
  wd('2026-11-11T22:57:11', '토스 정우진', -1_000, 41), // v1 W1 70.45
  syn('2026-11-12T19:56:19', '정우진', 100_000, '(a) 잔액 연결: 11/11 22:57:11 잔액 41원 → 11/12 19:57:45 -100,000원 → 41원'),
  wd('2026-11-12T19:57:45', '토뱅 정우진', -100_000, 41), // v1 W1 70.198
  syn('2026-11-12T21:47:26', '정우진', 20_000,
    "(b) 입금 목록 맨 아래 걸친 '11월 12일' 행(v1 149.991 #5851, 이름·금액 판독 불가) — 잔액 연결: 11/12 19:57:45 잔액 41원 → 23:23:13 +30,000원 → 50,041원"),
  // ── 여기부터 입금·출금이 모두 보인 구간 (11/12 23:23:13 ~) ──
  dep('2026-11-12T23:23:13', '정우진', 30_000, 50_041), // v1 D3 149.707
  dep('2026-11-12T23:23:36', '정우진', 230_000, 280_041), // v1 D1 56.895
  wd('2026-11-12T23:25:19', '토스페이', -20_900, 259_141), // v1 W1 70.081
  dep('2026-11-13T00:31:47', '상금', 30_000, 289_141), // v1 D1 56.781
  wd('2026-11-13T01:16:32', '토뱅 정우진', -2_000, 287_141), // v1 W1 69.797
  wd('2026-11-13T09:18:02', '토뱅 정우진', -200_000, 87_141), // v1 W1 69.63
  wd('2026-11-13T11:34:04', '토뱅 정우진', -15_000, 72_141), // v1 W1 69.372
  wd('2026-11-13T12:07:07', '토뱅 정우진', -70_000, 2_141), // v1 W1 69.279
  dep('2026-11-14T12:28:44', '서동현', 1_400, 3_541), // v1 D1 47.042
  wd('2026-11-14T12:29:15', '토뱅 정우진', -3_500, 41), // v1 W1 69.045
  dep('2026-11-14T12:30:38', '서동현', 2_000, 2_041), // v1 D1 46.96
  wd('2026-11-14T12:31:18', '토뱅 정우진', -2_000, 41), // v1 W1 68.895
  dep('2026-11-14T15:06:55', '류성민', 29_900, 29_941), // v1 D1 46.908
  wd('2026-11-14T15:08:55', '토뱅 정우진', -29_900, 41), // v1 W1 68.761
  dep('2026-11-14T16:40:53', '한지호', 20_000, 20_041), // v1 D1 46.85
  wd('2026-11-14T16:42:21', '삼성월렛머니', -20_000, 41), // v1 W1 68.385
  dep('2026-11-15T15:29:48', '문지훈', 200_000, 200_041), // v1 D1 46.674
  wd('2026-11-15T15:31:41', '토뱅 정우진', -200_000, 41), // v1 W1 67.808
  dep('2026-11-15T19:15:30', '실시간 이체', 256_000, 256_041), // v1 D1 46.59
  wd('2026-11-15T19:23:19', '토스 권태윤', -22_000, 234_041), // v1 W1 67.498
  wd('2026-11-15T19:25:08', '토스 정우진', -28_600, 205_441), // v1 W1 67.24
  wd('2026-11-15T19:32:13', '카카오페이', -200_000, 5_441), // v1 W1 67.122
  wd('2026-11-16T13:36:06', '토스 유하은(', -4_800, 641), // v1 W1 67.006 — 칸이 차서 잘린 모양 그대로
  dep('2026-11-16T13:58:51', '한지호', 15_000, 15_641), // v1 D1 46.5
  wd('2026-11-16T14:03:32', '토뱅 정우진', -15_641, 0), // v1 W1 66.687
  dep('2026-11-17T13:52:34', '장서연', 5_000, 5_000), // v1 D1 46.181
  dep('2026-11-17T21:05:25', '테더', 40_000, 45_000), // v1 D1 46.047
  wd('2026-11-17T22:45:34', '토뱅 정우진', -40_000, 5_000), // v1 W1 66.295
  dep('2026-11-18T13:23:45', '29', 4_000, 9_000), // v1 D1 45.688
  // ── 여기부터 전체 목록에도 보인 구간 (11/18 13:24:42 ~, v1 A1) ──
  wd('2026-11-18T13:24:42', '토뱅 정우진', -9_000, 0), // v1 A1 37.897
  dep('2026-11-18T14:00:41', '기프티콘다사요', 16_000, 16_000), // v1 A1 37.638
  wd('2026-11-18T14:02:22', '토뱅 정우진', -16_000, 0), // v1 A1 37.455
  dep('2026-11-18T16:21:46', '기프티콘다사요', 8_000, 8_000), // v1 A1 37.304
  wd('2026-11-18T17:39:15', '토뱅 정우진', -8_000, 0), // v1 A1 37.22
  dep('2026-11-18T17:49:45', '윤서준', 50_000, 50_000), // v1 A1 37.003
  dep('2026-11-18T17:52:48', '정우진', 50_000, 100_000), // v1 A1 36.869
  wd('2026-11-18T18:59:25', '토뱅 정우진', -100_000, 0), // v1 A1 36.785
  dep('2026-11-19T18:51:46', 'ㄷㅂ', 25_000, 25_000), // v1 A1 36.702
  wd('2026-11-19T19:26:31', '토뱅 정우진', -20_000, 5_000), // v1 A1 36.326
  dep('2026-11-19T21:53:58', '배준혁', 3_000, 8_000), // v1 A1 36.142
  wd('2026-11-19T22:22:57', '토뱅 정우진', -8_000, 0), // v1 A1 36.041
  dep('2026-11-20T00:07:10', '기프티콘다사요', 16_000, 16_000), // v1 A1 35.841
  dep('2026-11-20T00:18:52', '기프티콘다사요', 16_000, 32_000), // v1 A1 35.758
  wd('2026-11-20T00:44:15', '토뱅 정우진', -32_000, 0), // v1 A1 35.69
  dep('2026-11-20T09:52:45', 'KYC1344', 1, 1), // v1 A1 35.523
  dep('2026-11-20T12:18:40', '한지호', 57_000, 57_001), // v1 A1 35.456
  wd('2026-11-20T12:19:52', '삼성월렛머니', -50_000, 7_001), // v1 A1 35.382
  wd('2026-11-20T13:14:49', '토뱅 정우진', -4_000, 3_001), // v1 A1 35.224
  dep('2026-11-20T16:47:30', '한지호', 50_000, 53_001), // v1 A1 35.071
  wd('2026-11-20T16:49:24', '삼성월렛머니', -50_000, 3_001), // v1 A1 34.972
  dep('2026-11-20T18:48:04', '정우진', 110_000, 113_001), // v1 A1 34.771
  wd('2026-11-20T18:56:06', '토뱅 정우진', -100_000, 13_001), // v1 A1 34.67
  wd('2026-11-20T20:17:15', '토뱅 정우진', -13_000, 1), // v1 A1 34.604
  dep('2026-11-20T21:29:47', '한지호', 100_000, 100_001, { detailSrc: 'video' }), // v1 A1 34.328 · 상세 ①③ (v1 91.641, 154.589)
  wd('2026-11-20T21:39:57', '카카오페이', -99_655, 346), // v1 A1 34.161
  // ── 이 앱의 이체 (받는 분 정우진) ──
  xfer('2026-11-21T11:02:40', 'nh', -1, 345, '농협정우진', { detailSrc: 'video' }), // v1 A1 33.453 · 녹화 전 이체 · 상세 ② (v1 101.871)
  xfer('2026-11-21T11:09:11', 'nh', -1, 344, '농협정우진', { since: 'v2-start' }), // v1 A3 199.631 — v1 영상 속 1원 이체
  xfer('2026-11-21T11:17:39', 'kakao', -2, 342, '카카정우진', { since: 'v2-end' }), // v2 A4 89.382 — v2 영상 속 2원 이체
];

/** 'YYYY-MM-DDTHH:mm:ss' → 'tx-YYYYMMDD-HHMMSS' (ledger id 와 같은 규칙) */
function txIdFor(occurredAt) {
  return `tx-${occurredAt.slice(0, 10).replace(/-/g, '')}-${occurredAt.slice(11, 19).replace(/:/g, '')}`;
}

/** 거래 행을 완성하고 잔액 연결을 계산한다. 영상 잔액과 하나라도 다르면 throw (시드가 잘못 고쳐지는 것을 막는다) */
function buildRows(scenario) {
  const order = SCENARIOS[scenario].order;
  const rows = ROWS.filter((r) => !r.since || SCENARIOS[r.since].order <= order);
  for (let i = 0; i < rows.length; i++) {
    if (!isValidLocalIso(rows[i].t)) throw new Error(`seed: bad time ${rows[i].t}`);
    if (i > 0 && rows[i].t <= rows[i - 1].t) throw new Error(`seed: rows not in time order at ${rows[i].t}`);
  }
  // 영상 잔액이 있는 첫 행에서 거꾸로 시작 잔액을 구한다
  const anchor = rows.findIndex((r) => r.b !== undefined);
  const opening = rows[anchor].b - rows.slice(0, anchor + 1).reduce((s, r) => s + r.a, 0);
  if (opening < 0) throw new Error('seed: negative opening balance');
  let bal = opening;
  const ids = new Set();
  return rows.map((r, i) => {
    bal += r.a;
    if (bal < 0) throw new Error(`seed: negative balance at ${r.t}`);
    if (r.b !== undefined && r.b !== bal) throw new Error(`seed: balance mismatch at ${r.t}: ${bal} != ${r.b}`);
    const id = txIdFor(r.t);
    if (ids.has(id)) throw new Error(`seed: duplicate id ${id}`);
    ids.add(id);
    const person = r.key ? PEOPLE[r.key] : null;
    let displayName = r.name;
    if (person) {
      displayName = transferDisplayName(person.bankCode, person.name, person.name);
      if (displayName !== r.name) throw new Error(`seed: display name rule ${displayName} != ${r.name} at ${r.t}`);
    }
    if (r.source === 'synthetic') {
      if (r.t >= VISIBLE_FROM.all) throw new Error(`seed: synthetic row inside the visible 'all' list at ${r.t}`);
      if (r.kind === 'deposit' && r.t >= VISIBLE_FROM.deposit) throw new Error(`seed: synthetic deposit inside the visible deposit list at ${r.t}`);
      if (r.kind === 'withdraw' && r.t >= VISIBLE_FROM.withdraw) throw new Error(`seed: synthetic withdrawal inside the visible withdrawal list at ${r.t}`);
    }
    const tmpl = r.kind === 'deposit' ? DEPOSIT_DETAIL : r.kind === 'transfer' ? TRANSFER_DETAIL : WITHDRAW_DETAIL;
    return {
      seq: i + 1,
      id,
      accountId: MAIN_ACCOUNT_ID,
      occurredAt: r.t,
      displayName,
      amount: r.a,
      balanceAfter: bal,
      kind: r.kind,
      code: tmpl.code,
      branch: tmpl.branch,
      requester: r.kind === 'deposit' ? r.name : null,
      counterpartyName: person ? person.name : null,
      counterpartyBank: person ? person.bankCode : null,
      counterpartyAccount: person ? person.digits : null,
      recipientLabel: person ? ACCOUNT.ownerName : null, // 받는 분 통장표기 기본값 = 보내는 사람
      myLabel: person ? person.name : null, // 내 통장표기 기본값 = 받는 분 예금주
      fee: 0,
      chequeAmount: 0,
      detailSrc: r.detailSrc ?? 'rule',
      source: r.source,
      note: r.note ?? null,
      personKey: r.key ?? null,
    };
  });
}

/** 시나리오별 시드 데이터 (순수 데이터, DB 미사용) */
function buildSeed(name) {
  const scenario = resolveScenario(name);
  if (!scenario) throw new Error(`unknown scenario: ${name}`);
  const transactions = buildRows(scenario);
  const balance = transactions[transactions.length - 1].balanceAfter;
  if (balance !== SCENARIOS[scenario].balance) throw new Error(`seed: ${scenario} balance ${balance} != ${SCENARIOS[scenario].balance}`);
  const account = { ...ACCOUNT, balance, pin: process.env.WOORI_ACCOUNT_PIN || DEFAULT_ACCOUNT_PIN, sortOrder: 1 };

  // 최근입금계좌: 이 앱으로 보낸 적 있는 받는 분 (처음 보낸 순으로 id). v1·v2 영상 모두 정우진·지역농축협 1행 (ledger 8절)
  const firstUse = new Map();
  for (const t of transactions) if (t.personKey && !firstUse.has(t.personKey)) firstUse.set(t.personKey, t);
  const recipients = [...firstUse.keys()].map((key, i) => {
    const p = PEOPLE[key];
    const last = transactions.filter((t) => t.personKey === key).at(-1);
    return {
      id: i + 1, name: p.name, bankCode: p.bankCode, digits: p.digits,
      lastUsedAt: last.occurredAt, lastTxSeq: last.seq, favorite: false, source: 'video',
    };
  });

  const directory = [
    ...Object.values(PEOPLE).map((p) => ({ bankCode: p.bankCode, digits: p.digits, holderName: p.name })),
    { bankCode: ACCOUNT.bankCode, digits: ACCOUNT.digits, holderName: ACCOUNT.ownerName },
    ...EXTRA_DIRECTORY,
  ];

  return { scenario, clock: { ...SCENARIOS[scenario].clock }, account, transactions, recipients, directory };
}

// ───────────────────────── 거래 명세 PDF 시드 (backend/statement.js) ─────────────────────────
const STATEMENT_DAY_FROM = 8 * 3600 + 10 * 60; // 같은 날 거래를 펼칠 시각 범위 (PDF 에 시각이 없다)
const STATEMENT_DAY_TO = 21 * 3600 + 35 * 60;

/** PDF 기재내용의 잘린 끝을 다듬는다: '카카오페이(택시' → '카카오페이(택시)', '씨유(CU) 그' → '씨유(CU)', '김호성 우체' → '김호성' */
function cleanStatementName(text) {
  let t = String(text ?? '').trim().replace(/\s+(그|우체)$/, '');
  if (t.endsWith('(')) t = t.slice(0, -1).trim();
  else if ((t.match(/\(/g) ?? []).length > (t.match(/\)/g) ?? []).length) t += ')';
  return t;
}

const hms = (sec) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((n) => String(n).padStart(2, '0')).join(':');

/**
 * 거래 명세(statement.json) → 시드. 영상 시드(v1-start)의 은행 · 조회 디렉터리는 그대로 쓰고, 내 계좌 · 거래내역만 바꾼다.
 *   거래 시각: 명세에는 날짜만 있다 → 같은 날 안에서 PDF 순서(최신 → 과거)대로 8:10~21:35 사이에 고르게 펼친다 (초는 고정 규칙으로 흩뜨림).
 *   종류: 입금 = deposit(의뢰인 = 기재내용), 출금 = withdraw (받는 계좌번호가 명세에 없어 이체(transfer)로는 못 만든다).
 *   거래구분(code) = 적요, 관리점(branch) = 취급점.  받는 분(최근입금계좌)은 비워 둔다 — 관리 패널 '받는 분'에서 등록.
 */
function buildStatementSeed(st) {
  const base = buildSeed('v1-start');
  const rows = st.rows; // 최신순
  const byDate = new Map();
  rows.forEach((r, i) => {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(i);
  });
  const at = new Array(rows.length);
  for (const [date, idxs] of byDate) {
    const n = idxs.length;
    const step = (STATEMENT_DAY_TO - STATEMENT_DAY_FROM) / n;
    idxs.forEach((rowIdx, j) => {
      // j = 0 이 그날 가장 늦은 거래. 과거일수록 이른 시각
      const sec = Math.floor(STATEMENT_DAY_FROM + (n - 1 - j + 0.5) * step) + ((rowIdx * 37) % Math.max(1, Math.min(59, Math.floor(step / 2))));
      at[rowIdx] = `${date}T${hms(sec)}`;
    });
  }
  const oldestFirst = rows.map((r, i) => ({ r, t: at[i] })).reverse();
  const transactions = oldestFirst.map(({ r, t }, i) => {
    const amount = (r.in ?? 0) - (r.out ?? 0);
    const kind = amount > 0 ? 'deposit' : 'withdraw';
    const name = cleanStatementName(r.text);
    return {
      seq: i + 1,
      id: txIdFor(t),
      accountId: MAIN_ACCOUNT_ID,
      occurredAt: t,
      displayName: name,
      amount,
      balanceAfter: r.bal,
      kind,
      code: (r.kind || '').trim() || '지급',
      branch: (r.branch || '').trim() || (kind === 'deposit' ? DEPOSIT_DETAIL.branch : WITHDRAW_DETAIL.branch),
      requester: kind === 'deposit' ? name : null,
      counterpartyName: null,
      counterpartyBank: null,
      counterpartyAccount: null,
      recipientLabel: null,
      myLabel: null,
      fee: 0,
      chequeAmount: 0,
      detailSrc: 'rule',
      source: 'statement',
      note: null,
      personKey: null,
    };
  });
  // 잔액이 처음(가장 오래된 거래 앞)부터 끝까지 이어지는지 — 안 이어지면 명세를 잘못 옮긴 것
  for (let i = 1; i < transactions.length; i++) {
    if (transactions[i].balanceAfter !== transactions[i - 1].balanceAfter + transactions[i].amount) {
      throw new Error(`statement: 잔액이 이어지지 않는다 (${transactions[i].occurredAt} ${transactions[i].displayName})`);
    }
  }
  const last = transactions[transactions.length - 1];
  if (st.balance != null && st.balance !== last.balanceAfter) throw new Error(`statement: balance ${st.balance} != 마지막 거래 잔액 ${last.balanceAfter}`);
  const a = st.account;
  const account = {
    ...base.account,
    digits: a.digits,
    ownerName: a.ownerName,
    product: a.product || base.account.product,
    balance: last.balanceAfter,
    badge: null,
    dailyLimit: null,
  };
  const directory = base.directory.map((d) =>
    d.bankCode === ACCOUNT.bankCode && d.digits === ACCOUNT.digits ? { ...d, digits: a.digits, holderName: a.ownerName } : d,
  );
  return { scenario: 'statement', clock: { ...base.clock }, account, transactions, recipients: [], directory, source: 'statement' };
}

/**
 * DB 를 시나리오 상태로 통째로 다시 채운다 (원자적). 이체 표(ticket)도 지운다.
 * @param {{now?: string|null, seed?: object}} [opts] seed: buildStatementSeed 결과 등 (없으면 name 시나리오). now: 개발용 시계 고정 ('YYYY-MM-DDTHH:mm:ss'). 없으면 덮어쓰기를 지운다 (WOORI_NOW → 실제 시각)
 */
function resetDb(db, name = 'v1-start', opts = {}) {
  const seed = opts.seed ?? buildSeed(name);
  withTransaction(db, () => {
    db.exec(`
      DELETE FROM tickets;
      DELETE FROM transactions;
      DELETE FROM recipients;
      DELETE FROM directory;
      DELETE FROM accounts;
      DELETE FROM banks;
    `);
    const insBank = db.prepare(`INSERT INTO banks (code, name, short, prefix, prefix_src, logo, kftc, in_grid, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const b of BANKS) insBank.run(b.code, b.name, b.short, b.prefix, b.prefixSrc, b.logo, b.kftc, b.inGrid ? 1 : 0, b.sortOrder);

    const a = seed.account;
    db.prepare(`INSERT INTO accounts (id, bank_code, account_digits, product, owner_name, badge, balance, daily_limit, pin, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(a.id, a.bankCode, a.digits, a.product, a.ownerName, a.badge, a.balance, a.dailyLimit, a.pin, a.sortOrder);

    const insTx = db.prepare(`INSERT INTO transactions
      (seq, id, account_id, occurred_at, display_name, amount, balance_after, kind, code, branch, requester,
       counterparty_name, counterparty_bank, counterparty_account, recipient_label, my_label, fee, cheque_amount, detail_src, source, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const t of seed.transactions) {
      insTx.run(t.seq, t.id, t.accountId, t.occurredAt, t.displayName, t.amount, t.balanceAfter, t.kind, t.code, t.branch, t.requester,
        t.counterpartyName, t.counterpartyBank, t.counterpartyAccount, t.recipientLabel, t.myLabel, t.fee, t.chequeAmount,
        t.detailSrc, t.source, t.note);
    }

    const insRcp = db.prepare(`INSERT INTO recipients (id, name, bank_code, account_digits, last_used_at, last_tx_seq, favorite, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const r of seed.recipients) insRcp.run(r.id, r.name, r.bankCode, r.digits, r.lastUsedAt, r.lastTxSeq, r.favorite ? 1 : 0, r.source);

    const insDir = db.prepare('INSERT OR REPLACE INTO directory (bank_code, account_digits, holder_name) VALUES (?, ?, ?)');
    for (const d of seed.directory) insDir.run(d.bankCode, d.digits, d.holderName);

    setOverride(db, opts.now ?? null);
    db.prepare("INSERT INTO meta (key, value) VALUES ('seed_source', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(seed.source ?? 'video');
  });
  return seed;
}

/**
 * 🔔 관리 패널 '이 프로필 데이터' (bank-app-clone POST /api/reset 과 같은 두 가지). 지금 이름(owner_name)은 그대로 둔다.
 *   'example' 예시 데이터로 = 거래 명세(statement.json)가 있으면 그것, 없으면 v1-start 시드
 *   'empty'   빈 상태로     = 계좌·거래내역·받는 분을 모두 지우고 통장 0원 (대표 계좌만 남는다)
 */
function resetMode(db, mode) {
  const name = db.prepare('SELECT owner_name FROM accounts WHERE id = ?').get(MAIN_ACCOUNT_ID)?.owner_name;
  const st = getStatement();
  resetDb(db, 'v1-start', st ? { seed: buildStatementSeed(st) } : {});
  withTransaction(db, () => {
    if (mode === 'empty') {
      db.exec(`
        DELETE FROM tickets;
        DELETE FROM transactions;
        DELETE FROM recipients;
      `);
      const own = db.prepare('SELECT bank_code, account_digits FROM accounts WHERE id = ?').get(MAIN_ACCOUNT_ID);
      db.prepare('DELETE FROM directory WHERE NOT (bank_code = ? AND account_digits = ?)').run(own.bank_code, own.account_digits);
      db.prepare('UPDATE accounts SET balance = 0 WHERE id = ?').run(MAIN_ACCOUNT_ID);
    }
    if (name) {
      db.prepare('UPDATE accounts SET owner_name = ?').run(name);
      const own = db.prepare('SELECT bank_code, account_digits FROM accounts WHERE id = ?').get(MAIN_ACCOUNT_ID);
      db.prepare('UPDATE directory SET holder_name = ? WHERE bank_code = ? AND account_digits = ?').run(name, own.bank_code, own.account_digits);
    }
  });
}

/**
 * DB 가 비어 있으면 채운다: 거래 명세(statement.json)가 있으면 그것, 없으면 WOORI_SCENARIO(기본 'v1-start'). 채웠으면 true.
 * 이미 데이터가 있어도, 명세가 있는데 한 번도 시드 출처(meta 'seed_source')를 남긴 적 없는 옛 저장본이면 명세로 한 번 바꿔 채운다
 * (이 기능이 들어오기 전에 깔린 APK 의 저장본 — 그 뒤로는 어떤 리셋이든 출처가 남아 다시 건드리지 않는다).
 */
function ensureSeeded(db) {
  const st = getStatement();
  const n = db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n;
  if (n > 0) {
    const src = db.prepare("SELECT value FROM meta WHERE key = 'seed_source'").get();
    if (st && !src) {
      resetDb(db, 'v1-start', { seed: buildStatementSeed(st) });
      return true;
    }
    return false;
  }
  if (st) resetDb(db, 'v1-start', { seed: buildStatementSeed(st) });
  else resetDb(db, resolveScenario(process.env.WOORI_SCENARIO || 'v1-start') ?? 'v1-start');
  return true;
}

module.exports = {
  buildSeed,
  buildStatementSeed,
  resetDb,
  resetMode,
  ensureSeeded,
  resolveScenario,
  txIdFor,
  SCENARIOS,
  SCENARIO_ALIASES,
  VISIBLE_FROM,
  PEOPLE,
  ACCOUNT,
  MAIN_ACCOUNT_ID,
  DEFAULT_ACCOUNT_PIN,
  DAILY_LIMIT,
  DEPOSIT_DETAIL,
  TRANSFER_DETAIL,
  WITHDRAW_DETAIL,
};

// `node seed.js [v1-start|v2-start|v2-end]` — 파일 DB(WOORI_DB_PATH 또는 backend/woori.db)를 시나리오 상태로 리셋
if (require.main === module) {
  const { openDb } = require('./db');
  const name = process.argv[2] || 'v1-start';
  if (!resolveScenario(name)) {
    console.error(`unknown scenario: ${name} (v1-start | v2-start | v2-end)`);
    process.exit(2);
  }
  const db = openDb();
  const seed = resetDb(db, name);
  console.log(`reset '${seed.scenario}': ${seed.transactions.length} transactions, balance ${seed.account.balance}`);
  db.close();
}
