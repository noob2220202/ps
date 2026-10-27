import type { GroupAccount } from "../types/bank";
import "./GroupAccountCard.css";

interface GroupAccountCardProps {
  group: GroupAccount;
}

export function GroupAccountCard({ group }: GroupAccountCardProps) {
  return (
    <div className="group-card">
      <div className="group-card__title">모임 관리</div>
      <div className="group-card__row">
        <span>🙂 모임 멤버</span>
        <span className="group-card__value">{group.memberCount}명 참여 중</span>
      </div>
      {group.unpaidDuesCount > 0 && (
        <div className="group-card__row">
          <span>🧾 회비 입금현황</span>
          <span className="group-card__value group-card__value--alert">
            {group.unpaidDuesCount}명 미납
          </span>
        </div>
      )}
    </div>
  );
}
