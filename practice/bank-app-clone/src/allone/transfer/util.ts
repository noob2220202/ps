// 이체 영역 안에서만 쓰는 도우미 (컴포넌트 아닌 것): 은행 이름 · 줄 글 · 금액 키 · 잔액채우기 링크 시각 · 복사
import type { Bank } from "../../api/types";
import { applyKey, type PadKey as LibPadKey } from "../../lib/keypad";
import { aoBankName } from "../bank";
import { aoDigits } from "../format";

// ---------- 은행 ----------
// 주소에는 은행 코드만 있음 → 은행 목록에서 찾아 이름 · 색. 목록이 아직 없으면 코드만으로 (NH농협은행 · 국민은행은 이름이 정해져 있음)
export const findBank = (banks: Bank[] | undefined, code: string) => banks?.find((b) => b.code === code) ?? null;
export const bankLabel = (banks: Bank[] | undefined, code: string) => aoBankName(findBank(banks, code) ?? { code, name: "" }) || code;
export const logoBank = (b: Bank | null | undefined) => (b ? { name: b.name, short: b.short, color: b.color } : undefined);

// 받는 분 · 내 계좌 줄의 둘째 줄: "<은행> <숫자만>" (T1 · T2 받는 분 줄, plan §2.5)
export const rawLine = (bank: { code: string; name?: string } | null | undefined, number: string | null | undefined) =>
  `${aoBankName(bank)} ${aoDigits(number)}`;

// ---------- 금액 키 ----------
export type PadKey = Exclude<LibPadKey, "kok">;
// 키 하나를 금액 문자열에 (앞 0 없음, 최대 자리). "0" 만 남으면 빈 값
export function padApply(value: string, k: PadKey, max = 13) {
  const next = applyKey(value, k, max);
  return /^0*$/.test(next) ? "" : next;
}
// +N만 칩
export const addMan = (value: string, man: number, max = 13) => String(Math.min(Number(value || 0) + man * 10_000, 10 ** max - 1));

// 잔액채우기 링크를 누른 때 (T5 가 T6 을 링크 +983ms 에 올리려고 — 화면이 늦게 그려져도 녹화 시각표대로)
let topupLinkAt = -1e9;
export const markTopupLink = () => void (topupLinkAt = performance.now());
export const sinceTopupLink = () => performance.now() - topupLinkAt;

// 클립보드 (안 되면 조용히)
export function copyText(text: string) {
  try {
    void navigator.clipboard?.writeText(text).catch(() => {});
  } catch {
    // 권한이 없거나 http 이면 그냥 넘어감
  }
}
