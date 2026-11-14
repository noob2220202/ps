// kakao2 상태바 (StatusBar.tsx K2StatusBar)를 밖에서 움직이는 값들
import { useSyncExternalStore } from "react";

// ---------- 시각 옆 표시 칸: 달(앱 보관함 · 인트로) | 파란 위치 표시 | 위치 화살표 ----------
// null(기본) = 자동: 앱이 켜진 때(launch.ts)부터 파란 위치 표시가 나타났다가 4.3초 뒤 화살표로, 그 뒤로 화살표
export type K2Indicator = "moon" | "bubble" | "arrow";
let indicator: K2Indicator | null = null;
const indListeners = new Set<() => void>();
export function setK2Indicator(next: K2Indicator | null) {
  if (indicator === next) return;
  indicator = next;
  indListeners.forEach((fn) => fn());
}
export const useK2Indicator = () =>
  useSyncExternalStore(
    (fn) => (indListeners.add(fn), () => void indListeners.delete(fn)),
    () => indicator,
  );

// ---------- 시계 글자색 전환 길이 ----------
// 녹화: 오른쪽 아이콘 · 화살표는 한 프레임에 바뀌고 시계만 서서히 (device.md §5) — 화면이 바뀔 때 550ms, 시트 배경이 깔리고 걷힐 때 200ms,
// 이체 모달을 닫을 때는 0 (바로). 다음 한 번의 글자색 변경에만 쓸 길이를 정해 둠 (1초 안에 안 바뀌면 버림). 이체 모달 닫기는 ScreenStack 이 부름
export const K2_CLOCK_MS = 550;
let clockOnce: { ms: number; until: number } | null = null;
export function k2ClockOnce(ms: number) {
  clockOnce = { ms, until: performance.now() + 1000 };
}
// 상태바가 글자색을 바꿀 때 읽음 (지우지는 않음 — 다 바꾼 뒤 clearK2ClockOnce)
export const pendingK2ClockMs = () => (clockOnce && performance.now() < clockOnce.until ? clockOnce.ms : null);
export const clearK2ClockOnce = () => void (clockOnce = null);

// ---------- 시각 옆 칸 그림 (393 × 54 상태바 좌표, 시각이 '10:47' 일 때 자리 — 시각 폭만큼 옮겨 그림) ----------
// 위치 화살표 (location.fill, 오른쪽 위를 가리킴): 잉크 75.60 – 87.93 × 23.31 – 35.64. 녹화 31초 화살표에 맞춘 네 꼭짓점을
// 같은 색 선(두께 K2_ARROW_ROUND)으로 둘러 모서리를 반지름 1.05 로 둥글게 (안쪽 오목한 곳은 각진 채)
export const K2_ARROW_PATH = "M86.85 24.33L76.85 29.01L82.3 28.93L82.47 34.27Z";
export const K2_ARROW_ROUND = 2.1;
// 파란 위치 표시: 지름 16 원 #0187ff (가운데 81.93, 29.31) + 흰 화살표 (잉크 77.94 – 85.26 × 25.98 – 33.31)
export const K2_BUBBLE_ARROW = "translate(33.06 12.14) scale(0.5937)";
// 달 (앱 보관함 집중 모드): 큰 원에서 오른쪽 위 원을 뺀 초승달 (☾), 잉크 75.94 – 88.59 × 22.98 – 35.64.
// 녹화 0.30 – 0.37초(또렷해진 뒤) 5장 평균의 투명도에 두 원을 맞춤 (P2 인트로)
export const K2_MOON = { cx: 82.5, cy: 29.13, r: 6.43, cutX: 85.63, cutY: 26.12, cutR: 5.33 };
