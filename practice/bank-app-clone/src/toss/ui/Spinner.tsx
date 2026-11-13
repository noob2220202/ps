// 스피너 두 가지 (transfer §2.0 · home §2.8)
//  grey: 회색 #b5b6bb 머티리얼 원호 (늘었다 줄며 돎, ≈1초), ⌀30 · 선 2.5 — LOAD 빈 화면 · 목록 기다림
//  blue: 파란 #3182f6 90° 원호가 돎, ⌀20 · 선 2.5 — "잠시만 기다려주세요." 상자
import type { CSSProperties } from "react";

export function TossSpinner({ variant = "grey", size, stroke = 2.5, color, className, style }: { variant?: "grey" | "blue"; size?: number; stroke?: number; color?: string; className?: string; style?: CSSProperties }) {
  const d = size ?? (variant === "grey" ? 30 : 20);
  const r = (d - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      className={`toss-spin toss-spin--${variant}${className ? ` ${className}` : ""}`}
      style={{ ["--toss-spin-c" as string]: c.toFixed(2), ...style }}
      width={d}
      height={d}
      viewBox={`0 0 ${d} ${d}`}
      fill="none"
      aria-hidden
    >
      <circle
        cx={d / 2}
        cy={d / 2}
        r={r}
        stroke={color ?? (variant === "grey" ? "#b5b6bb" : "#3182f6")}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={variant === "blue" ? `${(c / 4).toFixed(2)} ${c.toFixed(2)}` : undefined}
      />
    </svg>
  );
}
