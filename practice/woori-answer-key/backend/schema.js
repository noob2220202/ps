'use strict';
// 스키마 + 트랜잭션 도우미 — DB 드라이버와 무관한 순수 모듈 (node:sqlite 를 부르지 않는다).
// db.js(node:sqlite, 서버)와 프론트 로컬 모드(sql.js, 서버 없는 APK — frontend/src/WooriLocal.ts)가 같은 스키마·같은 트랜잭션 규칙을 쓴다.
// db 는 node:sqlite DatabaseSync 와 같은 모양(exec, prepare → run/get/all)이면 된다.

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS banks (
    code       TEXT PRIMARY KEY,       -- 'WOORI', 'NH', 'NHLOCAL', 'KAKAO' …
    name       TEXT NOT NULL,          -- 금융회사 그리드 이름 ('우리은행', '농협은행', '카카오뱅크')
    short      TEXT NOT NULL,          -- 짧은 이름 ('우리', '농협', '지역농축협', '카카오뱅크') — 추천 칩·받는 계좌 줄
    prefix     TEXT NOT NULL,          -- 거래내역 표시 이름 앞말 ('농협'+'정우진' = '농협정우진', '카카'+'정우진')
    prefix_src TEXT NOT NULL,          -- 'video' (영상에 나온 앞말) | 'design' (설계값)
    logo       TEXT,                   -- 프론트 에셋 이름 ('bank-nh' …), 없으면 NULL
    kftc       TEXT NOT NULL,
    in_grid    INTEGER NOT NULL,       -- 금융회사 선택 그리드(21곳)에 있는지
    sort_order INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id               INTEGER PRIMARY KEY,
    bank_code        TEXT NOT NULL REFERENCES banks(code),
    account_digits   TEXT NOT NULL UNIQUE,
    product          TEXT NOT NULL,     -- 'WON 통장' (이체 화면 표기는 띄어쓰기 없이 'WON통장')
    owner_name       TEXT NOT NULL,
    badge            TEXT,              -- '한도제한'
    balance          INTEGER NOT NULL CHECK (balance >= 0),
    daily_limit      INTEGER,           -- 한도제한 계좌 1일 이체한도 (원, 설계값), NULL = 제한 없음
    pin              TEXT NOT NULL,     -- 계좌 비밀번호 4자리 (더미, README)
    sort_order       INTEGER NOT NULL
  );

  -- seq: 정렬·커서용 정수 키 (같은 시각이면 나중에 넣은 것이 위). id: 'tx-YYYYMMDD-HHMMSS' (ledger 와 같은 이름)
  CREATE TABLE IF NOT EXISTS transactions (
    seq                  INTEGER PRIMARY KEY,
    id                   TEXT NOT NULL UNIQUE,
    account_id           INTEGER NOT NULL REFERENCES accounts(id),
    occurred_at          TEXT NOT NULL,     -- 로컬 'YYYY-MM-DDTHH:mm:ss'
    display_name         TEXT NOT NULL,     -- 거래내역 목록 글자 ('농협정우진', '토뱅 정우진', '한지호')
    amount               INTEGER NOT NULL,  -- 부호 있음 (출금 음수)
    balance_after        INTEGER NOT NULL,
    kind                 TEXT NOT NULL,     -- 'deposit' | 'transfer' (이 앱의 이체, 받는 분 정보 있음) | 'withdraw' (그 밖의 출금)
    code                 TEXT,              -- 상세 '거래구분' ('0543', '모바일')
    branch               TEXT,              -- 상세 '관리점'
    requester            TEXT,              -- 상세 '의뢰인' (입금)
    counterparty_name    TEXT,              -- 받는 분 예금주 (transfer)
    counterparty_bank    TEXT,              -- 받는 기관 코드 (transfer)
    counterparty_account TEXT,              -- 받는 계좌 숫자 (transfer)
    recipient_label      TEXT,              -- 받는 분 통장표기 (transfer)
    my_label             TEXT,              -- 내 통장표기 (transfer)
    fee                  INTEGER NOT NULL DEFAULT 0,
    cheque_amount        INTEGER NOT NULL DEFAULT 0,
    detail_src           TEXT NOT NULL,     -- 'video' (상세 화면이 영상에 나옴) | 'rule' (같은 종류의 영상 상세를 본뜬 설계값)
    source               TEXT NOT NULL,     -- 'video' (영상에 보인 행) | 'synthetic' (지어낸 행, 잔액 연결용) | 'app' (앱에서 이체)
    note                 TEXT               -- synthetic 행을 넣은 이유
  );
  CREATE INDEX IF NOT EXISTS ix_tx_account_time ON transactions(account_id, occurred_at, seq);

  CREATE TABLE IF NOT EXISTS recipients (
    id             INTEGER PRIMARY KEY,
    name           TEXT NOT NULL,
    bank_code      TEXT NOT NULL REFERENCES banks(code),
    account_digits TEXT NOT NULL,
    last_used_at   TEXT NOT NULL,
    last_tx_seq    INTEGER,             -- 마지막 이체 거래 seq (같은 초 이체는 이걸로 최근순)
    favorite       INTEGER NOT NULL DEFAULT 0,
    source         TEXT NOT NULL,       -- 'video' | 'app'
    UNIQUE (bank_code, account_digits)
  );

  -- 계좌 조회(예금주 확인)용 외부 계좌 디렉터리 (더미)
  CREATE TABLE IF NOT EXISTS directory (
    bank_code      TEXT NOT NULL REFERENCES banks(code),
    account_digits TEXT NOT NULL,
    holder_name    TEXT NOT NULL,
    PRIMARY KEY (bank_code, account_digits)
  );

  -- 이체 검사([다음]) → 비밀번호 → 실행 사이의 표 (리셋하면 지워진다)
  CREATE TABLE IF NOT EXISTS tickets (
    seq             INTEGER PRIMARY KEY,
    ticket          TEXT NOT NULL UNIQUE,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    bank_code       TEXT NOT NULL,
    account_digits  TEXT NOT NULL,
    holder_name     TEXT NOT NULL,
    amount          INTEGER NOT NULL,
    recipient_label TEXT NOT NULL,
    my_label        TEXT NOT NULL,
    first_time      INTEGER NOT NULL,
    dup_tx_id       TEXT,
    dup_seconds     INTEGER,
    state           TEXT NOT NULL,      -- 'checked' → 'verified' (비밀번호 맞음) → 'done' | 'locked' (5번 틀림)
    pin_failures    INTEGER NOT NULL DEFAULT 0,
    checked_at      TEXT NOT NULL,
    tx_seq          INTEGER
  );

  -- 개발용 값 (now_override: POST /api/dev/clock, /api/dev/reset {now})
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`;

/** BEGIN IMMEDIATE … COMMIT, 예외 시 ROLLBACK 후 다시 던진다. */
function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* 이미 롤백됨 */
    }
    throw err;
  }
}

module.exports = { SCHEMA, withTransaction };
