// 녹화 맨 앞에 인트로 영상을 붙일지 켜고 끄기. 캡쳐모드(capture.ts)와 같은 방식으로 이 브라우저에 기억됨.
// 실제로 이어붙이는 동작은 프로그램판(Electron, electronBridge.ts)에서만 일어난다 — 웹판은 켜 둬도 그냥 평소처럼 저장됨.
const KEY = "introVideo";

function stored() {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

let on = stored();
const listeners = new Set<() => void>();

export function isIntroOn() {
  return on;
}

export function setIntroOn(next: boolean) {
  on = next;
  try {
    if (next) localStorage.setItem(KEY, "on");
    else localStorage.removeItem(KEY);
  } catch {
    // 저장 못 하면 이번에만
  }
  listeners.forEach((fn) => fn());
}

export const subscribeIntro = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));
