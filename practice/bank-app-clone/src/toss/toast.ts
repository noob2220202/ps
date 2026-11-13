// 토스트 "토스뱅크로 이동했어요" / "토스로 이동했어요" (전역 하나, TossOverlay 의 TossToast 가 그림). plan.md §3.3, home.md §2.7 · §3.3
//  들어옴: 위에서 −14dp → 0 스프링 (+240–330ms 에 +5.5dp 넘침, ≈800ms 에 멈춤) + 180ms 투명도 · 흐림
//  머묾: 들어온 뒤 1450ms 이상, 그리고 새 화면이 준비된 뒤(tossToastReady) 100ms 까지
//  나감: 200ms 위로 13dp + 흐려짐
// showTossToast(word, { waitReady: true }) 면 화면이 tossToastReady() 를 부를 때까지 기다림 (안 부르면 maxMs 에 나감).
// 통장 화면(BankScreen)은 내용이 그려지면 tossToastReady() 를 부를 것
import { useSyncExternalStore } from "react";

export type TossToastWord = "토스뱅크" | "토스";
export type TossToastState = { id: number; word: TossToastWord; leaving: boolean };

export const TOSS_TOAST = { minHold: 1450, afterReady: 100, maxHold: 2600, exit: 200, enter: 800 } as const;

let state: TossToastState | null = null;
let seq = 0;
let shownAt = 0;
let readyAt: number | null = null;
let timer = 0;
const listeners = new Set<() => void>();
const set = (next: TossToastState | null) => {
  state = next;
  listeners.forEach((fn) => fn());
};

function schedule() {
  window.clearTimeout(timer);
  if (!state || state.leaving) return;
  const now = performance.now();
  const until = readyAt === null ? shownAt + TOSS_TOAST.maxHold : Math.max(shownAt + TOSS_TOAST.minHold, readyAt + TOSS_TOAST.afterReady);
  const id = state.id;
  timer = window.setTimeout(() => {
    if (state?.id === id) set({ ...state, leaving: true });
  }, Math.max(0, until - now));
}

export function showTossToast(word: TossToastWord = "토스뱅크", { delay = 0, waitReady = false }: { delay?: number; waitReady?: boolean } = {}) {
  const show = () => {
    shownAt = performance.now();
    readyAt = waitReady ? null : shownAt;
    set({ id: ++seq, word, leaving: false });
    schedule();
  };
  if (delay > 0) window.setTimeout(show, delay);
  else show();
}
// 새 화면 내용이 준비됨 (토스트가 없으면 아무 일 없음)
export function tossToastReady() {
  if (!state || readyAt !== null) return;
  readyAt = performance.now();
  schedule();
}
export function hideTossToast() {
  if (state && !state.leaving) set({ ...state, leaving: true });
}
export function cutTossToast() {
  window.clearTimeout(timer);
  if (state) set(null);
}
// TossToast: 나가기 애니메이션이 끝남
export function endTossToast(id: number) {
  if (state?.id === id && state.leaving) set(null);
}
export const useTossToast = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => state,
  );
