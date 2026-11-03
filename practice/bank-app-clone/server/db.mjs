import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

// SQLite 데이터베이스. Node 22에 내장된 node:sqlite 를 써서 따로 설치할 게 없다.
// 넷플릭스 프로필처럼 프로필마다 DB 파일이 따로 있다 → 계좌·거래·받는 분이 서로 섞이지 않음
//   server/data/app.db             프로필 목록 (이름, 아바타, 갤럭시/아이폰·테마 설정)
//   server/data/profiles/<id>.db   그 프로필의 은행 데이터
// 서버 하나는 앱 하나만: 기본은 카카오뱅크, APP=nh (또는 --app nh) 면 NH 콕뱅크, APP=hana 면 하나원큐, APP=ibk 면 IBK기업은행 i-ONE Bank.
// 콕뱅크·하나·IBK 서버는 데이터 폴더도 따로 (server/data-nh/, data-hana/, data-ibk/ — 프로필 목록부터 전부 따로). 표 모양은 같아서 API는 같이 씀
// (.gitignore 처리 — 내 데이터는 내 서버에만)
// APP=kbank 면 케이뱅크, APP=kbank2 는 같은 케이뱅크 화면에 '녹화 인트로'(녹화 시작 때 실제 기기 홈 화면 → 금융 폴더 → K 아이콘을
// 누르는 영상을 먼저 틀고 시작화면으로 이어 붙임)를 켠 두 번째 서버 — 데이터·계정·포트는 따로 (SERVER_ID = 폴더·쿠키 이름)
export const APPS = ["kakao", "nh", "hana", "ibk", "kbank"];
const appArg = process.argv.indexOf("--app");
export const SERVER_ID = process.env.APP ?? (appArg > 0 ? process.argv[appArg + 1] : "kakao");
export const INTRO = SERVER_ID === "kbank2";
export const APP = INTRO ? "kbank" : SERVER_ID;
if (!APPS.includes(APP)) throw new Error(`APP은 kakao, nh, hana, ibk, kbank, kbank2 중 하나 (지금: ${SERVER_ID})`);
const here = dirname(fileURLToPath(import.meta.url));
export const DATA = process.env.DATA_DIR ?? resolve(here, SERVER_ID === "kakao" ? "data" : `data-${SERVER_ID}`);
mkdirSync(resolve(DATA, "profiles"), { recursive: true });

// ---------- 프로필 목록 ----------
export const registry = new DatabaseSync(resolve(DATA, "app.db"));
registry.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS profiles (
    id         TEXT PRIMARY KEY,           -- "p" + 16진수 8자리 (DB 파일 이름으로도 씀)
    name       TEXT NOT NULL,
    avatar     TEXT NOT NULL,              -- 아바타 그림 이름 (boy, girl, ...)
    color      TEXT NOT NULL,              -- 아바타 배경색
    os         TEXT,                       -- 이 프로필로 마지막에 본 기기 (android / ios)
    theme      TEXT,                       -- light / dark / system
    created_at TEXT NOT NULL
  );
`);

export const AVATARS = ["boy", "girl", "child", "grandma", "wave", "star", "coin", "money-bag"];
export const COLORS = ["#FFE45C", "#BDEBD8", "#CFE3FF", "#FFD3DC", "#E2D9FF", "#FFDCC2"];
export const MAX_PROFILES = Number(process.env.MAX_PROFILES ?? 5); // 개발 중 여러 명이 따로 쓸 땐 환경변수로 늘림
export const newProfileId = () => `p${randomUUID().replaceAll("-", "").slice(0, 8)}`;

// id가 파일 이름이 되므로 형식을 꼭 검사 ("../../etc/passwd" 같은 값으로 다른 파일을 열지 못하게)
export const isProfileId = (id) => typeof id === "string" && /^p[0-9a-f]{8}$/.test(id);
const profileFile = (id) => resolve(DATA, "profiles", `${id}.db`);

// ---------- 프로필별 은행 DB ----------
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS profile (
    id              INTEGER PRIMARY KEY CHECK (id = 1),  -- 사용자 1명뿐
    user_name       TEXT NOT NULL,
    card_last4      TEXT NOT NULL,
    card_spend      INTEGER,                              -- 이번달 쓴 돈 직접 입력값 (NULL이면 체크카드 거래 합계로 자동 계산)
    cashback_count  INTEGER NOT NULL DEFAULT 2            -- "현금 돌려받을 기회 N건"
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
    tag        TEXT NOT NULL,
    kind       TEXT                        -- 거래구분 직접 지정(🔔 관리 패널). 비어 있으면 tag로 기본값 계산
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
    receive_error INTEGER NOT NULL DEFAULT 0, -- i-ONE Bank: 이 계좌로 보내면 받는 은행 오류 안내 (녹화 28초)
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
`;

