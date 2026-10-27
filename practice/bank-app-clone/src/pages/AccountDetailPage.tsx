import { useNavigate, useParams } from "react-router-dom";
import { mockAccounts, mockTransactions } from "../data/mockData";
import { TransactionList } from "../components/TransactionList";

// SPEC.md의 "2. 계좌 상세 화면" 참고
// 이미 연결된 것: URL의 :accountId로 계좌 찾기, 해당 계좌의 거래내역 필터링, 상세 페이지 이동
// 직접 채울 것: 잔액 크게 표시, 이체하기/채우기 버튼, 뒤로가기

export function AccountDetailPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();

  const account = mockAccounts.find((a) => a.id === accountId);
  const transactions = mockTransactions.filter((tx) => tx.accountId === accountId);

  if (!account) return <div>계좌를 찾을 수 없습니다</div>;

  return (
    <div className="screen">
      TODO: 뒤로가기 버튼, {account.nickname} 잔액 {account.balanceWon}원, 이체하기/채우기 버튼
      <TransactionList
        transactions={transactions}
        onItemClick={(tx) => navigate(`/account/${accountId}/transaction/${tx.id}`)}
      />
    </div>
  );
}
