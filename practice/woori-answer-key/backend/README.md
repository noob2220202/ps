# 우리WON뱅킹 클론 답지 — 백엔드

Express 4 + SQLite(`node:sqlite` 내장 `DatabaseSync`, 네이티브 의존성 없음). Node 22.13 이상. 하나 답지(`answer-key/backend`)와 같은 구성·버전
(express 4.22, cors 2.8)을 복사해 우리WON뱅킹용으로 고쳤다 (코드 공유·import 없음).

```bash
npm install
npm start                # http://localhost:4100/api   (WOORI_API_PORT 로 변경)
npm test                 # node --test (메모리 DB·임의 포트 — 4100 을 쓰지 않음)
npm run reset:v1-start   # 파일 DB 를 v1 녹화 시작 상태로 (잔액 345원)
npm run reset:v2-start   # v1 1원 이체 뒤 = v2 녹화 시작 (344원)
npm run reset:v2-end     # v2 2원 이체 뒤 (342원)
```

## 환경 변수

| 이름 | 기본 | 뜻 |
|---|---|---|
| `WOORI_API_PORT` | `4100` | 서버 포트 (Vite 개발 서버 5273 이 `/api` 를 여기로 프록시) |
| `WOORI_DB_PATH` | `backend/woori.db` | SQLite 파일 (gitignore). 비어 있으면 시작할 때 `WOORI_SCENARIO` 로 채운다 |
| `WOORI_SCENARIO` | `v1-start` | 빈 DB 를 처음 채울 시나리오 |
| `WOORI_NOW` | (실제 시각) | 서버 시계 고정 `YYYY-MM-DDTHH:mm:ss` — 예: `2026-11-21T11:09:11` (v1 이체), `2026-11-21T11:17:39` (v2 이체) |
| `WOORI_DISABLE_DEV` | | `1` 이면 `/api/dev/*` 없음 |
| `WOORI_ACCOUNT_PIN` | `1234` | 계좌 비밀번호 더미 값 (리셋할 때 DB 에 들어간다) |
| `WOORI_PRIVACY_JSON` | | 테스트 전용: 저장소 밖 `privacy.json` 경로를 주면 개인정보 grep 검사가 돈다 (아래) |

- 시각은 모두 **로컬 문자열 `YYYY-MM-DDTHH:mm:ss` (Asia/Seoul)**, 시간대 표기 없음. 금액은 원 단위 정수 (하나 답지와 같은 규칙).
- **시계** 우선순위: ① 개발용 덮어쓰기(`POST /api/dev/clock`, `POST /api/dev/reset {now}`) ② `WOORI_NOW` ③ 실제 시각.
  시계가 정하는 것: 조회기간(3개월 = 오늘 − 3개월 ~ 오늘 → 영상 `2026.08.21 ~ 2026.11.21`), 중복 이체 경고의 '오늘'과 'N분 전', 이체 거래시각.
- 녹화·스크린샷은 시계를 영상의 그날로 고정한다: `POST /api/dev/reset {"scenario":"v1-start","now":"video"}` → 시계 11:09:11
  (v1 이체 시각, 중복 경고 "6분 전"), `{"scenario":"v2-start","now":"video"}` → 11:17:39 (v2 이체 시각).

## 더미 값

| 무엇 | 값 |
|---|---|
| 계좌 비밀번호 (4자리) | **`1234`** (`WOORI_ACCOUNT_PIN`) — 영상은 FLAG_SECURE 로 가려져 실제 값과 무관 |
| 내 계좌 | 우리은행 WON 통장 `1002-123-456789` (예금주 정우진, 배지 한도제한) |
| 받는 분 (v1) | 정우진 · 지역농축협 `12345652789012` (최근입금계좌) |
| 받는 분 (v2) | 정우진 · 카카오뱅크 `3333123456789` (계좌번호 직접 입력) |
| 조회 디렉터리에만 있는 계좌 (테스트용) | 신한 `110987654321` 강다은 · 국민 `56780101876543` 오민재 · 농협은행 `3021987654321` 남궁솔 |

이름·계좌는 모두 스크래치 `privacy.json` 의 더미 (실제 값은 저장소에 없다). 하나 답지 더미(홍길동·김철수·박영희)와 겹치지 않는다.

## API

