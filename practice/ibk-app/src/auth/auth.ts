// 로그인 상태 (서버 쿠키 세션). 앱이 켜질 때 /api/auth/me 로 확인하고, 이후 요청이 401/403(기간 끝·정지)이면 로그인 화면으로
import { useSyncExternalStore } from "react";
import { ApiError, http, setAuthListener } from "../api/client";
import { setCurrentProfile } from "../profile/session";

export type Plan = "1" | "7" | "30" | "forever";
export interface User {
  id: string;
  username: string;
  role: "admin" | "user";
  plan: Plan;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
  disabled: boolean;
  lastLogin: string | null;
}
export interface ManagedUser extends User {
  profiles: number;
}

type AuthState = { status: "checking" } | { status: "out"; message?: string } | { status: "in"; user: User };
let state: AuthState = { status: "checking" };
const listeners = new Set<() => void>();
const set = (s: AuthState) => {
  state = s;
  listeners.forEach((fn) => fn());
};
export const useAuth = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => state,
  );

export async function checkAuth() {
  try {
    set({ status: "in", user: await http.get<User>("/api/auth/me") });
  } catch (e) {
    set({ status: "out", message: e instanceof ApiError && e.status === 403 ? e.message : undefined });
  }
}

export async function login(username: string, password: string) {
  const user = await http.post<User>("/api/auth/login", { username, password });
  setCurrentProfile(null); // 다른 계정의 프로필이 남아 있지 않게 → 프로필 고르기부터
  set({ status: "in", user });
}

export async function logout() {
  await http.post("/api/auth/logout").catch(() => {});
  setCurrentProfile(null);
  set({ status: "out" });
}

export const changePassword = (current: string, next: string) => http.post<void>("/api/auth/password", { current, next });

// 요청 중에 로그인이 풀렸거나(401) 기간이 끝났거나 정지됐으면(403) → 로그인 화면 (client.ts 가 부름)
export function onAuthError(status: number, code: string, message: string) {
  if (state.status !== "in") return;
  if (status === 401 || (status === 403 && (code === "EXPIRED" || code === "DISABLED"))) {
    setCurrentProfile(null);
    set({ status: "out", message: status === 403 ? message : "다시 로그인해 주세요" });
  }
}

setAuthListener(onAuthError);

// 남은 기간 글자 ("영구", "3일 4시간 남음", "기간 끝남")
export function remaining(u: Pick<User, "expiresAt" | "role">, now = Date.now()) {
  if (u.role === "admin" || !u.expiresAt) return "영구";
  const ms = new Date(u.expiresAt).getTime() - now;
  if (ms <= 0) return "기간 끝남";
  const h = Math.floor(ms / 3600_000);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}일 ${h % 24}시간 남음` : h > 0 ? `${h}시간 남음` : `${Math.max(1, Math.floor(ms / 60_000))}분 남음`;
}

// ---------- 관리자 ----------
export const admin = {
  users: () => http.get<ManagedUser[]>("/api/admin/users"),
  create: (body: { username: string; password: string; plan: Plan }) => http.post<ManagedUser>("/api/admin/users", body),
  update: (id: string, patch: { plan?: Plan; extend?: Plan; disabled?: boolean; password?: string }) => http.patch<ManagedUser>(`/api/admin/users/${id}`, patch),
  remove: (id: string) => http.delete(`/api/admin/users/${id}`),
};
