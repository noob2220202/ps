// server/auth.mjs 대신 (vite.config.ts 가 APK 빌드에서만 바꿔 끼움) — 로그인 · 계정이 없다: 늘 로그인된 한 사람.
// 같은 이름·모양의 export 를 두어 server/index.mjs 는 그대로 돌아간다. 프로필 표(registry.profiles)에 주인 칸(owner_id)만 원본처럼 맞춰 둔다.
import { registry } from "../../../server/db.mjs";

if (!registry.prepare("SELECT 1 FROM pragma_table_info('profiles') WHERE name = 'owner_id'").get()) registry.exec("ALTER TABLE profiles ADD COLUMN owner_id TEXT");

export const LOCAL_USER = {
  id: "ulocal001",
  username: "allone",
  role: "admin",
  plan: "forever",
  created_at: "2026-01-01T00:00:00.000Z",
  expires_at: null,
  disabled: 0,
  last_login: null,
};

export const PLANS = { 1: 1, 7: 7, 30: 30, forever: null };
export const COOKIE = "bank_sid_allone";
export const expiryFor = () => null;
export const isUsername = () => true;
export const isPassword = () => true;
export const isExpired = () => false;
export const createUser = () => LOCAL_USER;
export const findUser = () => LOCAL_USER;
export const setPassword = () => undefined;
export const login = () => ({ user: LOCAL_USER, token: "local" });
export const logout = () => undefined;
export const sessionUser = () => LOCAL_USER;
export const readCookie = () => "local";
export const setSessionCookie = () => undefined;
export const clearSessionCookie = () => undefined;
export const tooManyFails = () => false;
export const noteFail = () => undefined;
export const clearFails = () => undefined;
export const toUser = (u) => ({
  id: u.id,
  username: u.username,
  role: u.role,
  plan: u.plan,
  createdAt: u.created_at,
  expiresAt: u.expires_at,
  expired: false,
  disabled: false,
  lastLogin: u.last_login,
});
