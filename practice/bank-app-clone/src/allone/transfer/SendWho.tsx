// [기초 단계 자리 — transfer 영역이 이 파일을 진짜 T1 누구에게 보낼까요(계좌번호 · 은행 · 최근/자주/내계좌/연락처 · ☆ · 삭제하기)로 바꿈]
// 지금은 이동 시험용: 최근 · 내계좌 행 → 얼마를 보낼까요 (바로 CUT), ‹ = 뒤로, 취소 = 새로 불러온 홈
import { useSearchParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { aoPaths, type AoRecipients } from "../api";
import { aoBankName } from "../bank";
import { useAoFlow } from "../flow";
import { AoStub } from "../stub";

export function SendWho() {
  const [params] = useSearchParams();
  const from = params.get("from") ?? "main";
  const rec = useApi<AoRecipients>(aoPaths.recipients(from));
  const flow = useAoFlow();
  const rows = [
    ...(rec.data?.recent ?? []).map((r) => ({ key: `r${r.bank.code}${r.number}`, bankCode: r.bank.code, bank: r.bank, number: r.number, holder: r.holder })),
    ...(rec.data?.mine ?? []).map((m) => ({ key: `m${m.accountId}`, bankCode: m.bank.code, bank: m.bank, number: m.number ?? "", holder: m.holder })),
  ];
  return (
    <AoStub title="누구에게 보낼까요?" area="transfer" links={[{ label: "취소", onPress: () => flow.goHomeFresh() }]}>
      {rows.map((r) => (
        <button key={r.key} className="ao-stub__tx" onClick={() => void flow.goAmount({ from, to: { bankCode: r.bankCode, number: r.number, holder: r.holder } })}>
          <span>{r.holder}</span>
          <small>
            {aoBankName(r.bank)} {r.number}
          </small>
        </button>
      ))}
    </AoStub>
  );
}
