import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ApiError, getVersion, http, subscribeVersion } from "./client";

// GET 요청 + 캐시를 한 번에. (React Query/SWR를 아주 작게 흉내낸 것)
//
// - 같은 주소를 전에 받아 둔 적이 있으면 그걸 "즉시" 보여주고, 뒤에서 새로 받아 바꾼다
//   (stale-while-revalidate). 그래서 두 번째 방문부터는 로딩 화면이 안 뜬다.
// - 데이터를 바꾸는 요청(POST/PATCH/DELETE)이 성공하면 client가 invalidate() → 버전이 올라가고
//   → 여기서 다시 요청. 개발자 패널에서 거래를 만들면 홈/내역이 알아서 갱신되는 원리.
// - 실패하면 status: "error" + retry. 이미 보여주던 데이터가 있으면 그대로 두고 에러만 알려준다.

const cache = new Map<string, unknown>();

export type ApiState<T> =
  | { status: "loading"; data?: undefined; error?: undefined; retry: () => void }
  | { status: "done"; data: T; error?: ApiError; retry: () => void }
  | { status: "error"; data?: undefined; error: ApiError; retry: () => void };

export function prefetch(path: string) {
  return http
    .get(path)
    .then((data) => cache.set(path, data))
    .catch(() => {}); // 실패하면 화면이 열릴 때 다시 요청함
}

export function useApi<T>(path: string): ApiState<T> {
  const version = useSyncExternalStore(subscribeVersion, getVersion);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data?: T; error?: ApiError; path: string }>(() => ({
    data: cache.get(path) as T | undefined,
    path,
  }));

  useEffect(() => {
    let cancelled = false; // 응답 오기 전에 화면을 떠나거나 주소가 바뀌면 결과를 버림 (레이스 컨디션 방지)
    http
      .get<T>(path)
      .then((data) => {
        cache.set(path, data);
        if (!cancelled) setState({ data, path });
      })
      .catch((error: unknown) => {
        const e = error instanceof ApiError ? error : new ApiError(0, { message: String(error) });
        if (!cancelled) setState((s) => ({ data: s.path === path ? s.data : undefined, error: e, path }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, version, attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, error: undefined }));
    setAttempt((n) => n + 1);
  }, []);

  const data = state.path === path ? state.data : (cache.get(path) as T | undefined);
  if (data !== undefined) return { status: "done", data, error: state.error, retry };
  if (state.error && state.path === path) return { status: "error", error: state.error, retry };
  return { status: "loading", retry };
}
