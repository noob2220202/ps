// NH올원뱅크 상태바 글자색 덮어쓰기 (AlloneStatusBar 가 읽음). 보통은 화면의 useStatusBar(bg, fg) 의 fg (allone 화면은 모두 "dark").
// 네이티브 막이 상태바 띠까지 덮을 때 막을 연 쪽이 정함 (plan.md §3.1, infra.md §1.5):
//  setAoStatusFg("light", { iconsDelay: 600, clockDelay: 667, clockMs: 100 })   금액 입력(T7): 아이콘은 600ms 뒤 한 프레임에, 시계는 667ms 뒤 100ms 동안
//  setAoStatusFg(null)                                                        닫으면 한 프레임에 원래 색 (검정)
//  계좌 비밀번호(T3)는 검정 그대로 (부르지 않음)
//  인트로: 장면 동안 "light", 녹아 사라질 때 setAoStatusFg(null, { iconsDelay: 33, iconsMs: 250, clockDelay: 33, clockMs: 250, easing: AO_DISSOLVE_EASE })
// fg: null = 덮어쓰기 없음. 지연 · 길이는 이번 바뀜에만 (다음 바뀜은 다시 정함)
import { useSyncExternalStore } from "react";

export type AoFg = "light" | "dark";
export interface AoStatusFgTiming {
  iconsDelay?: number; // 오른쪽 아이콘(신호 · LTE · 배터리)이 바뀌기 시작할 때까지
  iconsMs?: number; // 아이콘이 바뀌는 길이 (0 = 한 프레임에)
  clockDelay?: number; // 시계가 바뀌기 시작할 때까지
  clockMs?: number; // 시계가 바뀌는 길이 (0 = 한 프레임에)
  easing?: string; // CSS 곡선 (기본 linear)
}
export interface AoStatusFgState {
  fg: AoFg | null;
  timing: Required<AoStatusFgTiming>;
  seq: number;
  at: number; // 부른 시각 (performance.now) — 지연 · 길이는 이 시각부터 잼 (React 가 그리는 데 걸린 시간 · 프레임 위상과 상관없이)
}

const ZERO: Required<AoStatusFgTiming> = { iconsDelay: 0, iconsMs: 0, clockDelay: 0, clockMs: 0, easing: "linear" };
let state: AoStatusFgState = { fg: null, timing: ZERO, seq: 0, at: 0 };
const listeners = new Set<() => void>();

export function setAoStatusFg(fg: AoFg | null, timing: AoStatusFgTiming = {}) {
  state = { fg, timing: { ...ZERO, ...timing }, seq: state.seq + 1, at: performance.now() };
  listeners.forEach((fn) => fn());
}
// 녹화 다시 시작 · 로그아웃 (AlloneOverlay): 덮어쓰기 없이 바로
export const resetAoStatusFg = () => {
  if (state.fg !== null) setAoStatusFg(null);
};
export const aoStatusFg = () => state;
export const useAoStatusFg = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => state,
  );
