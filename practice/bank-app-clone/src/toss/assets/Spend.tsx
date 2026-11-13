import { TossStub } from "../stub";

// 기초 단계 자리 — A5 assets 영역이 진짜 화면으로 바꿈. /spend?month=YYYY-MM (아래 띠 scrim 모드)
export function Spend() {
  return <TossStub title="소비" area="assets" links={[]} navMode="scrim" />;
}
