import { TossStub } from "../stub";

// 기초 단계 자리 — A4 cert 영역이 진짜 화면으로 바꿈. L /cert/transfer/items?account=
export function CertItems() {
  return <TossStub title="어떤 내역을 발급할까요?" area="cert" links={[{ label: "다음", to: "/cert/transfer/method?account=main&ids=" }]} />;
}
