import type { Bank } from "../api/types";

// 케이뱅크 화면의 은행 이름 (받는 분 목록 · 금액 · 확인 · 완료 · 거래 상세가 같이 씀).
// 녹화(23초 '최근 보낸 계좌', 67초 거래 상세)는 농협 계좌를 '지역농축협 <번호>'로 적음 → 농협은행 13자리(3-4-4-2)가 아니면 지역농축협.
// 그 밖의 은행은 서버 이름 그대로 (카카오뱅크 · 새마을금고 · 케이뱅크 …)
export function kbankBankName(bank: Pick<Bank, "code" | "name">, number = ""): string {
  if (bank.code === "nh" && number.replace(/\D/g, "").length !== 13) return "지역농축협";
  return bank.name;
}
