import { useEffect, useSyncExternalStore } from "react";

// i-ONE Bank 전역 로딩: 앱 영역 한가운데 색 점 4개(IbkSpinner)와, 화면을 옮길 때 잠깐 덮는 빈 바탕(cover).
// 녹화(82d59fba): 화면 위에 점이 그냥 얹힘(어둡게 하지 않음). 홈 '이체' → 점 430ms(95.30~95.73) → 흰 화면 1~3프레임
// → 앱 영역 #fafafa + 점(처음부터 다시) → 새 화면이 한 번에 (spec/home.md 6-1, who.md 6.1). 사라질 때 ≈100ms 페이드아웃.
// App 이 IbkLoadingLayer 한 장을 폰 위에 그리고(PhoneFrame overlay), 어느 화면이든 여기 상태를 올려 켠다.
export interface IbkLoadingState {
  spin: number; // 점을 붙잡고 있는 수 (0 이면 꺼짐). 여럿이 동시에 잡아도 됨
  key: number; // 바뀌면 점을 처음(다 모인 한 점)부터 다시 — 녹화에서 로딩 표시를 껐다 켤 때마다 처음부터
  cover: string | null; // 앱 영역을 덮는 바탕색 (null = 안 덮음)
}
let st: IbkLoadingState = { spin: 0, key: 0, cover: null };
const subs = new Set<() => void>();
const set = (p: Partial<IbkLoadingState>) => {
  st = { ...st, ...p };
  subs.forEach((f) => f());
};
export const subscribeIbkLoading = (f: () => void) => (subs.add(f), () => void subs.delete(f));
export const getIbkLoading = () => st;
export const useIbkLoading = () => useSyncExternalStore(subscribeIbkLoading, getIbkLoading);

// 점 켜기. 돌려받은 함수를 부르면 놓음 (여러 번 불러도 한 번만). 꺼져 있다가 켜지면 처음부터 돔
export function holdIbkSpinner(): () => void {
  set({ spin: st.spin + 1, key: st.spin === 0 ? st.key + 1 : st.key });
  let done = false;
  return () => {
    if (done) return;
    done = true;
    set({ spin: Math.max(0, st.spin - 1) });
  };
}

// 켜진 채로 처음(한 점)부터 다시 (녹화 14.233·100.03초: 로딩 표시를 껐다 켬)
export const restartIbkSpinner = () => set({ key: st.key + 1 });

// 앱 영역 덮개: "#fafafa"(빈 로딩 화면) · "#ffffff"(바뀌는 순간 흰 화면) · null
export const setIbkCover = (color: string | null) => set({ cover: color });

// 화면이 데이터를 기다리는 동안 점을 붙잡기: useIbkSpinner(loading)
export function useIbkSpinner(active: boolean) {
  useEffect(() => (active ? holdIbkSpinner() : undefined), [active]);
}

export const ibkSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const ibkNextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// ms 동안 점만 보여 줌 ('다음' → 1.4초 원호 뒤 확인 화면 같은 곳). 끝나면 점은 100ms 페이드아웃
export async function ibkSpin(ms: number) {
  const release = holdIbkSpinner();
  await ibkSleep(ms);
  release();
}

// 일(work)이 끝날 때까지 + 최소 minMs 동안 점을 보여 줌
export async function withIbkSpinner<T>(work: Promise<T>, minMs = 0): Promise<T> {
  const release = holdIbkSpinner();
  try {
    const [v] = await Promise.all([work, ibkSleep(minMs)]);
    return v;
  } finally {
    release();
  }
}
