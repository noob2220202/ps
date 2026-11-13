// 토스 로딩 층 (전역 하나, TossOverlay 의 TossLoadingLayer 가 그림 — kakao2 dim.ts 처럼 주인은 여기 하나). plan.md §1.3 LOAD, §3.3
//  showTossLoad()   LOAD 화면: 상태바 아래 화면 전체가 빈 #171619 + 가운데 회색 스피너(⌀30, (192, 433)). 그 프레임에 바로 (페이드 없음), 터치 막음
//  cutTossLoad()    바로 없앰 — 다음 화면 push 가 시작하는 프레임에 (flow.ts goSend)
//  showTossWaitBox(afterMs = 300) "잠시만 기다려주세요." 상자 (x 10–374, y 418–496): afterMs 뒤에도 아직이면 나타남. 돌려준 함수로 끔
//  hideTossWaitBox()
import { useSyncExternalStore } from "react";

export type TossLoadState = { load: number | null; wait: number | null };

let state: TossLoadState = { load: null, wait: null };
let seq = 0;
const listeners = new Set<() => void>();
const set = (next: Partial<TossLoadState>) => {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
};

export function showTossLoad() {
  const id = ++seq;
  set({ load: id });
  return id;
}
export function cutTossLoad(id?: number) {
  if (state.load !== null && (id === undefined || state.load === id)) set({ load: null });
}
export const isTossLoadUp = () => state.load !== null;

let waitTimer = 0;
export function showTossWaitBox(afterMs = 300) {
  const id = ++seq;
  window.clearTimeout(waitTimer);
  if (afterMs > 0) waitTimer = window.setTimeout(() => set({ wait: id }), afterMs);
  else set({ wait: id });
  return () => {
    window.clearTimeout(waitTimer);
    if (state.wait === id) set({ wait: null });
  };
}
export function hideTossWaitBox() {
  window.clearTimeout(waitTimer);
  if (state.wait !== null) set({ wait: null });
}
export function cutTossLoading() {
  window.clearTimeout(waitTimer);
  if (state.load !== null || state.wait !== null) set({ load: null, wait: null });
}

export const useTossLoading = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => state,
  );
