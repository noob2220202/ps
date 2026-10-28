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
    mini_account_no TEXT NOT NULL,
    card_last4      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('mini', 'main', 'external')),
    bank_code  TEXT,                       -- 다른 은행 계좌일 때만 (kb, shinhan, ...)
    number     TEXT,                       -- 계좌번호 (하이픈 포함)
    balance    INTEGER NOT NULL DEFAULT 0, -- 원 단위 정수 (돈은 소수점 없이!)
    badge      TEXT,
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
`);

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

export function seed() {
  transaction(() => {
    db.exec("DELETE FROM transactions; DELETE FROM accounts; DELETE FROM profile; DELETE FROM sqlite_sequence;");
    db.prepare("INSERT INTO profile VALUES (1, ?, ?, ?)").run("홍길동", "0000-00-0000000", "0000");
    const acc = db.prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, badge, sort) VALUES (?, ?, ?, ?, ?, ?, ?)");
    acc.run("mini", "mini", null, null, 0, null, 0);
    acc.run("main", "main", null, "3333-00-0000000", 500000, "한도계좌", 1);
    acc.run("nh", "external", "nh", "302-0000-0000-00", 0, null, 2);
    const tx = db.prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES ('main', ?, ?, ?, ?)");
    for (const row of SEED_TX) tx.run(...row);
  });
}

// 처음 실행이면 초기 데이터 넣기
if (!db.prepare("SELECT 1 FROM profile").get()) seed();
