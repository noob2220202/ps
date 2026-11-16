// 이의제기 화면 공용 부품 (영역 안에서만). 이 웹 화면들의 머리줄은 공용 AoHeader 와 아이콘 · 자리가 달라서 따로 그림 (녹화 C4 1.2 · 2.0):
//  ← 화살표 (잉크 x 26.31–45.63 · y 77.33–90.67, 두께 1.45 둥근 끝) · 가운데 제목 (잉크 132.31–260.53 × 77–91.33)
//  nav: 집 (잉크 x 307.66 y 74.67 — 거래내역조회보다 4pt 왼쪽) · ≡🔍 (상자 345, 74 — 공용과 같음)
//  flow: 취소 #3a3a3a (잉크 341.99–368.3 × 77.33–91.33 — 공용 flow 의 취소보다 크고 진함)
import type { ReactNode } from "react";
import type { DspScrollBarState } from "./store";
import { AoHomeIcon, AoMenuSearchIcon } from "../ui";

// ← (잉크 19.32 × 13.34). svg 상자는 화면 정수 자리 (26, 77) 에 두고 선은 그 안에서 (0.31, 0.33) 만큼 옮김 — 상자를 소수 자리에 두면 1pt 단위로 붙어 버림
function ArrowBack() {
  const s = 1.45;
  const i = s / 2;
  const w = 19.32;
  const h = 13.34;
  const m = h / 2; // 화살촉은 45° (가로 = 세로)
  return (
    <svg className="ao-dsp-hdr__arrow" width="21" height="15" viewBox="0 0 21 15" aria-hidden>
      <path
        transform="translate(0.31 0.33)"
        d={`M${i} ${m}H${w - i}M${m} ${i}L${i} ${m}L${m} ${h - i}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={s}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 칸 안 돋보기 (잉크 15.65 × 17 — 고리 지름 13.6, 손잡이가 아래로 조금 김). 영업점 칸 · 영업점검색 칸 (C4 4.941 · 7.0)
export function DspMagnifier({ className }: { className?: string }) {
  return (
    <svg className={className} width="15.65" height="17" viewBox="0 0 15.65 17" aria-hidden>
      <circle cx="6.9" cy="6.6" r="6.12" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path d="M10.6 11.5L14.98 16.33" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function DisputeHeader({
  variant,
  title,
  blank = false,
  showTitle = true,
  onBack,
  onHome,
  onMenu,
  onCancel,
}: {
  variant: "nav" | "flow";
  title: ReactNode;
  blank?: boolean; // 아직 아무것도 안 그린 웹 화면 (빈 흰 머리줄)
  showTitle?: boolean;
  onBack?: () => void;
  onHome?: () => void;
  onMenu?: () => void;
  onCancel?: () => void;
}) {
  return (
    <header className={`ao-dsp-hdr ao-dsp-hdr--${variant}${blank ? " ao-dsp-hdr--blank" : ""}`}>
      <button type="button" className="ao-dsp-hdr__btn ao-dsp-hdr__back" aria-label="뒤로" onClick={() => onBack?.()}>
        <ArrowBack />
      </button>
      {showTitle && <h1 className="ao-dsp-hdr__title">{title}</h1>}
      {variant === "nav" ? (
        <>
          <button type="button" className="ao-dsp-hdr__btn ao-dsp-hdr__home" aria-label="홈" onClick={() => onHome?.()}>
            <AoHomeIcon />
          </button>
          <button type="button" className="ao-dsp-hdr__btn ao-dsp-hdr__menu" aria-label="전체메뉴" onClick={() => onMenu?.()}>
            <AoMenuSearchIcon />
          </button>
        </>
      ) : (
        <button type="button" className="ao-dsp-hdr__cancel" onClick={() => onCancel?.()}>
          <span>취소</span>
        </button>
      )}
    </header>
  );
}

// 흰 막 (웹뷰 = 이 화면 층 전체, 머리줄 · 아래 버튼까지). 키보드 · 상태바 · 공용 스피너는 그 위
export function DisputeVeil({ on }: { on: boolean }) {
  return on ? <div className="ao-dsp-veil" aria-hidden /> : null;
}

// 오른쪽 스크롤 막대 (store.ts useScrollBar)
export function DspScrollBar({ bar }: { bar: DspScrollBarState }) {
  if (!bar.height) return null;
  return <div className={`ao-dsp-sbar${bar.on ? " ao-dsp-sbar--on" : ""}`} style={{ top: bar.top, height: bar.height }} aria-hidden />;
}
