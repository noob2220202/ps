// NH올원뱅크 토스트 (전역 하나, AlloneOverlay 의 AoToastLayer 가 z 54 에 그림 — 웹 로딩 막 위, 네이티브 시트 아래). plan.md §3.3, transfer.md §5.3
//  aoToast(text, { bottom })  알약 rgba(0,0,0,.80) · 흰 14.3/400 · 안쪽 12 × 20 · 둥글기 22 · 가운데. 200ms 나타나 2000ms 머문 뒤 200ms 사라짐
//    bottom = 토스트 아래 끝의 화면 y (pt, 0 = 상태바 위끝, 852 틀 기준). 기본 712 (아래 버튼 위). T2 키패드 판 위는 419.
//    진짜 폰(500px 이하)에서는 아래 띠(안전 영역)에서 같은 거리 — 818 − bottom 만큼 웹뷰 아래끝에서 위
//  cutAoToast()  바로 없앰 (녹화 다시 시작 · 로그아웃)
import { useSyncExternalStore } from "react";
import { AO_TOAST } from "./motion";

export interface AoToastState {
  id: number;
  text: string;
  bottom: number;
  leaving: boolean;
}

let state: AoToastState | null = null;
let seq = 0;
let timer = 0;
const listeners = new Set<() => void>();
const set = (next: AoToastState | null) => {
  state = next;
  listeners.forEach((fn) => fn());
};

export const AO_TOAST_BOTTOM = 712;

export function aoToast(text: string, { bottom = AO_TOAST_BOTTOM }: { bottom?: number } = {}) {
  window.clearTimeout(timer);
  const id = ++seq;
  set({ id, text, bottom, leaving: false });
  timer = window.setTimeout(() => {
    if (state?.id === id) set({ ...state, leaving: true });
    timer = window.setTimeout(() => state?.id === id && set(null), AO_TOAST.fade + 50);
  }, AO_TOAST.fade + AO_TOAST.hold);
}

// AoToastLayer: 사라지기 애니메이션이 끝남
export function endAoToast(id: number) {
  if (state?.id === id && state.leaving) {
    window.clearTimeout(timer);
    set(null);
  }
}

export function cutAoToast() {
  window.clearTimeout(timer);
  if (state) set(null);
}

export const useAoToast = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => state,
  );
