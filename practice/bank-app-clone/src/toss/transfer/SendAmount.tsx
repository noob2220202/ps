import { TossStub } from "../stub";

// 기초 단계 자리 — A3 transfer 영역이 진짜 화면으로 바꿈. S4 /send/amount (D1 안내창은 화면 안)
export function SendAmount() {
  return <TossStub title="토스뱅크 송금" area="transfer" links={[{ label: "다음", to: "/send/confirm" }]} />;
}
