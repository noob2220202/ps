// [기초 단계 자리 — account 영역이 이 파일을 진짜 거래내역조회(계좌 블록 · 조회 조건 · 행 · 잔액 숨기기 · 시트들)로 바꿈]
// 지금은 이동 시험용: 거래 행 → 상세 (입금 txIn · 출금 txOut), 이체 → 누구에게 보낼까요 (sendFromList), 홈 · 전체메뉴
import { useParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { aoPaths, type AoAccount, type AoTransaction } from "../api";
import { useAoFlow } from "../flow";
import { aoAccountNumber, aoSignedWon, aoTime, aoTxLabel, aoWon } from "../format";
import { AoStub } from "../stub";

export function History() {
  const { accountId = "main" } = useParams();
  const account = useApi<AoAccount>(aoPaths.account(accountId));
  const txs = useApi<AoTransaction[]>(aoPaths.transactions(accountId));
  const flow = useAoFlow();
  return (
    <AoStub
      title="거래내역조회"
      area="account"
      links={[
        { label: "이체", onPress: () => flow.goSend({ from: accountId, origin: "history" }) },
        { label: "홈", onPress: () => flow.goHome() },
        { label: "전체메뉴", onPress: () => flow.goMenu() },
      ]}
    >
      {account.data && (
        <div className="ao-stub__card">
          <strong>{account.data.label}</strong>
          <small>{aoAccountNumber(account.data)}</small>
          <span className="ao-stub__bal">{aoWon(account.data.balance)}</span>
        </div>
      )}
      {txs.data?.slice(0, 8).map((t) => (
        <button key={t.id} className="ao-stub__tx" onClick={() => void flow.goTx(t.id, t.amount < 0 ? "out" : "in")}>
          <span>
            {t.merchant} <small>{aoTxLabel(t)}</small>
          </span>
          <span>{aoSignedWon(t.amount)}</span>
          <small>
            {t.at.slice(0, 10)} {aoTime(t.at)}
          </small>
        </button>
      ))}
    </AoStub>
  );
}
