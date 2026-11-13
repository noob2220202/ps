// [기초 단계 자리 — transfer 영역이 이 파일을 진짜 T2 얼마를 보낼까요(금액 · 네이티브 키패드 판 · 칩 · 출금계좌 시트 · T3 계좌 비밀번호)로 바꿈]
// 지금은 이동 시험용: 1,000원 다음 → (password 막) 이체 확인, 잔액채우기 → T5 (topupLink), ‹ = 뒤로, 취소 = 새로 불러온 홈
import { useSearchParams } from "react-router-dom";
import { useAoFlow } from "../flow";
import { AoStub } from "../stub";

export function SendAmount() {
  const [params] = useSearchParams();
  const flow = useAoFlow();
  const from = params.get("from") ?? "main";
  return (
    <AoStub
      title="얼마를 보낼까요?"
      area="transfer"
      links={[
        { label: "1,000원 · 다음", onPress: () => flow.go(`/send/confirm?${params.toString()}&amount=1000`, { via: "password" }) },
        { label: "잔액채우기", onPress: () => flow.goTopup({ to: from, origin: "amount" }) },
        { label: "취소", onPress: () => flow.goHomeFresh() },
      ]}
    >
      <p className="ao-stub__sub">
        {params.get("holder")} · {params.get("bank")} {params.get("number")}
      </p>
    </AoStub>
  );
}
