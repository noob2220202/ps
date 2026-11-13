import { TossStub } from "../stub";

// 기초 단계 자리 — A4 cert 영역이 진짜 화면으로 바꿈. H /cert
export function CertHome() {
  return <TossStub title="토스뱅크 증명서 발급하기" area="cert" links={[{ label: "송금 확인증", to: "/cert/transfer" }]} />;
}
