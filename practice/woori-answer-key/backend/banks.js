'use strict';
// 금융회사 목록 + 추천 은행 칩 재생표.
//
// 그리드 순서 = v2 '금융회사를 선택해 주세요' 시트 [은행] 탭 3열 그리드 (v2 71.965–72.467, #2765–#2773, ledger 9절).
// 영상에는 7줄(21곳)만 보이고 목록을 스크롤하지 않았다 → 그 아래 은행은 지어내지 않는다. [증권사] 탭은 누르지 않아 비어 있다.
//
// 필드
//   name   그리드 이름 ('우리은행', '농협은행', 'iM뱅크(대구)')
//   short  짧은 이름 — 추천 칩('카카오뱅크', '한국씨티', '수협', '농협', '국민', '우리'), 받는 계좌 줄('지역농축협 12345652789012')
//   prefix 이 앱에서 이체한 출금 행의 거래내역 표시 이름 앞말. 영상: 지역농축협 → '농협정우진', 카카오뱅크 → '카카정우진' (붙여 씀).
//          나머지는 설계값 = 짧은 이름 앞 두 글자 (prefixSrc 'design')
//   logo   프론트 에셋 이름 (inventory assets: bank-woori … bank-cu). 한국씨티는 칩 글자만 보였고 로고 에셋이 없다 → null
//   inGrid 그리드 21곳에 있는지. 지역농축협(최근입금계좌·조회 결과)·한국씨티(추천 칩)는 그리드에 안 보였다.

const BANKS = [
  // code, name, short, prefix, prefixSrc, logo, kftc, inGrid
  ['WOORI', '우리은행', '우리', '우리', 'design', 'bank-woori', '020', true],
  ['NH', '농협은행', '농협', '농협', 'design', 'bank-nh', '011', true],
  ['KB', '국민은행', '국민', '국민', 'design', 'bank-kb', '004', true],
  ['KAKAO', '카카오뱅크', '카카오뱅크', '카카', 'video', 'bank-kakao', '090', true],
  ['SHINHAN', '신한은행', '신한', '신한', 'design', 'bank-shinhan', '088', true],
  ['HANA', '하나은행', '하나', '하나', 'design', 'bank-hana', '081', true],
  ['IBK', '기업은행', '기업', '기업', 'design', 'bank-ibk', '003', true],
  ['TOSS', '토스뱅크', '토스뱅크', '토스', 'design', 'bank-toss', '092', true],
  ['MG', '새마을금고', '새마을금고', '새마', 'design', 'bank-kfcc', '045', true],
  ['KBANK', '케이뱅크', '케이뱅크', '케이', 'design', 'bank-kbank', '089', true],
  ['IM', 'iM뱅크(대구)', 'iM뱅크', 'iM', 'design', 'bank-im', '031', true],
  ['BUSAN', '부산은행', '부산', '부산', 'design', 'bank-busan', '032', true],
  ['SC', 'SC제일은행', 'SC제일', 'SC', 'design', 'bank-sc', '023', true],
  ['KN', '경남은행', '경남', '경남', 'design', 'bank-kyongnam', '039', true],
  ['KJ', '광주은행', '광주', '광주', 'design', 'bank-kwangju', '034', true],
  ['DEUTSCHE', '도이치은행', '도이치', '도이', 'design', 'bank-deutsche', '055', true],
  ['SANLIM', '산림조합', '산림조합', '산림', 'design', 'bank-nfcf', '064', true],
  ['KDB', '산업은행', '산업', '산업', 'design', 'bank-kdb', '002', true],
  ['SH', '수협은행', '수협', '수협', 'design', 'bank-suhyup', '007', true],
  ['SHC', '수협중앙회', '수협중앙회', '수협', 'design', 'bank-suhyup-central', '030', true],
  ['CU', '신협', '신협', '신협', 'design', 'bank-cu', '048', true],
  // ↓ 그리드에 없음
  ['NHLOCAL', '지역농축협', '지역농축협', '농협', 'video', 'bank-nh', '012', false], // 최근입금계좌 '지역농축협', 로고는 농협 마크
  ['CITI', '한국씨티은행', '한국씨티', '씨티', 'design', null, '027', false], // 추천 칩 '한국씨티' 에만 나옴
].map(([code, name, short, prefix, prefixSrc, logo, kftc, inGrid], i) => ({
  code,
  name,
  short,
  prefix,
  prefixSrc,
  logo,
  kftc,
  inGrid,
  sortOrder: i + 1,
}));

