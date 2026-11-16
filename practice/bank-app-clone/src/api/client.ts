import { ALLONE, currentProfileId } from "../profile/session";
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

// 로그인이 풀렸을 때 알림 받을 곳 (auth.ts 가 등록. 서로 import 하면 순환이라 이렇게)
let authListener: ((status: number, code: string, message: string) => void) | null = null;
export const setAuthListener = (fn: typeof authListener) => (authListener = fn);

// 진짜 백엔드를 붙이면 여기만 바꾸면 된다 (예: "https://api.example.com")
const BASE = "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // 어느 프로필의 데이터인지 서버에 알려주는 헤더 (서버가 그 프로필의 DB 파일로 처리)
  const profile = currentProfileId();
  const res = await fetch(BASE + path, {
    method,
    // 올원뱅크: 같은 주소의 GET 을 여러 화면이 한꺼번에 다시 받을 때(잔액채우기 뒤 무효화 등) 브라우저 HTTP 캐시가 하나씩 차례로 보내서
    // (응답 지연 250ms × 개수) 로딩 막이 길어졌음 → 캐시를 거치지 않고 한꺼번에. 다른 앱은 그대로
    ...(ALLONE && method === "GET" && { cache: "no-store" as const }),
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(profile && { "X-Profile": profile }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) {
    const err = new ApiError(res.status, data);
    if (!path.startsWith("/api/auth/")) authListener?.(err.status, err.code, err.message);
    throw err;
  }
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