| 메서드 | 경로 | 요청 | 응답 (성공) | 오류 |
|---|---|---|---|---|
| GET | `/api/health` | | `{ok, db, now}` | |
| GET | `/api/accounts` | | `Account[]` | |
| GET | `/api/accounts/:id` | | `Account` | 404 |
| GET | `/api/accounts/:id/transactions` | `?period=thisMonth\|3m\|6m\|1y\|custom&from=&to=&type=all\|in\|out&order=desc\|asc&cursor=&limit=` | `TxPage` | 400, 404 |
| GET | `/api/transactions/:id` | | `TxDetail` (상세 2종 + 설계값) | 404 |
| GET | `/api/accounts/:id/transactions/:txId` | | `TxDetail` (그 계좌 것만) | 404 |
| GET | `/api/recipients` | `?tab=recommend\|frequent\|mine` (기본 recommend) | `Recipient[]` | 400 |
| POST | `/api/recipients/:id/favorite` | `{}` 토글 또는 `{favorite: boolean}` | `Recipient` | 400, 404 |
| DELETE | `/api/recipients/:id` | | `{ok: true}` (최근입금계좌 '편집', 설계값) | 404 |
| GET | `/api/banks` | `?type=bank\|securities` (`&all=1` 이면 그리드 밖 기관까지) | `Bank[]` — 그리드 21곳 순서 | 400 |
| GET | `/api/banks/suggest` | `?digits=<입력 자리수>&seq=v2` (또는 `accountNumber=`) | `{code, name, logo}[]` 추천 은행 칩 | 400 |
| POST | `/api/lookup` | `{bankCode, accountNumber}` | `{holderName, bankCode, bankName, accountNumber, logo, firstTime}` | 400, 404 |
| POST | `/api/transfers/check` | `{fromAccountId, recipientId}` 또는 `{fromAccountId, bankCode, accountNumber}` + `amount` (+ 선택 `recipientLabel`, `myLabel`) | `Ticket` | 400, 404, 422 |
| GET | `/api/transfers/check/:ticket` | | `Ticket` (확인 화면 다시 그리기) | 404 |
| POST | `/api/transfers/password` | `{ticket, pin}` | `{ok: true, ticket, state: 'verified'}` | 400, 404, 409, 422, 423 |
| POST | `/api/transfers` | `{ticket}` (+ 선택 `recipientLabel`, `myLabel`, 개발용 `occurredAt`) | **201** `{transaction: TxItem, balanceAfter, done: Done}` | 400, 403, 404, 409, 422, 423 |
| GET | `/api/transfers/:txId` | | `Done` (완료 화면) | 404 |
| POST | `/api/dev/reset` | `{scenario, now?}` — `now`: `'YYYY-MM-DDTHH:mm:ss'` 또는 `'video'` | `{ok, scenario, balance, transactions, clock, now, source}` | 400 |
| GET/POST | `/api/dev/clock` | POST `{now: 'YYYY-MM-DDTHH:mm:ss' \| null}` | `{now, source: 'override'\|'env'\|'real'}` | 400 |

오류 응답은 항상 `{error: "<한국어 메시지>", code: "<코드>"}` (비밀번호 오류는 `failCount`, `maxFailures` 도).

### 응답 모양

