// 녹화 인트로 (kbank2 · ibk2 서버만, session.ts HAS_INTRO): 켜면 녹화 시작 때 폰 화면에 실제 기기 인트로 영상(기기 홈 화면 → 금융 폴더 →
// K 아이콘 탭 → 시작화면이 반쯤 떠오름)을 먼저 틀고, 끝나자마자 앱 시작화면으로 이어 붙인다 (recorder.ts).
// 폰 아래 스위치 줄에서 켜고 끔 (갤럭시 모드만). 이 브라우저의 localStorage 'intro' 에 기억됨 (기본 켜짐).
// 인트로를 끄면 상태바의 화면녹화 표시도 없음 (PhoneFrame KbankLeft) — kbank 와 같은 상태바
import { useSyncExternalStore } from "react";
import { APP, HAS_INTRO } from "../profile/session";

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

export const isIntroOn = () => on;

export function setIntro(next: boolean) {
  on = HAS_INTRO && next;
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

// 상태바 화면녹화 표시(괄호 안 캠코더) 깜빡임: 0.986초 주기, 반은 켜짐 (녹화 원본 프레임 시각으로 잼: 켜짐 5.24 · 10.17 · … · 29.93초
// 18번을 직선 맞춤 → 주기 985.8ms, 켜짐 길이 491~508ms). blinkEpoch = 켜짐이 시작된 시각(performance.now).
// 인트로 영상이 끝나는 순간엔 켜진 지 0.37초째 (recorder.ts INTRO.blinkOnMs)
// ibk2(i-ONE Bank 인트로 기기)는 1초 주기(0.5초 켜짐 · 0.5초 꺼짐), 영상이 끝날 때 켜진 지 0.25초째
export const BLINK_MS = APP === "ibk" ? 1000 : 986;
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
