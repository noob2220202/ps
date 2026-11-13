// [기초 단계 자리 — account 영역이 이 파일을 진짜 거래내역 상세(메모 · ☆ · 다시보내기 · 정보 카드 · 확인)로 바꿈]
// 지금은 이동 시험용: × = 뒤로 (목록 스크롤 그대로), 다시보내기 = 얼마를 보낼까요 (resend, 이 칸을 바꿈)
import { useParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { aoPaths, type AoTxDetail } from "../api";
import { useAoFlow } from "../flow";
import { aoSignedWon, aoTxLabel } from "../format";
import { AoStub } from "../stub";

export function TxDetail() {
  const { txId = "" } = useParams();
  const tx = useApi<AoTxDetail>(aoPaths.transaction(txId));
  const flow = useAoFlow();
  const t = tx.data;
  return (
    <AoStub
      title="거래내역 상세"
      area="account"
      back="close"
      links={
        t?.transfer && t.amount < 0
          ? [
              {
                label: "다시보내기",
                onPress: () =>
                  flow.goAmount({
                    from: t.ao?.accountId ?? t.accountId,
                    to: { bankCode: t.transfer!.bank.code, number: t.transfer!.number, holder: t.transfer!.holder },
                    replace: true,
                    via: "resend",
                  }),
              },
            ]
          : []
      }
    >
      {t && (
        <div className="ao-stub__card">
          <strong>{t.merchant}</strong>
          <small>{aoTxLabel(t) || t.kind}</small>
          <span className="ao-stub__bal">{aoSignedWon(t.amount)}</span>
        </div>
      )}
    </AoStub>
  );
}
