// NH올원뱅크 은행 이름 · 은행 선택 순서 (plan.md §2.5, transfer.md §2.2 · §5.4). 은행 코드는 server/banks.mjs 와 같음.
// 앱 id "allone" 은 은행 코드가 아님. NH농협은행 = 은행 코드 "nh" (콕뱅크 앱 id 도 "nh" 지만 다른 것 — infra.md §4)
import type { Bank } from "../api/types";

// 화면에 쓰는 은행 이름: nh → NH농협은행, kb → 국민은행 (서버 BANKS 의 농협은행 · 국민은행 대신), 나머지는 BANKS.name
const NAMES: Record<string, string> = { nh: "NH농협은행", kb: "국민은행" };
export const aoBankName = (bank: { code: string; name?: string } | null | undefined) => (bank ? (NAMES[bank.code] ?? bank.name ?? bank.code) : "");

// 은행 선택 시트 (invented): 은행 / 증권사 두 탭, 각각 BANKS 순서 그대로 + 은행은 NH농협은행을 맨 앞
export function aoBankTabs(banks: Bank[]) {
  const bank = banks.filter((b) => b.section === "bank");
  const nh = bank.find((b) => b.code === "nh");
  return {
    banks: nh ? [nh, ...bank.filter((b) => b !== nh)] : bank,
    securities: banks.filter((b) => b.section === "securities"),
  };
}

// 녹화에 나온 은행 (타일은 녹화에서 자른 그림 allone-bank-<code>.png, 나머지는 BANKS 색 타일 — ui/BankLogo.tsx)
export const AO_CROPPED_BANKS = ["jb", "shinhan", "kakao", "hana", "kb", "kbank", "nh"] as const;
