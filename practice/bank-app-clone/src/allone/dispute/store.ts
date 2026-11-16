// 이의제기 화면끼리 주고받는 것 (영역 안에서만):
//  - 영업점검색에서 고른 영업점 → 밑에 숨어 있는 신청 전 확인 화면 (그 화면이 듣고 있다가 바로 받음 — 숨은 채로 그려 두어 돌아오는 cut 에 이미 반영)
//  - useDisputeVeil(): 웹 화면(이의제기 쪽)의 로딩 = 흰 막 51% + 가운데 스피너. 막은 떠나는 화면이 그리고 스피너는 공용 로딩 층
//    (nav.ts LOAD disputeApply · branchOpen 의 dimFade.from 이 이동이 끝난 한참 뒤라 공용 검은 막은 켜지지 않음). 녹화 C4 1.607 · 6.174 · 9.157
//  - useStaged(steps): 화면이 처음 그려진 뒤 ms 마다 단계 (머리줄 제목 · 그림이 내용보다 조금 늦게 뜸)
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useAoReturn } from "../nav";
import type { AoBranch } from "./content";

// ---------- 고른 영업점 ----------
const pickListeners = new Set<(b: AoBranch) => void>();
export function onDisputeBranchPick(cb: (b: AoBranch) => void) {
  pickListeners.add(cb);
  return () => void pickListeners.delete(cb);
}
export const pickDisputeBranch = (b: AoBranch) => pickListeners.forEach((fn) => fn(b));

// ---------- 흰 막 ----------
// run(go): 이동이 받아들여지면 흰 막을 켬. 막은 이 화면이 밑으로 숨을 때까지 그대로 (새 화면은 cut 뒤 한두 프레임 늦게 그려짐 — 그 사이에도 막),
// 다시 맨 위가 되면(뒤로 돌아옴) 걷음. go 가 false 로 끝나면(잠김 · 막 도중 뒤로) 바로 걷음
export function useDisputeVeil() {
  const [veil, setVeil] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => void (live.current = false);
  }, []);
  useAoReturn(() => setVeil(false));
  const run = useCallback((go: () => Promise<boolean>) => {
    setVeil(true);
    void go().then((ok) => !ok && live.current && setVeil(false));
  }, []);
  return { veil, run };
}

// ---------- 처음 그린 뒤 단계 ----------
// steps: 단계별 시각 (ms, 오름차순). 돌려줌: 지나간 단계 수 (0 = 아직 아무것도). 화면이 처음 그려질 때 한 번만
export function useStaged(steps: readonly number[]) {
  const [n, setN] = useState(0);
  const first = useRef(steps);
  useEffect(() => {
    const ts = first.current.map((ms, i) => window.setTimeout(() => setN((v) => Math.max(v, i + 1)), ms));
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, []);
  return n;
}

// 화면이 사라질 때 같이 지울 타이머들
export function useTimers() {
  const ts = useRef<number[]>([]);
  useEffect(() => () => ts.current.forEach((t) => window.clearTimeout(t)), []);
  return useCallback((ms: number, fn: () => void) => {
    ts.current.push(window.setTimeout(fn, ms));
  }, []);
}

// ---------- 오른쪽 스크롤 막대 (iOS 웹뷰처럼) ----------
// 스크롤하면 나타나고 983ms 뒤 117ms 동안 사라짐 (C4 4.924 → 5.907–6.024). 폭 3 (화면 x 387–390), 위아래 2 · 3.5 안쪽 (C4 4.374 · 11.557)
// 숨은 층에서 일어난 스크롤(영업점을 고르고 돌아오기 전)은 보이지 않음
export interface DspScrollBarState {
  top: number; // 화면 층 기준 (머리줄 50 포함)
  height: number;
  on: boolean;
}
const DSP_BAR_HOLD = 983; // 사라지는 117ms 는 dispute.css .ao-dsp-sbar
export function useScrollBar(body: RefObject<HTMLDivElement | null>, active: boolean) {
  const [bar, setBar] = useState<DspScrollBarState>({ top: 0, height: 0, on: false });
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onScroll = useCallback(() => {
    const el = body.current;
    if (!el || !active) return;
    const sh = el.scrollHeight;
    const ch = el.clientHeight;
    if (sh <= ch) return;
    const st = el.scrollTop;
    const top = (st / sh) * ch + 2;
    const bottom = ((st + ch) / sh) * ch - 3.5;
    setBar({ top: el.offsetTop + top, height: Math.max(0, bottom - top), on: true });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBar((b) => ({ ...b, on: false })), DSP_BAR_HOLD);
  }, [body, active]);
  return { bar, onScroll };
}
