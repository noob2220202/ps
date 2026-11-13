import { TossStub } from "../stub";

// 기초 단계 자리 — A3 transfer 영역이 진짜 화면으로 바꿈. S2 /send/number (S3 은행 시트는 화면 안)
export function SendNumber() {
  return <TossStub title="어떤 계좌로 보낼까요?" area="transfer" links={[{ label: "확인", to: "/send/amount?bank=kb&number=12345601234567" }]} />;
}