const opened = new Map(); // 열어 둔 DB 연결 재사용 (요청마다 파일을 열면 느림)

export function profileDb(id) {
  if (!isProfileId(id)) throw new Error(`bad profile: ${id}`);
  let d = opened.get(id);
  if (!d) {
    d = new DatabaseSync(profileFile(id));
    d.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    d.exec(SCHEMA);
    migrate(d);
    d.app = APP; // 어느 앱 DB인지 (송금 한도 등 앱마다 다른 규칙에 씀)
    opened.set(id, d);
  }
  return d;
}

export function removeProfileDb(id) {
  if (!isProfileId(id)) return;
  opened.get(id)?.close();
  opened.delete(id);
  for (const ext of ["", "-wal", "-shm"]) rmSync(profileFile(id) + ext, { force: true });
}

// 지금 요청이 쓰는 DB. 서버가 요청마다 runWithDb(그 프로필 DB, ...)로 감싸 두면
// 그 안에서 부르는 함수들은 db()만 쓰면 된다 (함수마다 db를 인자로 넘기지 않아도 됨)
const current = new AsyncLocalStorage();
export const runWithDb = (d, fn) => current.run(d, fn);
export function db() {
  const d = current.getStore();
  if (!d) throw new Error("프로필 DB 없이 db()를 불렀어요");
  return d;
}

// ---------- 예전 DB 고치기 (마이그레이션) ----------
// 이미 만들어진 DB 파일은 CREATE TABLE IF NOT EXISTS 로는 안 바뀐다 → 달라진 점만 직접 반영
function migrate(d) {
  const columns = (table) => d.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!columns("accounts").includes("name")) d.exec("ALTER TABLE accounts ADD COLUMN name TEXT"); // 상품 이름 (콕뱅크 "자립예탁금")
  if (!columns("transactions").includes("memo")) d.exec("ALTER TABLE transactions ADD COLUMN memo TEXT"); // 콕뱅크 거래메모
  if (!columns("transactions").includes("kind")) d.exec("ALTER TABLE transactions ADD COLUMN kind TEXT"); // 🔔 패널에서 거래구분 직접 지정
  if (!columns("profile").includes("card_spend")) d.exec("ALTER TABLE profile ADD COLUMN card_spend INTEGER");
  if (!columns("profile").includes("cashback_count")) d.exec("ALTER TABLE profile ADD COLUMN cashback_count INTEGER NOT NULL DEFAULT 2");
  if (!columns("accounts").includes("safebox")) d.exec("ALTER TABLE accounts ADD COLUMN safebox INTEGER NOT NULL DEFAULT 0");
  if (!columns("payees").includes("receive_error")) d.exec("ALTER TABLE payees ADD COLUMN receive_error INTEGER NOT NULL DEFAULT 0");
  if (columns("profile").includes("mini_account_no")) {
    // mini 계좌 삭제: 거래·이체 기록은 ON DELETE CASCADE로 같이 지워지고, mini로 "보낸" 기록만 따로 정리
    const mini = d.prepare("SELECT mini_account_no AS no FROM profile").get();
    if (mini) d.prepare("DELETE FROM transfers WHERE bank_code = 'kakao' AND number = ?").run(mini.no.replace(/\D/g, ""));
    d.exec("DELETE FROM accounts WHERE kind = 'mini'; ALTER TABLE profile DROP COLUMN mini_account_no;");
  }
  d.exec("UPDATE accounts SET badge = NULL WHERE kind = 'main'"); // 예전 "한도계좌" 뱃지(모임통장 표시) 제거
}

