// [기초 단계 자리 — transfer 영역이 이 파일을 진짜 이체 확인(받는 분 · 금액 · 통장 표시 · 보내기)으로 바꿈]
// 지금은 이동 시험용: 보내기 → (send 막, POST /api/transfers) 이체 완료로 이 칸을 바꿈, ‹ = 뒤로, 취소 = 새로 불러온 홈
import { useSearchParams } from "react-router-dom";
import { aoApi } from "../api";
import { useAoFlow } from "../flow";
import { AoStub } from "../stub";

export function SendConfirm() {
  const [params] = useSearchParams();
  const flow = useAoFlow();
  const amount = Number(params.get("amount")) || 0;
  return (
    <AoStub
      title="이체 확인"
      area="transfer"
      links={[
        {
          label: "보내기",
          onPress: () =>
            flow.go(`/send/done?${params.toString()}`, {
              via: "send",
              replace: true,
              task: () =>
                aoApi.transfer({ fromAccountId: params.get("from") ?? "main", bankCode: params.get("bank") ?? "", number: params.get("number") ?? "", amount }),
            }),
        },
        { label: "취소", onPress: () => flow.goHomeFresh() },
      ]}
    />
  );
}
