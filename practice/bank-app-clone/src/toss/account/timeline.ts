// 통장 영역 화면들의 '웹뷰처럼 단계별로 그려지는' 시간표와 계산 (account.md §3.2 · §3.5–3.6 · §2.7, plan.md §3.4 · §6.2 Q9).
// 녹화의 웹뷰 기다림(1–4초)은 줄였음. 데이터가 늦게 오면 그때부터 같은 간격으로 이어 감
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export interface AcctTimeline {
  barReady: number; // 진행 막대가 70 → 100% 로 차기 시작 (ms, 들어온 때부터)
  steps: readonly number[]; // phase 1, 2, … 가 되는 때
}

// 통장 (녹화 A 14.21 → 21.78초를 1.3초로): 진행 막대 150ms (TossProgressBar delay) · 500ms 에 다 참 ·
// 1 이름 줄 + 채우기/보내기 + 추천 뼈대 850 · 2 계좌 · 잔액 900 · 3 최근 거래 · 체크카드 줄 · '내 자산' 뼈대 1050 ·
// 4 이자 줄이 끼어듦 1150 · 5 전부 + 톱니 1300 · 배너는 그 500ms 뒤 (ACCT_BANNER.after)
export const ACCT_BANK = {
  barReady: 500,
  steps: [850, 900, 1050, 1150, 1300],
  titleAt: 186, // 머리줄 제목이 나타나는 스크롤 (이자 줄이 머리줄 밑으로 다 들어감, 배너 없을 때)
  bannerH: 180.8,
} as const;

// 거래내역 (녹화 A 45.5 → 49.05초, B 75.0 → 77.1초): 진행 막대 → 450ms 에 내용 + 머리줄 카드 · 관리, 그 400ms 뒤 파란 ✓ 800ms
export const ACCT_HISTORY = { barReady: 250, steps: [450], check: 400, checkHold: 800 } as const;

// 상세 내역 (녹화 A 56.40 → 57.75초): 350ms 에 내용
export const ACCT_DETAIL = { barReady: 150, steps: [350] } as const;

// 다른 은행 계좌 (녹화 B 161.5 빈 화면 → 161.75 뼈대 → 162.75 잔액 반짝임 → 163.0 내용 → 163.9 ✓):
// 1 뼈대 150 · 2 내용 + 톱니 450 (잔액 반짝임 1300ms 한 번) · 새로고침 아이콘은 들어올 때부터 돌다가 1350ms 에 ✓ 로
export const ACCT_OTHER = { barReady: 200, steps: [150, 450], spin: 1350, shimmer: 1300 } as const;

// ---------- 뒤로 와서 다시 그리는 화면 ----------
// ScreenStack 은 맨 위 화면만 붙여 두므로 뒤로 오면 화면을 새로 만듦. 녹화처럼 '쌓여 있던 화면은 받아 둔 그대로 바로' 보이게 (plan.md §1.4):
// 이 주소 칸(location.key)을 전에 그렸고 POP 으로 왔으면 단계 없이 끝 모습 + 스크롤 자리 되살림
const drawn = new Set<string>();
const scrollAt = new Map<string, number>();
export function useAcctRevisit() {
  const location = useLocation();
  const navType = useNavigationType();
  const key = location.key;
  const [revisit] = useState(() => navType === "POP" && drawn.has(key));
  useEffect(() => {
    drawn.add(key);
  }, [key]);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 되살린 스크롤 (처음 그릴 때 바로 — 화면이 한 번도 맨 위로 보이지 않게)
  const [savedScroll] = useState(() => (revisit ? (scrollAt.get(key) ?? 0) : 0));
  useLayoutEffect(() => {
    if (revisit && bodyRef.current) bodyRef.current.scrollTop = savedScroll;
  }, [revisit, savedScroll]);
  const saveScroll = useCallback((st: number) => scrollAt.set(key, st), [key]);
  return { revisit, key, bodyRef, savedScroll, saveScroll };
}

// 들어온 때(첫 렌더 뒤)부터 steps 시각마다 phase 를 올림. ready 가 아니면 기다렸다가, 늦게 오면 첫 단계를 지금으로 당겨 같은 간격으로.
// revisit 이면 처음부터 마지막 단계 (진행 막대 없음)
export function useAcctPhases(ready: boolean, t: AcctTimeline, revisit = false) {
  const [phase, setPhase] = useState(revisit ? t.steps.length : 0);
  const [barReady, setBarReady] = useState(revisit);
  const t0 = useRef(0);
  useEffect(() => {
    t0.current = performance.now();
  }, []);
  useEffect(() => {
    if (!ready || revisit) return;
    const now = performance.now();
    const base = Math.max(t0.current, now - t.steps[0]);
    const timers = t.steps.map((ms, i) => window.setTimeout(() => setPhase((p) => Math.max(p, i + 1)), Math.max(0, base + ms - now)));
    timers.push(window.setTimeout(() => setBarReady(true), Math.max(0, t0.current + t.barReady - now)));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [ready, t, revisit]);
  return { phase, barReady };
}

// '어제까지 쌓인 이자' (plan.md §2.2): 잔액 × 연 1% × (오늘 날짜 − 1) / 365, 1일엔 0원
export const acctInterest = (balance: number, now = new Date()) => Math.max(0, Math.floor((balance * 0.01 * (now.getDate() - 1)) / 365));

// 목록을 다 받은 뒤 (그리고 맨 위로 되돌아왔을 때) 잠깐 보이는 ✓ — delay 뒤 hold 동안, 200ms 에 사라짐
export function useAcctCheck(loaded: boolean, delay: number, hold: number) {
  const [on, setOn] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!loaded) return;
    const a = window.setTimeout(() => setOn(true), n ? 0 : delay);
    const b = window.setTimeout(() => setOn(false), (n ? 0 : delay) + hold);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [loaded, delay, hold, n]);
  // 아래로 300dp 넘게 내렸다가 맨 위로 돌아오면 다시 (녹화 A 111.09)
  const far = useRef(false);
  const onScrollTop = useCallback((st: number) => {
    if (st > 300) far.current = true;
    else if (st <= 0 && far.current) {
      far.current = false;
      setN((k) => k + 1);
    }
  }, []);
  return { on, onScrollTop };
}
