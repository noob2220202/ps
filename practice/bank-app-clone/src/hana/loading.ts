import { useCallback, useSyncExternalStore } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";

// 하나원큐는 화면을 옮길 때 '빈 페이지 + 초록 원호' 가 잠깐 지나간다 (라이트 녹화 30fps: 보내기 → 홈이 밀려 나간 뒤
// 흰 빈 페이지 가운데 원호 ≈200ms → 원호 없는 빈 페이지 ≈430ms → 이체 화면. 완료 → 거래내역조회는 ≈170ms + 330ms.
// 상태바는 그대로, 페이지만 비어 있음). App 이 HanaLoadingLayer 한 장을 폰 안에 그리고, 어느 화면이든 여기 상태를 올려 켠다.
type Phase = "spinner" | "blank" | null;
let phase: Phase = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const subscribeHanaLoading = (f: () => void) => (subs.add(f), () => void subs.delete(f));
export const getHanaLoading = () => phase;
export const useHanaLoading = () => useSyncExternalStore(subscribeHanaLoading, getHanaLoading);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

// navigate 대신: 원호 → 빈 페이지 순서로 덮은 채 이동하고, 새 화면이 그려진 뒤 막을 걷음
export function useHanaGo() {
  const navigate = useNavigate();
  return useCallback(
    (to: string, options?: NavigateOptions & { spinner?: number; blank?: number }) => {
      const { spinner = 200, blank = 430, ...nav } = options ?? {};
      phase = "spinner";
      emit();
      sleep(spinner)
        .then(() => {
          phase = "blank";
          emit();
          navigate(to, nav);
        })
        .then(() => sleep(blank))
        .then(nextPaint)
        .finally(() => {
          phase = null;
          emit();
        });
    },
    [navigate],
  );
}
