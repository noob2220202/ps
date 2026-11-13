// 거래내역 · 다른 은행 계좌 화면이 같이 쓰는 줄: 전체 ⌄ / ✓ / 검색 동그라미, 아래 채우기 · 보내기, 머리줄 카드 · 관리 (account.md §2.5 · §2.7)
import { TossBottomDock, TossButton, TossButtonPair } from "../ui/Button";
import { GearIcon } from "../ui/icons";
import { TossPressable } from "../ui/Pressable";
import { AcctChevronDown } from "./parts";

// 돋보기 16dp (#949496)
function AcctMagnifier() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7.1" cy="7.1" r="5.3" stroke="#949496" strokeWidth="1.7" />
      <path d="m11 11 3.6 3.6" stroke="#949496" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
// ✓ 16dp (파랑)
export function AcctCheckMark({ size = 16, color = "var(--toss-blue-text)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.65} viewBox="0 0 16 10.4" fill="none" aria-hidden>
      <path d="m1.2 5.2 4.2 4.2L14.8 1" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 전체 ⌄ (왼쪽) · 잠깐 보이는 ✓ · 검색 동그라미 (오른쪽). 전체 · 검색은 누름 표시만 (plan.md §1.6)
export function AcctFilterRow({ check, className }: { check: boolean; className?: string }) {
  return (
    <div className={`toss-acct-filter${className ? ` ${className}` : ""}`}>
      <TossPressable className="toss-acct-filter__all" radius={8} inset="-6px -8px">
        전체
        <AcctChevronDown className="toss-acct-filter__chev" color="#8d8d8f" s={1.7} />
      </TossPressable>
      <span className={`toss-acct-filter__check${check ? " toss-acct-filter__check--on" : ""}`}>
        <AcctCheckMark />
      </span>
      <TossPressable className="toss-acct-filter__search" radius={16} ariaLabel="검색">
        <AcctMagnifier />
      </TossPressable>
    </div>
  );
}

// 아래 고정 채우기 (옅은 파랑) · 보내기 (파랑), 위 40dp 그라데이션
export function AcctBottomBar({ onSend }: { onSend?: () => void }) {
  return (
    <TossBottomDock fade className="toss-acct-dock">
      <TossButtonPair>
        <TossButton variant="weak">채우기</TossButton>
        <TossButton onPress={onSend}>보내기</TossButton>
      </TossButtonPair>
    </TossBottomDock>
  );
}

// 세운 카드 (거래내역 머리줄 '카드')
function AcctCardGlyph() {
  return (
    <svg width="13.6" height="18.4" viewBox="0 0 13.6 18.4" aria-hidden>
      <rect x="0" y="0" width="13.6" height="18.4" rx="2.6" fill="#6c6c6e" />
      <rect x="2.6" y="2.6" width="3.4" height="4" rx="0.8" fill="#171619" />
    </svg>
  );
}

// 거래내역 머리줄 오른쪽: 카드 · 관리 (#6c6c6e — 녹화 잉크 가장 밝은 곳, 16 R) — 누름 표시만
export function AcctHistoryActions() {
  return (
    <div className="toss-acct-hact">
      <TossPressable className="toss-acct-hact__btn toss-acct-hact__btn--card" radius={10} inset="-6px -6px">
        <AcctCardGlyph />
        <span>카드</span>
      </TossPressable>
      <TossPressable className="toss-acct-hact__btn toss-acct-hact__btn--manage" radius={10} inset="-6px -6px">
        <GearIcon filled size={21.5} color="#6c6c6e" />
        <span>관리</span>
      </TossPressable>
    </div>
  );
}
