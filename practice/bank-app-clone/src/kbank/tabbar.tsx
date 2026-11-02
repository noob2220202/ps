import { localAsset } from "../assets/Asset";
import "./kbank-home.css"; // 탭바 스타일(kbh-tabbar)도 홈 CSS 에 있음

// 케이뱅크 아래 탭바 (홈·상품·혜택·서비스·전체). 녹화 16.5~16.9초(프레임 496~508) 에서 잰 값.
// 흰 바탕, 위 모서리 둥긂(r ≈ 21dp, 녹화 32px), 윗선 1px #e4e8ee (녹화 y 1172).
// 아이콘 그림: 녹화에서 잘라 4배 (scripts/kbank-crops/home.py tab-*), 글자: 11px 500 (FONT.md), 활성 #0212a4 · 나머지 #5c5f63.
// 아래 16dp 는 제스처 손잡이 자리 — 아이폰은 그 자리가 홈 인디케이터 안전영역(--safe-bottom)으로 바뀜 (kbank-home.css .kbh-tabbar)
export type KbankTab = "홈" | "상품" | "혜택" | "서비스" | "전체";
const TABS: { label: KbankTab; art: string }[] = [
  { label: "홈", art: "kbank-home-tab-home" },
  { label: "상품", art: "kbank-home-tab-product" },
  { label: "혜택", art: "kbank-home-tab-benefit" },
  { label: "서비스", art: "kbank-home-tab-service" },
  { label: "전체", art: "kbank-home-tab-all" },
];

// 다른 탭은 녹화에 없음 → 눌러도 아무 일 없음 (onTab 을 주면 그 탭만 반응)
export function KbankTabBar({ active = "홈", onTab }: { active?: KbankTab; onTab?: (tab: KbankTab) => void }) {
  return (
    <nav className="kbh-tabbar">
      {TABS.map((t) => {
        const src = localAsset(t.art);
        return (
          <button key={t.label} className={`kbh-tabbar__tab ${t.label === active ? "on" : ""}`} onClick={() => onTab?.(t.label)}>
            {src ? <img src={src} alt="" draggable={false} /> : <i />}
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
