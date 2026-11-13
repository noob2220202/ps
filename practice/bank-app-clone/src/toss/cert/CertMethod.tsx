import { TossStub } from "../stub";

// 기초 단계 자리 — A4 cert 영역이 진짜 화면으로 바꿈. M /cert/transfer/method?account=&ids=
export function CertMethod() {
  return <TossStub title="증명서를 어떻게 받을까요?" area="cert" links={[{ label: "발급하기", to: "/cert/transfer/issuing" }]} />;
}
