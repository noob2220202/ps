import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AVATARS,
  COLORS,
  MAX_PROFILES,
  db,
  isProfileId,
  newProfileId,
  profileDb,
  registry,
  removeProfileDb,
  runWithDb,
  seedEmpty,
  seedExample,
  transaction,
} from "./db.mjs";
import { BANKS, bankByCode, bankInfo, checkNumber, digitsOf, formatAccountNumber } from "./banks.mjs";

// ===== 백엔드 서버 (Express + SQLite) =====
// npm start → 이 파일 하나가 API(/api/...)와 빌드된 화면(dist/)을 같은 포트(기본 9101)로 제공한다.
// 개발 중(npm run dev)에는 API만 8787에서 돌고, Vite 개발 서버가 /api 요청을 여기로 넘겨준다.

const app = express();
app.use(express.json());

// 스켈레톤/스피너가 실제 앱처럼 잠깐 보이도록 조회 요청에 약간의 지연 (API_DELAY_MS=0 이면 끔)
const DELAY = Number(process.env.API_DELAY_MS ?? 250);
app.use("/api", (req, _res, next) => (req.method === "GET" && DELAY ? setTimeout(next, DELAY) : next()));

// ---------- 공통 도우미 ----------
class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    Object.assign(this, { status, code, fields });
  }
}
const bad = (message, fields) => new HttpError(400, "VALIDATION", message, fields);
const conflict = (message, fields) => new HttpError(409, "CONFLICT", message, fields);
const notFound = (what) => new HttpError(404, "NOT_FOUND", `${what}을(를) 찾을 수 없어요`);

const pad = (n) => String(n).padStart(2, "0");
function nowIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const getProfile = () => {
  const p = db().prepare("SELECT user_name, card_last4 FROM profile WHERE id = 1").get();
  return { userName: p.user_name, cardLast4: p.card_last4 };
};

function toAccount(row, profile = getProfile()) {
  // 카카오뱅크 3333 통장도 이체 화면에선 "카카오뱅크 3333-..."로 보이므로 은행 정보를 붙인다
  const bank = bankByCode(row.bank_code ?? "kakao");
  const label = row.kind === "main" ? `${profile.userName}의 통장` : `${profile.userName}의 ${bank?.name ?? "다른 은행"} 계좌`;
  return {
    id: row.id,
    kind: row.kind,
    label,
    balance: row.balance,
    ...(row.badge && { badge: row.badge }),
    number: row.number ?? undefined,
    bank: bankInfo(bank),
    ...(row.kind === "main" && { safebox: row.safebox }),
  };
}

function findAccount(id) {
  const row = db().prepare("SELECT * FROM accounts WHERE id = ?").get(id);
  if (!row) throw notFound("계좌");
  return row;
}

// "거래 후 잔액"은 저장하지 않고, 현재 잔액에서 최신 거래부터 거꾸로 빼며 계산
function listTransactions(accountId) {
  let balance = findAccount(accountId).balance;
  return db()
    .prepare("SELECT * FROM transactions WHERE account_id = ? ORDER BY at DESC, id DESC")
    .all(accountId)
    .map((t) => {
      const tx = toTransaction(t, balance);
      balance -= t.amount;
      return tx;
    });
}

function toTransaction(t, balanceAfter) {
  const [d, time] = t.at.split("T");
  const [, mm, dd] = d.split("-");
  return {
    id: String(t.id),
    accountId: t.account_id,
    at: t.at,
    date: `${mm}.${dd}`,
    time: time.slice(0, 5),
    merchant: t.merchant,
    amount: t.amount,
    tag: t.tag,
    balanceAfter,
  };
}

const TAGS = ["#체크카드", "#자동이체", "#예금이자", "#이체"];
const KIND_BY_TAG = { "#체크카드": "체크카드결제", "#자동이체": "자동이체", "#예금이자": "예금이자", "#이체": "이체" };

