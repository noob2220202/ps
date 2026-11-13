import { useAdDismiss } from "../flow";
import { TossStub } from "../stub";

// 기초 단계 자리 — A1 home 영역이 진짜 화면으로 바꿈. /ad/payback (보내기 S8 자리를 push 로 바꿈 + "토스로 이동했어요", 닫으면 pop)
export function AdPayback() {
  const dismiss = useAdDismiss();
  return <TossStub title="30일 동안 매일 2,000원" area="home" links={[{ label: "닫기", onPress: () => dismiss() }]} />;
}