// 여러 쿼리를 "전부 성공 아니면 전부 취소"로 묶기 (잔액 변경 + 거래 기록이 따로 놀면 안 되니까)
export function transaction(fn, d = db()) {
  d.exec("BEGIN");
  try {
    const result = fn();
    d.exec("COMMIT");
    return result;
  } catch (e) {
    d.exec("ROLLBACK");
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

const wipe = (d) =>
  d.exec(
    "DELETE FROM transfers; DELETE FROM payees; DELETE FROM transactions; DELETE FROM accounts; DELETE FROM profile; DELETE FROM sqlite_sequence;",
  );

// 예시 데이터: 홍길동 + 거래 19건 + 받는 분 7명 + 예전 이체 3건
export function seedExample(d) {
  transaction(() => {
    wipe(d);
    d.prepare("INSERT INTO profile (id, user_name, card_last4) VALUES (1, ?, ?)").run("홍길동", "0000");
    const acc = d.prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, safebox, sort) VALUES (?, ?, ?, ?, ?, ?, ?)");
    acc.run("main", "main", null, "3333-00-0000000", 500000, 100000, 1);
    acc.run("nh", "external", "nh", "302-0000-0000-00", 0, 0, 2);
    const tx = d.prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES ('main', ?, ?, ?, ?)");
    for (const row of SEED_TX) tx.run(...row);
    const payee = d.prepare("INSERT INTO payees (bank_code, number, holder) VALUES (?, ?, ?)");
    for (const row of SEED_PAYEES) payee.run(...row);
    const tr = d.prepare(
      "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, at, out_tx_id) VALUES ('main', ?, ?, ?, ?, ?, ?)",
    );
    for (const [at, bank, number, holder, amount] of SEED_TRANSFERS) {
      const out = tx.run(at, holder, -amount, "#이체");
      tr.run(bank, number, holder, amount, at, out.lastInsertRowid);
    }
  }, d);
}

// 빈 상태: 카카오뱅크 통장 0원 하나만 (새 프로필은 이걸로 시작)
export function seedEmpty(d, userName) {
  transaction(() => {
    wipe(d);
    d.prepare("INSERT INTO profile (id, user_name, card_last4) VALUES (1, ?, ?)").run(userName, "0000");
    d.prepare("INSERT INTO accounts (id, kind, number, balance, safebox, sort) VALUES ('main', 'main', ?, 0, 0, 1)").run("3333-00-0000000");
  }, d);
}

// ---------- NH 콕뱅크 초기 데이터 (전부 가상) ----------
const NH_NUMBER = "352-0000-0000-01"; // 내 자립예탁금 (농축협)
const NH_PAYEES = [
  ["kakao", "7777000000001", "김카카(미니)", 0],
  ["nh", "50500052000011", "이농협", 0],
  ["nh", "3550000000022", "주식회사 예시상품권", 0],
  ["shinhan", "140000000001", "정신한", 0],
  ["nh", "6370000000033", "장농협", 0],
  ["woori", "1002000000044", "김우리", 0],
  ["toss", "190000000055", "박토스", 0],
  ["hana", "58700000000011", "최하나", 1],
];
// [시각, 은행, 번호, 이름, 금액] — 최근송금 목록용 예전 송금
const NH_TRANSFERS = [
  ["2025-05-14 08:11:48", "toss", "190000000055", "박토스", 1000],
  ["2025-05-18 13:23:18", "woori", "1002000000044", "김우리", 1000],
  ["2025-05-18 16:20:54", "nh", "6370000000033", "장농협", 1000],
  ["2025-05-21 17:43:31", "shinhan", "140000000001", "정신한", 1000],
  ["2025-05-22 18:28:22", "nh", "3550000000022", "주식회사 예시상품권", 1000],
  ["2025-05-23 06:57:13", "nh", "50500052000011", "이농협", 1000],
  ["2025-05-25 20:45:47", "kakao", "7777000000001", "김카카(미니)", 1000],
];
const NH_TX = [
  ["2025-05-01T09:00:00", "홍길동", 30000, "#이체"],
  ["2026-10-20T10:00:00", "홍길동", 50000, "#이체"],
  ["2026-10-22T19:12:40", "예시마트", -12000, "#체크카드"],
  ["2026-10-25T21:03:11", "김우리", -15000, "#이체"],
];

const nhBase = (d, userName, balance) => {
  wipe(d);
  d.prepare("INSERT INTO profile (id, user_name, card_last4) VALUES (1, ?, ?)").run(userName, "0000");
  d.prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, name, sort) VALUES ('main', 'main', 'nh', ?, ?, '자립예탁금', 1)").run(
    NH_NUMBER,
    balance,
  );
};

