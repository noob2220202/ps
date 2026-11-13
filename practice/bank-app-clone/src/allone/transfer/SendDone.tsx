// [기초 단계 자리 — transfer 영역이 이 파일을 진짜 이체 완료(초록 체크 · 문구 · 상자 · 확인)로 바꿈]
// 지금은 이동 시험용: 확인 = sendFinish (흐름에 들어오기 전 화면으로, 홈이면 새로 불러온 홈)
import { useSearchParams } from "react-router-dom";
import { useAoFlow } from "../flow";
import { aoWon } from "../format";
import { AoStub } from "../stub";

export function SendDone() {
  const [params] = useSearchParams();
  const flow = useAoFlow();
  return (
    <AoStub title="이체 완료" area="transfer" back={false} links={[{ label: "확인", onPress: () => flow.sendFinish() }]}>
      <p className="ao-stub__sub">
        {params.get("holder")}님에게 {aoWon(Number(params.get("amount")) || 0)}을 보냈어요
      </p>
    </AoStub>
  );
}
