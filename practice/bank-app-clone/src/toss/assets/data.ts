// 자산 영역(소비 · 자산 · 내 계좌)의 계산 · 기억 칸. 값의 근거는 assets.md
import { useCallback, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import type { TossSpend, TossSpendCategory } from "../api";

// ---------- 뒤로 와서 다시 그리는 화면 ----------
// ScreenStack 은 맨 위 화면만 붙여 두므로 뒤로 오면 화면을 새로 만듦. 녹화처럼 '쌓여 있던 화면은 그대로' 보이게 (plan.md §1.4):
// 이 주소 칸(location.key)을 전에 그렸고 POP 으로 왔으면 첫 그리기 단계(뼈대 · 카드 나타남) 없이, 스크롤 · 고른 것도 되살림
const memo = new Map<string, Record<string, unknown>>();
export function useAssetsRevisit<T extends Record<string, unknown>>() {
  const location = useLocation();
  const navType = useNavigationType();
  const key = location.key;
  const [saved] = useState(() => (navType === "POP" ? (memo.get(key) as Partial<T> | undefined) : undefined));
  // 이 화면의 기억 칸에 덮어씀 (스크롤 · 탭 등). 처음 그린 화면도 빈 칸을 만들어 둠 (다음에 뒤로 오면 revisit)
  const save = useCallback(
    (patch: Partial<T>) => {
      memo.set(key, { ...memo.get(key), ...patch });
    },
    [key],
  );
  return { revisit: !!saved, saved: saved ?? ({} as Partial<T>), save };
}

// ---------- 소비 (assets.md §2.1) ----------
export const SPEND = {
  summaryH: 126.4, // 요약 (121.6–248), 이만큼 스크롤하면 주간 달력이 탭 밑에 붙음
  stripH: 142.4, // 주간 달력 (248–390.4, 붙으면 121.6–264)
  weekTop: 30.4, // 달력 안 첫 주 줄 위 (날짜 동그라미 위끝)
  weekH: 78.4, // 주 줄 높이 (펼친 달력)
  foot: 33.6, // ⌄ 줄
  spyLine: 131.8, // 스크롤 엿보기: 묶음 위끝이 (본문 기준) 이보다 위면 그 날 — 날짜 머리 잉크 위끝이 화면 y ≈ 284.6 에 올 때 바뀜 (B 145.764 · 146.945 · 148.012: 287 → 281–283)
  skeletonMin: 450, // 뼈대 최소 (녹화 1.5초를 줄인 값, plan.md Q9 의 '300ms 이상') — 막대 · 줄이 다 나타난 뒤 바뀌게
  expand: 250, // ⌄ 달력 펼치기
} as const;

const pad = (n: number) => String(n).padStart(2, "0");
export const ymOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const shiftYm = (ym: string, by: number) => {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + by, 1);
  return ymOf(d);
};
const dateOf = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 분류 막대: 너비는 몫대로, 조각 사이 2.4, 가장 작은 조각 16 (그보다 작으면 16 으로 두고 나머지를 줄임)
export function barSegments(cats: TossSpendCategory[], width = 336, gap = 2.4, min = 16) {
  const items = cats.filter((c) => c.amount > 0);
  if (!items.length) return [];
  const avail = width - gap * (items.length - 1);
  const sum = items.reduce((s, c) => s + c.amount, 0);
  const fixed = new Set<number>();
  let w = items.map((c) => (c.amount / sum) * avail);
  for (let k = 0; k < items.length; k++) {
    const small = w.findIndex((v, i) => v < min && !fixed.has(i));
    if (small < 0) break;
    fixed.add(small);
    const free = avail - fixed.size * min;
    const freeSum = items.reduce((s, c, i) => (fixed.has(i) ? s : s + c.amount), 0);
    w = items.map((c, i) => (fixed.has(i) ? min : freeSum ? (c.amount / freeSum) * free : 0));
  }
  return items.map((c, i) => ({ key: c.key, color: c.color, w: w[i] }));
}

// "지난달보다 N만원 더 쓰는 중" (assets.md §4.1): 1만원 이상은 만원 단위 반올림, 그 아래는 원. 1,000원 미만 차이는 "지난달과 비슷해요"
export function diffCopy(diff: number): { tone: "more" | "less" | "same"; amount: string } {
  const a = Math.abs(diff);
  if (a < 1000) return { tone: "same", amount: "" };
  const amount = a >= 10000 ? `${Math.round(a / 10000).toLocaleString("ko-KR")}만원` : `${a.toLocaleString("ko-KR")}원`;
  return { tone: diff > 0 ? "more" : "less", amount };
}

// 달력 칸: 그 달을 일요일부터 주 단위로. 앞뒤 달 날짜는 out (회색, 누를 수 없음)
export type CalCell = { date: string; day: number; out: boolean };
export function monthWeeks(month: string): CalCell[][] {
  const first = dateOf(`${month}-01`);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const weeks: CalCell[][] = [];
  const cur = new Date(start);
  while (weeks.length < 6) {
    const week: CalCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: isoOf(cur), day: cur.getDate(), out: ymOf(cur) !== month });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (ymOf(cur) !== month) break;
  }
  return weeks;
}

// 처음 고른 날: 이번 달이면 오늘, 지난 달이면 가장 최근 거래일 (없으면 그 달 마지막 날)
export function defaultDay(s: TossSpend) {
  if (s.today.startsWith(s.month)) return s.today;
  return s.groups[0]?.date ?? s.days[s.days.length - 1]?.date ?? `${s.month}-01`;
}