```ts
Account   { id: 1, bank: 'woori', bankCode: 'WOORI', bankName: '우리은행', bankShort: '우리', logo: 'bank-woori',
            product: 'WON 통장', productNoSpace: 'WON통장', number: '1002-123-456789', badge: '한도제한', ownerName: '정우진',
            balance, withdrawable /* 출금가능금액 = 잔액 */, dailyLimit, remainingDailyLimit /* 설계값 */ }

TxPage    { range: {period, from: '2026.08.21', to: '2026.11.21', fromDate, toDate, text: '2026.08.21 ~ 2026.11.21'},
            type, order, labels: {period: '3개월', type: '전체', order: '최신순'},   // 필터 줄
            limit, total, items: TxItem[], nextCursor: string | null,
            summary: {inSum, outSum, inCount, outCount, design: true} }            // '기간 내 합계' 펼침 (설계값)

TxItem    { id: 'tx-20261121-110240', accountId, occurredAt, displayName: '농협정우진', amount: -1, balanceAfter: 345,
            type: 'in' | 'out', synthetic: boolean,
            display: { dateLine: '11월 21일 · 11:02:40', amount: '-1원', balance: '잔액 345원', amountColor: 'black' | 'blue', month: '2026년 11월' } }

TxDetail  { id, accountId, kind: 'deposit' | 'withdraw-transfer' | 'withdraw', type, displayName, amount, occurredAt, balanceAfter,
            code /* 거래구분 */, requester /* 의뢰인 */, recipient: {name, bankCode, bankName, accountNumber, logo} | null,
            recipientLabel, myLabel, receipt /* 이체확인증 */, chequeAmount, fee, branch /* 관리점 */, memo: null,
            synthetic, detailSrc: 'video' | 'rule',
            display: { pageTitle: '거래내역 상세', title, amount: '+100,000원', amountColor,
                       fields: {key, label, value, sub?, placeholder?, link?, button?}[], search: "'한지호' 검색하기", buttons: ['공유', '확인'] } }

Recipient { id, name, bankCode, bankName /* 짧은 이름 '지역농축협' */, accountNumber, logo, date: '2026.11.21', lastUsedAt, favorite }

Bank      { code, name /* 그리드 '농협은행' */, short /* 칩 '농협' */, logo /* 'bank-nh' */, order, kftc, inGrid, prefix, prefixSrc }

Ticket    { ticket: 'tk-000001', state: 'checked' | 'verified' | 'done' | 'locked', fromAccountId,
            from: {bankCode, bankName: '우리은행', bankShort: '우리', product: 'WON통장', number, logo},
            to: {name, bankCode, bankName, accountNumber, logo}, holderName, amount, fee: 0, recipientLabel, myLabel,
            displayName /* 거래내역에 생길 이름 */, firstTime, duplicate: {minutesAgo, secondsAgo, at, transactionId, text: '6분 전'} | null,
            withdrawable, checkedAt, transactionId /* done 뒤 */,
            display: {amount: '1원', confirmTo: '정우진 님에게', confirmAmount: '1원을 이체하시겠어요?',
                      confirmSub: '지역농축협 12345652789012 계좌로 보냅니다.', fee: '면제', footnote: '인증서 비밀번호 입력 없이 바로 이체됩니다.',
                      duplicateTitle: '오늘 같은 내용으로 보냈어요!\n한 번 더 보낼까요?' | null, duplicateAgo: '6분 전' | null,
                      firstTimeChip: '처음 보내는 계좌예요. 사기의심조회' | null} }

Done      { transactionId, occurredAt, holderName, to: {name, bankCode, bankName, accountNumber, logo}, amount, fee, recipientLabel, myLabel,
            memo: null, receipt: true, balanceAfter, recipientId, favorite,
            display: {title: '정우진 님에게\n이체했어요', account: '지역농축협 12345652789012', amount: '1원'} }
```

### 거래내역 목록 (`GET /api/accounts/:id/transactions`)

- 기간: `period` 기본 `3m`(오늘 − 3개월 ~ 오늘, 그 달에 같은 날이 없으면 말일). `thisMonth` = 이번달 1일 ~ 오늘, `6m`, `1y`,
  `custom` = `from`, `to` (`YYYY-MM-DD` 또는 `YYYY.MM.DD`, 둘 다 포함). `period` 없이 `from`/`to` 만 주면 `custom`.
- 거래구분 `type`: `all`(전체) · `in`(입금, 금액 > 0) · `out`(출금, 금액 < 0). 정렬 `order`: `desc`(최신순, 영상) · `asc`(과거순, 설계값).
- 정렬 키는 `(occurredAt, seq)` — 같은 초면 나중에 넣은 거래가 위. 페이지: `limit` 기본 30 (1~200), `nextCursor` 를 `cursor` 로 그대로 넘긴다
  (다른 정렬의 커서는 400 `INVALID_CURSOR`). 영상에 아래쪽 로딩 표시가 없으므로 프론트는 끝에 닿기 전에 미리 다음 페이지를 받는다.
- 월 머리글('2026년 11월')·날짜가 바뀌는 곳의 구분선은 프론트가 `items` 로 만든다 (`display.month` 가 바뀌는 곳).
- `summary` = 기간 전체(거래구분 무관) 입금·출금 합계 — 영상에서 '기간 내 합계 ⌄' 는 늘 접혀 있어 숫자가 없다 → **설계값**.

### 표시 규칙 (ledger 의 실제 표기)

- 날짜 줄 `'11월 21일 · 11:02:40'` (월·일 앞 0 없음, 시각 2자리) · 금액 `'+100,000원'` (입금, 파랑) / `'-1원'` (출금, 검정) · 잔액 줄 `'잔액 345원'`.
- 이 앱에서 한 이체의 표시 이름 = **받는 기관 앞말 + 예금주, 붙여 씀**: 지역농축협 → `'농협정우진'`, 카카오뱅크 → `'카카정우진'` (영상).
  그 밖의 기관 앞말은 설계값(짧은 이름 앞 두 글자, `Bank.prefixSrc: 'design'`). 내 통장표기를 기본값(예금주)에서 바꾸면 그 글자를 앞말 없이 쓴다 (설계값).
