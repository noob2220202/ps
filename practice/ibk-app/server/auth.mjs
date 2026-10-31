import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { APP, DATA, PORT, registry } from "./db.mjs";

// ===== 로그인 계정 (은행마다 따로 — 서버 하나 = 앱 하나, 데이터 폴더가 따로라 계정도 따로) =====
// 관리자(admin)가 계정을 만들고 이용 기간을 정함: 1일 / 7일 / 30일 / 영구 (만든 순간부터 줄어듦)
// 계정마다 프로필(누구의 은행을 열까요?)이 따로 있고, 그 프로필들의 은행 데이터도 따로.
// 로그인 상태는 HttpOnly 쿠키(bank_sid_<앱>)의 세션 토큰으로 — 같은 주소의 다른 포트(9101/9103)끼리 쿠키가 섞이지 않게 이름에 앱을 넣음
registry.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pw_salt     TEXT NOT NULL,
    pw_hash     TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    plan        TEXT NOT NULL,              -- '1' / '7' / '30' / 'forever'
    created_at  TEXT NOT NULL,              -- ISO (UTC)
    expires_at  TEXT,                       -- ISO (UTC). NULL = 영구
    disabled    INTEGER NOT NULL DEFAULT 0,
    last_login  TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );
`);
// 예전 프로필 표에 주인 칸 추가 (없으면)
if (!registry.prepare("SELECT 1 FROM pragma_table_info('profiles') WHERE name = 'owner_id'").get()) registry.exec("ALTER TABLE profiles ADD COLUMN owner_id TEXT");

export const PLANS = { 1: 1, 7: 7, 30: 30, forever: null }; // 일 수 (null = 영구)
// 포트까지 이름에 넣음: 쿠키는 포트를 구분하지 않아서, 같은 IP 에 기존 i-ONE Bank(bank-app-clone, bank_sid_ibk)나
// 이 앱을 여러 개 띄우면 한쪽에 로그인할 때 다른 쪽이 로그아웃됐음
export const COOKIE = `bank_sid_${APP}_${PORT}`;
const SESSION_DAYS = 30;

const hash = (password, salt) => scryptSync(String(password), salt, 32).toString("hex");
function checkPassword(user, password) {
  const a = Buffer.from(hash(password, user.pw_salt), "hex");
  const b = Buffer.from(user.pw_hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export const newUserId = () => `u${randomBytes(4).toString("hex")}`;
export const isUsername = (s) => typeof s === "string" && /^[a-zA-Z0-9_.-]{3,20}$/.test(s);
export const isPassword = (s) => typeof s === "string" && s.length >= 4 && s.length <= 64;

const addDays = (from, days) => new Date(from.getTime() + days * 86400_000).toISOString();
export function expiryFor(plan, from = new Date()) {
  const days = PLANS[plan];
  return days === null ? null : addDays(from, days);
}

export function createUser({ username, password, role = "user", plan = "forever" }) {
  const salt = randomBytes(16).toString("hex");
  const id = newUserId();
  const now = new Date();
  registry
    .prepare("INSERT INTO users (id, username, pw_salt, pw_hash, role, plan, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, username, salt, hash(password, salt), role, plan, now.toISOString(), role === "admin" ? null : expiryFor(plan, now));
  return findUser(id);
}
export const findUser = (id) => registry.prepare("SELECT * FROM users WHERE id = ?").get(id);
export function setPassword(id, password) {
  const salt = randomBytes(16).toString("hex");
  registry.prepare("UPDATE users SET pw_salt = ?, pw_hash = ? WHERE id = ?").run(salt, hash(password, salt), id);
  registry.prepare("DELETE FROM sessions WHERE user_id = ?").run(id); // 비밀번호를 바꾸면 다른 곳 로그인은 풀림
}

export const isExpired = (u) => u.role !== "admin" && u.expires_at !== null && new Date(u.expires_at).getTime() <= Date.now();

export const toUser = (u) => ({
  id: u.id,
  username: u.username,
  role: u.role,
  plan: u.plan,
  createdAt: u.created_at,
  expiresAt: u.expires_at ?? null,
  expired: isExpired(u),
  disabled: !!u.disabled,
  lastLogin: u.last_login ?? null,
});

// ---------- 로그인 / 세션 ----------
export function login(username, password) {
  const u = registry.prepare("SELECT * FROM users WHERE username = ?").get(String(username ?? ""));
  if (!u || !checkPassword(u, password)) return { error: "아이디 또는 비밀번호가 맞지 않아요" };
  if (u.disabled) return { error: "사용이 정지된 계정이에요. 관리자에게 문의해 주세요" };
  if (isExpired(u)) return { error: "이용 기간이 끝난 계정이에요. 관리자에게 문의해 주세요", code: "EXPIRED" };
  const token = randomBytes(24).toString("hex");
  registry.prepare("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)").run(token, u.id, new Date().toISOString());
  registry.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(new Date().toISOString(), u.id);
  return { token, user: u };
}
export const logout = (token) => token && registry.prepare("DELETE FROM sessions WHERE token = ?").run(token);

export function sessionUser(token) {
  if (!token) return null;
  const s = registry.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!s) return null;
  if (Date.now() - new Date(s.created_at).getTime() > SESSION_DAYS * 86400_000) {
    logout(token);
    return null;
  }
  return findUser(s.user_id) ?? null;
}

export function readCookie(req, name = COOKIE) {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
export function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}
export const clearSessionCookie = (res) => res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

// 로그인 시도 제한: 같은 IP 에서 1분에 10번 틀리면 잠깐 막음
const fails = new Map();
export function tooManyFails(ip) {
  const f = fails.get(ip);
  return !!f && f.n >= 10 && Date.now() - f.at < 60_000;
}
export function noteFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.at > 60_000) fails.set(ip, { n: 1, at: Date.now() });
  else f.n++;
}
export const clearFails = (ip) => fails.delete(ip);

// ---------- 처음 켤 때: 관리자 계정 ----------
// ADMIN_USER / ADMIN_PASSWORD 환경변수가 있으면 그걸로, 없으면 admin + 임의 비밀번호를 만들어
// 서버 로그와 <데이터 폴더>/admin-password.txt 에 남김. 주인 없는 예전 프로필은 관리자 것으로
if (!registry.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) {
  const username = process.env.ADMIN_USER && isUsername(process.env.ADMIN_USER) ? process.env.ADMIN_USER : "admin";
  const password = process.env.ADMIN_PASSWORD || randomBytes(6).toString("base64url");
  const admin = createUser({ username, password, role: "admin", plan: "forever" });
  if (!process.env.ADMIN_PASSWORD) {
    const file = resolve(DATA, "admin-password.txt");
    writeFileSync(file, `아이디: ${username}\n비밀번호: ${password}\n(로그인 후 관리 화면에서 비밀번호를 바꾸고 이 파일은 지워도 돼요)\n`);
    console.log(`[${APP}] 관리자 계정을 만들었어요 → 아이디 ${username} / 비밀번호 ${password}  (${file})`);
  }
  registry.prepare("UPDATE profiles SET owner_id = ? WHERE owner_id IS NULL").run(admin.id);
}