// ---------- 프로필 (넷플릭스처럼 접속하면 고르기) ----------
// 프로필 목록 API는 어느 프로필에도 속하지 않음. 나머지 /api 요청은 헤더 X-Profile 의 프로필 DB로 처리
const toProfile = (r) => ({ id: r.id, name: r.name, avatar: r.avatar, color: r.color, os: r.os ?? undefined, theme: r.theme ?? undefined });
const findProfile = (id) => {
  const r = isProfileId(id) && registry.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
  if (!r) throw new HttpError(404, "PROFILE_NOT_FOUND", "없는 프로필이에요");
  return r;
};
function checkProfileFields({ name, avatar, color, os, theme }) {
  const fields = {};
  if (name !== undefined && !/^.{1,10}$/u.test(String(name).trim())) fields.name = "이름은 1~10자";
  if (avatar !== undefined && !AVATARS.includes(avatar)) fields.avatar = "알 수 없는 아바타";
  if (color !== undefined && !COLORS.includes(color)) fields.color = "알 수 없는 색";
  if (os !== undefined && !["android", "ios"].includes(os)) fields.os = "android 또는 ios";
  if (theme !== undefined && !["light", "dark", "system"].includes(theme)) fields.theme = "light, dark, system 중 하나";
  if (Object.keys(fields).length) throw bad(Object.values(fields)[0], fields);
}

app.get("/api/profiles", (_req, res) => res.json(registry.prepare("SELECT * FROM profiles ORDER BY created_at, rowid").all().map(toProfile)));

// 새 프로필: 빈 상태(카카오뱅크 통장 0원)로 시작
app.post("/api/profiles", (req, res) => {
  const { name, avatar = AVATARS[0], color = COLORS[0] } = req.body ?? {};
  if (name === undefined) throw bad("이름을 입력해 주세요", { name: "이름을 입력해 주세요" });
  checkProfileFields({ name, avatar, color });
  if (registry.prepare("SELECT COUNT(*) AS n FROM profiles").get().n >= MAX_PROFILES) throw bad(`프로필은 ${MAX_PROFILES}개까지 만들 수 있어요`);
  const id = newProfileId();
  seedEmpty(profileDb(id), String(name).trim());
  registry
    .prepare("INSERT INTO profiles (id, name, avatar, color, created_at) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))")
    .run(id, String(name).trim(), avatar, color);
  res.status(201).json(toProfile(findProfile(id)));
});

// 이름·아바타 수정, 그리고 이 프로필의 기기/테마 설정 저장
app.patch("/api/profiles/:id", (req, res) => {
  const p = findProfile(req.params.id);
  const body = req.body ?? {};
  checkProfileFields(body);
  const next = { ...p, ...Object.fromEntries(Object.entries(body).filter(([k, v]) => v !== undefined && k in p)) };
  registry
    .prepare("UPDATE profiles SET name = ?, avatar = ?, color = ?, os = ?, theme = ? WHERE id = ?")
    .run(String(next.name).trim(), next.avatar, next.color, next.os, next.theme, p.id);
  res.json(toProfile(findProfile(p.id)));
});

// 삭제: 그 프로필의 DB 파일까지 지움 (마지막 하나는 못 지움)
app.delete("/api/profiles/:id", (req, res) => {
  const p = findProfile(req.params.id);
  if (registry.prepare("SELECT COUNT(*) AS n FROM profiles").get().n <= 1) throw bad("프로필이 하나는 있어야 해요");
  registry.prepare("DELETE FROM profiles WHERE id = ?").run(p.id);
  removeProfileDb(p.id);
  res.status(204).end();
});

app.use("/api", (req, _res, next) => {
  if (req.path === "/profiles" || req.path.startsWith("/profiles/")) return next();
  const id = req.get("X-Profile");
  if (!id) throw new HttpError(400, "PROFILE_REQUIRED", "프로필을 먼저 골라 주세요");
  runWithDb(profileDb(findProfile(id).id), next);
});