- 그 밖의 행 이름은 영상 그대로: `'토뱅 정우진'`·`'토스 정우진'`·`'토스 정우진_'`(띄어 씀), 잘린 모양 `'토스 유하은('`·`'토스 (주)앤'`, 회사 이름(카카오페이, 삼성월렛머니 …).
- 계좌번호: 우리은행 13자리 `1002-123-456789` (4-3-6), 다른 기관은 영상처럼 숫자만 (`12345652789012`, `3333123456789`).
- 상세 필드 순서 (`display.fields`):
  - 입금 (영상 ①, 한지호 +100,000원): 메모입력 · 거래일시 `2026.11.20 21:29:47` · 거래구분 `0543` · 거래후 잔액 · 의뢰인 · 수표금액 `0원` · 관리점 `플랫폼사업부`
  - 이체 (영상 ②, 농협정우진 -1원): 메모입력 · 거래일시 · 받는 분 `정우진` / `지역농축협 12345652789012` (두 줄) · 받는 분 통장표기 · 이체확인증 [보기] ·
    거래구분 `모바일` · 거래후 잔액 · 수표금액 · 관리점 `디지털영업부`
  - 그 밖의 출금 (영상에 없음, 설계값): 메모입력 · 거래일시 · 거래구분 · 거래후 잔액 · 수표금액 · 관리점
  - 상세가 영상에 나온 행은 위 2건뿐 (`detailSrc: 'video'`). 나머지 행은 같은 종류 상세의 값(거래구분·관리점)을 그대로 쓴 **설계값** (`detailSrc: 'rule'`).
  - 메모: 영상의 어느 거래에도 없다 → `memo: null`, 자리표시 '메모를 입력해 보세요'.

### 계좌 조회 · 금융회사 · 추천 칩

- `GET /api/banks` 그리드 21곳 = v2 '금융회사를 선택해 주세요' [은행] 탭 순서 (우리은행 · 농협은행 · 국민은행 / 카카오뱅크 · 신한은행 · 하나은행 / … / 수협은행 · 수협중앙회 · 신협).
  영상은 7줄까지만 보였고 스크롤하지 않았다 → 그 아래 은행은 없다. `type=securities` 는 빈 배열 ([증권사] 탭은 누르지 않음).
  그리드 밖 기관(`all=1`): 지역농축협(`NHLOCAL`, 최근입금계좌·조회 결과, 로고는 농협 마크), 한국씨티(`CITI`, 추천 칩에만 나옴, 로고 = 추천 칩에서 딴 그림 `bank-citi`).
- `logo` 는 프론트 에셋 이름 (inventory assets `bank-woori` … `bank-cu`).
- `POST /api/lookup`: '농협은행'(`NH`)을 골라도 지역농축협 계좌면 실제 기관 `NHLOCAL` 로 바뀐다 (하나 답지와 같은 처리).
  `firstTime` = 이 앱으로 그 (기관, 계좌)에 보낸 적이 없음 → '처음 보내는 계좌예요. 사기의심조회' 칩 (v2 카카오뱅크 = true, v1 지역농축협 = false).
- `GET /api/banks/suggest`: 칩은 실제 입력 숫자로 정해진 값이라 더미 숫자와 맞지 않는다 → 계좌번호 규칙 없이 **자리수 → 영상의 칩 목록**을 그대로 준다 (ledger 11절).

  | 자리수 | 칩 |
  |---|---|
  | 0–3 | (없음) |
  | 4 | 카카오뱅크 · 한국씨티 |
  | 5 | 카카오뱅크 · 수협 · 농협 |
  | 6–9 | 카카오뱅크 · 국민 · 수협 |
  | 10 | 우리 · 카카오뱅크 · 한국씨티 |
  | 11 | 우리 · 카카오뱅크 · 수협 |
  | 12 | 우리 · 카카오뱅크 · 국민 |
  | 13 (이상, 설계값) | 우리 · 카카오뱅크 · 농협 |

  칩이 바뀌는 지연(글자 입력 뒤 ≈0.08–0.13초)과 아이콘 페이드는 프론트 몫 (timeline-v2). 칩 '수협' = 수협은행(`SH`)으로 본다 (설계값).

### 이체 흐름

