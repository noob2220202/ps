import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mockAccounts, mockMonthlyCardSpend, mockGroupAccount } from "../data/mockData";
import { AccountCard } from "../components/AccountCard";
import { MonthlyCardSpend } from "../components/MonthlyCardSpend";
import { GroupAccountCard } from "../components/GroupAccountCard";
import { BottomNav } from "../components/BottomNav";
import { Icon } from "../components/Icon";
import "./HomePage.css";

const AI_HINTS = [
  "원금 지키는 펀드, 정말 가능할까요?",
  "지난 달보다 얼마나 더 썼을까요?",
  "회비 안 낸 모임멤버 한 번에 모아봤어요",
];

export function HomePage() {
  const navigate = useNavigate();
  const [hintIndex, setHintIndex] = useState(0);

  // 3초마다 배너 문구를 돌림. 언마운트 시 꼭 interval을 정리해야 메모리 누수가 안 남
  // (의존성 배열을 []로 둬서 effect가 처음 1번만 등록되게 함).
  useEffect(() => {
    const id = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % AI_HINTS.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="screen home-page">
      <header className="home-header">
        <div className="home-header__search">
          <Icon name="search" size={16} />
          <span>{AI_HINTS[hintIndex]}</span>
        </div>
        <button className="home-header__bell" type="button" aria-label="알림">
          <Icon name="bell" />
          <span className="home-header__bell-dot" />
        </button>
      </header>

      <section>
        {mockAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onClick={() => navigate(`/account/${account.id}`)}
          />
        ))}
      </section>

      <MonthlyCardSpend spend={mockMonthlyCardSpend} />
      <GroupAccountCard group={mockGroupAccount} />

      <BottomNav />
    </div>
  );
}
