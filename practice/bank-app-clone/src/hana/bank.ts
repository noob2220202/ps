import type { Bank } from "../api/types";

// 하나원큐 은행 이름·계좌번호·거래구분 규칙 (화면 여러 곳이 같이 씀)
export const nf = new Intl.NumberFormat("ko-KR");

// ---------- 은행 ----------
// 은행선택 시트의 순서와 타일 이름 (스크린샷 3장). 코드는 server/banks.mjs 와 같다
export const HANA_BANKS: [string, string][] = [
  ["hana", "하나"], ["kb", "국민"], ["shinhyup", "신협"],
  ["woori", "우리"], ["kn", "경남"], ["kj", "광주"],
  ["ibk", "기업"], ["nh", "농협"], ["busan", "부산"],
  ["nfcf", "산림조합"], ["kdb", "산업"], ["mg", "새마을금고"],
  ["suhyup", "수협"], ["shinhan", "신한"], ["post", "우체국"],
  ["jb", "전북"], ["jeju", "제주"], ["kakao", "카카오뱅크"],
  ["kbank", "케이뱅크"], ["toss", "토스뱅크"], ["citi", "한국씨티"],
  ["im", "iM뱅크(대구)"], ["sc", "SC제일"], ["savings", "저축은행"],
  ["deutsche", "도이치뱅크"], ["boc", "중국"], ["ccb", "중국건설"],
  ["icbc", "중국공상"], ["bnp", "BNP파리바"], ["boa", "BOA"],
  ["hsbc", "HSBC"], ["jpm", "JP모간"],
];
// 은행 목록 끝의 세금 타일 (은행이 아니라 연습용 앱에선 안내만)
export const HANA_TAX: [string, string][] = [["tax-national", "국세"], ["tax-customs", "관세"], ["tax-treasury", "국고금"], ["tax-local", "지방세입"]];
const LABEL = new Map(HANA_BANKS);

// 받는 분 은행 이름: 농협 13·14자리는 "지역농축협" (녹화: 최근 목록·확인·완료), 나머지는 타일 이름
export function hanaBankName(bank: Pick<Bank, "code" | "short">, number = "") {
  const digits = number.replace(/\D/g, "").length;
  if (bank.code === "nh") return digits >= 13 ? "지역농축협" : "농협";
  return LABEL.get(bank.code) ?? bank.short;
}

// 계좌번호: 하나은행만 3-6-5 하이픈 ("하나 123-000000-11111"), 다른 은행은 숫자만
export function hanaNumber(bank: Pick<Bank, "code">, number: string) {
  const d = number.replace(/\D/g, "");
  if (bank.code !== "hana" || d.length !== 14) return d;
  return `${d.slice(0, 3)}-${d.slice(3, 9)}-${d.slice(9)}`;
}

// 거래구분 (녹화 거래내역): 체크카드 / 타행송금(지역농축협) / 타행이체(받은 이체) …
export function hanaTxKind(tx: { tag: string; amount: number; toBank?: { code: string; digits: number } }) {
  if (tx.tag === "#체크카드") return "체크카드";
  if (tx.tag === "#자동이체") return "자동이체";
  if (tx.tag === "#예금이자") return "결산이자";
  if (tx.amount > 0) return "타행이체";
  if (!tx.toBank) return "타행송금";
  if (tx.toBank.code === "hana") return "당행이체";
  const name = hanaBankName({ code: tx.toBank.code, short: tx.toBank.code }, "0".repeat(tx.toBank.digits));
  return `타행송금(${tx.toBank.code === "nh" ? name : (LONG[tx.toBank.code] ?? name)})`;
}
const LONG: Record<string, string> = { kb: "국민은행", shinhan: "신한은행", woori: "우리은행", ibk: "기업은행", shinhyup: "신협", mg: "새마을금고", post: "우체국" };

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
// "2026-10-30T18:08:35" → "2026.10.30 (금)"
export function hanaDay(at: string) {
  const [y, m, d] = at.slice(0, 10).split("-").map(Number);
  return `${at.slice(0, 10).replaceAll("-", ".")} (${WEEK[new Date(y, m - 1, d).getDay()]})`;
}
