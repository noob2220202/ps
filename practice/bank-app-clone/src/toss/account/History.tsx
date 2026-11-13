import { TossStub } from "../stub";

// 기초 단계 자리 — A2 account 영역이 진짜 화면으로 바꿈. /bank/:accountId/history
export function History() {
  return <TossStub title="거래내역" area="account" links={[{ label: "상세 내역", to: "/tx/x" }]} />;
}
