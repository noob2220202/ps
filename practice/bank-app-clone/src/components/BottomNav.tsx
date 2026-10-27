import { useLocation } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import "./BottomNav.css";

// 혜택/AI/투자/전체 화면은 영상에 안 나와서 스펙 밖 → 실제 라우트 없이
// "홈"만 /일 때 활성화되는 걸로 표시. 나머지는 눌러도 아무 일 안 일어남.
const TABS: { label: string; icon: IconName; path: string }[] = [
  { label: "홈", icon: "home", path: "/" },
  { label: "혜택", icon: "gift", path: "/benefits" },
  { label: "AI", icon: "sparkle", path: "/ai" },
  { label: "투자", icon: "chart", path: "/invest" },
  { label: "전체", icon: "menu", path: "/all" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => {
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            className={`bottom-nav__item ${active ? "bottom-nav__item--active" : ""}`}
            type="button"
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
