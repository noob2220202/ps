import { OS } from "../platform/platform";
import { Icon } from "./icons/Icon";

// 안드로이드: 화살표(←) 아이콘만. iOS 26+: 유리(Liquid Glass) 원 안의 꺾쇠(‹) — 스타일은 global.css
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn" aria-label="뒤로" onClick={onClick}>
      {OS === "ios" ? <Icon name="chevron-left" size={22} stroke={2.3} /> : <Icon name="back" />}
    </button>
  );
}

export function GearButton() {
  return (
    <button className="icon-btn" aria-label="설정">
      <Icon name="gear" size={OS === "ios" ? 21 : 23} stroke={1.7} />
    </button>
  );
}
