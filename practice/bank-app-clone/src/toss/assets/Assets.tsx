import { TossStub } from "../stub";

// 기초 단계 자리 — A5 assets 영역이 진짜 화면으로 바꿈. /assets
export function Assets() {
  return <TossStub title="자산" area="assets" links={[{ label: "내 계좌", to: "/assets/accounts" }]} />;
}
