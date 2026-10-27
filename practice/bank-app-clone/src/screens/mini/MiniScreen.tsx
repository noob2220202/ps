import { useNavigate } from "react-router-dom";
import { api } from "../../api/mockApi";
import { useAsync } from "../../hooks/useAsync";
import { useStatusBar } from "../../hooks/useStatusBar";
import { won } from "../../lib/format";
import { ACCOUNTS } from "../../api/db";
import { Spinner } from "../../components/Spinner";
import { BackButton, GearButton } from "../../components/NavButtons";
import { Icon } from "../../components/icons/Icon";
import "./Mini.css";

// mini는 상단(잔액)은 즉시 그리고, 거래내역만 흰 동그라미 스피너로 로딩 (영상 37초)
export function MiniScreen() {
  const navigate = useNavigate();
  useStatusBar("var(--beige-page)", "dark");
  const mini = ACCOUNTS[0];
  const txs = useAsync(() => api.transactions(mini.id), []);

  return (
    <div className="screen mini">
      <div className="mini__top">
        <header className="mini__header">
          <BackButton onClick={() => navigate(-1)} />
          <h1>{mini.label}</h1>
          <GearButton />
        </header>
        <div className="mini__number">{mini.number}</div>
        <strong className="mini__balance">{won(mini.balance)}</strong>
        <div className="mini__actions">
          <button className="mini__btn pressable">이체하기</button>
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
      ) : (
        <p className="mini__empty fade-in">거래 내역이 없습니다.</p>
      )}
    </div>
  );
}