// ---------- 화면용 API ----------
app.get("/api/home", (_req, res) => {
  const profile = getProfile();
  const accounts = db().prepare("SELECT * FROM accounts ORDER BY sort, rowid").all();
  const month = nowIso().slice(0, 7);
  const spend = db()
    .prepare("SELECT COALESCE(-SUM(amount), 0) AS s FROM transactions WHERE tag = '#체크카드' AND amount < 0 AND at LIKE ?")
    .get(`${month}%`).s;
  res.json({
    profile,
    accounts: accounts.map((a) => toAccount(a, profile)),
    monthlyCardSpend: spend,
    cashbackCount: 2,
    banners: [
      { id: "b1", title: "mini카드로 삼성월렛 이용하고\n2천 포인트 받아가기", cta: "삼성월렛으로 이동", image: "banner-mcard" },
      { id: "b2", title: "우리 동네 가까운 봉사활동 찾기\n카카오뱅크에서 시작하세요", cta: "더 알아보기", image: "banner-volunteer" },
      { id: "b3", title: "피카PC방 전용 결제 이벤트\nmini카드로 마일리지 받기", cta: "자세히 보기", image: "banner-pcbang" },
      { id: "b4", title: "AND2BLE\n미니 2집 발매", cta: "MV 보러가기", image: "banner-and2ble", ad: true },
    ],
    aiPromo: { title: "AI 목표적금 출시", desc: "최고 연 5% 받고 목표 지원금까지" },
    shortcuts: [
      { id: "s1", label: "우리학교 시간표", icon: "shortcut-timetable" },
      { id: "s2", label: "정부지원금 찾기", icon: "shortcut-subsidy" },
      { id: "s3", label: "모바일 신분증 이용하기", icon: "shortcut-id" },
      { id: "s4", label: "mini 26일저금", icon: "shortcut-mini26" },
    ],
    nativeAd: { source: "쇼핑 앱에서 구매하기", title: "특가 탁구화", sponsor: "광고입니다" },
  });
});

app.get("/api/banks", (_req, res) => res.json(BANKS.map(bankInfo)));

app.get("/api/profile", (_req, res) => res.json(getProfile()));

app.patch("/api/profile", (req, res) => {
  const { userName, cardLast4 } = req.body ?? {};
  const fields = {};
  if (userName !== undefined && !/^.{1,10}$/u.test(String(userName).trim())) fields.userName = "이름은 1~10자";
  if (cardLast4 !== undefined && !/^\d{4}$/.test(cardLast4)) fields.cardLast4 = "숫자 4자리";
  if (Object.keys(fields).length) throw bad("입력값을 확인해 주세요", fields);
  const p = getProfile();
  db().prepare("UPDATE profile SET user_name = ?, card_last4 = ? WHERE id = 1").run(
    userName !== undefined ? String(userName).trim() : p.userName,
    cardLast4 ?? p.cardLast4,
  );
  res.json(getProfile());
});

app.get("/api/accounts/:id", (req, res) => res.json(toAccount(findAccount(req.params.id))));

// 다른 은행 계좌 추가
app.post("/api/accounts", (req, res) => {
  const { bankCode, number, balance = 0 } = req.body ?? {};
  const bank = bankByCode(bankCode);
  const fields = {};
  if (!bank) fields.bankCode = "은행을 골라 주세요";
  else if (bank.code === "kakao") fields.bankCode = "카카오뱅크 통장은 이미 있어요";
  const digits = digitsOf(number);
  const numberError = bank && checkNumber(bank, digits);
  if (numberError) fields.number = numberError;
  if (!Number.isInteger(balance) || balance < 0 || balance > 1_000_000_000) fields.balance = "0원 이상 10억원 이하";
  if (Object.keys(fields).length) throw bad("입력값을 확인해 주세요", fields);

  const formatted = formatAccountNumber(bankCode, digits);
  if (db().prepare("SELECT 1 FROM accounts WHERE bank_code = ? AND number = ?").get(bankCode, formatted))
    throw conflict("이미 추가된 계좌예요", { number: "이미 추가된 계좌예요" });

  const id = `bank-${randomUUID().slice(0, 8)}`;
  const sort = db().prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM accounts").get().s;
  db().prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, sort) VALUES (?, 'external', ?, ?, ?, ?)").run(
    id,
    bankCode,
    formatted,
    balance,
    sort,
  );
  res.status(201).json(toAccount(findAccount(id)));
});

// 잔액/계좌번호 수정
app.patch("/api/accounts/:id", (req, res) => {
  const row = findAccount(req.params.id);
  const { balance, number, safebox } = req.body ?? {};
  const money = (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 1_000_000_000);
  if (!money(balance)) throw bad("입력값을 확인해 주세요", { balance: "0원 이상 10억원 이하" });
  if (!money(safebox)) throw bad("입력값을 확인해 주세요", { safebox: "0원 이상 10억원 이하" });
  if (safebox !== undefined && row.kind !== "main") throw bad("세이프박스는 카카오뱅크 통장에만 있어요");
  let formatted = row.number;
  if (number !== undefined) {
    if (row.kind !== "external") throw bad("다른 은행 계좌만 계좌번호를 바꿀 수 있어요");
    const digits = digitsOf(number);
    const numberError = checkNumber(bankByCode(row.bank_code), digits);
    if (numberError) throw bad(numberError, { number: numberError });
    formatted = formatAccountNumber(row.bank_code, digits);
  }
  db().prepare("UPDATE accounts SET balance = ?, number = ?, safebox = ? WHERE id = ?").run(
    balance ?? row.balance,
    formatted,
    safebox ?? row.safebox,
    row.id,
  );
  res.json(toAccount(findAccount(row.id)));
});

