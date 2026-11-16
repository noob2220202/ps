// kakao2 로딩 막: 폰 화면 전체(상태바 띠 포함, 852pt)를 rgba(0,0,0,.34)로 덮고 가운데 스피너. 상태바 글자 · 아일랜드는 덮지 않음.
// 한 화면이 켜고 다른 화면이 끄므로(홈 이체 → 이체 모달, 통장 거래 → 거래상세) 전역 하나 (LoadingDim.tsx 가 폰 화면 안에 한 번 그림)
//   showK2Dim()  — 그 프레임에 바로 나타남 (페이드 없음), 터치 막음
//   leaveK2Dim() — 167ms cubic-bezier(.42,0,.58,1) 로 스피너와 같이 흐려지고 사라짐 (데이터가 그려진 프레임에 부름)
//   cutK2Dim()   — 바로 없앰 (이체: 흐려지기 시작하고 67ms 뒤 모달이 올라올 때, critic.md C6)
import { useSyncExternalStore } from "react";

export type K2DimState = { id: number; leaving: boolean; spinner: boolean; spinnerColor: string };

export const K2_DIM_FADE_MS = 167;
// 스피너 색: 어두운 홈 위 #dcdcdc, 흰 화면 위 #e9e9e9 (critic.md C2)
export const K2_SPIN_ON_DARK = "#dcdcdc";
export const K2_SPIN_ON_LIGHT = "#e9e9e9";

let state: K2DimState | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const set = (next: K2DimState | null) => {
  state = next;
  listeners.forEach((fn) => fn());
};

export function showK2Dim({ spinner = true, spinnerColor = K2_SPIN_ON_LIGHT }: { spinner?: boolean; spinnerColor?: string } = {}) {
  set({ id: ++seq, leaving: false, spinner, spinnerColor });
}
export function leaveK2Dim() {
  if (state && !state.leaving) set({ ...state, leaving: true });
}
export function cutK2Dim() {
  if (state) set(null);
}
// LoadingDim: 흐려지기가 끝남 (그사이 다시 켰으면 그대로 둠)
export function endK2Dim(id: number) {
  if (state?.id === id) set(null);
}
export const isK2DimUp = () => state !== null;
export const useK2Dim = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => state,
  );
