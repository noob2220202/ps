// 녹화 인트로 (kbank2 서버만, session.ts HAS_INTRO): 켜면 녹화 시작 때 폰 화면에 실제 기기 인트로 영상(기기 홈 화면 → 금융 폴더 →
// K 아이콘 탭 → 시작화면이 반쯤 떠오름)을 먼저 틀고, 끝나자마자 앱 시작화면으로 이어 붙인다 (recorder.ts).
// 폰 아래 스위치 줄에서 켜고 끔. <html data-intro="on"> 에 기억됨 (i-ONE Bank 단독판 ibk-app 과 같은 방식)
import { useSyncExternalStore } from "react";
import { HAS_INTRO } from "../profile/session";

const KEY = "intro";
const listeners = new Set<() => void>();

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off"; // 기본 켜짐
  } catch {
    return true;
  }
}

let on = HAS_INTRO && stored();
if (HAS_INTRO) document.documentElement.dataset.intro = on ? "on" : "off";

export const isIntroOn = () => on;

export function setIntro(next: boolean) {
  on = HAS_INTRO && next;
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

// 상태바 화면녹화 표시(괄호 안 캠코더) 깜빡임: 1초 주기(0.5초 켜짐 · 0.5초 꺼짐, 녹화 12.7~30초 프레임마다 잼).
// blinkEpoch = 켜짐이 시작된 시각(performance.now). 인트로 영상이 끝나는 순간엔 켜진 지 0.33초째(녹화 5.27초에 켜짐, 5.60초에 끝남)
export const BLINK_MS = 1000;
let blinkEpoch = performance.now();
const blinkListeners = new Set<() => void>();
export function syncBlink(onForMs: number) {
  blinkEpoch = performance.now() - onForMs;
  blinkListeners.forEach((fn) => fn());
}
export const useBlinkEpoch = () =>
  useSyncExternalStore(
    (fn) => (blinkListeners.add(fn), () => void blinkListeners.delete(fn)),
    () => blinkEpoch,
  );
