import { currentApp, currentProfileId } from "../profile/session";
import type { ApiErrorBody } from "./types";

// 서버가 2xx가 아닌 응답을 주면 이 에러를 던진다. status/code/fields로 화면이 에러를 구분해서 보여줄 수 있다.
export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(status: number, body: Partial<ApiErrorBody> | undefined) {
    super(body?.message ?? `요청 실패 (${status})`);
    this.status = status;
    this.code = body?.code ?? "UNKNOWN";
    this.fields = body?.fields;
  }
}

// 진짜 백엔드를 붙이면 여기만 바꾸면 된다 (예: "https://api.example.com")
const BASE = "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // 어느 프로필의 데이터인지 서버에 알려주는 헤더 (서버가 그 프로필의 DB 파일로 처리)
  const profile = currentProfileId();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(profile && { "X-Profile": profile }),
      ...(currentApp() === "nh" && { "X-App": "nh" }), // 콕뱅크면 그 프로필의 콕뱅크 DB
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, data);
  if (method !== "GET") invalidate(); // 데이터를 바꾸는 요청이 성공하면, 화면들이 다시 불러오도록 알림
  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: (path: string) => request<void>("DELETE", path),
};

// ---------- 캐시 무효화 ----------
// 데이터 버전 번호. 바뀌면 useApi를 쓰는 모든 화면이 다시 요청한다
// (React Query의 invalidateQueries와 같은 개념).
let version = 0;
const listeners = new Set<() => void>();
export function invalidate() {
  version++;
  listeners.forEach((fn) => fn());
}
export const getVersion = () => version;
export function subscribeVersion(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