export function seedNhExample(d, userName = "홍길동") {
  transaction(() => {
    nhBase(d, userName, 46000);
    const tx = d.prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES ('main', ?, ?, ?, ?)");
    for (const row of NH_TX) tx.run(...row);
    const payee = d.prepare("INSERT INTO payees (bank_code, number, holder, favorite) VALUES (?, ?, ?, ?)");
    for (const row of NH_PAYEES) payee.run(...row);
    const tr = d.prepare(
      "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, at, out_tx_id) VALUES ('main', ?, ?, ?, ?, ?, ?)",
    );
    for (const [at, bank, number, holder, amount] of NH_TRANSFERS) {
      const iso = at.replace(" ", "T");
      tr.run(bank, number, holder, amount, iso, tx.run(iso, holder, -amount, "#이체").lastInsertRowid);
    }
  }, d);
}

export function seedNhEmpty(d, userName) {
  transaction(() => nhBase(d, userName, 0), d);
}

// ---------- 하나원큐 초기 데이터 (전부 가상) ----------
const HANA_NUMBER = "123-910000-12345"; // 내 영하나플러스통장
const HANA_PAYEES = [
  ["nh", "3520000000022", "이서준", 0],
  ["kakao", "7777000000001", "김민지(미니)", 0],
  ["hana", "12300000011111", "박하늘", 0],
  ["kakao", "3333000000099", "오카카", 0],
  ["hana", "12300000022222", "박하늘", 0],
  ["shinhyup", "137000000510", "정신협", 0],
];
// [시각, 은행, 번호, 이름, 금액] — 이체 '최근' 목록용 예전 이체
const HANA_TRANSFERS = [
  ["2026-09-10 12:10:00", "shinhyup", "137000000510", "정신협", 10000],
  ["2026-10-20 09:30:00", "hana", "12300000022222", "박하늘", 5000],
  ["2026-10-23 19:02:00", "kakao", "3333000000099", "오카카", 3000],
  ["2026-10-27 08:15:00", "hana", "12300000011111", "박하늘", 5000],
  ["2026-10-28 21:45:10", "kakao", "7777000000001", "김민지(미니)", 1000],
  ["2026-10-29 18:06:14", "nh", "3520000000022", "이서준", 1000],
];
const HANA_TX = [
  ["2026-10-01T09:00:00", "홍길동", 100000, "#이체"],
  ["2026-10-24T13:27:06", "예시음료자판기", -1500, "#체크카드"],
  ["2026-10-24T14:37:29", "예시음료자판기", -800, "#체크카드"],
  ["2026-10-25T14:38:06", "예시음료자판기", -800, "#체크카드"],
  ["2026-10-26T18:21:01", "샘플마트", -2990, "#체크카드"],
  ["2026-10-28T21:46:51", "김민지", 1000, "#이체"],
  ["2026-10-29T18:23:11", "예시배달앱", -12850, "#체크카드"],
];

const hanaBase = (d, userName, balance) => {
  wipe(d);
  d.prepare("INSERT INTO profile (id, user_name, card_last4) VALUES (1, ?, ?)").run(userName, "0000");
  d.prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, name, sort) VALUES ('main', 'main', 'hana', ?, ?, '영하나플러스통장', 1)").run(
    HANA_NUMBER,
    balance,
  );
};