1. `POST /api/transfers/check` ([다음]) — 받는 계좌·금액 검사 후 `ticket` 을 만든다.
   - **중복 이체 경고**: 오늘(시계 날짜) 같은 출금 계좌 → 같은 받는 (기관, 계좌)로 **같은 금액**을 이 앱에서 보낸 적이 있으면 가장 최근 것의
     `duplicate: {minutesAgo, secondsAgo, at, transactionId, text}`. `minutesAgo` 는 내림: v1 은 11:02:40 → 11:09:11 = 6분 31초 → `'6분 전'`.
     1분 미만 `'방금 전'`, 60분 이상 `'N시간 전'` 은 설계값. v2(카카오뱅크 2원)는 `null`.
   - 받는 분 통장표기 기본값 = 보내는 사람(출금 계좌 예금주), 내 통장표기 기본값 = 받는 분 예금주 (영상은 둘 다 '정우진').
2. `POST /api/transfers/password` — 계좌 비밀번호 4자리 (`1234`). 틀리면 422 `WRONG_PIN` (`failCount`/5), 5번 틀리면 이 ticket 은 423 `PIN_LOCKED` (설계값).
3. `POST /api/transfers` — `BEGIN IMMEDIATE … COMMIT` 안에서: 잔액·한도 다시 검사 → 잔액 감소 → 출금 거래 추가 → 최근입금계좌 upsert → ticket `done`.
   어느 단계든 실패하면 `ROLLBACK` (ticket 은 `verified` 로 남아 다시 실행할 수 있다).
   - 거래시각 = 시계. 시계가 마지막 거래보다 이르면 마지막 거래 시각으로 맞춘다 (잔액 연결 보호, 같은 시각이면 나중 거래가 위).
     개발/테스트용 본문 `occurredAt` 은 마지막 거래보다 이르면 400.
   - 거래 id = `tx-YYYYMMDD-HHMMSS`, 같은 초에 이미 있으면 `-2`, `-3` … (시계를 고정한 채 여러 번 보낼 때).
4. `GET /api/transfers/:txId` — 완료 화면 (`정우진 님에게 / 이체했어요`, 받는 계좌, 이체금액, 메모 자리, 이체확인증, ☆).

| 조건 | 상태 | code |
|---|---|---|
| 본문/기관/계좌번호 형식 | 400 | `INVALID_BODY` / `INVALID_BANK` / `INVALID_ACCOUNT_NUMBER` |
| `fromAccountId` · `recipientId` 형식 | 400 | `INVALID_FROM_ACCOUNT` · `INVALID_RECIPIENT` |
| `amount` 가 1 이상 정수(number)가 아님 | 400 | `INVALID_AMOUNT` |
| 통장표기가 문자열이 아니거나 20자 초과 (설계값) | 400 | `INVALID_LABEL` |
| 출금 계좌 · 받는 분 · 받는 계좌 없음 | 404 | `FROM_ACCOUNT_NOT_FOUND` · `RECIPIENT_NOT_FOUND` · `ACCOUNT_NOT_FOUND` |
| 출금 계좌 = 받는 계좌 | 400 | `SAME_ACCOUNT` |
| 금액 > 잔액 (검사·실행 모두) | 422 | `INSUFFICIENT_BALANCE` |
| 한도제한: 그날 이 앱의 이체 합 + 금액 > 1,000,000원 (설계값) | 422 | `DAILY_LIMIT_EXCEEDED` |
| ticket 없음 / 형식 | 404 / 400 | `TICKET_NOT_FOUND` / `INVALID_TICKET` |
| 비밀번호 형식 · 틀림 · 5번 틀림 | 400 · 422 · 423 | `INVALID_PIN` · `WRONG_PIN` · `PIN_LOCKED` |
| 비밀번호 전에 실행 | 403 | `PIN_REQUIRED` |
| 이미 실행한 ticket | 409 | `TICKET_USED` |

## 시드 데이터

출처: 스크래치 `ledger.json` (두 영상 거래내역 전사, 이름·계좌는 privacy.json 더미). 금액·잔액·날짜·시각·회사 이름은 영상 그대로.
`seed.js` 가 시드를 만들 때 **영상에 보인 잔액과 하나라도 다르면, 잔액이 끊기면, 지어낸 행이 영상 범위 안에 들어가면 throw** 한다.
거래 행의 `source`: `video`(영상 84건) · `synthetic`(지어낸 22건) · `app`(앱에서 이체).

### 시나리오 (`POST /api/dev/reset {scenario}`)

