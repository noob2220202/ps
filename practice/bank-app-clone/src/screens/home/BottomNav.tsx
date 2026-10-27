import { Icon } from "../../components/icons/Icon";

const TABS = [
  { label: "홈", icon: "home", dot: false },
  { label: "혜택", icon: "gift", dot: true },
  { label: "AI", icon: "ai", dot: false },
  { label: "투자", icon: "invest", dot: false },
  { label: "전체", icon: "menu", dot: true },
] as const;

export function BottomNav({ minimized = false }: { minimized?: boolean }) {
  return (
    <nav className={`bottom-nav ${minimized ? "bottom-nav--min" : ""}`}>
      {TABS.map((t) => (
        <button key={t.label} className={`bottom-nav__item ${t.label === "홈" ? "bottom-nav__item--active" : ""}`}>
          <span className="bottom-nav__icon">
            <Icon name={t.icon} size={23} stroke={1.8} />
            {t.dot && <span className="red-dot bottom-nav__dot" />}
          </span>
          <span className="bottom-nav__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