const BY_CODE = new Map(BANKS.map((b) => [b.code, b]));

/** 같은 계좌번호 체계를 함께 찾는 묶음: '농협은행'을 골라도 지역농축협 계좌를 찾는다 (하나 답지와 같은 처리) */
const LOOKUP_GROUPS = {
  NH: ['NH', 'NHLOCAL'],
  NHLOCAL: ['NHLOCAL', 'NH'],
};

function getBank(code) {
  return BY_CODE.get(code);
}

function lookupCodes(code) {
  return LOOKUP_GROUPS[code] ?? [code];
}

/**
 * 추천 은행 칩 재생표 (v2 계좌번호 입력, ledger 11절).
 * 칩은 실제 입력 숫자로 정해진 값이라 더미 숫자(3333123456789)와 맞지 않는다 → 계좌번호 규칙을 쓰지 않고
 * "몇 자리 입력한 뒤의 칩" 을 영상 순서 그대로 돌려준다. 자리마다 영상에서 마지막으로 보인 칩 목록.
 *   0–3자리: 없음 (65.207–67.215) · 4: 카카오뱅크·한국씨티 (67.348) · 5: 카카오뱅크·수협·농협 (67.732)
 *   6–9: 카카오뱅크·국민·수협 (68.001, 7·8·9자리에서 안 바뀜) · 10: 우리·카카오뱅크·한국씨티 (69.523)
 *   11: 우리·카카오뱅크·수협 (69.824) · 12: 우리·카카오뱅크·국민 (70.008) · 13: 우리·카카오뱅크·농협 (70.409, 은행 고른 뒤에도 그대로)
 * 14자리 이상은 영상에 없다 → 13자리 목록을 그대로 쓴다 (설계값).
 * 칩 '수협' 은 수협은행(SH) 으로 본다 (칩 글자만으로는 수협중앙회와 구분 안 됨, 설계값).
 */
const SUGGEST_SEQUENCES = {
  v2: [
    [], [], [], [],
    ['KAKAO', 'CITI'],
    ['KAKAO', 'SH', 'NH'],
    ['KAKAO', 'KB', 'SH'],
    ['KAKAO', 'KB', 'SH'],
    ['KAKAO', 'KB', 'SH'],
    ['KAKAO', 'KB', 'SH'],
    ['WOORI', 'KAKAO', 'CITI'],
    ['WOORI', 'KAKAO', 'SH'],
    ['WOORI', 'KAKAO', 'KB'],
    ['WOORI', 'KAKAO', 'NH'],
  ],
};

/**
 * 이 앱에서 한 이체의 거래내역 표시 이름.
 * 영상: 지역농축협 정우진 → '농협정우진', 카카오뱅크 정우진 → '카카정우진' (앞말 + 이름, 붙여 씀. 내 통장표기는 기본값 '정우진').
 * 설계값: 내 통장표기를 기본값(받는 분 예금주)에서 바꾸면 그 글자를 앞말 없이 그대로 쓴다.
 */
function transferDisplayName(bankCode, holderName, myLabel) {
  if (myLabel !== holderName) return myLabel;
  const prefix = getBank(bankCode)?.prefix ?? '';
  return `${prefix}${holderName}`;
}

/** @returns {{code,name,logo}[]} 칩 목록 (name = 짧은 이름) */
function suggestBanks(seq, digits) {
  const table = SUGGEST_SEQUENCES[seq];
  if (!table) return null;
  const codes = table[Math.min(digits, table.length - 1)];
  return codes.map((code) => {
    const b = getBank(code);
    return { code, name: b.short, logo: b.logo };
  });
}

module.exports = { BANKS, getBank, lookupCodes, suggestBanks, transferDisplayName, SUGGEST_SEQUENCES };
