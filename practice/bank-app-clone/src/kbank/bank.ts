import type { Bank } from "../api/types";

// 케이뱅크 화면의 은행 이름 (받는 분 목록 · 금액 · 확인 · 완료 · 거래 상세가 같이 씀).
// 녹화(23초 '최근 보낸 계좌', 67초 거래 상세)는 농협 계좌를 '지역농축협 <번호>'로 적음 → 농협은행 13자리(3-4-4-2)가 아니면 지역농축협.
// 그 밖의 은행은 서버 이름 그대로 (카카오뱅크 · 새마을금고 · 케이뱅크 …)
export function kbankBankName(bank: Pick<Bank, "code" | "name">, number = ""): string {
  if (bank.code === "nh" && number.replace(/\D/g, "").length !== 13) return "지역농축협";
  return bank.name;
}

// 짧은 은행 이름 (이체확인증 '받는계좌', 입금 상세 '상대 정보' — 두 번째 녹화 46·66·81초).
// 농협은 위와 같은 규칙으로 13자리가 아니면 '농축협', 그 밖은 서버 short ('카카오뱅크' · '신한' · '국민' · '새마을' …)
export function kbankBankShort(bank: Pick<Bank, "code" | "short">, number = ""): string {
  if (bank.code === "nh" && number.replace(/\D/g, "").length !== 13) return "농축협";
  return bank.short;
}
