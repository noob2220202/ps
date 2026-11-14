// NH올원뱅크 화면 표기 규칙 (plan.md §2.5). 숫자는 화면에서 바로 이 함수들로 (값은 늘 서버 데이터 — 녹화 값을 넣지 않음)
import type { AoTransaction, AoTransferRecord } from "./api";
import { AO_TOPUP_MEMO } from "./api";
import { aoBankName } from "./bank";

const nf = new Intl.NumberFormat("ko-KR");
export const aoNum = (n: number) => nf.format(n); // "1,234"
export const aoWon = (n: number) => `${nf.format(n)}원`; // "1,234원"
export const aoSignedWon = (n: number) => (n < 0 ? `-${aoWon(-n)}` : aoWon(n));
export const aoDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

// ---------- 거래 종류 표시 ----------
// #이체 출금 → 올원이체, #이체 입금 → 표시 없음 (녹화 그대로), #체크카드 → 체크카드, #자동이체 → 자동이체, #예금이자 → 결산이자
export function aoTxLabel(tx: Pick<AoTransaction, "tag" | "amount">): string {
  switch (tx.tag) {
    case "#이체":
      return tx.amount < 0 ? "올원이체" : "";
    case "#체크카드":
      return "체크카드";
    case "#자동이체":
      return "자동이체";
    case "#예금이자":
      return "결산이자";
    default:
      return "";
  }
}

// ---------- 계좌번호 ----------
// 내 NH 계좌: 3-4-4-2 하이픈 (홈 카드 · 계좌 블록 · T3 · T5). 13자리가 아니면 받은 그대로
export function aoNhNumber(number: string | null | undefined) {
  const d = aoDigits(number);
  if (d.length !== 13) return number ?? "";
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}-${d.slice(11)}`;
}
// 은행 형식대로 하이픈 (pattern 은 BANKS 의 자리 묶음). 형식이 없으면 숫자만
export function aoHyphen(number: string | null | undefined, pattern?: number[]) {
  const d = aoDigits(number);
  if (!pattern) return d;
  const parts: string[] = [];
  let i = 0;
  for (const len of pattern) {
    if (i >= d.length) break;
    parts.push(d.slice(i, i + len));
    i += len;
  }
  if (i < d.length) parts.push(d.slice(i));
  return parts.join("-");
}
// 내 계좌 번호 표기: NH 는 3-4-4-2, 다른 은행은 그 은행 형식
export const aoAccountNumber = (a: { bank?: { code: string; pattern?: number[] } | null; number?: string | null }) =>
  a.bank?.code === "nh" ? aoNhNumber(a.number) : aoHyphen(a.number, a.bank?.pattern);
// "NH농협은행(1234)" (T2 출금 계좌 줄)
export const aoBankLast4 = (a: { bank?: { code: string; name?: string } | null; number?: string | null }) =>
  `${aoBankName(a.bank)}(${aoDigits(a.number).slice(-4)})`;
// "NH농협은행 302-1234-5678-91" / "국민은행 123456-78-901234"
export const aoBankLine = (a: { bank?: { code: string; name?: string; pattern?: number[] } | null; number?: string | null }) =>
  `${aoBankName(a.bank)} ${aoAccountNumber(a)}`;

// ---------- 금액 읽기 (T2 · T7 금액 아래 글) ----------
// 1만 아래 "9,000원", "1만 2,345원", "1억 2,345만 6,789원", 0 인 자리는 뺌 ("500만원", "1만원")
export function aoAmountReading(n: number) {
  const v = Math.max(0, Math.floor(n));
  if (v < 10_000) return `${nf.format(v)}원`;
  const eok = Math.floor(v / 100_000_000);
  const man = Math.floor((v % 100_000_000) / 10_000);
  const rest = v % 10_000;
  const parts: string[] = [];
  if (eok) parts.push(`${nf.format(eok)}억`);
  if (man) parts.push(`${nf.format(man)}만`);
  if (rest) parts.push(nf.format(rest));
  return `${parts.join(" ")}원`;
}

// ---------- 날짜 ----------
const p2 = (n: number) => String(n).padStart(2, "0");
// "2026.11.13"
export const aoDate = (d: Date) => `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
// 서버 시각 "YYYY-MM-DDTHH:MM:SS" → Date (로컬)
export const aoParseAt = (at: string) => new Date(at.length <= 10 ? `${at}T00:00:00` : at);
// "HH:mm:ss" (거래내역 행)
export const aoTime = (at: string) => {
  const t = at.slice(11, 19);
  return t.length === 8 ? t : `${t}:00`.slice(0, 8);
};
// "YYYY.MM.DD HH:mm:ss" (상세 거래시간)
export const aoDateTime = (at: string) => `${at.slice(0, 10).replace(/-/g, ".")} ${aoTime(at)}`;

// 조회 기간: 1주일 = −7일, 1개월 · 3개월 · 6개월 = N달 전 같은 날 (그 달에 그 날이 없으면 그 달 마지막 날), 끝 = 오늘
export type AoPeriod = "1w" | "1m" | "3m" | "6m";
export function aoRange(period: AoPeriod, today = new Date()) {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let from: Date;
  if (period === "1w") from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 7);
  else {
    const months = period === "1m" ? 1 : period === "3m" ? 3 : 6;
    const y = to.getFullYear();
    const m = to.getMonth() - months;
    const last = new Date(y, m + 1, 0).getDate();
    from = new Date(y, m, Math.min(to.getDate(), last));
  }
  return { from, to, label: `${aoDate(from)} ~ ${aoDate(to)}` };
}
// 그 기간 안의 거래인지 (from 0시 ~ to 23:59:59)
export function aoInRange(at: string, range: { from: Date; to: Date }) {
  const t = aoParseAt(at).getTime();
  const end = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() + 1).getTime();
  return t >= range.from.getTime() && t < end;
}

// ---------- 한도 (표시 상수 + 화면 검사, 서버 한도 없음 — plan.md §0.10) ----------
export const AO_LIMITS = { perTransfer: 5_000_000, daily: 1_000_000 } as const;
// 1일 잔여한도 = 1,000,000 − 오늘 그 계좌에서 한 잔액채우기 합계 (GET /api/transfers?from=)
export function aoDailyRemaining(records: AoTransferRecord[] | undefined, today = new Date()) {
  const day = `${today.getFullYear()}-${p2(today.getMonth() + 1)}-${p2(today.getDate())}`;
  const used = (records ?? [])
    .filter((r) => r.at.startsWith(day) && (r.memoTo === AO_TOPUP_MEMO || r.memoMe === AO_TOPUP_MEMO))
    .reduce((s, r) => s + r.amount, 0);
  return Math.max(0, AO_LIMITS.daily - used);
}
// T2 다음: 0 < 금액 ≤ 출금 계좌 잔액, ≤ 5,000,000
export const aoCanSend = (amount: number, balance: number) => amount > 0 && amount <= balance && amount <= AO_LIMITS.perTransfer;
// T5 잔액채우기 검사 (오류 문구는 transfer.md §5.3) — 통과면 null
export function aoTopupError(amount: number, available: number, dailyRemaining: number) {
  if (amount <= 0) return "금액을 입력해 주세요";
  if (amount > available) return "출금가능금액을 초과했어요";
  if (amount > AO_LIMITS.perTransfer || amount > dailyRemaining) return "이체한도를 초과했어요";
  return null;
}
