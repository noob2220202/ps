import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// SQLite 데이터베이스. Node 22에 내장된 node:sqlite 를 써서 따로 설치할 게 없다.
// 파일 위치: server/data/bank.db (.gitignore 처리 — 내 데이터는 내 서버에만)
const here = dirname(fileURLToPath(import.meta.url));
const file = process.env.DB_PATH ?? resolve(here, "data/bank.db");
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id              INTEGER PRIMARY KEY CHECK (id = 1),  -- 사용자 1명뿐
    user_name       TEXT NOT NULL,
    card_last4      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('main', 'external')), -- main = 카카오뱅크 3333 통장
    bank_code  TEXT,                       -- 다른 은행 계좌일 때만 (kb, shinhan, ...)
    number     TEXT,                       -- 계좌번호 (하이픈 포함)
    balance    INTEGER NOT NULL DEFAULT 0, -- 원 단위 정수 (돈은 소수점 없이!)
    badge      TEXT,
    safebox    INTEGER NOT NULL DEFAULT 0, -- 세이프박스 (통장 잔액과 따로 보관하는 돈, main만)
    sort       INTEGER NOT NULL DEFAULT 0  -- 홈 화면 표시 순서
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, -- 계좌 지우면 거래도 같이 삭제
    at         TEXT NOT NULL,              -- "2026-10-27T11:37:12"
    merchant   TEXT NOT NULL,
    amount     INTEGER NOT NULL,           -- 출금은 음수
    tag        TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tx_account_at ON transactions (account_id, at DESC);

  -- 받는 분 (🔔 패널에서 미리 등록). 이체할 때 계좌번호를 넣으면 여기서 예금주 이름을 찾는다
  -- (진짜 은행은 금융결제원 망으로 상대 은행에 물어보지만, 여기선 이 표가 "다른 은행들" 역할)
  CREATE TABLE IF NOT EXISTS payees (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_code TEXT NOT NULL,
    number    TEXT NOT NULL,               -- 숫자만 (하이픈 없이)
    holder    TEXT NOT NULL,               -- 예금주
    favorite  INTEGER NOT NULL DEFAULT 0,  -- 최근 이체 목록의 ☆
    UNIQUE (bank_code, number)
  );

  -- 이체 기록. 보낸 쪽 출금 거래(out_tx_id), 내 계좌로 보냈으면 받은 쪽 입금 거래(in_tx_id)와 연결
  CREATE TABLE IF NOT EXISTS transfers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    from_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    bank_code       TEXT NOT NULL,
    number          TEXT NOT NULL,         -- 숫자만
    holder          TEXT NOT NULL,         -- 보낼 당시의 예금주 이름
    amount          INTEGER NOT NULL CHECK (amount > 0),
    memo_to         TEXT,                  -- 받는 분에게 표기
    memo_me         TEXT,                  -- 나에게 표기
    at              TEXT NOT NULL,
    out_tx_id       INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    in_tx_id        INTEGER REFERENCES transactions(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_transfers_at ON transfers (at DESC);
`);

// ---------- 예전 DB 고치기 (마이그레이션) ----------
// 이미 만들어진 bank.db는 CREATE TABLE IF NOT EXISTS 로는 안 바뀐다 → 달라진 점만 직접 반영
const columns = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
if (!columns("accounts").includes("safebox")) db.exec("ALTER TABLE accounts ADD COLUMN safebox INTEGER NOT NULL DEFAULT 0");
if (columns("profile").includes("mini_account_no")) {
  // mini 계좌 삭제: 거래·이체 기록은 ON DELETE CASCADE로 같이 지워지고, mini로 "보낸" 기록만 따로 정리
  const mini = db.prepare("SELECT mini_account_no AS no FROM profile").get();
  if (mini) db.prepare("DELETE FROM transfers WHERE bank_code = 'kakao' AND number = ?").run(mini.no.replace(/\D/g, ""));
  db.exec("DELETE FROM accounts WHERE kind = 'mini'; ALTER TABLE profile DROP COLUMN mini_account_no;");
}
db.exec("UPDATE accounts SET badge = NULL WHERE kind = 'main'"); // 예전 "한도계좌" 뱃지(모임통장 표시) 제거

// 여러 쿼리를 "전부 성공 아니면 전부 취소"로 묶기 (잔액 변경 + 거래 기록이 따로 놀면 안 되니까)
export function transaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// ---------- 초기 데이터 (전부 가상의 예시) ----------
const SEED_TX = [
  ["2026-10-27T12:10:05", "예시편의점", -3000, "#체크카드"],
  ["2026-10-27T09:30:20", "샘플카페", -4500, "#체크카드"],
  ["2026-10-26T18:00:30", "예시통신요금", -20000, "#자동이체"],
  ["2026-10-26T18:00:00", "예시보험", -10000, "#자동이체"],
  ["2026-10-25T19:45:10", "샘플분식", -8000, "#체크카드"],
  ["2026-10-25T13:20:40", "예시배달앱", -15000, "#체크카드"],
  ["2026-10-24T05:00:00", "입출금통장 이자", 10, "#예금이자"],
  ["2026-10-23T20:15:00", "샘플마트", -5000, "#체크카드"],
  ["2026-10-22T21:00:00", "샘플마트", -2000, "#체크카드"],
  ["2026-10-22T16:30:00", "예시스터디카페", -20000, "#체크카드"],
  ["2026-10-22T14:00:30", "예시자판기", -1000, "#체크카드"],
  ["2026-10-22T14:00:10", "예시자판기", -1000, "#체크카드"],
  ["2026-10-22T10:00:00", "예시자판기", -1000, "#체크카드"],
  ["2026-10-21T13:00:00", "샘플서점", -12000, "#체크카드"],
  ["2026-10-21T09:00:00", "예시자판기", -1000, "#체크카드"],
  ["2026-10-20T19:00:00", "예시배달앱", -18000, "#체크카드"],
  ["2026-10-20T08:00:00", "샘플카페", -4500, "#체크카드"],
  ["2026-10-19T16:00:00", "샘플마트", -6000, "#체크카드"],
  ["2026-10-18T12:00:00", "홍길동", 100000, "#이체"],
];

// 받는 분 예시 (전부 가상의 이름/번호)
const SEED_PAYEES = [
  ["nh", "3510000000011", "김민지"],
  ["nh", "3520000000022", "이서준"],
  ["nh", "3560000000033", "박하늘(샘플마트)"],
  ["hana", "12345678901234", "최예시"],
  ["toss", "100000000001", "정테스트"],
  ["shinhan", "110000000001", "한샘플"],
  ["kakao", "3333000000099", "오카카"],
];
// 최근 이체 목록이 비어 있지 않게 예전 이체 몇 건 (입출금통장에서 보냄)
const SEED_TRANSFERS = [
  ["2026-10-24T18:20:00", "nh", "3560000000033", "박하늘(샘플마트)", 23000],
  ["2026-10-25T11:05:00", "nh", "3520000000022", "이서준", 5000],
  ["2026-10-26T20:40:00", "nh", "3510000000011", "김민지", 10000],
];

export function seed() {
  transaction(() => {
    db.exec(
      "DELETE FROM transfers; DELETE FROM payees; DELETE FROM transactions; DELETE FROM accounts; DELETE FROM profile; DELETE FROM sqlite_sequence;",
    );
    db.prepare("INSERT INTO profile (id, user_name, card_last4) VALUES (1, ?, ?)").run("홍길동", "0000");
    const acc = db.prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, safebox, sort) VALUES (?, ?, ?, ?, ?, ?, ?)");
    acc.run("main", "main", null, "3333-00-0000000", 500000, 100000, 1);
    acc.run("nh", "external", "nh", "302-0000-0000-00", 0, 0, 2);
    const tx = db.prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES ('main', ?, ?, ?, ?)");
    for (const row of SEED_TX) tx.run(...row);
    const payee = db.prepare("INSERT INTO payees (bank_code, number, holder) VALUES (?, ?, ?)");
    for (const row of SEED_PAYEES) payee.run(...row);
    const tr = db.prepare(
      "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, at, out_tx_id) VALUES ('main', ?, ?, ?, ?, ?, ?)",
    );
    for (const [at, bank, number, holder, amount] of SEED_TRANSFERS) {
      const out = tx.run(at, holder, -amount, "#이체");
      tr.run(bank, number, holder, amount, at, out.lastInsertRowid);
    }
  });
}

// 처음 실행이면 초기 데이터 넣기
if (!db.prepare("SELECT 1 FROM profile").get()) seed();
