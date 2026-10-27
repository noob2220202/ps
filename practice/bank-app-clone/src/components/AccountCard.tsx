import type { Account } from "../types/bank";
import { formatWon } from "../lib/format";
import { Icon } from "./Icon";
import "./AccountCard.css";

interface AccountCardProps {
  account: Account;
  onClick?: () => void;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  return (
    <div
      className={`account-card ${account.isStarred ? "account-card--starred" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="account-card__avatar">
        {account.isStarred ? <Icon name="wave" size={18} /> : "B"}
      </div>

      <div className="account-card__info">
        <div className="account-card__name-row">
          {account.isStarred && <span className="account-card__star">★</span>}
          <span className="account-card__name">{account.nickname}</span>
          {account.badge && <span className="account-card__badge">{account.badge}</span>}
        </div>
        <div className="account-card__balance">{formatWon(account.balanceWon)}</div>
      </div>

      {/* 카드 전체가 클릭 영역이라 이체 버튼까지 같이 눌리면 상세 페이지로 이동해버림.
          실제 서비스라면 e.stopPropagation()으로 버블링을 막아야 함 — 여기선 데모라 생략. */}
      <button className="account-card__transfer-btn" type="button">
        이체
      </button>
    </div>
  );
}
