// AoNativeSheet (plan.md §3.3, transfer §2.4 · §2.7 · §3.13–3.14): 네이티브 시트 — 웹뷰 밖까지, 창 전체(상태바 띠 포함)를 막으로 덮음
// (#ao-native, z 55 — 아일랜드 · 빨간 점 · 상태바 글자는 그 위). 웹 로딩 막에 덮이지 않음.
//  level "amount"   금액 입력 T7: 막 검정 .765 (흰색 → 60), 시트 위 224, 둥글기 24 (C3 6.5 에서 잼)
//                   enter "rise": 막은 한 프레임에, 시트는 +64ms 부터 357ms cubic-bezier(.19,.52,.23,1) 로 852 → top (금액 칸을 누르면 riseDelay 46)
//                   exit "slide": 145ms cubic-bezier(.29,.19,.54,.75) 로 내려간 뒤 막이 370ms 더 남았다 한 프레임에 사라짐 (C3 7.729–8.246)
//                   statusFg: 상태바 아이콘은 막 +600ms 에 한 프레임에, 시계는 +667ms 부터 100ms 동안 흰색. 닫기 시작하면 한 프레임에 검정
//                   제목 "금액 입력" 19.8/600 (잉크 x 24.65, 위 +26.67) · × #656571 16 × 16 두께 1.9 네모 끝 (x 346.71, +28)
//  level "password" 계좌 비밀번호 T3: 막 검정 .733 (흰색 → 68), 시트 위 368, 둥글기 20 (C3 32.5), 나타남 · 사라짐 모두 한 프레임, 상태바는 검정 그대로
//                   제목 18.8/400 (잉크 x 24.98, +28) · × 17.32 두께 1.45 검정 (x 346.38, +26.67)
// 시트 안 좌표: (0, 0) = 시트 왼쪽 위. 영역은 자식을 화면 y − top 에 absolute 로 두거나 그냥 흐름대로 (제목 줄은 absolute 라 자리를 차지하지 않음)
// 녹화 다시 시작 · 로그아웃(aoNativeReset) 이면 바로 사라지고 onClose 를 부름
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLayerActive } from "../../platform/LayerContext";
import { AO_AMOUNT_SHEET } from "../motion";
import { onAoNativeReset } from "../native";
import { setAoStatusFg } from "../statusFg";
import { AoCloseIcon } from "./icons";
import { AoNativePortal } from "./NativePortal";

export type AoNativeSheetLevel = "amount" | "password";

export interface AoNativeSheetProps {
  open: boolean;
  level: AoNativeSheetLevel;
  enter?: "rise" | "instant"; // 기본 amount → rise, password → instant
  exit?: "slide" | "instant"; // 기본 amount → slide, password → instant
  riseDelay?: number; // 막이 뜬 뒤 시트가 올라오기 시작할 때까지 (기본 64)
  top?: number; // 쉴 때 시트 위끝 (화면 y). 기본 amount 224 · password 368
  radius?: number; // 기본 amount 24 · password 20
  statusFg?: boolean; // 상태바 글자를 흰색으로 (기본 amount 만 true)
  title?: ReactNode;
  closeButton?: boolean; // 기본: title 이 있으면
  onClose?: () => void; // × (그리고 aoNativeReset)
  onDimClick?: () => void; // 막 누름 (기본 아무것도 안 함)
  onClosed?: () => void; // 막까지 다 사라진 뒤
  className?: string;
  children?: ReactNode;
}

type Phase = "closed" | "open" | "closing";

