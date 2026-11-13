import { useAdDismiss } from "../flow";
import { TossStub } from "../stub";

// 기초 단계 자리 — A1 home 영역이 진짜 화면으로 바꿈. /ad/coupon (옮기기 S8 자리를 reveal 로 바꿈, 닫으면 fade)
export function AdCoupon() {
  const dismiss = useAdDismiss();
  return (
    <TossStub
      title="5천원 쿠폰이 발급됐어요"
      area="home"
      back={false}
      links={[
        { label: "쿠폰 받기", onPress: () => dismiss() },
        { label: "3일 동안 안보기", onPress: () => dismiss({ snooze: true }) },
      ]}
    />
  );
}
