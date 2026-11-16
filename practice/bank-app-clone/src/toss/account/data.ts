// 통장 영역의 그림 이름 · 거래 분류 · 묶기 (화면 파일이 컴포넌트만 내보내게 따로 둠)
import { localAsset } from "../../assets/Asset";
import type { TossTransaction } from "../api";

// src/assets/local/toss-acct-<name>.png|jpg (scripts/toss-crops/account.py)
export const acctImg = (name: string) => localAsset(`toss-acct-${name}`);

// 거래 동그라미 아이콘 종류: 이체 ₩ (남색) · 카드 캐시백 메달 · 통장 이자 영수증 · 그 밖의 가게 ··· (브랜드 로고는 쓰지 않음)
export type AcctTxKind = "transfer" | "cashback" | "interest" | "store";
export function acctTxKind(t: Pick<TossTransaction, "tag" | "category" | "merchant">): AcctTxKind {
  if (t.category === "캐시백" || t.merchant.includes("캐시백")) return "cashback";
  if (t.tag === "#예금이자") return "interest";
  if (t.tag === "#이체") return "transfer";
  return "store";
}
// 날짜별로 묶음 (서버가 최신순으로 줌)
export function acctGroupByDay<T extends { at: string }>(list: T[]) {
  const groups: { day: string; items: T[] }[] = [];
  for (const t of list) {
    const day = t.at.slice(0, 10);
    const g = groups.at(-1);
    if (g && g.day === day) g.items.push(t);
    else groups.push({ day, items: [t] });
  }
  return groups;
}
