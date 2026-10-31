// 녹화 인트로 on/off: 켜면 녹화 시작 시 폰 화면에 실제 기기 인트로 영상(홈 화면 → 앱 찾기 → 열기)을
// 먼저 재생하고, 끝나자마자 바로 앱 시작화면으로 이어 붙인다 (recorder.ts). <html data-intro="on"> 에 기억됨.
import { useSyncExternalStore } from "react";

const KEY = "intro";
const listeners = new Set<() => void>();

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off"; // 기본 켜짐
  } catch {
    return true;
  }
}

let on = stored();
document.documentElement.dataset.intro = on ? "on" : "off";

export const isIntroOn = () => on;

export function setIntro(next: boolean) {
  on = next;
  document.documentElement.dataset.intro = on ? "on" : "off";
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // 저장 못 하면 이번 세션만
  }
  listeners.forEach((fn) => fn());
}

export const useIntro = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => on,
  );
