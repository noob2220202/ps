// 토스 화면 한 장의 뼈대 (plan.md §3.1 · §3.3). 상태바는 화면 위에 겹친 투명한 층이라(StatusBar.tsx) 맨 위 28dp 띠는 화면이 직접 칠함
// — 띠는 화면 층과 같이 움직임 (push 중 그 위 빈자리가 검게 보이는 것도 이 때문, nav.css).
//   <div.toss-page  바탕(bg), 853.33 전체>
//     <div.toss-page__band  0–28 (band 색)>
//     <div.toss-page__main  28 – 838.33 (scrim 띠 모드면 853.33 까지)>  ← 전환 때 '내용'으로 따로 움직이는 부분 (nav.css)
//        header → body(스크롤) → dock
// 시트 · 안내창(Sheet.tsx · Dialog.tsx)은 이 화면 뿌리(.toss-page)에 붙어서 띠까지 덮음 (TossPageContext)
import { useState, type CSSProperties, type ReactNode, type Ref, type UIEvent } from "react";
import { useTossBand, type TossBandMode } from "../band";
import { TossPageContext } from "./shared";

export const TOSS_BG = "#171619";
export const TOSS_BG_DEEP = "#100f12";

export interface TossPageProps {
  bg?: string; // 화면 바탕 (기본 #171619, 홈 · 증명서 첫 화면 #100f12)
  band?: string; // 맨 위 28dp 띠 색 (기본 = bg)
  header?: ReactNode; // AppBar 등 (본문 위, 스크롤 안 됨)
  headerOverlay?: boolean; // 머리줄을 본문 위에 겹침 (통장: 투명 + 흐림, 거래내역: 스크롤 따라 바탕) — 본문 위 여백은 화면이 둠
  dock?: ReactNode; // 아래 고정 (BottomDock · 탭바 등)
  navMode?: TossBandMode; // 이 화면이 맨 위인 동안 아래 내비 띠 모드 (scrim 이면 내용이 띠 밑까지)
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  bodyRef?: Ref<HTMLDivElement>;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  children?: ReactNode;
}

export function TossPage({ bg = TOSS_BG, band, header, headerOverlay, dock, navMode, className, bodyClassName, style, bodyRef, onScroll, children }: TossPageProps) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  useTossBand(navMode && navMode !== "solid" ? navMode : null);
  return (
    <div
      ref={setRoot}
      className={`toss-page${navMode === "scrim" ? " toss-page--under-nav" : ""}${headerOverlay ? " toss-page--overlay-head" : ""}${className ? ` ${className}` : ""}`}
      style={{ background: bg, ...style }}
    >
      <div className="toss-page__band" style={{ background: band ?? bg }} />
      <TossPageContext.Provider value={root}>
        <div className="toss-page__main">
          {header && <div className="toss-page__head">{header}</div>}
          <div className={`toss-page__body${bodyClassName ? ` ${bodyClassName}` : ""}`} ref={bodyRef} onScroll={onScroll}>
            {children}
          </div>
          {dock}
        </div>
      </TossPageContext.Provider>
    </div>
  );
}

// 시트 · 안내창 등이 이 화면 뿌리에 붙도록 감쌈 (TossPage 안에서는 저절로). 화면 뿌리가 아니라 그 안의 어떤 칸에 붙이고 싶을 때
export function TossPortalRoot({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setRoot} className="toss-portal-root">
      <TossPageContext.Provider value={root}>{children}</TossPageContext.Provider>
    </div>
  );
}
