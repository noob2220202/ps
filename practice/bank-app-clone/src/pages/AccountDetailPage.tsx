import { useNavigate, useParams } from "react-router-dom";
import { mockAccounts, mockTransactions } from "../data/mockData";
import { TransactionList } from "../components/TransactionList";
import { Icon } from "../components/Icon";
import { formatWon } from "../lib/format";
import "./AccountDetailPage.css";

export function AccountDetailPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();

  const account = mockAccounts.find((a) => a.id === accountId);
  const transactions = mockTransactions.filter((tx) => tx.accountId === accountId);

  // accountId가 URL에만 있고 mockAccounts에 없는 값이면(오타, 삭제된 계좌 등) 여기서 걸러줌.
  // 이런 "존재하지 않는 리소스" 방어 코드는 실무에서도 꼭 필요한 패턴.
  if (!account) {
    return (
      <div className="screen">
        <p>계좌를 찾을 수 없습니다.</p>
        <button onClick={() => navigate("/")}>홈으로</button>
      </div>
    );
  }

  return (
    <div className="screen account-detail">
      <header className="account-detail__header">
        <button onClick={() => navigate(-1)} aria-label="뒤로가기" type="button">
          <Icon name="back" />
        </button>
        <button aria-label="설정" type="button">
          <Icon name="settings" />
        </button>
      </header>

      <div className="account-detail__balance-section">
        <div className="account-detail__label">
          <span className="account-card__star">★</span> 계좌번호
        </div>
        <div className="account-detail__balance">{formatWon(account.balanceWon)}</div>
        <div className="account-detail__actions">
          <button className="account-detail__action-btn" type="button">
            이체하기
          </button>
          <button className="account-detail__action-btn" type="button">
            채우기
          </button>
        </div>
      </div>

      <div className="account-detail__section-title">최근 내역</div>
      <TransactionList
        transactions={transactions}
        onItemClick={(tx) => navigate(`/account/${accountId}/transaction/${tx.id}`)}
      />
    </div>
  );
}
