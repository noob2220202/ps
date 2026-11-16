// NH올원뱅크: 앱이 켜진 시각 D (performance.now 기준, plan.md §1.1). 켜진 직후에만 도는 것 — 홈 인디케이터(D+250 → D+1100) — 은 이 시각부터 잼.
//  - 녹화 인트로: 녹화기가 장면을 깔 때 aoHoldLaunch() → 인트로가 녹아 사라지기 시작하는 순간 aoSetLaunchAt(D) (launch 영역 · recorder.ts)
//  - 그냥 켤 때(프로필 고름 · 새로고침 · 인트로 끈 녹화): App 이 시작화면(boot "splash")을 띄울 때 aoLaunchReady() → D = 지금 − 250ms
//    (흰 시작화면이 1.20초 뒤 스플래시로 — 인트로가 있을 때와 같은 시각표)
//  - App 은 이 값을 useLayoutEffect 에서 정함 → 시작화면(AlloneSplash)은 useEffect 안에서(또는 useAoLaunchAt 으로) 읽으면 이번 D 를 받음.
//    자식의 useLayoutEffect · 그리기 중에 읽으면 아직 지난번 값 (자식 효과가 부모 효과보다 먼저 돎)
import { useSyncExternalStore } from "react";
import { AO_LAUNCH_NO_INTRO_LEAD } from "./motion";

let launchAt: number | null = null;
let held = false;
let claimed = false; // 인트로가 정해 둔 값: 바로 뒤 aoLaunchReady() 가 덮어쓰지 않게
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

// 켜진 시각 D 를 정함 (기본 지금)
export function aoSetLaunchAt(t = performance.now()) {
  held = false;
  claimed = true;
  if (launchAt === t) return;
  launchAt = t;
  emit();
}

// 녹화 인트로: 장면이 보이는 동안은 켜짐 연출을 멈춰 둠 (홈 인디케이터 없음)
export function aoHoldLaunch() {
  held = true;
  claimed = false;
  if (launchAt === null) return;
  launchAt = null;
  emit();
}
export const aoLaunchHeld = () => held;

// App: 시작화면(boot "splash")이 뜸. 인트로가 잡아 두었거나 방금 정했으면 그대로, 아니면 D = 지금 − 250
export function aoLaunchReady() {
  if (held) return;
  if (claimed) {
    claimed = false;
    return;
  }
  launchAt = performance.now() - AO_LAUNCH_NO_INTRO_LEAD;
  emit();
}

export const aoLaunchAt = () => launchAt;
export const useAoLaunchAt = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => launchAt,
  );
