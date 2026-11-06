import { NavAi, NavAll, NavBenefit, NavHome, NavInvest } from "./icons";
import "./K2TabBar.css";

const TABS = [
  { label: "홈", icon: "home", Icon: NavHome },
  { label: "혜택", icon: "benefit", Icon: NavBenefit },
  { label: "AI", icon: "ai", Icon: NavAi },
  { label: "투자", icon: "invest", Icon: NavInvest },
  { label: "전체", icon: "all", Icon: NavAll },
] as const;

// kakao2 홈 탭바 (home.md §4.14): iOS 26 유리 캡슐 351 × 62, 줄어들지 않음. 어두운 유리가 기본, 떠 있는 광고가 내려간 뒤로는 밝은 유리 (400ms).
// 빨간 점은 '전체'에만. 통장으로 밀려날 때 · 이체 모달을 닫고 돌아올 때의 모습은 K2TabBar.css (critic.md G1 · G3)
export function K2TabBar({ tone }: { tone: "dark" | "light" }) {
  return (
    <nav className={`k2-tab k2-tab--${tone}`}>
      <span className="k2-tab__glass" />
      <span className="k2-tab__sel" />
      <span className="k2-tab__items">
        {TABS.map(({ label, icon, Icon }) => (
          <button key={label} className={`k2-tab__item k2-tab__item--${icon}${icon === "home" ? " k2-tab__item--on" : ""}`}>
            <span className="k2-tab__icon">
              <Icon />
            </span>
            <span className="k2-tab__label">{label}</span>
            {icon === "all" && <span className="k2-tab__dot" />}
          </button>
        ))}
      </span>
    </nav>
  );
}
