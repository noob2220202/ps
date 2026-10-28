import { useNavigate } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { paths } from "../../api/endpoints";
import type { Account, Transaction } from "../../api/types";
import { TxList } from "../../components/TxList";
import { ErrorState } from "../../components/ErrorState";
import { useStatusBar } from "../../hooks/useStatusBar";
import { won } from "../../lib/format";
import { Spinner } from "../../components/Spinner";
import { BackButton, GearButton } from "../../components/NavButtons";
import { Icon } from "../../components/icons/Icon";
import "./Mini.css";

// mini는 상단(잔액)은 즉시 그리고, 거래내역만 흰 동그라미 스피너로 로딩 (영상 37초)
export function MiniScreen() {
  const navigate = useNavigate();
  useStatusBar("var(--beige-page)", "dark");
  const account = useApi<Account>(paths.account("mini"));
  const txs = useApi<Transaction[]>(paths.transactions("mini"));
  // 상단(이름/잔액)은 거의 안 바뀌는 정보라 영상에서도 즉시 그려짐 → 응답 전엔 빈 값으로 자리만
  const mini = account.data ?? { label: "", number: "", balance: 0 };

  return (
    <div className="screen mini">
      <div className="mini__top">
        <header className="mini__header">
          <BackButton onClick={() => navigate(-1)} />
          <h1>{mini.label}</h1>
          <GearButton />
        </header>
        <div className="mini__number">{mini.number}</div>
        <strong className="mini__balance">{account.data ? won(mini.balance) : "\u00a0"}</strong>
        <div className="mini__actions">
          <button className="mini__btn pressable" onClick={() => navigate("/transfer?from=mini")}>
            이체하기
          </button>
          <button className="mini__btn pressable">
            용돈요청
            <span className="mini__new">NEW</span>
          </button>
        </div>
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
        <p className="mini__empty fade-in">거래 내역이 없습니다.</p>
      ) : (
        <div className="mini__list fade-in">
          <TxList items={txs.data} onSelect={(tx) => navigate(`/account/mini/tx/${tx.id}`, { state: { tx } })} />
        </div>
      )}
    </div>
  );
}
