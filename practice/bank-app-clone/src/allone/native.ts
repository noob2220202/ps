// NH올원뱅크 "네이티브 층" 자리들 (AlloneOverlay 가 폰 화면 위에 그림, plan.md §3.1 z 순서).
// 웹뷰(.phone__viewport, 59–818) 밖까지 덮는 것 — 금액 키패드 판, 네이티브 시트 · 막, iOS 키보드, 녹화 인트로 장면 — 은 이 자리에 그림 (AoNativePortal).
//  panel 53  T2 금액 키패드 판 (웹 로딩 막 51 위, 막에 덮이지 않음)
//  sheet 55  네이티브 막 + 시트 (금액 입력 T7 · 계좌 비밀번호 T3) · 스플래시 그림 — id "ao-native"
//  keyboard 56  iOS 키보드
//  scene 57  녹화 인트로 홈 화면 장면 (launch 영역) — setAoScene(node) 로 넣거나 #ao-native-scene 에 직접
// 토스트(54)와 웹 로딩 막(51)은 따로 (toast.ts · loading.ts). 홈 인디케이터 58, 아일랜드 60, 상태바 글자 70 은 PhoneFrame
import { useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";

export type AoNativeLayer = "panel" | "sheet" | "keyboard" | "scene";
export const AO_NATIVE_IDS: Record<AoNativeLayer, string> = {
  panel: "ao-native-panel",
  sheet: "ao-native",
  keyboard: "ao-native-kb",
  scene: "ao-native-scene",
};

const hosts: Record<AoNativeLayer, HTMLElement | null> = { panel: null, sheet: null, keyboard: null, scene: null };
const hostListeners = new Set<() => void>();
export function setAoNativeHost(layer: AoNativeLayer, el: HTMLElement | null) {
  if (hosts[layer] === el) return;
  hosts[layer] = el;
  hostListeners.forEach((fn) => fn());
}
const subscribeHosts = (fn: () => void) => (hostListeners.add(fn), () => void hostListeners.delete(fn));
export const useAoNativeHost = (layer: AoNativeLayer) => useSyncExternalStore(subscribeHosts, () => hosts[layer]);
export const aoNativeHost = (layer: AoNativeLayer) => hosts[layer];

// ---------- 인트로 장면 자리 (launch 영역의 showAlloneScene 이 씀) ----------
// 녹화기가 "off" 다음 프레임을 첫 장면으로 찍으므로 바로 그림 (flushSync)
let scene: ReactNode = null;
const sceneListeners = new Set<() => void>();
export function setAoScene(node: ReactNode) {
  const apply = () => {
    scene = node;
    sceneListeners.forEach((fn) => fn());
  };
  try {
    flushSync(apply);
  } catch {
    apply(); // 렌더 도중에 불렸으면 그냥
  }
}
const subscribeScene = (fn: () => void) => (sceneListeners.add(fn), () => void sceneListeners.delete(fn));
const getScene = () => scene;
export const useAoScene = () => useSyncExternalStore(subscribeScene, getScene);

// ---------- 네이티브 층 비우기 ----------
// 녹화를 다시 시작(RESTART "off")하거나 로그인이 풀리면 AlloneOverlay 가 부름: 웹 로딩 막 · 토스트 · 상태바 글자색 덮어쓰기를 걷고,
// 네이티브 시트 · 키패드 판 · 키보드를 연 화면이 있으면 닫으라고 알림 (화면이 사라지며 portal 도 같이 사라지지만, 남아 있는 화면용)
const resetListeners = new Set<() => void>();
export function onAoNativeReset(cb: () => void) {
  resetListeners.add(cb);
  return () => void resetListeners.delete(cb);
}
export const aoNativeReset = () => resetListeners.forEach((fn) => fn());
