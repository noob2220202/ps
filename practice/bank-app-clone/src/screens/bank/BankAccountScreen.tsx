import { useNavigate, useParams } from "react-router-dom";
import { paths } from "../../api/endpoints";
import type { Account, Transaction } from "../../api/types";
import { useApi } from "../../api/useApi";
import { useStatusBar } from "../../hooks/useStatusBar";
import { won } from "../../lib/format";
import { BankIcon } from "../../components/BankIcon";
import { BackButton } from "../../components/NavButtons";
import { ErrorState } from "../../components/ErrorState";
import { Spinner } from "../../components/Spinner";
import { TxList } from "../../components/TxList";
import { Icon } from "../../components/icons/Icon";
import "./BankAccount.css";

// 다른 은행 계좌 화면 (보기 전용 — 추가/삭제/거래 생성은 홈의 🔔 패널에서)
// 위쪽은 은행 대표색을 아주 옅게 깔아서 어느 은행인지 한눈에 보이게
export function BankAccountScreen() {
  const { accountId = "" } = useParams();
  const navigate = useNavigate();
  const account = useApi<Account>(paths.account(accountId));
  const txs = useApi<Transaction[]>(paths.transactions(accountId));
  useStatusBar("#ffffff", "dark");

  if (account.status === "error")
    return (
      <div className="screen bank">
        <header className="bank__header">
          <BackButton onClick={() => navigate(-1)} />
        </header>
        {account.error.status === 404 ? (
          <p className="bank__empty">삭제된 계좌예요.</p>
        ) : (
          <ErrorState error={account.error} onRetry={account.retry} />
        )}
      </div>
    );

  const acc = account.data;
  const tint = acc?.bank ? `color-mix(in srgb, ${acc.bank.color} 9%, #ffffff)` : "#f6f6f6";

  return (
    <div className="screen bank">
      <div className="bank__top" style={{ background: tint }}>
        <header className="bank__header">
          <BackButton onClick={() => navigate(-1)} />
          <h1>{acc?.bank?.name ?? ""}</h1>
          <span className="bank__header-spacer" />
        </header>
        {acc ? (
          <div className="bank__summary fade-in">
            {acc.bank && <BankIcon bank={acc.bank} size={44} />}
            <span className="bank__label">{acc.label}</span>
            <span className="bank__number">{acc.number}</span>
            <strong className="bank__balance">{won(acc.balance)}</strong>
            <div className="bank__actions">
              <button className="bank__btn pressable" onClick={() => navigate(`/transfer?from=${accountId}`)}>
                이체하기
              </button>
              <button className="bank__btn pressable">가져오기</button>
            </div>
          </div>
        ) : (
          <div className="bank__summary">
            <div className="skel" style={{ width: 44, height: 44, borderRadius: "50%" }} />
            <div className="skel" style={{ width: 140, height: 16, marginTop: 12 }} />
            <div className="skel" style={{ width: 110, height: 26, marginTop: 10 }} />
          </div>
        )}
      </div>

      <div className="mini__search">
        <Icon name="search" size={20} stroke={2} />
        <button className="search-box__filter">
          3개월 · 전체 · 최신 <Icon name="chevron-down" size={14} stroke={1.6} />
        </button>
      </div>

      {txs.status === "loading" ? (
        <div className="mini__spinner">
          <Spinner size={18} color="#9a9a9a" />
        </div>
      ) : txs.status === "error" ? (
        <ErrorState error={txs.error} onRetry={txs.retry} />
      ) : txs.data.length === 0 ? (
        <p className="bank__empty fade-in">거래 내역이 없습니다.</p>
      ) : (
        <div className="fade-in">
          <TxList items={txs.data} onSelect={(tx) => navigate(`/account/${accountId}/tx/${tx.id}`, { state: { tx } })} />
        </div>
      )}
    </div>
  );
}
