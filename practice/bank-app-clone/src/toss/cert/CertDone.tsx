import { useTossFlow } from "../flow";
import { TossStub } from "../stub";

// 기초 단계 자리 — A4 cert 영역이 진짜 화면으로 바꿈. D /cert/transfer/done?account=&ids=&at= — '확인했어요' = certExit()
export function CertDone() {
  const { certExit } = useTossFlow();
  return (
    <TossStub
      title="송금 확인증을 발급했어요"
      area="cert"
      links={[
        { label: "문서 보기", to: "/cert/doc" },
        { label: "확인했어요", onPress: certExit },
      ]}
    />
  );
}