export function seedHanaExample(d, userName = "홍길동") {
  transaction(() => {
    hanaBase(d, userName, 40470);
    const tx = d.prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES ('main', ?, ?, ?, ?)");
    for (const row of HANA_TX) tx.run(...row);
    const payee = d.prepare("INSERT INTO payees (bank_code, number, holder, favorite) VALUES (?, ?, ?, ?)");
    for (const row of HANA_PAYEES) payee.run(...row);
    const tr = d.prepare(
      "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, at, out_tx_id) VALUES ('main', ?, ?, ?, ?, ?, ?)",
    );
    for (const [at, bank, number, holder, amount] of HANA_TRANSFERS) {
      const iso = at.replace(" ", "T");
      tr.run(bank, number, holder, amount, iso, tx.run(iso, holder, -amount, "#이체").lastInsertRowid);
    }
  }, d);
}

export function seedHanaEmpty(d, userName) {
  transaction(() => hanaBase(d, userName, 0), d);
}

// ---------- IBK기업은행 i-ONE Bank 초기 데이터 (전부 가상) ----------
// 녹화 홈의 계좌 카드 아래 점이 2개(계좌 2장)라 예시도 입출금 계좌 2개. 번호는 기업은행 3-6-2-3 형식
const IBK_ACCOUNTS = [
  ["main", "main", "123-456789-01-011", "보통예금(IBK W통장)", 1, 2345670],
  ["ibk-2", "external", "123-456789-02-022", "보통예금(IBK 급여통장)", 2, 752000],
];
const IBK_PAYEES = [
  ["jeju", "18900000000011", "이서준", 0],
  ["jeju", "18900000000022", "이서준", 0],
  ["mg", "9003000000033", "김민지", 0],
  ["kb", "98270000000044", "박하늘", 0],
  ["shinhan", "110000000055", "정신한", 0],
  ["jb", "1021000000066", "최예시", 0],
  ["kakao", "3333000000099", "오카카", 0],
  ["toss", "190000000077", "강토스", 0],
  ["nh", "3520000000088", "윤농협", 0],
  ["woori", "1002000000099", "서우리", 0],
];
// [시각, 은행, 번호, 이름, 금액] — '최근 이체' 목록·이체결과조회용 예전 이체
const IBK_TRANSFERS = [
  ["2026-10-02 12:10:00", "woori", "1002000000099", "서우리", 30000],
  ["2026-10-05 09:30:00", "nh", "3520000000088", "윤농협", 12000],
  ["2026-10-09 19:02:00", "toss", "190000000077", "강토스", 50000],
  ["2026-10-12 08:15:00", "kakao", "3333000000099", "오카카", 8000],
  ["2026-10-18 21:45:10", "jb", "1021000000066", "최예시", 20000],
  ["2026-10-22 13:40:00", "shinhan", "110000000055", "정신한", 15000],
  ["2026-10-25 18:06:14", "kb", "98270000000044", "박하늘", 100],
  ["2026-10-27 10:21:33", "mg", "9003000000033", "김민지", 200000],
  ["2026-10-29 20:43:05", "jeju", "18900000000022", "이서준", 300000],
  ["2026-10-30 14:04:19", "jeju", "18900000000011", "이서준", 150000],
];
// 거래내역 예시: 이체로 받은 돈(파랑) · 1원 인증 입금 · 체크카드
const IBK_TX = [
  ["2026-10-01T09:00:00", "홍길동", 500000, "#이체"],
  ["2026-10-03T13:27:06", "예시마트", -23800, "#체크카드"],
  ["2026-10-14T11:00:00", "KPS0000", 1, "#이체"],
  ["2026-10-20T18:21:01", "샘플카페", -4500, "#체크카드"],
  ["2026-10-30T14:54:00", "이서준", 450000, "#이체"],
  ["2026-10-30T14:55:30", "이서준", 400000, "#이체"],
];

const ibkBase = (d, userName, balances) => {
  wipe(d);
  d.prepare("INSERT INTO profile (id, user_name, card_last4) VALUES (1, ?, ?)").run(userName, "0000");
  const acc = d.prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, name, sort) VALUES (?, ?, 'ibk', ?, ?, ?, ?)");
  IBK_ACCOUNTS.slice(0, balances.length).forEach(([id, kind, number, name, sort], i) => acc.run(id, kind, number, balances[i], name, sort));
};