| 시나리오 | 별칭 | 의미 | 잔액 | 거래 | 맨 위 행 | 최근입금계좌 | `now:'video'` |
|---|---|---|---|---|---|---|---|
| `v1-start` | `v1` | v1 녹화 시작 (11:02:40 녹화 전 1원 이체까지) | 345 | 104 | 11/21 11:02:40 농협정우진 -1원 | 정우진·지역농축협 (11:02:40) | 11:09:11 |
| `v2-start` | `v1-end`, `v2` | v1 1원 이체(11:09:11) 뒤 = v2 녹화 시작 | 344 | 105 | 11/21 11:09:11 농협정우진 -1원 | 정우진·지역농축협 (11:09:11) | 11:17:39 |
| `v2-end` | | v2 2원 이체(11:17:39) 뒤 | 342 | 106 | 11/21 11:17:39 카카정우진 -2원 | + 정우진·카카오뱅크 (11:17:39, 맨 위) | 11:17:39 |

- `v1-start` 에서 영상과 같은 이체(최근입금계좌 1행에 1원, 시계 11:09:11)를 하면 `v2-start` 와, `v2-start` 에서 영상과 같은 이체
  (카카오뱅크 3333123456789 에 2원, 11:17:39)를 하면 `v2-end` 와 **API 결과가 완전히 같다** (테스트).
- 리셋은 결정적이고 이체·즐겨찾기·삭제·ticket·시계 덮어쓰기를 모두 되돌린다 (`now` 를 주면 그 시각으로 다시 고정).
- 녹화 사이(v1 끝 → v2 시작)에 거래내역 필터가 '출금' 으로 바뀌어 있었던 것은 화면 상태라 백엔드와 무관 (v2 시작 URL `/history?type=out`).

### 영상에 보인 거래 84건 (입금 26 · 출금 58)

ledger 3절 표 그대로 (`seed.js` `ROWS` 의 `dep`/`wd`/`xfer` 행, 줄 끝 주석 = 처음 다 보인 영상·세션·시각).
영상이 보여 준 범위: 전체 목록 11/21 ~ **11/18 13:24:42** (v1 A1, 27행), 입금 목록 11/20 ~ **11/12 23:23:13** (v1 D3, 26행),
출금 목록 11/21 ~ **10/8 14:24:56** (v1 W1, 56행) + '2026년 9월' 머리글. 이 범위의 목록은 지어낸 행 없이 영상 순서 그대로다 (테스트).

### 지어낸 행 22건 (`synthetic: true`)

잔액이 모든 행에서 이어지도록 꼭 필요한 곳에만 넣었다 (BRIEF D7). 시각은 영상이 보여 준 범위 밖으로만:
지어낸 입금은 11/12 23:23:13 보다 이전, 지어낸 출금은 10/8 14:24:56 보다 이전 (`VISIBLE_FROM`, 시드 생성 때 검사).
끊김을 메우는 입금은 앞뒤 거래 사이, 대개 다음 출금 1~2분 전에 두었다. 이름은 영상의 본인 이체 모양을 따라 '정우진'.
시작 잔액(9/5 첫 행 전)은 92,018원 (잔액 연결로 계산).

