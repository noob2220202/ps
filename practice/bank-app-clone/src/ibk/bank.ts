import type { Bank } from "../api/types";

// i-ONE Bank 은행 이름·계좌번호 규칙 (화면 여러 곳이 같이 씀)
export const nf = new Intl.NumberFormat("ko-KR");

// 받는 분 은행 이름: 목록·금액·확인·완료에서 짧은 이름 ("제주 1890…", "새마을 9003…", "기업 123-…")
export function ibkBankName(bank: Pick<Bank, "code" | "short">) {
  return bank.short;
}

// 계좌번호: 기업은행은 3-6-2-3 하이픈 ("기업 123-456789-01-011"), 다른 은행은 숫자만
export function ibkNumber(bank: Pick<Bank, "code">, number: string) {
  const d = number.replace(/\D/g, "");
  if (bank.code !== "ibk" || d.length !== 14) return d;
  return `${d.slice(0, 3)}-${d.slice(3, 9)}-${d.slice(9, 11)}-${d.slice(11)}`;
}