export function seedIbkExample(d, userName = "홍길동") {
  transaction(() => {
    ibkBase(d, userName, IBK_ACCOUNTS.map((a) => a[5]));
    const tx = d.prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES ('main', ?, ?, ?, ?)");
    for (const row of IBK_TX) tx.run(...row);
    const payee = d.prepare("INSERT INTO payees (bank_code, number, holder, favorite) VALUES (?, ?, ?, ?)");
    for (const row of IBK_PAYEES) payee.run(...row);
    const tr = d.prepare(
      "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, at, out_tx_id) VALUES ('main', ?, ?, ?, ?, ?, ?)",
    );
    for (const [at, bank, number, holder, amount] of IBK_TRANSFERS) {
      const iso = at.replace(" ", "T");
      tr.run(bank, number, holder, amount, iso, tx.run(iso, holder, -amount, "#이체").lastInsertRowid);
    }
  }, d);
}

// 빈 상태: 보통예금(IBK W통장) 0원 하나만
export function seedIbkEmpty(d, userName) {
  transaction(() => ibkBase(d, userName, [0]), d);
}

// ---------- 케이뱅크 초기 데이터 (전부 가상) ----------
// 녹화 홈은 입출금통장 하나(듀얼K 입출금통장, 케이뱅크 3-3-6 번호). 받는 분·이체·거래 이름과 번호는 모두 지어낸 값
// (농협은 녹화처럼 '지역농축협'으로 보이게 농축협 14 · 11자리 — src/kbank/bank.ts. 50만원 받는 분은 11자리(3-2-6): 녹화 이체확인증 '받는계좌'가
// '농축협 [번호]' 한 줄(≈130dp, 칸 148 안 — 두 번째 녹화 74초)이라 14자리면 두 줄로 넘어감)
const KBANK_ACCOUNTS = [["main", "main", "100-000-123456", "듀얼K 입출금통장", 1, 502779]];
const KBANK_PAYEES = [
  ["kakao", "3333000000011", "이서준", 0], // 녹화의 최근 보낸 계좌 ☆ 는 모두 빈 별 (23초) — 관리 패널에서 켤 수 있음
  ["nh", "35200000022", "박하늘", 0],
  ["mg", "9003000000033", "김민지", 0],
  ["nh", "35200000000044", "정예시", 0],
  ["shinhan", "110000000055", "최샘플", 0],
  ["kb", "98270000000066", "오가상", 0],
];
// [시각, 은행, 번호, 이름, 금액] — '최근 보낸 계좌'·거래 상세의 상대 정보·이체확인증용 예전 이체.
// 시각은 초까지 (이체확인증 거래일시가 초까지 보임 — 두 번째 녹화 46·74초)
const KBANK_TRANSFERS = [
  ["2026-10-20 12:10:00", "kb", "98270000000066", "오가상", 30000],
  ["2026-10-24 09:30:00", "shinhan", "110000000055", "최샘플", 12000],
  ["2026-10-27 19:02:00", "nh", "35200000000044", "정예시", 50000],
  ["2026-10-29 08:15:42", "mg", "9003000000033", "김민지", 8000],
  ["2026-11-02 11:25:21", "nh", "35200000022", "박하늘", 500000],
  ["2026-11-02 11:48:10", "nh", "35200000022", "박하늘", 500000],
  ["2026-11-02 18:12:37", "kakao", "3333000000011", "이서준", 1],
];
// 받은 돈 (녹화 거래내역처럼 파랑 +) · 체크카드.
// 다섯째 칸 = 입금을 실제로 보낸 계좌 [은행, 번호, 예금주] — 목록 이름과 다를 수 있음 (두 번째 녹화 66·81초 · 첫 녹화 75초: 목록 이름이 같은 두 입금의
// 상대 정보가 '[이름] 카카오뱅크' · '(주)[간편결제 회사] 신한'). 🔔 패널 거래 편집의 상대 정보와 같은 자리(transfers, 입금 거래에 연결)에 둠 — '최근 보낸 계좌'엔 안 나옴
const KBANK_TX = [
  ["2026-10-15T09:00:00", "홍길동", 300000, "#이체"],
  ["2026-10-21T13:27:06", "예시마트", -23800, "#체크카드"],
  ["2026-11-02T11:23:05", "이서준", 500000, "#이체", ["kakao", "3333000000011", "이서준"]],
  ["2026-11-02T11:47:12", "이서준", 500000, "#이체", ["shinhan", "140000000088", "(주)예시페이"]],
  ["2026-11-02T18:10:00", "이서준", 1, "#이체"],
];
// 두 번째 녹화용 덧붙임 (kbank 만): 계좌 거래내역이 18행이 되게 10월 말 체크카드 5건 · 이체 1건 — 맨위로 ↑ 문턱 1150dp 를 넘게 스크롤되도록
// (두 번째 녹화 60.7초). kbank2(첫 녹화 재현, INTRO)는 첫 녹화처럼 12행(최대 스크롤 1070dp)이라 넣지 않음.
// 10-28 정예시는 '최근 보낸 계좌' 차례가 바뀌지 않게 10-27 과 10-29 사이
const KBANK_TX_MORE = INTRO
  ? []
  : [
      ["2026-10-26T18:34:51", "샘플서점", -12000, "#체크카드"],
      ["2026-10-28T12:41:09", "예시분식", -7500, "#체크카드"],
      ["2026-10-30T19:22:48", "샘플마트", -15400, "#체크카드"],
      ["2026-10-31T08:52:16", "예시카페", -4800, "#체크카드"],
      ["2026-10-31T13:05:33", "예시편의점", -2600, "#체크카드"],
    ];