// 다른 은행 계좌 삭제 (거래내역도 ON DELETE CASCADE로 같이 지워짐)
app.delete("/api/accounts/:id", (req, res) => {
  const row = findAccount(req.params.id);
  if (row.kind !== "external") throw bad("카카오뱅크 통장은 지울 수 없어요");
  db().prepare("DELETE FROM accounts WHERE id = ?").run(row.id);
  res.status(204).end();
});

app.get("/api/accounts/:id/transactions", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 500);
  res.json(listTransactions(req.params.id).slice(0, limit));
});

// 거래 추가 → 잔액도 같이 바뀜 (둘 중 하나만 되면 안 되니까 transaction으로 묶음)
app.post("/api/accounts/:id/transactions", (req, res) => {
  const row = findAccount(req.params.id);
  const { merchant, amount, tag = "#이체", at } = req.body ?? {};
  const fields = {};
  if (typeof merchant !== "string" || !merchant.trim()) fields.merchant = "거래처를 입력해 주세요";
  else if (merchant.length > 20) fields.merchant = "20자 이하";
  if (!Number.isInteger(amount) || amount === 0) fields.amount = "0이 아닌 금액을 입력해 주세요";
  else if (Math.abs(amount) > 10_000_000) fields.amount = "한 번에 1천만원까지";
  if (!TAGS.includes(tag)) fields.tag = "알 수 없는 거래 종류";
  if (at !== undefined && Number.isNaN(Date.parse(at))) fields.at = "날짜 형식 오류";
  if (Object.keys(fields).length) throw bad("입력값을 확인해 주세요", fields);
  if (row.balance + amount < 0)
    throw new HttpError(400, "INSUFFICIENT_BALANCE", `잔액이 부족해요 (현재 ${row.balance.toLocaleString("ko-KR")}원)`);

  const id = transaction(() => {
    const r = db()
      .prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES (?, ?, ?, ?, ?)")
      .run(row.id, at ? String(at).slice(0, 19).padEnd(19, ":00") : nowIso(), merchant.trim(), amount, tag);
    db().prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amount, row.id);
    return String(r.lastInsertRowid);
  });
  res.status(201).json(listTransactions(row.id).find((t) => t.id === id));
});

function findTx(id) {
  const t = db().prepare("SELECT * FROM transactions WHERE id = ?").get(Number(id));
  if (!t) throw notFound("거래");
  return t;
}

app.get("/api/transactions/:id", (req, res) => {
  const t = findTx(req.params.id);
  const tx = listTransactions(t.account_id).find((x) => x.id === String(t.id));
  const card = tx.tag === "#체크카드";
  res.json({
    ...tx,
    transactedAt: `${tx.at.slice(0, 10).replaceAll("-", ".")} ${tx.at.slice(11, 19)}`,
    kind: KIND_BY_TAG[tx.tag],
    ...(card && { cardInfo: `체크카드 (${getProfile().cardLast4})`, address: "서울 예시구 샘플로 123", phone: "02)000-0000" }),
  });
});

// 거래 삭제 → 그 거래가 없던 일이 되므로 잔액도 되돌림
app.delete("/api/transactions/:id", (req, res) => {
  const t = findTx(req.params.id);
  transaction(() => {
    db().prepare("DELETE FROM transactions WHERE id = ?").run(t.id);
    db().prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(t.amount, t.account_id);
  });
  res.status(204).end();
});

// ---------- 받는 분 (🔔 패널에서 관리) ----------
const toPayee = (p) => ({
  id: String(p.id),
  bank: bankInfo(bankByCode(p.bank_code)),
  number: p.number,
  holder: p.holder,
  favorite: !!p.favorite,
});

function findPayee(id) {
  const p = db().prepare("SELECT * FROM payees WHERE id = ?").get(Number(id));
  if (!p) throw notFound("받는 분");
  return p;
}

// 내 계좌 중 (은행, 숫자) 가 같은 것
function myAccountByNumber(bankCode, digits) {
  return db()
    .prepare("SELECT * FROM accounts")
    .all()
    .find((a) => (a.bank_code ?? "kakao") === bankCode && digitsOf(a.number) === digits);
}

