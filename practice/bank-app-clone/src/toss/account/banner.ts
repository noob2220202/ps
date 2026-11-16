// 통장 배너 상태 (BankBanner.tsx 가 그림). 방문마다 두 가지를 번갈아, × 는 앱을 다시 열 때까지
import { useEffect, useState } from "react";
import { ACCT_BANNERS } from "./menu";

export const ACCT_BANNER = { after: 500, open: 650, close: 350 } as const;

// 이 앱 실행 동안의 기억: 몇 번째 방문인지(주소 칸 key 마다 한 번), × 를 눌렀는지
const variantByKey = new Map<string, number>();
let visits = 0;
let dismissed = false;

type BannerState = "none" | "open" | "closing";
export interface AcctBannerState {
  variant: (typeof ACCT_BANNERS)[number] | null;
  state: BannerState;
  shown: boolean; // 펼쳐졌거나 펼치는 중 (머리줄 제목 기준선 · 카드 모서리)
  still: boolean; // 처음부터 펼친 채 (뒤로 와서 다시 그림 — 펼침 · 글자 움직임 없음)
  close: () => void;
}

// 뒤로 와서 다시 그릴 때: 펼쳐져 있던 배너는 펼친 채 그대로 (움직임 없이)
const stateByKey = new Map<string, BannerState>();

export function useBankBanner(key: string, contentReady: boolean): AcctBannerState {
  if (!variantByKey.has(key)) variantByKey.set(key, visits++ % ACCT_BANNERS.length);
  const idx = variantByKey.get(key) ?? 0;
  const [state, setState] = useState<BannerState>(() => (stateByKey.get(key) === "open" && !dismissed ? "open" : "none"));
  const [still] = useState(() => state === "open");
  useEffect(() => {
    stateByKey.set(key, state === "closing" ? "none" : state);
  }, [key, state]);
  useEffect(() => {
    if (!contentReady || dismissed) return;
    const t = window.setTimeout(() => setState((s) => (s === "none" && !dismissed ? "open" : s)), ACCT_BANNER.after);
    return () => window.clearTimeout(t);
  }, [contentReady]);
  useEffect(() => {
    if (state !== "closing") return;
    const t = window.setTimeout(() => setState("none"), ACCT_BANNER.close + 30);
    return () => window.clearTimeout(t);
  }, [state]);
  const close = () => {
    dismissed = true;
    setState((s) => (s === "open" ? "closing" : s));
  };
  return { variant: state === "none" ? null : ACCT_BANNERS[idx], state, shown: state === "open", still, close };
}
