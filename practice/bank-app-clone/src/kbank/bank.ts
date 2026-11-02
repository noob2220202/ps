import type { Bank } from "../api/types";

// 케이뱅크 화면의 은행 이름 (받는 분 목록 · 금액 · 확인 · 완료 · 거래 상세가 같이 씀).
// 녹화(23초 '최근 보낸 계좌', 67초 거래 상세)는 농협 계좌를 '지역농축협 <번호>'로 적음 — 10 · 14자리와, 13자리라도 35 로 시작하는 번호
// (지역 농·축협 3-4-4-2, 첫 녹화 23초 넷째 줄) → 농협은행 13자리(35 로 시작하지 않음)만 농협은행, 나머지는 지역농축협.
// 그 밖의 은행은 서버 이름 그대로 (카카오뱅크 · 새마을금고 · 케이뱅크 …)
const nhLocal = (number: string) => {
  const d = number.replace(/\D/g, "");
  return d.length !== 13 || d.startsWith("35");
};
export function kbankBankName(bank: Pick<Bank, "code" | "name">, number = ""): string {
  if (bank.code === "nh" && nhLocal(number)) return "지역농축협";
  return bank.name;
}

// 짧은 은행 이름 (이체확인증 '받는계좌', 입금 상세 '상대 정보' — 두 번째 녹화 46·66·81초).
// 농협은 위와 같은 규칙으로 지역 농·축협이면 '농축협', 그 밖은 서버 short ('카카오뱅크' · '신한' · '국민' · '새마을' …)
export function kbankBankShort(bank: Pick<Bank, "code" | "short">, number = ""): string {
  if (bank.code === "nh" && nhLocal(number)) return "농축협";
  return bank.short;
}

// 거래구분: 녹화는 이체가 모두 '전자금융' (거래 상세 · 이체확인증, 서버 기본 거래구분 '이체')
export const kbankKindLabel = (kind: string) => (kind === "이체" ? "전자금융" : kind);