export function AoNativeSheet({
  open,
  level,
  enter = level === "amount" ? "rise" : "instant",
  exit = level === "amount" ? "slide" : "instant",
  riseDelay = AO_AMOUNT_SHEET.riseDelay,
  top = level === "amount" ? 224 : 368,
  radius = level === "amount" ? 24 : 20,
  statusFg = level === "amount",
  title,
  closeButton,
  onClose,
  onDimClick,
  onClosed,
  className,
  children,
}: AoNativeSheetProps) {
  // 녹화 다시 시작으로 걷힌 상태: open 이 한 번 false 가 될 때까지 안 그림
  const [killed, setKilled] = useState(false);
  if (!open && killed) setKilled(false);
  const want = open && !killed;

  const [phase, setPhase] = useState<Phase>(want ? "open" : "closed");
  if (want && phase !== "open") setPhase("open");
  if (!want && phase === "open") setPhase(exit === "instant" || killed ? "closed" : "closing");

  useEffect(() => {
    if (phase !== "closing") return;
    const t = window.setTimeout(() => setPhase("closed"), AO_AMOUNT_SHEET.close + AO_AMOUNT_SHEET.dimLinger);
    return () => window.clearTimeout(t);
  }, [phase]);

  const cb = useRef({ onClose, onClosed });
  useEffect(() => {
    cb.current = { onClose, onClosed };
  });
  const shown = useRef(phase !== "closed");
  useEffect(() => {
    if (phase === "closed" && shown.current) cb.current.onClosed?.();
    shown.current = phase !== "closed";
  }, [phase]);

  // 상태바 글자색: 열리면 흰색 (아이콘 +600 한 프레임 · 시계 +667 부터 100ms), 닫기 시작하면 한 프레임에 원래 색.
  // 시트를 연 화면이 맨 위가 아니게 되면(위에 새 화면 — 시트는 AoNativePortal 이 숨김) 흰 글자도 같이 풂
  const active = useLayerActive();
  const fgOn = useRef(false);
  const fgWanted = statusFg && phase === "open" && active;
  useEffect(() => {
    if (fgWanted && !fgOn.current) {
      fgOn.current = true;
      setAoStatusFg("light", {
        iconsDelay: AO_AMOUNT_SHEET.statusIconsDelay,
        clockDelay: AO_AMOUNT_SHEET.statusClockDelay,
        clockMs: AO_AMOUNT_SHEET.statusClockMs,
      });
    } else if (!fgWanted && fgOn.current) {
      fgOn.current = false;
      setAoStatusFg(null);
    }
  }, [fgWanted]);
  useEffect(
    () => () => {
      // 사라질 때 (StrictMode 의 가짜 마운트 해제 뒤에는 위 효과가 다시 흰색으로 돌려놓음)
      if (fgOn.current) {
        fgOn.current = false;
        setAoStatusFg(null);
      }
    },
    [],
  );

  // 녹화 다시 시작 · 로그아웃: 바로 걷고 닫으라고 알림
  useEffect(
    () =>
      onAoNativeReset(() => {
        setKilled(true);
        cb.current.onClose?.();
      }),
    [],
  );

  if (phase === "closed") return null;
  const showClose = closeButton ?? title != null;
  return (
    <AoNativePortal>
      <div className={`ao-nsheet ao-nsheet--${level} ao-nsheet--${phase} ao-nsheet--in-${enter}${className ? ` ${className}` : ""}`}>
        <div className="ao-nsheet__dim" onClick={() => phase === "open" && onDimClick?.()} />
        <div
          className="ao-nsheet__card"
          role="dialog"
          aria-modal
          style={{
            height: 852 - top,
            borderRadius: `${radius}px ${radius}px 0 0`,
            ...(enter === "rise" && phase === "open" && { animationDelay: `${riseDelay}ms` }),
          }}
        >
          {title != null && <h2 className="ao-nsheet__title">{title}</h2>}
          {showClose && (
            <button type="button" className="ao-nsheet__close" aria-label="닫기" onClick={() => phase === "open" && onClose?.()}>
              {level === "amount" ? <AoCloseIcon size={16} stroke={1.9} cap="square" color="#656571" /> : <AoCloseIcon size={17.32} stroke={1.45} />}
            </button>
          )}
          {children}
        </div>
      </div>
    </AoNativePortal>
  );
}
