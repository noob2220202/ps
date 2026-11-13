// 거래내역조회 목록 규칙 (plan.md §2.4 · §2.5, account.md §4 · §5): 서버는 한 번에 최대 500개 (거래 후 잔액까지 계산된 것)를 주고,
// 기간 · 입출금 · 정렬 · 20개씩 끊기는 모두 화면에서 함. 조회 조건 시트는 녹화에 없음 (invented) — 기본 1개월 · 전체 · 최신순
import type { AoTransaction } from "../api";
import { aoInRange, aoRange, type AoPeriod } from "../format";

export type AcctType = "all" | "in" | "out";
export type AcctOrder = "desc" | "asc";
export interface AcctFilter {
  period: AoPeriod;
  type: AcctType;
  order: AcctOrder;
}
export const ACCT_FILTER_DEFAULT: AcctFilter = { period: "1m", type: "all", order: "desc" };
export const ACCT_PAGE = 20; // 한 번에 보이는 줄 수 (아래 끝에 가까워지면 20개 더)
export const ACCT_MORE_MS = 300; // 다음 20개를 붙이기 전 아래 스피너 (plan Q28)

export const ACCT_PERIODS: readonly (readonly [AoPeriod, string])[] = [
  ["1w", "1주일"],
  ["1m", "1개월"],
  ["3m", "3개월"],
  ["6m", "6개월"],
];
export const ACCT_TYPES: readonly (readonly [AcctType, string])[] = [
  ["all", "전체"],
  ["in", "입금"],
  ["out", "출금"],
];
export const ACCT_ORDERS: readonly (readonly [AcctOrder, string])[] = [
  ["desc", "최신순"],
  ["asc", "과거순"],
];

const labelOf = <K extends string>(list: readonly (readonly [K, string])[], k: K) => list.find(([v]) => v === k)?.[1] ?? "";
// "1개월 · 전체 · 최신순"
export const acctSummary = (f: AcctFilter) =>
  [labelOf(ACCT_PERIODS, f.period), labelOf(ACCT_TYPES, f.type), labelOf(ACCT_ORDERS, f.order)].join(" · ");

// 조건에 맞는 줄 (거래 후 잔액은 서버가 전체 기록으로 계산한 값 그대로)
export function acctRows(txs: AoTransaction[], f: AcctFilter, today = new Date()) {
  const range = aoRange(f.period, today);
  const rows = txs.filter((t) => aoInRange(t.at, range) && (f.type === "all" || (f.type === "in" ? t.amount > 0 : t.amount < 0)));
  // 서버 순서(최신순)를 기준으로 시각 · id 로 다시 맞춤 (같은 시각이면 나중에 생긴 것이 위)
  const key = (t: AoTransaction) => `${t.at}#${t.id.padStart(10, "0")}`;
  rows.sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0));
  if (f.order === "asc") rows.reverse();
  return { rows, range };
}

// 행 날짜 "YYYY.MM.DD"
export const acctDate = (at: string) => at.slice(0, 10).replace(/-/g, ".");
