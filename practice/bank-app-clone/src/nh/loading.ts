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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

// navigate 대신: 로딩을 보여준 다음, **막이 덮인 채로** 이동하고 새 화면이 그려진 뒤에 막을 걷음.
// (녹화: 막 아래에서 이미 다음 화면으로 바뀌어 있고, 막이 걷히면 바로 밝은 새 화면 — v1 14.5~14.7초, v2 40.5~41.1초)
// after: 이동한 뒤 막을 더 덮고 있을 시간(새 화면 전환 80ms + 여유)
export function useNhGo() {
  const navigate = useNavigate();
  return useCallback(
    (to: string, options?: NavigateOptions & { minMs?: number; after?: number }) => {
      count++;
      emit();
      sleep(options?.minMs ?? 550)
        .then(() => navigate(to, options))
        .then(() => sleep(options?.after ?? 90))
        .then(nextPaint)
        .finally(() => {
          count--;
          emit();
        });
    },
    [navigate],
  );
}