const KBANK_TRANSFERS_MORE = INTRO ? [] : [["2026-10-28 20:41:37", "nh", "35200000000044", "정예시", 25000]];

const kbankBase = (d, userName, balance) => {
  wipe(d);
  d.prepare("INSERT INTO profile (id, user_name, card_last4) VALUES (1, ?, ?)").run(userName, "0000");
  const [id, kind, number, name, sort] = KBANK_ACCOUNTS[0];
  d.prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, name, sort) VALUES (?, ?, 'kbank', ?, ?, ?, ?)").run(id, kind, number, balance, name, sort);
};

// 예시 거래 시각은 녹화 날(2026-11-02, 마지막 18:12:37) 그대로. 그보다 이른 때 예시로 되돌리면 모두 그만큼 하루씩 앞당김 —
// 지금 한 이체가 '미래' 예시 거래 사이에 끼어 그 뒤 거래들의 잔액이 어긋났음 (13:52 이체 위에 18:12 '잔액 502,776' 등). 순서·간격은 그대로
const KBANK_LAST = "2026-11-02T18:12:37";
const DAY = 86_400_000;
const kbankShift = () => {
  const ahead = Date.parse(KBANK_LAST) - Date.now();
  return ahead > 0 ? Math.ceil(ahead / DAY) : 0;
};
const shiftIso = (iso, days) => {
  if (!days) return iso;
  const t = new Date(Date.parse(iso) - days * DAY);
  const p = (n) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
};

export function seedKbankExample(d, userName = "홍길동") {
  const days = kbankShift();
  transaction(() => {
    kbankBase(d, userName, KBANK_ACCOUNTS[0][5]);
    const tx = d.prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES ('main', ?, ?, ?, ?)");
    const tr = d.prepare(
      "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, at, out_tx_id) VALUES ('main', ?, ?, ?, ?, ?, ?)",
    );
    for (const [at, merchant, amount, tag, sender] of [...KBANK_TX, ...KBANK_TX_MORE]) {
      const iso = shiftIso(at, days);
      const id = tx.run(iso, merchant, amount, tag).lastInsertRowid;
      if (sender) tr.run(...sender, Math.abs(amount), iso, id); // 입금 보낸 분 (연결된 거래 amount > 0)
    }
    const payee = d.prepare("INSERT INTO payees (bank_code, number, holder, favorite) VALUES (?, ?, ?, ?)");
    for (const row of KBANK_PAYEES) payee.run(...row);
    for (const [at, bank, number, holder, amount] of [...KBANK_TRANSFERS, ...KBANK_TRANSFERS_MORE]) {
      const iso = shiftIso(at.replace(" ", "T"), days);
      tr.run(bank, number, holder, amount, iso, tx.run(iso, holder, -amount, "#이체").lastInsertRowid);
    }
  }, d);
}

