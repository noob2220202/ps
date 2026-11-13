import { TossStub } from "../stub";

// 기초 단계 자리 — A4 cert 영역이 진짜 화면으로 바꿈. W /cert/transfer/issuing (2.6초 뒤 D 로 replace)
export function CertIssuing() {
  return <TossStub title="잠시만 기다려주세요" area="cert" links={[{ label: "발급 끝 (replace)", to: "/cert/transfer/done", replace: true }]} />;
}
