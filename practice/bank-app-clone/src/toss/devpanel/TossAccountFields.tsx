import type { Account } from "../../api/types";
import type { TossRun } from "./types";

// 기초 단계 자리 — A5 assets(+ 패널) 영역이 채움. 🔔 관리 → 계좌 → 계좌 하나를 펼친 칸 안 토스만의 칸 (plan.md §2.5):
// 개설일 (토스뱅크 계좌, 증명서 A) · 토스머니 표시(role money) 등
export function TossAccountFields(_props: { account: Account; run: TossRun }) {
  return null;
}
