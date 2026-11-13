import { TossStub } from "../stub";

// 기초 단계 자리 — A4 cert 영역이 진짜 화면으로 바꿈. A /cert/transfer/account (cut)
export function CertAccount() {
  return <TossStub title="어떤 계좌의 증명서를 발급할까요?" area="cert" links={[{ label: "다음", to: "/cert/transfer/items?account=main" }]} />;
}
