import type { Bank } from "../api/types";

// 콕뱅크 '은행선택' 화면의 순서와 이름 (카카오뱅크 앱과 순서·표기가 다름). 코드는 server/banks.mjs 와 같다
const BANK_ORDER: [string, string?][] = [
  ["nh", "NH농협"], ["kb", "국민은행"], ["ibk", "기업은행"],
  ["shinhan", "신한은행"], ["woori", "우리은행"], ["hana", "하나은행"],
  ["kakao", "카카오뱅크"], ["kbank", "케이뱅크"], ["toss", "토스뱅크"],
  ["sc", "SC제일은행"], ["kn", "경남은행"], ["kj", "광주은행"],
  ["im", "아이엠뱅크(대구은행)"], ["busan", "부산은행"], ["kdb", "산업은행"],
  ["suhyup", "수협"], ["jb", "전북은행"], ["jeju", "제주은행"],
  ["citi", "한국씨티은행"], ["mg", "새마을금고"], ["shinhyup", "신협"],
  ["savings", "상호저축은행"], ["nfcf", "산림조합"], ["post", "우체국"],
  ["deutsche", "도이치"], ["boa", "뱅크오브아메리카"], ["icbc", "중국공상은행"],
  ["ccb", "중국건설은행"], ["boc", "중국은행"], ["bnp", "BNP파리바"],
  ["hsbc", "HSBC"], ["jpm", "JP모간"],
];
const SEC_ORDER: [string, string?][] = [
  ["nhsec", "NH투자증권"], ["kyobo"], ["daishin"],
  ["mirae"], ["meritz"], ["bookook"],
  ["samsung"], ["shinyoung"], ["shinhansec", "신한금융투자"],
  ["eugene"], ["yuanta"], ["ls"],
  ["kakaopaysec"], ["cape"], ["kiwoom"],
  ["tosssec"], ["hanasec"], ["imsec"],
  ["kis"], ["wooriinv"], ["hanwha"],
  ["hmsec", "현대차투자증권"], ["bnksec"], ["dbsec"],
  ["ibksec"], ["kbsec"], ["daol"],
  ["sks", "SK증권"], ["sangsangin"],
];

export type NhBank = Bank & { label: string };

// 서버 은행 목록을 콕뱅크 순서·이름으로
export function nhBankList(banks: Bank[], section: "bank" | "securities"): NhBank[] {
  return (section === "bank" ? BANK_ORDER : SEC_ORDER).flatMap(([code, label]) => {
    const b = banks.find((x) => x.code === code);
    return b ? [{ ...b, label: label ?? b.name }] : [];
  });
}

// 콕뱅크 목록의 짧은 은행 이름 ("농축협 000000-00-000000", "카카오 7777…", "하나 0000…")
export const nhShort = (bank: Pick<Bank, "code" | "short">) =>
  ({ nh: "농협은행", kakao: "카카오", toss: "토스뱅크", kbank: "케이뱅크" })[bank.code] ?? bank.short;
