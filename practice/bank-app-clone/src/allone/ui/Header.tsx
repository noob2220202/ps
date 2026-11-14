// AoHeader (plan.md §3.3): 웹뷰 맨 위 흰 머리줄 50pt (화면 y 59–109, 가운데 84). 밑줄 · 그림자 없음. 홈 · 전체메뉴 머리줄은 영역 몫.
// 자리는 녹화에서 잰 잉크 상자 (ui.css .ao-hdr…):
//  nav    거래내역조회 (C2 11.341): ‹ 잉크 x 31.31 y 76.33 (두께 1.4) · 제목 가운데 16/700 자간 −0.4
//         (잉크 156.54–235.8 × 76.67–91.0) · 집 x 311.74 y 74.67 · ≡🔍 x 347.38 y 76.33
//  close  거래내역 상세 (C2 18.324 · 14.991): 제목 왼쪽 16/600 자간 −0.4 (잉크 24.31 × 77.0–91.0) · × x 348.71 y 75.67
//  flow   누구에게 · 얼마를 · 이체 확인 (C3 27.5 · 29.2): ‹ 11.66 × 20 (두께 1.6) x 23.98 y 74.0 · 취소 14.5/400 #838383
//         자간 −0.35 (잉크 344.38–368.36 × 78.33–90.67). title 을 주면 nav 처럼 가운데 제목
//  modal  가운데 제목 + × : weight 500 = 잔액채우기 17.6/500 (잉크 159.2–232.81 × 77.0–92.33, C3 8.5)
//         weight 700 = 통합검색 17.5/700 (잉크 166.86–225.48 × 76.67–92.33, C3 40.546) · × x 348.71 y 75.67
// 글자 크기는 영역 스펙 값(Pretendard 맞춤) 그대로, 자간만 잉크 폭에 맞춤. 누르는 칸은 44 × 44
import type { ReactNode } from "react";
import { AoBackIcon, AoCloseIcon, AoHomeIcon, AoMenuSearchIcon } from "./icons";

interface Base {
  className?: string;
}
export interface AoHeaderNavProps extends Base {
  variant: "nav";
  title: ReactNode;
  onBack?: () => void;
  onHome?: () => void;
  onMenu?: () => void;
}
export interface AoHeaderCloseProps extends Base {
  variant: "close";
  title: ReactNode;
  onClose?: () => void;
}
export interface AoHeaderFlowProps extends Base {
  variant: "flow";
  title?: ReactNode;
  onBack?: () => void;
  onCancel?: () => void;
  cancelLabel?: string; // 기본 "취소"
}
export interface AoHeaderModalProps extends Base {
  variant: "modal";
  title: ReactNode;
  weight?: 500 | 700; // 기본 500 (잔액채우기), 700 = 통합검색
  onClose?: () => void;
}
export type AoHeaderProps = AoHeaderNavProps | AoHeaderCloseProps | AoHeaderFlowProps | AoHeaderModalProps;

function CloseBtn({ onClose }: { onClose?: () => void }) {
  return (
    <button type="button" className="ao-hdr__btn ao-hdr__btn--close" aria-label="닫기" onClick={() => onClose?.()}>
      <AoCloseIcon />
    </button>
  );
}

export function AoHeader(props: AoHeaderProps) {
  const cls = `ao-hdr ao-hdr--${props.variant}${props.className ? ` ${props.className}` : ""}`;
  switch (props.variant) {
    case "nav":
      return (
        <header className={cls}>
          <button type="button" className="ao-hdr__btn ao-hdr__btn--back" aria-label="뒤로" onClick={() => props.onBack?.()}>
            <AoBackIcon />
          </button>
          <h1 className="ao-hdr__title ao-hdr__title--center ao-hdr__title--nav">{props.title}</h1>
          <button type="button" className="ao-hdr__btn ao-hdr__btn--home" aria-label="홈" onClick={() => props.onHome?.()}>
            <AoHomeIcon />
          </button>
          <button type="button" className="ao-hdr__btn ao-hdr__btn--menu" aria-label="전체메뉴" onClick={() => props.onMenu?.()}>
            <AoMenuSearchIcon />
          </button>
        </header>
      );
    case "close":
      return (
        <header className={cls}>
          <h1 className="ao-hdr__title ao-hdr__title--left">{props.title}</h1>
          <CloseBtn onClose={props.onClose} />
        </header>
      );
    case "flow":
      return (
        <header className={cls}>
          <button type="button" className="ao-hdr__btn ao-hdr__btn--flowback" aria-label="뒤로" onClick={() => props.onBack?.()}>
            <AoBackIcon variant="flow" />
          </button>
          {props.title && <h1 className="ao-hdr__title ao-hdr__title--center ao-hdr__title--nav">{props.title}</h1>}
          <button type="button" className="ao-hdr__cancel" onClick={() => props.onCancel?.()}>
            <span>{props.cancelLabel ?? "취소"}</span>
          </button>
        </header>
      );
    case "modal":
      return (
        <header className={cls}>
          <h1 className={`ao-hdr__title ao-hdr__title--center ao-hdr__title--modal${props.weight === 700 ? "-bold" : ""}`}>{props.title}</h1>
          <CloseBtn onClose={props.onClose} />
        </header>
      );
  }
}