| # | 종류 | 시각 | 이름 | 금액 | 거래 후 잔액 | 이유 |
|---|---|---|---|---:|---:|---|
| 1 | c | 2026-09-05 10:21:37 | 삼성월렛머니 | -30,000 | 62,018 | '2026년 9월' 머리글 아래 출금 — 영상에 안 보임 |
| 2 | c | 2026-09-19 13:42:51 | 카카오페이 | -12,000 | 50,018 | 〃 |
| 3 | c | 2026-09-27 21:14:05 | 토뱅 정우진 | -50,000 | 18 | 〃 (다음 영상 행 10/8 14:24:56 -1원 → 17원) |
| 4 | a | 2026-10-08 22:45:18 | 정우진 | +4,243,563 | 4,243,580 | 10/8 14:24:56 잔액 17원 → 22:46:52 -1원 → 4,243,579원 |
| 5 | a | 2026-10-10 09:12:44 | 정우진 | +1 | 1,043,580 | 10/9 23:32:59 잔액 1,043,579원 → 10/10 18:04:28 -500,000원 → 543,580원 |
| 6 | a | 2026-10-12 17:36:52 | 정우진 | +50,000 | 50,000 | 10/10 18:48:47 잔액 0원 → 10/12 17:38:40 -50,000원 → 0원 |
| 7 | a | 2026-10-12 17:39:05 | 정우진 | +50,000 | 50,000 | 10/12 17:38:40 잔액 0원 → 17:39:32 -50,000원 → 0원 |
| 8 | a | 2026-10-13 20:27:48 | 정우진 | +100,000 | 100,000 | 10/12 17:39:32 잔액 0원 → 10/13 20:29:36 -100,000원 → 0원 |
| 9 | a | 2026-10-19 00:42:31 | 정우진 | +50,000 | 50,000 | 10/13 20:29:36 잔액 0원 → 10/19 00:44:15 -50,000원 → 0원 |
| 10 | a | 2026-11-06 18:42:09 | 정우진 | +10,041 | 10,041 | 10/19 00:44:15 잔액 0원 → 11/6 18:44:42 -10,000원 → 41원 |
| 11 | a | 2026-11-06 23:24:37 | 정우진 | +20,000 | 20,041 | 11/6 18:44:42 잔액 41원 → 23:26:04 -20,000원 → 41원 |
| 12 | a | 2026-11-07 19:05:12 | 정우진 | +100,000 | 100,041 | 11/6 23:26:04 잔액 41원 → 11/7 19:06:43 -50,000원 → 50,041원 |
| 13 | a | 2026-11-07 19:06:50 | 정우진 | +50,000 | 100,041 | 11/7 19:06:43 잔액 50,041원 → 19:06:58 -50,000원 → 50,041원 |
| 14 | a | 2026-11-07 19:07:05 | 정우진 | +50,000 | 100,041 | 11/7 19:06:58 잔액 50,041원 → 19:07:13 -100,000원 → 41원 |
| 15 | a | 2026-11-07 23:20:41 | 정우진 | +30,000 | 30,041 | 11/7 19:07:13 잔액 41원 → 23:21:56 -30,000원 → 41원 |
| 16 | a | 2026-11-07 23:22:03 | 정우진 | +30,000 | 30,041 | 11/7 23:21:56 잔액 41원 → 23:22:10 -30,000원 → 41원 |
| 17 | a | 2026-11-08 07:51:20 | 정우진 | +50,000 | 50,041 | 11/7 23:22:10 잔액 41원 → 11/8 07:52:43 -50,000원 → 41원 |
| 18 | a | 2026-11-09 19:15:38 | 정우진 | +300,000 | 300,041 | 11/8 07:52:43 잔액 41원 → 11/9 19:17:04 -300,000원 → 41원 |
| 19 | a | 2026-11-11 21:57:02 | 정우진 | +20,000 | 20,041 | 11/9 19:17:04 잔액 41원 → 11/11 21:58:35 -20,000원 → 41원 |
| 20 | a | 2026-11-11 22:55:46 | 정우진 | +1,000 | 1,041 | 11/11 21:58:35 잔액 41원 → 22:57:11 -1,000원 → 41원 |
| 21 | a | 2026-11-12 19:56:19 | 정우진 | +100,000 | 100,041 | 11/11 22:57:11 잔액 41원 → 11/12 19:57:45 -100,000원 → 41원 |
| 22 | b | 2026-11-12 21:47:26 | 정우진 | +20,000 | 20,041 | 입금 목록 맨 아래에 날짜 줄 윗부분만 걸친 '11월 12일' 행 (v1 149.991 #5851, 이름·금액 판독 불가) — 11/12 19:57:45 잔액 41원 → 23:23:13 +30,000원 → 50,041원 |

- (a) 11/12 23:23:13 이전 출금 사이 끊김(ledger 5절 19곳 중 18곳)을 메우는 입금, (b) 19번째 끊김 = 입금 목록 맨 아래 걸친 행, (c) 9월 출금.
- 입금 목록을 끝(11/12 23:23:13)까지 내리면 바로 아래가 #22(11월 12일) — 영상의 '날짜 줄 윗부분' 과 같은 날짜.
- 출금 목록 맨 아래(10/8 14:24:56) 아래 '2026년 9월' 머리글 + #3·#2·#1.

### 최근입금계좌 · 조회 디렉터리

- 최근입금계좌(추천 탭) = 이 앱으로 보낸 적 있는 계좌, 최근순 (`last_used_at DESC, last_tx_seq DESC, id`). 두 영상 모두 정우진 · 지역농축협 1행 (ledger 8절),
  `v2-end` 에서 카카오뱅크가 맨 위에 더해진다. 즐겨찾기 ☆ 는 영상에서 모두 빈 별 → `favorite: false`.
- 자주 탭 = ☆ 한 계좌, 내계좌 탭 = 내 계좌 (둘 다 영상에서 누르지 않음 — 설계값).
- 조회 디렉터리 = 받는 분 두 계좌 + 내 계좌 + 테스트용 세 계좌 (위 '더미 값').

## 설계값 (영상에 없음, 지어냄 — 바꿔도 영상 비교와 무관)

계좌 비밀번호 `1234`와 5회 잠금 · 한도제한 1일 1,000,000원 · 통장표기 20자(앱 편집 시트는 10자로 더 좁힌다) · 다른 기관의 표시 이름 앞말 · 내 통장표기를 바꿨을 때의 표시 이름 ·
'방금 전'/'N시간 전' · 과거순 정렬 · 기간 내 합계 · 영상에 상세가 안 나온 행의 상세 값(`detailSrc: 'rule'`) · 자주/내계좌 탭 · 받는 분 삭제 ·
14자리 이상 추천 칩 · 칩 '수협' = 수협은행 · 증권사 목록(빈 배열) · 테스트용 디렉터리 계좌 3개 · 지어낸 거래 22건.

## 서버 없는 APK (프론트 로컬 모드)

APK(`tools/build-apk.sh`, frontend/README.md 'APK')는 이 폴더의 `app.js`·`routes/*`·`repo.js`·`transfer.js`·`seed.js`·`banks.js`·`clock.js`·`util.js`·`schema.js`
를 **고치지 않고 그대로** 웹뷰 안에 번들해 sql.js(SQLite wasm) 위에서 돌린다 — 같은 스키마·SQL·응답. 그래서 이 모듈들은 Express·node:sqlite 밖에서도
부를 수 있게 둔다: DB 는 `db` 인자(node:sqlite `DatabaseSync` 모양: `exec`·`prepare → run/get/all`, `run()` 의 `changes`·`lastInsertRowid`)로만,
`require('./db')`(node:sqlite)는 `server.js`·테스트·`seed.js` CLI 에서만. 쓰는 Node 전역은 `process.env`(빌드가 `{}`), 거래내역 커서의 `Buffer.from(…, 'base64url')`(로컬 모드가 이 둘만 흉내) 뿐이다.
새 코드에서 다른 Node 전용 API 를 쓰면 로컬 모드가 깨진다 → `node tools/woori-local-check.cjs` 가 실제 서버와 응답을 대조한다.

## 개인정보

- 저장소 파일(코드·시드·README·테스트)에는 더미만 있다. 실제 → 더미 대응표는 저장소 밖 스크래치 `privacy.json` 에만 있다.
- 검사: `WOORI_PRIVACY_JSON=<privacy.json 경로> npm test` → `test/privacy.test.js` 가 backend 의 모든 파일과 세 시나리오 시드 JSON 에서
  `privacy.json` 의 `grep` 목록 문자열을 찾는다 (0건이어야 통과, 맞은 문자열은 출력하지 않고 길이만 보인다). 경로가 없으면 이 테스트만 건너뛴다.

## 파일

| 파일 | 내용 |
|---|---|
| `server.js` | 진입점 (`WOORI_API_PORT`, SIGINT/SIGTERM 에 닫기) |
| `app.js` | `createApp({db, hooks, enableDev})` — 라우트 조립, 오류 → `{error, code}` |
| `schema.js` | 스키마 (banks, accounts, transactions, recipients, directory, tickets, meta) `SCHEMA` + `withTransaction()` — 드라이버와 무관한 순수 모듈 (프론트 로컬 모드도 이것을 쓴다) |
| `db.js` | node:sqlite 로 열기 `openDb()` (+ `SCHEMA`·`withTransaction` 다시 내보냄) |
| `clock.js` | 서버 시계 (덮어쓰기 → `WOORI_NOW` → 실제 시각) |
| `seed.js` | 시드 데이터(영상 84건 + 지어낸 22건), 시나리오, `buildSeed()`, `resetDb()`, `ensureSeeded()`, `node seed.js <시나리오>` |
| `banks.js` | 금융회사 21곳(+2) 순서·짧은 이름·앞말·로고, 추천 칩 재생표, 표시 이름 규칙 |
| `repo.js` | DB 행 → API 모양 (`display` 문자열 포함), 공용 조회 |
| `transfer.js` | 계좌 조회, 이체 검사(중복·처음)·비밀번호·실행(원자적)·완료 정보 |
| `util.js` | 계좌번호·금액·날짜 표시, 날짜 계산, `ApiError` |
| `routes/*.js` | accounts, transactions, recipients, banks, transfers, dev |
| `test/*.test.js` | `node --test` — `seed`(시나리오 잔액·잔액 연결·영상 84건·영상 목록 순서·지어낸 행 규칙·끊김 19곳), `api`(엔드포인트·기간/구분/정렬/커서·상세 2종·칩·조회·리셋/시계), `transfer`(v1·v2 이체 재현 = 다음 시나리오, 중복 경고, 비밀번호, 검증, 한도, 시각, 원자성), `db`(파일 DB, 실제 `server.js` 프로세스와 환경 변수), `privacy`(선택) |
