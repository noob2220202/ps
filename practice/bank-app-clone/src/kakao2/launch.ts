// kakao2: 앱이 켜진 시각 (performance.now 기준). 켜진 직후에만 도는 것들 — 상태바 파란 위치 표시 → 화살표, 홈 인디케이터,
// 홈 AI 알약 지우고 다시 쓰기 — 은 모두 이 시각부터 잼 (critic.md §2.1, 녹화 인트로가 끝나는 0.4167초 = 0)
// - 그냥 켤 때(프로필 고름 · 새로고침 · 인트로 없는 녹화): 홈이 뜨는 때 (App.tsx → launchReady)
// - 녹화 인트로: 영상을 트는 동안 홈을 밑에 미리 그려 두고(holdLaunch) 영상이 끝나는 순간 setLaunchAt (recorder.ts)
import { useSyncExternalStore } from "react";

let launchAt: number | null = null;
let held = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));

// 켜진 시각을 정함 (기본 지금). 같은 시각을 다시 넣으면 그대로, 다른 시각이면 켜짐 연출을 처음부터 다시
export function setLaunchAt(t = performance.now()) {
  held = false;
  if (launchAt === t) return;
  launchAt = t;
  emit();
}

// 녹화 인트로: 영상이 끝날 때까지 켜짐 연출을 멈춰 둠 (launchAt = null). 홈은 그동안 켜지기 전 모습 그대로
export function holdLaunch() {
  held = true;
  if (launchAt === null) return;
  launchAt = null;
  emit();
}

// App: 홈이 뜰 준비가 됨 (boot "ready"). 인트로가 잡아 두지 않았으면 지금이 켜진 시각
export function launchReady() {
  if (!held) setLaunchAt();
}

export const useLaunchAt = () => useSyncExternalStore(subscribe, () => launchAt);

// 켜짐 연출 시각표 (ms, launchAt 기준 · 녹화 시각 − 0.4167초). critic.md §2.1
export const LAUNCH = {
  homeIndicatorIn: 283, // 0.70 → 1.15초 나타남 (ease-out)
  homeIndicatorShown: 733,
  homeIndicatorOut: 1485, // 1.902 → 2.168초 사라짐 (linear)
  homeIndicatorGone: 1751,
  bubbleIn: 316, // 파란 위치 표시 0.733 → 0.942초 나타남
  bubbleShown: 525,
  bubbleOut: 4053, // 4.47초부터 작아지다 4.633초에 사라짐
  arrowIn: 4216, // 그 자리에 화살표가 9 → 12pt 로 커짐 (4.733초 끝)
  arrowShown: 4316,
  pillCollapse: 328, // 홈 AI 알약 (홈 화면이 씀)
  bannerFirst: 5391, // 홈 배너 첫 자동 넘김
  recDotPhase: 1173, // 녹화 점 k2-rec 위상 (syncBlink 값)
} as const;
