import { useCallback, useSyncExternalStore } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";

// 콕뱅크는 버튼을 누르면 화면 전체가 어두워지고 점 3개가 잠깐 돈 뒤에 다음 화면으로 넘어간다 (녹화1 13~15초).
// 어느 화면에서든 켤 수 있게 작은 전역 상태로 두고, App이 그 위에 한 장(NhLoadingLayer)만 그린다.
let count = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function subscribeNhLoading(f: () => void) {
  subs.add(f);
  return () => subs.delete(f);
}
export const isNhLoading = () => count > 0;

// 작업(fn)이 끝날 때까지, 그리고 최소 minMs 동안 로딩을 보여줌
export async function withNhLoading<T>(fn: () => Promise<T> | T, minMs = 550): Promise<T> {
  count++;
  emit();
  try {
    const [result] = await Promise.all([fn(), new Promise((r) => setTimeout(r, minMs))]);
    return result as T;
  } finally {
    count--;
    emit();
  }
}

export const useNhLoading = () => useSyncExternalStore(subscribeNhLoading, isNhLoading);

// navigate 대신: 로딩을 보여준 다음 이동
export function useNhGo() {
  const navigate = useNavigate();
  return useCallback(
    (to: string, options?: NavigateOptions) => {
      withNhLoading(() => undefined).then(() => navigate(to, options));
    },
    [navigate],
  );
}
