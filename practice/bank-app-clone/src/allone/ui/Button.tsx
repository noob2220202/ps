// AoButton (plan.md §3.3, account §2.2, transfer §2.0). 녹화에서 잰 버튼들:
//  primary      초록 #0c8f2d · 흰 글자. 누름 pressed: "dark" #004511 (거래내역 상세 확인, C2 19.208) · "light" #12a434 (웹 잔액채우기 · T1 · T5 · 보내기, C3 12.029)
//               · "native" #003e0e (T2 다음 · T7 확인, C3 30.896 · 11.15)
//  outline      흰 바탕 · 1pt #dcdcdc 테 · 검정 글자 (계좌관리 · 다시보내기 · 농협 계좌등록). 누름 #f5f5f5 (invented)
//  outlineGreen 흰 바탕 · 1pt #0c8f2d 테 · 초록 글자 (거래내역조회 이체). 누름 바탕 #eafeee (C2 20.024)
//  disabled     바탕 #f5f5f5, 글자색은 disabledColor (기본 흰색 — T2 다음 · T5 잔액채우기. T1 다음은 #808080)
// 크기는 화면마다 달라서 props 로 (기본: 높이 56, 둥글기 12, 글자 18 / 600). 누름 모양은 손가락이 닿아 있는 동안 (active 로 강제할 수 있음)
// onPress 는 손을 뗄 때 (click). 비활성이면 누름도 onPress 도 없음
import { useState, type CSSProperties, type ReactNode } from "react";

export type AoButtonVariant = "primary" | "outline" | "outlineGreen";
export type AoButtonPressed = "dark" | "light" | "native";

export interface AoButtonProps {
  variant?: AoButtonVariant;
  disabled?: boolean;
  pressed?: AoButtonPressed; // primary 의 누름 색 (기본 "light")
  active?: boolean; // 누른 모양으로 강제 (영역이 녹화처럼 누른 색을 몇 프레임 더 보여 줄 때)
  radius?: number; // 기본 12
  height?: number; // 기본 56
  size?: number; // 글자 크기 (기본 18)
  weight?: number; // 글자 굵기 (기본 primary 600, outline 500)
  letterSpacing?: number; // 기본 0
  width?: number | string; // 기본 100%
  disabledColor?: string; // 비활성 글자색 (기본 #fff)
  onPress?: () => void;
  type?: "button" | "submit";
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  children?: ReactNode;
}

export function AoButton({
  variant = "primary",
  disabled = false,
  pressed = "light",
  active,
  radius = 12,
  height = 56,
  size = 18,
  weight,
  letterSpacing = 0,
  width = "100%",
  disabledColor = "#ffffff",
  onPress,
  type = "button",
  className,
  style,
  children,
  ...rest
}: AoButtonProps) {
  const [down, setDown] = useState(false);
  const isDown = !disabled && (active ?? down);
  const cls =
    `ao-btn ao-btn--${variant}` +
    (variant === "primary" ? ` ao-btn--press-${pressed}` : "") +
    (isDown ? " ao-btn--down" : "") +
    (disabled ? " ao-btn--disabled" : "") +
    (className ? ` ${className}` : "");
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled}
      aria-label={rest["aria-label"]}
      style={{
        width,
        height,
        borderRadius: radius,
        fontSize: size,
        fontWeight: weight ?? (variant === "primary" ? 600 : 500),
        letterSpacing,
        ...(disabled && { color: disabledColor }),
        ...style,
      }}
      onPointerDown={(e) => {
        if (!disabled && e.button === 0) setDown(true);
      }}
      onPointerUp={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onClick={() => !disabled && onPress?.()}
    >
      {children}
    </button>
  );
}
