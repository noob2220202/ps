import type { Transaction } from "../../api/types";
import type { TossRun } from "./types";

// 기초 단계 자리 — A5 assets(+ 패널) 영역이 채움. 🔔 관리 → 거래 → 거래 하나를 고치는 칸 안 토스만의 칸 (plan.md §2.5):
// 분류(category) · 결제 수단(card / account / pay) · 카드 · 취소됨 · 소비에서 제외 — 저장은 이 칸이 따로 (tossApi.updateTransaction)
export function TossTxFields(_props: { tx: Transaction; run: TossRun }) {
  return null;
}
