// AoSheet (plan.md §3.3): 웹 아래 시트 (화면 안, 웹뷰 59–818 만 덮음 — 웹 로딩 막이 그 위에 올 수 있음).
//  배경막 rgba(0,0,0,.30) 이 300ms ease 로 나타남 (흰색 → 178, C3 3.33 · C1 12.75)
//  enter "rise": 818 → top 까지 291ms cubic-bezier(0,.11,.17,.87) (T6 출금계좌 선택, C3 2.879–3.196)
//        "pop" : 미끄러짐 없이 배경막 첫 프레임에 나타남 (정기점검 안내, C1 12.733)
//  exit  "slide": 150ms 내려가며 배경막도 같이 사라짐 (invented) · "cut": 한 프레임에 시트와 배경막이 같이 사라짐 (정기점검 닫기, T6 행 누름)
//  위 모서리 둥글기 24 (T6 · 정기점검에서 잼), 흰 바탕, 손잡이 · 구분선 · 그림자 없음
//  title 을 주면 T6 머리줄: 제목 20.6/500 (잉크 x 24.98, 시트 위 +23.33, C3 4.5) · × (잉크 x 348.71, +23.67)
//  top: 쉴 때 시트 위끝 (화면 y). 안 주면 내용 높이 (maxTop 보다 위로는 안 감, 넘치면 본문이 스크롤)
//  footer: 시트 아래 고정 칸 (기본 안쪽 0 24 30 — T6 버튼 731.33–788)
// 화면 층(.layer)에 붙어서 그려짐 (portal). 그 층이 맨 위가 아니면 같이 숨음. 열려 있어도 방문 기록은 쌓지 않음 (plan §1.3)
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AO_SHEET } from "../motion";
import { AoCloseIcon } from "./icons";

export interface AoSheetProps {
  open: boolean;
  onClose?: () => void; // × · 배경막 누름
  enter?: "rise" | "pop";
  exit?: "slide" | "cut";
  top?: number;
  maxTop?: number; // 기본 160
  radius?: number; // 기본 24
  title?: ReactNode;
  closeButton?: boolean; // 기본: title 이 있으면
  scrimClose?: boolean; // 배경막을 누르면 onClose (기본 true)
  footer?: ReactNode;
  footerClassName?: string;
  className?: string;
  bodyClassName?: string;
  onClosed?: () => void; // 나가는 움직임이 끝나 사라진 뒤
  host?: HTMLElement | null; // 붙일 곳 (기본: 가장 가까운 화면 층 .layer)
  children?: ReactNode;
}

type Phase = "closed" | "open" | "closing";

export function AoSheet({
  open,
  onClose,
  enter = "rise",
  exit = "slide",
  top,
  maxTop = 160,
  radius = 24,
  title,
  closeButton,
  scrimClose = true,
  footer,
  footerClassName,
  className,
  bodyClassName,
  onClosed,
  host,
  children,
}: AoSheetProps) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  if (open && phase !== "open") setPhase("open");
  if (!open && phase === "open") setPhase(exit === "cut" ? "closed" : "closing");

  useEffect(() => {
    if (phase !== "closing") return;
    const t = window.setTimeout(() => setPhase("closed"), AO_SHEET.down + 20);
    return () => window.clearTimeout(t);
  }, [phase]);

  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });
  const shown = useRef(phase !== "closed");
  useEffect(() => {
    if (phase === "closed" && shown.current) onClosedRef.current?.();
    shown.current = phase !== "closed";
  }, [phase]);

  // 붙일 화면 층 찾기 (그리기 전에 — useLayoutEffect 라 첫 프레임부터 제자리)
  const anchor = useRef<HTMLSpanElement>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (host !== undefined) return;
    setLayer(anchor.current?.closest<HTMLElement>(".layer") ?? anchor.current?.closest<HTMLElement>(".phone__viewport") ?? null);
  }, [host]);
  const target = host !== undefined ? host : layer;

  const showClose = closeButton ?? title != null;
  const node =
    phase === "closed" ? null : (
      <div className={`ao-sheet ao-sheet--${phase} ao-sheet--${enter}${className ? ` ${className}` : ""}`}>
        <div className="ao-sheet__scrim" onClick={() => scrimClose && phase === "open" && onClose?.()} />
        <div
          className="ao-sheet__card"
          role="dialog"
          aria-modal
          style={{
            borderRadius: `${radius}px ${radius}px 0 0`,
            // 웹뷰 아래끝(818)에 붙고 높이로 위끝을 정함 (진짜 폰에서 웹뷰 높이가 달라도 시트 높이는 그대로).
            // 다만 웹뷰가 그보다 낮은 폰이면 위 40 은 남김 — 제목 · × 가 화면 밖으로 나가지 않고 위쪽 배경막을 눌러 닫을 수 있게 (본문은 스크롤)
            ...(top !== undefined ? { height: `min(${818 - top}px, calc(100% - 40px))` } : { maxHeight: `min(${818 - maxTop}px, calc(100% - 40px))` }),
          }}
        >
          {(title != null || showClose) && (
            <div className="ao-sheet__head">
              {title != null && <h2 className="ao-sheet__title">{title}</h2>}
              {showClose && (
                <button type="button" className="ao-sheet__close" aria-label="닫기" onClick={() => phase === "open" && onClose?.()}>
                  <AoCloseIcon />
                </button>
              )}
            </div>
          )}
          <div className={`ao-sheet__body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
          {footer && <div className={`ao-sheet__foot${footerClassName ? ` ${footerClassName}` : ""}`}>{footer}</div>}
        </div>
      </div>
    );

  return (
    <>
      <span ref={anchor} hidden />
      {node && (target ? createPortal(node, target) : node)}
    </>
  );
}