function checkPayee({ bankCode, number, holder }, current) {
  const bank = bankByCode(bankCode ?? current?.bank_code);
  const fields = {};
  if (!bank) fields.bankCode = "은행을 골라 주세요";
  const digits = digitsOf(number ?? current?.number);
  const numberError = bank && checkNumber(bank, digits);
  if (numberError) fields.number = numberError;
  const name = String(holder ?? current?.holder ?? "").trim();
  if (!name || name.length > 20) fields.holder = "이름은 1~20자";
  if (Object.keys(fields).length) throw bad(Object.values(fields)[0], fields);
  if (myAccountByNumber(bank.code, digits)) throw conflict("내 계좌예요. 받는 분으로 등록할 필요 없어요", { number: "내 계좌" });
  const dup = db().prepare("SELECT id FROM payees WHERE bank_code = ? AND number = ?").get(bank.code, digits);
  if (dup && dup.id !== current?.id) throw conflict("이미 등록된 계좌예요", { number: "이미 등록된 계좌" });
  return { bankCode: bank.code, digits, name };
}

app.get("/api/payees", (_req, res) => res.json(db().prepare("SELECT * FROM payees ORDER BY holder").all().map(toPayee)));

app.post("/api/payees", (req, res) => {
  const { bankCode, digits, name } = checkPayee(req.body ?? {});
  const r = db().prepare("INSERT INTO payees (bank_code, number, holder) VALUES (?, ?, ?)").run(bankCode, digits, name);
  res.status(201).json(toPayee(findPayee(r.lastInsertRowid)));
});

app.patch("/api/payees/:id", (req, res) => {
  const p = findPayee(req.params.id);
  const body = req.body ?? {};
  const { bankCode, digits, name } = checkPayee(body, p);
  const favorite = body.favorite === undefined ? p.favorite : body.favorite ? 1 : 0;
  db().prepare("UPDATE payees SET bank_code = ?, number = ?, holder = ?, favorite = ? WHERE id = ?").run(bankCode, digits, name, favorite, p.id);
  res.json(toPayee(findPayee(p.id)));
});

app.delete("/api/payees/:id", (req, res) => {
  db().prepare("DELETE FROM payees WHERE id = ?").run(findPayee(req.params.id).id);
  res.status(204).end();
});

// ---------- 이체 ----------
// 받는 계좌 찾기: 내 계좌 → 등록된 받는 분 순서. 없으면 404 (진짜 앱의 "계좌정보를 확인해 주세요")
function findRecipient(bankCode, number) {
  const bank = bankByCode(bankCode);
  if (!bank) throw bad("은행을 골라 주세요", { bankCode: "은행을 골라 주세요" });
  const digits = digitsOf(number);
  const mine = myAccountByNumber(bank.code, digits);
  if (mine) return { bank: bankInfo(bank), number: digits, holder: getProfile().userName, accountId: mine.id };
  const p = db().prepare("SELECT * FROM payees WHERE bank_code = ? AND number = ?").get(bank.code, digits);
  if (p) return { ...toPayee(p), payeeId: String(p.id) };
  throw new HttpError(404, "ACCOUNT_NOT_FOUND", "입력하신 계좌정보를 확인해 주세요");
}

app.get("/api/transfer/lookup", (req, res) => res.json(findRecipient(req.query.bank, req.query.number)));

// 이체 첫 화면: 내 계좌(보내는 계좌 빼고) + 최근 이체한 사람
app.get("/api/transfer/recipients", (req, res) => {
  const profile = getProfile();
  const from = String(req.query.from ?? "");
  const mine = db()
    .prepare("SELECT * FROM accounts WHERE id != ? ORDER BY sort, rowid")
    .all(from)
    .map((a) => {
      const acc = toAccount(a, profile);
      return { accountId: acc.id, kind: acc.kind, label: acc.label, bank: acc.bank, number: acc.number, holder: profile.userName };
    });
  // 같은 계좌로 여러 번 보냈으면 마지막 한 번만. 받는 분이 등록돼 있으면 ☆ 상태도 같이
  const recent = db()
    .prepare(
      `SELECT t.bank_code, t.number, t.holder, MAX(t.at) AS last_at, p.id AS payee_id, p.favorite
         FROM transfers t LEFT JOIN payees p ON p.bank_code = t.bank_code AND p.number = t.number
        GROUP BY t.bank_code, t.number ORDER BY last_at DESC LIMIT 20`,
    )
    .all()
    .filter((r) => !myAccountByNumber(r.bank_code, r.number))
    .map((r) => ({
      bank: bankInfo(bankByCode(r.bank_code)),
      number: r.number,
      holder: r.holder,
      ...(r.payee_id && { payeeId: String(r.payee_id), favorite: !!r.favorite }),
    }));
  res.json({ mine, recent });
});

