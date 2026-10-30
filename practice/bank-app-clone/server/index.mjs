import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
  APP,
  SEEDS,
  transaction,
} from "./db.mjs";
import { BANKS, bankByCode, bankInfo, checkNumber, digitsOf, formatAccountNumber } from "./banks.mjs";
import {
  PLANS,
  clearFails,
  clearSessionCookie,
  createUser,
  expiryFor,
  findUser,
  isExpired,
  isPassword,
  isUsername,
  login,
  logout,
  noteFail,
  readCookie,
  sessionUser,
  setPassword,
  setSessionCookie,
  toUser,
  tooManyFails,
} from "./auth.mjs";

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
  const p = db().prepare("SELECT * FROM profile WHERE id = 1").get();
  return { userName: p.user_name, cardLast4: p.card_last4, cardSpend: p.card_spend, cashbackCount: p.cashback_count };
};

function toAccount(row, profile = getProfile()) {
  // 카카오뱅크 3333 통장도 이체 화면에선 "카카오뱅크 3333-..."로 보이므로 은행 정보를 붙인다
  const bank = bankByCode(row.bank_code ?? "kakao");
  const label =
    row.name ?? (row.kind === "main" ? `${profile.userName}의 통장` : `${profile.userName}의 ${bank?.name ?? "다른 은행"} 계좌`);
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

// 계좌 이름 (콕뱅크 "자립예탁금" 같은). 안 보내면 그대로
const checkName = (name) =>
  name === undefined ? null : typeof name !== "string" || !name.trim() || name.trim().length > 20 ? "계좌 이름은 1~20자" : null;

function findAccount(id) {
  const row = db().prepare("SELECT * FROM accounts WHERE id = ?").get(id);
  if (!row) throw notFound("계좌");
  return row;
}

// "거래 후 잔액"은 저장하지 않고, 현재 잔액에서 최신 거래부터 거꾸로 빼며 계산
function listTransactions(accountId) {
  let balance = findAccount(accountId).balance;
  // 내가 보낸 이체면 받은 은행 (하나원큐 거래내역의 "타행송금(지역농축협)" 표기에 씀)
  const sentBank = new Map(db().prepare("SELECT out_tx_id, bank_code, number FROM transfers").all().map((r) => [r.out_tx_id, r]));
  return db()
    .prepare("SELECT * FROM transactions WHERE account_id = ? ORDER BY at DESC, id DESC")
    .all(accountId)
    .map((t) => {
      const tx = toTransaction(t, balance);
      const s = sentBank.get(t.id);
      if (s) tx.toBank = { code: s.bank_code, digits: s.number.length };
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

// ---------- 로그인 (server/auth.mjs) ----------
app.post("/api/auth/login", (req, res) => {
  const ip = req.ip ?? "";
  if (tooManyFails(ip)) throw new HttpError(429, "TOO_MANY", "잠시 후 다시 시도해 주세요");
  const { username, password } = req.body ?? {};
  const r = login(username, password);
  if (r.error) {
    if (r.code !== "EXPIRED") noteFail(ip);
    throw new HttpError(r.code === "EXPIRED" ? 403 : 401, r.code ?? "LOGIN_FAILED", r.error);
  }
  clearFails(ip);
  setSessionCookie(res, r.token);
  res.json(toUser(r.user));
});
app.post("/api/auth/logout", (req, res) => {
  logout(readCookie(req));
  clearSessionCookie(res);
  res.status(204).end();
});
// 이 아래 /api 는 로그인해야 함 (기간이 끝났거나 정지된 계정은 막음)
app.use("/api", (req, _res, next) => {
  const user = sessionUser(readCookie(req));
  if (!user) throw new HttpError(401, "LOGIN_REQUIRED", "로그인해 주세요");
  if (user.disabled) throw new HttpError(403, "DISABLED", "사용이 정지된 계정이에요");
  if (isExpired(user)) throw new HttpError(403, "EXPIRED", "이용 기간이 끝났어요. 관리자에게 문의해 주세요");
  req.user = user;
  next();
});
app.get("/api/auth/me", (req, res) => res.json(toUser(req.user)));
// 내 비밀번호 바꾸기
app.post("/api/auth/password", (req, res) => {
  const { current, next } = req.body ?? {};
  if (!login(req.user.username, current).user) throw bad("지금 비밀번호가 맞지 않아요", { current: "지금 비밀번호가 맞지 않아요" });
  if (!isPassword(next)) throw bad("새 비밀번호는 4~64자", { next: "새 비밀번호는 4~64자" });
  setPassword(req.user.id, next);
  const r = login(req.user.username, next); // 지금 기기는 다시 로그인된 상태로
  setSessionCookie(res, r.token);
  res.status(204).end();
});

// ---------- 관리자: 계정 만들기·기간·정지·삭제 ----------
app.use("/api/admin", (req, _res, next) => {
  if (req.user.role !== "admin") throw new HttpError(403, "FORBIDDEN", "관리자만 쓸 수 있어요");
  next();
});
const adminUser = (u) => ({
  ...toUser(u),
  profiles: registry.prepare("SELECT COUNT(*) AS n FROM profiles WHERE owner_id = ?").get(u.id).n,
});
const findManaged = (id) => {
  const u = typeof id === "string" && findUser(id);
  if (!u) throw new HttpError(404, "USER_NOT_FOUND", "없는 계정이에요");
  return u;
};
app.get("/api/admin/users", (_req, res) => res.json(registry.prepare("SELECT * FROM users ORDER BY role, created_at").all().map(adminUser)));
app.post("/api/admin/users", (req, res) => {
  const { username, password, plan } = req.body ?? {};
  const fields = {};
  if (!isUsername(username)) fields.username = "아이디는 영문·숫자·_.- 3~20자";
  else if (registry.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) fields.username = "이미 있는 아이디예요";
  if (!isPassword(password)) fields.password = "비밀번호는 4~64자";
  if (!(String(plan) in PLANS)) fields.plan = "기간은 1 / 7 / 30 / forever";
  if (Object.keys(fields).length) throw bad(Object.values(fields)[0], fields);
  const u = createUser({ username, password, plan: String(plan) });
  addProfile(u, username.slice(0, 10), { example: true }); // 첫 프로필 (예시 데이터)
  res.status(201).json(adminUser(u));
});
// 기간 바꾸기: { plan } = 지금부터 다시 그 기간 / { extend } = 남은 기간(끝났으면 지금)에 더하기. 정지·비밀번호 초기화도
app.patch("/api/admin/users/:id", (req, res) => {
  const u = findManaged(req.params.id);
  const { plan, extend, disabled, password } = req.body ?? {};
  if (u.role === "admin" && (plan !== undefined || extend !== undefined || disabled !== undefined)) throw bad("관리자 계정은 기간·정지를 바꿀 수 없어요");
  if (plan !== undefined) {
    if (!(String(plan) in PLANS)) throw bad("기간은 1 / 7 / 30 / forever");
    registry.prepare("UPDATE users SET plan = ?, expires_at = ? WHERE id = ?").run(String(plan), expiryFor(String(plan)), u.id);
  }
  if (extend !== undefined) {
    if (!(String(extend) in PLANS)) throw bad("연장은 1 / 7 / 30 / forever");
    const base = u.expires_at && new Date(u.expires_at) > new Date() ? new Date(u.expires_at) : new Date();
    const next = String(extend) === "forever" ? null : u.expires_at === null ? null : expiryFor(String(extend), base);
    registry.prepare("UPDATE users SET plan = ?, expires_at = ? WHERE id = ?").run(next === null ? "forever" : String(extend), next, u.id);
  }
  if (disabled !== undefined) {
    registry.prepare("UPDATE users SET disabled = ? WHERE id = ?").run(disabled ? 1 : 0, u.id);
    if (disabled) registry.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
  }
  if (password !== undefined) {
    if (!isPassword(password)) throw bad("비밀번호는 4~64자", { password: "비밀번호는 4~64자" });
    setPassword(u.id, password);
  }
  res.json(adminUser(findUser(u.id)));
});
// 계정 삭제: 그 계정의 프로필·은행 데이터까지
app.delete("/api/admin/users/:id", (req, res) => {
  const u = findManaged(req.params.id);
  if (u.role === "admin") throw bad("관리자 계정은 지울 수 없어요");
  for (const p of registry.prepare("SELECT id FROM profiles WHERE owner_id = ?").all(u.id)) removeProfileDb(p.id);
  registry.prepare("DELETE FROM profiles WHERE owner_id = ?").run(u.id);
  registry.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id);
  registry.prepare("DELETE FROM users WHERE id = ?").run(u.id);
  res.status(204).end();
});

// ---------- 프로필 (넷플릭스처럼 접속하면 고르기) ----------
// 프로필 목록 API는 어느 프로필에도 속하지 않음. 나머지 /api 요청은 헤더 X-Profile 의 프로필 DB로 처리
const toProfile = (r) => ({ id: r.id, name: r.name, avatar: r.avatar, color: r.color, os: r.os ?? undefined, theme: r.theme ?? undefined });
// 프로필은 로그인한 계정 것만 (다른 계정의 프로필 id 를 보내도 없는 것으로)
const findProfile = (id, user) => {
  const r = isProfileId(id) && registry.prepare("SELECT * FROM profiles WHERE id = ? AND owner_id = ?").get(id, user.id);
  if (!r) throw new HttpError(404, "PROFILE_NOT_FOUND", "없는 프로필이에요");
  return r;
};
const countProfiles = (user) => registry.prepare("SELECT COUNT(*) AS n FROM profiles WHERE owner_id = ?").get(user.id).n;
function addProfile(user, name, { avatar = AVATARS[0], color = COLORS[0], example = false } = {}) {
  const id = newProfileId();
  // 새 프로필은 빈 상태(카카오뱅크 통장 0원 / 콕뱅크 자립예탁금 0원), 새 계정의 첫 프로필은 예시 데이터로
  if (example) SEEDS[APP].example(profileDb(id), name);
  else SEEDS[APP].empty(profileDb(id), name);
  registry
    .prepare("INSERT INTO profiles (id, name, avatar, color, owner_id, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))")
    .run(id, name, avatar, color, user.id);
  return id;
}
function checkProfileFields({ name, avatar, color, os, theme }) {
  const fields = {};
  if (name !== undefined && !/^.{1,10}$/u.test(String(name).trim())) fields.name = "이름은 1~10자";
  if (avatar !== undefined && !AVATARS.includes(avatar)) fields.avatar = "알 수 없는 아바타";
  if (color !== undefined && !COLORS.includes(color)) fields.color = "알 수 없는 색";
  if (os !== undefined && !["android", "ios"].includes(os)) fields.os = "android 또는 ios";
  if (theme !== undefined && !["light", "dark", "system"].includes(theme)) fields.theme = "light, dark, system 중 하나";
  if (Object.keys(fields).length) throw bad(Object.values(fields)[0], fields);
}

app.get("/api/profiles", (req, res) =>
  res.json(registry.prepare("SELECT * FROM profiles WHERE owner_id = ? ORDER BY created_at, rowid").all(req.user.id).map(toProfile)),
);

// 새 프로필: 빈 상태(카카오뱅크 통장 0원)로 시작
app.post("/api/profiles", (req, res) => {
  const { name, avatar = AVATARS[0], color = COLORS[0] } = req.body ?? {};
  if (name === undefined) throw bad("이름을 입력해 주세요", { name: "이름을 입력해 주세요" });
  checkProfileFields({ name, avatar, color });
  if (countProfiles(req.user) >= MAX_PROFILES) throw bad(`프로필은 ${MAX_PROFILES}개까지 만들 수 있어요`);
  const id = addProfile(req.user, String(name).trim(), { avatar, color });
  res.status(201).json(toProfile(findProfile(id, req.user)));
});

// 이름·아바타 수정, 그리고 이 프로필의 기기/테마 설정 저장
app.patch("/api/profiles/:id", (req, res) => {
  const p = findProfile(req.params.id, req.user);
  const body = req.body ?? {};
  checkProfileFields(body);
  const next = { ...p, ...Object.fromEntries(Object.entries(body).filter(([k, v]) => v !== undefined && k in p)) };
  registry
    .prepare("UPDATE profiles SET name = ?, avatar = ?, color = ?, os = ?, theme = ? WHERE id = ?")
    .run(String(next.name).trim(), next.avatar, next.color, next.os, next.theme, p.id);
  res.json(toProfile(findProfile(p.id, req.user)));
});

// 삭제: 그 프로필의 DB 파일까지 지움 (마지막 하나는 못 지움)
app.delete("/api/profiles/:id", (req, res) => {
  const p = findProfile(req.params.id, req.user);
  if (countProfiles(req.user) <= 1) throw bad("프로필이 하나는 있어야 해요");
  registry.prepare("DELETE FROM profiles WHERE id = ?").run(p.id);
  removeProfileDb(p.id);
  res.status(204).end();
});

app.use("/api", (req, _res, next) => {
  if (req.path === "/profiles" || req.path.startsWith("/profiles/")) return next();
  const id = req.get("X-Profile");
  if (!id) throw new HttpError(400, "PROFILE_REQUIRED", "프로필을 먼저 골라 주세요");
  runWithDb(profileDb(findProfile(id, req.user).id), next);
});

// ---------- 화면용 API ----------
app.get("/api/home", (_req, res) => {
  const profile = getProfile();
  const accounts = db().prepare("SELECT * FROM accounts ORDER BY sort, rowid").all();
  const month = nowIso().slice(0, 7);
  // 이번달 쓴 돈: 🔔에서 직접 넣은 값이 있으면 그것, 없으면 이번 달 체크카드 출금 합계
  const spend =
    profile.cardSpend ??
    db()
      .prepare("SELECT COALESCE(-SUM(amount), 0) AS s FROM transactions WHERE tag = '#체크카드' AND amount < 0 AND at LIKE ?")
      .get(`${month}%`).s;
  res.json({
    profile,
    accounts: accounts.map((a) => toAccount(a, profile)),
    monthlyCardSpend: spend,
    cashbackCount: profile.cashbackCount,
    // 실제 앱 2026-10-28 12:09 스크린샷 순서 (점 3개)
    banners: [
      { id: "b1", title: "mini카드로 삼성월렛 이용하고\n2천 포인트 받아가기", cta: "삼성월렛으로 이동", image: "banner-mcard" },
      { id: "b2", title: "피카PC방 전용 결제 이벤트\nmini카드로 마일리지 받기", cta: "자세히 보기", image: "banner-pcbang" },
      { id: "b3", title: "금요일이 다가온다!\n간식부터 용돈까지 혜택 받기", cta: "자세히 보기", image: "banner-friday" },
    ],
    aiPromo: { title: "AI 목표적금 출시", desc: "최고 연 5% 받고 목표 지원금까지" },
    shortcuts: [
      { id: "s1", label: "정부지원금 찾기", icon: "shortcut-subsidy" },
      { id: "s2", label: "우리학교 시간표", icon: "shortcut-timetable" },
      { id: "s3", label: "매일 용돈 받기", icon: "shortcut-allowance" },
      { id: "s4", label: "50만원 넣고 금리쿠폰 받기", icon: "shortcut-coupon" },
    ],
    nativeAd: { source: "쿠팡 앱에서 구매하기", title: "로켓배송 오늘주문내일도착", sponsor: "Appier 광고입니다" },
  });
});

app.get("/api/banks", (_req, res) => res.json(BANKS.map(bankInfo)));

app.get("/api/profile", (_req, res) => res.json(getProfile()));

app.patch("/api/profile", (req, res) => {
  const { userName, cardLast4, cardSpend, cashbackCount } = req.body ?? {};
  const fields = {};
  if (userName !== undefined && !/^.{1,10}$/u.test(String(userName).trim())) fields.userName = "이름은 1~10자";
  if (cardLast4 !== undefined && !/^\d{4}$/.test(cardLast4)) fields.cardLast4 = "숫자 4자리";
  // cardSpend: null = 자동 계산으로 되돌리기
  if (cardSpend !== undefined && cardSpend !== null && !(Number.isInteger(cardSpend) && cardSpend >= 0 && cardSpend <= 1_000_000_000))
    fields.cardSpend = "0원 이상 10억원 이하";
  if (cashbackCount !== undefined && !(Number.isInteger(cashbackCount) && cashbackCount >= 0 && cashbackCount <= 99)) fields.cashbackCount = "0~99건";
  if (Object.keys(fields).length) throw bad("입력값을 확인해 주세요", fields);
  const p = getProfile();
  db().prepare("UPDATE profile SET user_name = ?, card_last4 = ?, card_spend = ?, cashback_count = ? WHERE id = 1").run(
    userName !== undefined ? String(userName).trim() : p.userName,
    cardLast4 ?? p.cardLast4,
    cardSpend !== undefined ? cardSpend : p.cardSpend,
    cashbackCount ?? p.cashbackCount,
  );
  res.json(getProfile());
});

app.get("/api/accounts/:id", (req, res) => res.json(toAccount(findAccount(req.params.id))));

// 다른 은행 계좌 추가
app.post("/api/accounts", (req, res) => {
  // 콕뱅크 서버는 농협 계좌만 (은행을 안 보내면 농협). 계좌 이름(저축예금 등)도 정할 수 있음
  const { bankCode = APP === "kakao" ? undefined : APP, number, balance = 0, name } = req.body ?? {};
  const bank = bankByCode(bankCode);
  const fields = {};
  if (!bank) fields.bankCode = "은행을 골라 주세요";
  else if (bank.code === "kakao") fields.bankCode = "카카오뱅크 통장은 이미 있어요";
  else if (APP === "nh" && bank.code !== "nh") fields.bankCode = "콕뱅크에는 농협 계좌만 추가할 수 있어요";
  else if (APP === "hana" && bank.code !== "hana") fields.bankCode = "하나원큐에는 하나은행 계좌만 추가할 수 있어요";
  else if (APP === "ibk" && bank.code !== "ibk") fields.bankCode = "i-ONE Bank에는 기업은행 계좌만 추가할 수 있어요";
  const nameError = checkName(name);
  if (nameError) fields.name = nameError;
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
  db().prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, sort, name) VALUES (?, 'external', ?, ?, ?, ?, ?)").run(
    id,
    bankCode,
    formatted,
    balance,
    sort,
    name?.trim() || ({ nh: "저축예금", hana: "입출금통장", ibk: "보통예금" }[APP] ?? null),
  );
  res.status(201).json(toAccount(findAccount(id)));
});

// 잔액/계좌번호 수정
app.patch("/api/accounts/:id", (req, res) => {
  const row = findAccount(req.params.id);
  const { balance, number, safebox, name } = req.body ?? {};
  const nameError = checkName(name);
  if (nameError) throw bad(nameError, { name: nameError });
  const money = (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 1_000_000_000);
  if (!money(balance)) throw bad("입력값을 확인해 주세요", { balance: "0원 이상 10억원 이하" });
  if (!money(safebox)) throw bad("입력값을 확인해 주세요", { safebox: "0원 이상 10억원 이하" });
  if (safebox !== undefined && row.kind !== "main") throw bad("세이프박스는 카카오뱅크 통장에만 있어요");
  let formatted = row.number;
  if (number !== undefined) {
    // 카카오뱅크 통장 번호는 고정, 콕뱅크는 대표계좌 번호도 바꿀 수 있음
    if (row.kind !== "external" && APP === "kakao") throw bad("다른 은행 계좌만 계좌번호를 바꿀 수 있어요");
    const digits = digitsOf(number);
    const numberError = checkNumber(bankByCode(row.bank_code), digits);
    if (numberError) throw bad(numberError, { number: numberError });
    formatted = formatAccountNumber(row.bank_code, digits);
  }
  db().prepare("UPDATE accounts SET balance = ?, number = ?, safebox = ?, name = ? WHERE id = ?").run(
    balance ?? row.balance,
    formatted,
    safebox ?? row.safebox,
    name === undefined ? row.name : name.trim(),
    row.id,
  );
  res.json(toAccount(findAccount(row.id)));
});

// 다른 은행 계좌 삭제 (거래내역도 ON DELETE CASCADE로 같이 지워짐)
app.delete("/api/accounts/:id", (req, res) => {
  const row = findAccount(req.params.id);
  if (row.kind !== "external") throw bad(`${{ kakao: "카카오뱅크 통장", nh: "대표계좌", hana: "대표계좌", ibk: "대표계좌" }[APP]}은 지울 수 없어요`);
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
  const sent = db().prepare("SELECT * FROM transfers WHERE out_tx_id = ?").get(t.id);
  res.json({
    ...tx,
    transactedAt: `${tx.at.slice(0, 10).replaceAll("-", ".")} ${tx.at.slice(11, 19)}`,
    kind: KIND_BY_TAG[tx.tag],
    ...(card && { cardInfo: `체크카드 (${getProfile().cardLast4})`, address: "서울 예시구 샘플로 123", phone: "02)000-0000" }),
    memo: t.memo ?? "",
    // 내가 보낸 이체면 받은 은행/계좌 (콕뱅크 거래 상세의 입금은행·입금계좌)
    ...(sent && { transfer: { bank: bankInfo(bankByCode(sent.bank_code)), number: sent.number, holder: sent.holder } }),
  });
});

// 거래메모 저장 (콕뱅크 거래 상세)
app.patch("/api/transactions/:id", (req, res) => {
  const t = findTx(req.params.id);
  const memo = String(req.body?.memo ?? "").trim();
  if (memo.length > 20) throw bad("거래메모는 20자 이하", { memo: "20자 이하" });
  db().prepare("UPDATE transactions SET memo = ? WHERE id = ?").run(memo || null, t.id);
  res.json({ id: String(t.id), memo });
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

// 이체 첫 화면: 내 계좌(보내는 계좌 빼고 — 콕뱅크 '내계좌' 탭은 보내는 계좌도 잔액과 함께 보여줌) + 최근 이체한 사람
app.get("/api/transfer/recipients", (req, res) => {
  const profile = getProfile();
  const from = String(req.query.from ?? "");
  const mine = db()
    .prepare("SELECT * FROM accounts WHERE id != ? ORDER BY sort, rowid")
    .all(APP === "nh" ? "" : from)
    .map((a) => {
      const acc = toAccount(a, profile);
      return { accountId: acc.id, kind: acc.kind, label: acc.label, bank: acc.bank, number: acc.number, holder: profile.userName, balance: acc.balance };
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
      lastAt: r.last_at,
      ...(r.payee_id && { payeeId: String(r.payee_id), favorite: !!r.favorite }),
    }));
  // 자주쓰는(☆ 누른 받는 분) — 콕뱅크 "자주쓰는" 탭
  const favorites = db()
    .prepare("SELECT * FROM payees WHERE favorite = 1 ORDER BY holder")
    .all()
    .map((p) => ({ ...toPayee(p), payeeId: String(p.id) }));
  res.json({ mine, recent, favorites, ...(db().app === "nh" && { dailyRemaining: NH_DAILY_LIMIT - sentToday(from) }) });
});

// 콕뱅크 1일 송금 한도 (영상: "1일 송금 잔여한도 1,000,000원")
const NH_DAILY_LIMIT = 1_000_000;
const sentToday = (fromId) =>
  db().prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM transfers WHERE from_account_id = ? AND at LIKE ?").get(fromId, `${nowIso().slice(0, 10)}%`).s;

// 이체 기록 (IBK 이체결과조회 · 이체확인증): 최근 것부터. ?from=계좌id 면 그 계좌에서 보낸 것만
const toTransfer = (t) => {
  const from = db().prepare("SELECT number FROM accounts WHERE id = ?").get(t.from_account_id);
  return {
    id: String(t.id),
    at: t.at,
    fromAccountId: t.from_account_id,
    fromNumber: from?.number ?? "",
    bank: bankInfo(bankByCode(t.bank_code)),
    number: t.number,
    holder: t.holder,
    amount: t.amount,
    memoTo: t.memo_to ?? getProfile().userName,
    memoMe: t.memo_me ?? t.holder,
    outTxId: t.out_tx_id == null ? null : String(t.out_tx_id),
  };
};
app.get("/api/transfers", (req, res) => {
  const from = req.query.from ? String(req.query.from) : null;
  const rows = from
    ? db().prepare("SELECT * FROM transfers WHERE from_account_id = ? ORDER BY at DESC, id DESC").all(from)
    : db().prepare("SELECT * FROM transfers ORDER BY at DESC, id DESC").all();
  res.json(rows.map(toTransfer));
});
app.get("/api/transfers/:id", (req, res) => {
  const t = db().prepare("SELECT * FROM transfers WHERE id = ?").get(req.params.id);
  if (!t) throw new HttpError(404, "NOT_FOUND", "이체 기록이 없어요");
  res.json(toTransfer(t));
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
  if (db().app === "nh" && sentToday(from.id) + amount > NH_DAILY_LIMIT)
    throw new HttpError(400, "LIMIT_EXCEEDED", `1일 송금 한도(${NH_DAILY_LIMIT.toLocaleString("ko-KR")}원)를 넘었어요`);

  const me = getProfile().userName;
  const memoToText = memoTo?.trim() || me; // 받는 분 통장에 찍힐 이름 (기본: 내 이름)
  const memoMeText = memoMe?.trim() || to.holder; // 내 통장에 찍힐 이름 (기본: 받는 분 이름)

  // 출금 + (내 계좌면) 입금 + 이체 기록 → 하나라도 실패하면 전부 취소
  const { id, outTxId } = transaction(() => {
    const insertTx = db().prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES (?, ?, ?, ?, '#이체')");
    const addBalance = db().prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?");
    const out = insertTx.run(from.id, at, memoMeText, -amount).lastInsertRowid;
    addBalance.run(-amount, from.id);
    let inTx = null;
    if (to.accountId) {
      inTx = insertTx.run(to.accountId, at, memoToText, amount).lastInsertRowid;
      addBalance.run(amount, to.accountId);
    }
    const r = db()
      .prepare(
        "INSERT INTO transfers (from_account_id, bank_code, number, holder, amount, memo_to, memo_me, at, out_tx_id, in_tx_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(from.id, to.bank.code, to.number, to.holder, amount, memoTo?.trim() || null, memoMe?.trim() || null, at, out, inTx);
    return { id: r.lastInsertRowid, outTxId: String(out) };
  });
  res.status(201).json({
    id: String(id),
    outTxId, // 내 통장 출금 거래 id (콕뱅크 완료 화면 '상세보기', 거래메모 저장에 씀)
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
  if (mode !== "empty" && mode !== "example") throw bad("mode는 empty 또는 example");
  SEEDS[db().app][mode](db(), getProfile().userName);
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
  // 화면은 세 앱이 같은 빌드를 쓰고, 어느 앱인지는 index.html에 끼워 넣어 알려준다 (window.__BANK_APP__)
  const html = readFileSync(resolve(dist, "index.html"), "utf8")
    .replace(/<title>.*<\/title>/, `<title>${{ kakao: "카카오뱅크", nh: "NH콕뱅크", hana: "하나원큐", ibk: "i-ONE Bank" }[APP]} 클론 연습</title>`)
    .replace("</head>", `<script>window.__BANK_APP__ = ${JSON.stringify(APP)};</script></head>`);
  app.use(express.static(dist, { index: false })); // "/" 도 아래에서 (index.html을 그대로 주면 앱 정보가 빠짐)
  // /account/main 같은 주소로 바로 들어와도 index.html을 줘야 화면 쪽 라우터가 처리할 수 있다
  app.get("/{*path}", (_req, res) => res.type("html").send(html));
}

const portArg = process.argv.indexOf("--port");
const PORT = Number(process.env.PORT ?? (portArg > 0 ? process.argv[portArg + 1] : { kakao: 9101, nh: 9103, hana: 9105, ibk: 9107 }[APP]));
app.listen(PORT, "0.0.0.0", () => console.log(`bank-clone server (${APP}) → http://localhost:${PORT}${existsSync(dist) ? "" : " (API만, dist 없음)"}`));
