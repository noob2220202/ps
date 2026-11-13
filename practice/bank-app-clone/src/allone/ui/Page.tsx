// AoPage (plan.md §3.3): 웹뷰(59–818, 759pt) 안의 흰 화면 한 장. ScreenStack 층(.layer)을 꽉 채움.
//   <div.ao-page  바탕 bg (기본 #fff)>
//     header   위 고정 (보통 AoHeader, 50pt = 화면 y 59–109) — 내용은 그 밑에서 스크롤되고 109 에서 잘림
//     body     스크롤 (bodyRef · onScroll)
//     footer   아래 고정 (흰 바탕, 딱 끊김). 기본 안쪽 9.33 24 30 = T5 잔액채우기 버튼 자리 (위 722 → 버튼 731.33–788 → 818 까지 30)
// 상태바는 흰 띠 위 검정 글자 (useStatusBar). 웹 시트(AoSheet)는 이 화면 층에 붙어서 웹뷰만 덮음
import type { CSSProperties, ReactNode, Ref, UIEvent } from "react";
import { useStatusBar } from "../../hooks/useStatusBar";

export interface AoPageProps {
  header?: ReactNode;
  footer?: ReactNode;
  footerClassName?: string; // 기본 안쪽 여백을 바꿀 때 (예: 거래내역 상세 확인 730.7–786.7 → 아래 31.3)
  footerStyle?: CSSProperties;
  bodyRef?: Ref<HTMLDivElement>;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  bg?: string;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function AoPage({ header, footer, footerClassName, footerStyle, bodyRef, onScroll, bg, className, bodyClassName, style, children }: AoPageProps) {
  useStatusBar("#ffffff", "dark");
  return (
    <div className={`ao-page${className ? ` ${className}` : ""}`} style={{ ...(bg && { background: bg }), ...style }}>
      {header && <div className="ao-page__head">{header}</div>}
      <div className={`ao-page__body${bodyClassName ? ` ${bodyClassName}` : ""}`} ref={bodyRef} onScroll={onScroll}>
        {children}
      </div>
      {footer && (
        <div className={`ao-page__foot${footerClassName ? ` ${footerClassName}` : ""}`} style={footerStyle}>
          {footer}
        </div>
      )}
    </div>
  );
}