// 빈 상태: 듀얼K 입출금통장 0원 하나만
export function seedKbankEmpty(d, userName) {
  transaction(() => kbankBase(d, userName, 0), d);
}

// kbank2 전용 "테스트" 프로필: 2026-11-02 거래내역 8건 (이름·계좌번호는 모두 가상값으로 바꿈 — 실명·실계좌는 커밋 금지 규칙)
const KBANK_TEST_TX = [
  ["2026-11-02T11:23:00", "김도윤(카카오뱅크)", 500000, "#이체"],
  ["2026-11-02T11:23:03", "최하은(농협) 0241099887", -300000, "#이체"],
  ["2026-11-02T11:43:00", "예시모터스", 4290000, "#이체"],
  ["2026-11-02T11:48:10", "최하은(농협) 0241099887", -500000, "#이체"],
  ["2026-11-02T12:47:39", "카카오페이", -400000, "#이체"],
  ["2026-11-02T12:57:28", "샘플모터스", 5800000, "#이체"],
  ["2026-11-02T14:22:50", "최하은(농협) 0241099887", -7000000, "#이체"],
  ["2026-11-02T14:46:41", "정예준", -300000, "#이체"],
];
export function seedKbankTestProfile(d) {
  transaction(() => {
    kbankBase(d, "테스트", 2272491); // 마지막 거래(14:46:41) 뒤 잔액 — 거래내역은 최신 거래부터 거꾸로 잔액을 계산해서 보여 줌
    const tx = d.prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES ('main', ?, ?, ?, ?)");
    for (const [at, merchant, amount, tag] of KBANK_TEST_TX) tx.run(at, merchant, amount, tag);
  }, d);
}

// 앱별 "예시 데이터로 / 빈 상태로"
export const SEEDS = {
  kakao: { example: (d) => seedExample(d), empty: seedEmpty },
  nh: { example: (d, name) => seedNhExample(d, name), empty: seedNhEmpty },
  hana: { example: (d, name) => seedHanaExample(d, name), empty: seedHanaEmpty },
  ibk: { example: (d, name) => seedIbkExample(d, name), empty: seedIbkEmpty },
  kbank: { example: (d, name) => seedKbankExample(d, name), empty: seedKbankEmpty },
};

// ---------- 처음 켤 때 ----------
// 프로필이 하나도 없으면: 예전 버전의 server/data/bank.db 가 있으면 그걸 첫 프로필로 옮기고,
// 없으면 예시 데이터로 "홍길동" 프로필을 하나 만든다
if (!registry.prepare("SELECT 1 FROM profiles").get()) {
  const id = newProfileId();
  const legacy = resolve(DATA, "bank.db");
  if (APP === "kakao" && existsSync(legacy)) for (const ext of ["", "-wal", "-shm"]) if (existsSync(legacy + ext)) renameSync(legacy + ext, profileFile(id) + ext);
  const d = profileDb(id);
  if (!d.prepare("SELECT 1 FROM profile").get()) SEEDS[APP].example(d, "홍길동");
  const name = d.prepare("SELECT user_name FROM profile").get().user_name;
  registry
    .prepare("INSERT INTO profiles (id, name, avatar, color, created_at) VALUES (?, ?, 'boy', ?, datetime('now', 'localtime'))")
    .run(id, name, COLORS[0]);
}
// kbank2 "테스트" 프로필 만들기는 auth.mjs 맨 아래에서 함 (주인(owner_id)을 관리자로 정해야 해서 —
// 관리자 계정이 이미 있는 서버에서 git pull → 재시작했을 때도 보이려면, 관리자 id가 있어야 함. db.mjs는 auth.mjs보다 먼저 실행돼 아직 모름)
