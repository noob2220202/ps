import { useSendFinish } from "../flow";
import { TossStub } from "../stub";

// 기초 단계 자리 — A3 transfer 영역이 진짜 화면으로 바꿈. S7 → S8 /send/done (cut, replace). '확인' = sendFinish(kind)
export function SendDone() {
  const finish = useSendFinish();
  return (
    <TossStub
      title="토스뱅크 송금"
      area="transfer"
      links={[
        { label: "확인 (옮겼어요 → 쿠폰)", onPress: () => finish("move") },
        { label: "확인 (보냈어요 → 2,000원)", onPress: () => finish("send") },
      ]}
    />
  );
}
