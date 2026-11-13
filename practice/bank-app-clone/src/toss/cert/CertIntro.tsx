import { TossStub } from "../stub";

// 기초 단계 자리 — A4 cert 영역이 진짜 화면으로 바꿈. I /cert/transfer
export function CertIntro() {
  return <TossStub title="송금 확인증" area="cert" links={[{ label: "발급하기", to: "/cert/transfer/account" }]} />;
}
