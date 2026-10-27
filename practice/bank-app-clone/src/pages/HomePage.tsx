import { useNavigate } from "react-router-dom";
import { mockAccounts, mockMonthlyCardSpend, mockGroupAccount } from "../data/mockData";
import { AccountCard } from "../components/AccountCard";
import { GroupAccountCard } from "../components/GroupAccountCard";
import { BottomNav } from "../components/BottomNav";

// SPEC.md의 "1. Home 화면" 전체 참고
// 이 페이지는 이미 데이터 연결/라우팅이 되어 있습니다.
// AccountCard, GroupAccountCard, BottomNav 내부 구현을 채우면 화면이 완성됩니다.

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="screen">
      TODO: 상단 검색바 / AI 추천 배너 영역
      {mockAccounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          onClick={() => navigate(`/account/${account.id}`)}
        />
      ))}
      TODO: {mockMonthlyCardSpend.label} {mockMonthlyCardSpend.totalWon}원 카드 섹션
      <GroupAccountCard group={mockGroupAccount} />
      <BottomNav />
    </div>
  );
}