app.post("/api/transfers", (req, res) => {
  const { fromAccountId, bankCode, number, amount, memoTo, memoMe } = req.body ?? {};
  const from = findAccount(fromAccountId);
  const to = findRecipient(bankCode, number);
  const fields = {};
  if (!Number.isInteger(amount) || amount <= 0) fields.amount = "보낼 금액을 입력해 주세요";
  else if (amount > 10_000_000) fields.amount = "한 번에 1천만원까지";
  for (const [k, v] of Object.entries({ memoTo, memoMe }))
    if (v !== undefined && (typeof v !== "string" || v.trim().length > 20)) fields[k] = "20자 이하";
  if (Object.keys(fields).length) throw bad(Object.values(fields)[0], fields);
  if (to.accountId === from.id) throw bad("같은 계좌로는 보낼 수 없어요");
  if (from.balance < amount)
    throw new HttpError(400, "INSUFFICIENT_BALANCE", `출금 가능 금액(${from.balance.toLocaleString("ko-KR")}원)을 넘었어요`);

  const at = nowIso();

  const me = getProfile().userName;
  const memoToText = memoTo?.trim() || me; // 받는 분 통장에 찍힐 이름 (기본: 내 이름)
  const memoMeText = memoMe?.trim() || to.holder; // 내 통장에 찍힐 이름 (기본: 받는 분 이름)

  // 출금 + (내 계좌면) 입금 + 이체 기록 → 하나라도 실패하면 전부 취소
  const id = transaction(() => {
    const insertTx = db().prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES (?, ?, ?, ?, '#이체')");
    const addBalance = db().prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?");
    const out = insertTx.run(from.id, at, memoMeText, -amount).lastInsertRowid;
    addBalance.run(-amount, from.id);
    let inTx = null;
    if (to.accountId) {
      inTx = insertTx.run(to.accountId, at, memoToText, amount).lastInsertRowid;
      addBalance.run(amount, to.accountId);
    }
    return db()
      .prepare(
        "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, memo_to, memo_me, at, out_tx_id, in_tx_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(from.id, to.bank.code, to.number, to.holder, amount, memoTo?.trim() || null, memoMe?.trim() || null, at, out, inTx).lastInsertRowid;
  });
  res.status(201).json({
    id: String(id),
    fromAccountId: from.id,
    to,
    amount,
    at,
    balanceAfter: findAccount(from.id).balance,
  });
});

// 되돌리기: mode "empty" = 빈 상태(통장 0원), "example" = 홍길동 예시 데이터
app.post("/api/reset", (req, res) => {
  const mode = req.body?.mode ?? "example";
  if (mode === "empty") seedEmpty(db(), getProfile().userName);
  else if (mode === "example") seedExample(db());
  else throw bad("mode는 empty 또는 example");
  res.status(204).end();
});

app.use("/api", (_req, _res, next) => next(new HttpError(404, "NOT_FOUND", "없는 API예요")));

// 에러를 항상 { code, message, fields } 모양으로
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ code: "VALIDATION", message: "JSON 형식 오류" });
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ code: err.code ?? "SERVER_ERROR", message: status >= 500 ? "서버 오류예요" : err.message, ...(err.fields && { fields: err.fields }) });
});

// ---------- 빌드된 화면 제공 (npm run build 후) ----------
const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  // /account/main 같은 주소로 바로 들어와도 index.html을 줘야 화면 쪽 라우터가 처리할 수 있다
  app.get("/{*path}", (_req, res) => res.sendFile(resolve(dist, "index.html")));
}

const portArg = process.argv.indexOf("--port");
const PORT = Number(process.env.PORT ?? (portArg > 0 ? process.argv[portArg + 1] : 9101));
app.listen(PORT, "0.0.0.0", () => console.log(`bank-clone server → http://localhost:${PORT}${existsSync(dist) ? "" : " (API만, dist 없음)"}`));
