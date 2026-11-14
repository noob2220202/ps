// 큰 버튼 (CTA). plan.md §3.3: transfer §2.0 · cert §2.0 · account §2.5
//  56dp, 모서리 16, x 20–364 (BottomDock 안), 글자 17 SB
//  primary #3182f6 / weak #1f2942 + #5399f8 / grey #292a2f / secondary #18294a + #4690f6 / disabled #1e355b + #4d5e7c (180ms 교차)
//  누름: 버튼 전체가 50ms 에 #2b72de + scale .965 (80ms), 떼면 150ms 에 돌아옴
//  loading: 글자가 100ms 에 사라지고 점 3개 (⌀6.4, 간격 15, 750ms 주기, 200ms 차이, 투명도 .3→1 · 크기 .75→1)
//  BarCTA: 화면 폭 꽉 찬 막대 (금액 화면 '다음', 0–384 · 56, 모서리 0, 글자 17 M)
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { tossScaleOf } from "../phoneSnap";

export type TossButtonVariant = "primary" | "weak" | "grey" | "secondary";

export interface TossButtonProps {
  variant?: TossButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  bar?: boolean; // BarCTA 모양
  onPress?: () => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  children?: ReactNode;
}

export function TossButton({ variant = "primary", disabled, loading, bar, onPress, className, style, ariaLabel, children }: TossButtonProps) {
  const [ripple, setRipple] = useState<{ x: number; y: number; r: number; on: boolean; n: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || loading || !ref.current) return;
    const b = ref.current.getBoundingClientRect();
    const k = tossScaleOf(ref.current); // 폰 zoom (진짜 폰 화면) → 버튼 안 px 로
    const x = (e.clientX - b.left) / k;
    const y = (e.clientY - b.top) / k;
    const r = Math.hypot(Math.max(x, b.width / k - x), Math.max(y, b.height / k - y));
    setRipple((p) => ({ x, y, r, on: true, n: (p?.n ?? 0) + 1 }));
  };
  const up = () => setRipple((p) => (p ? { ...p, on: false } : p));
  return (
    <button
      ref={ref}
      type="button"
      className={`toss-btn toss-btn--${variant}${bar ? " toss-btn--bar" : ""}${disabled ? " toss-btn--disabled" : ""}${loading ? " toss-btn--loading" : ""}${ripple?.on ? " toss-btn--pressed" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onClick={() => !disabled && !loading && onPress?.()}
    >
      {ripple && (
        <span
          key={ripple.n}
          className={`toss-btn__ripple${ripple.on ? " on" : ""}`}
          style={{ left: ripple.x - ripple.r, top: ripple.y - ripple.r, width: ripple.r * 2, height: ripple.r * 2 }}
          aria-hidden
        />
      )}
      <span className="toss-btn__label">{children}</span>
      <span className="toss-btn__dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}

// 화면 아래 고정 자리 (y 762–818, 버튼 아래 20.3). fade: 위로 40dp 그라데이션 (목록이 밑으로 흐려짐)
export function TossBottomDock({ children, fade, bg, className, style }: { children: ReactNode; fade?: boolean; bg?: string; className?: string; style?: CSSProperties }) {
  return (
    <div className={`toss-dock${fade ? " toss-dock--fade" : ""}${className ? ` ${className}` : ""}`} style={{ ["--toss-dock-bg" as string]: bg ?? "var(--toss-bg)", ...style }}>
      {children}
    </div>
  );
}
// 본문 아래에 비워 둘 높이 (BottomDock 에 가려지지 않게)
export const TOSS_DOCK_SPACE = 96;

// 두 버튼 (공유하기 + 확인 등): 같은 폭, 사이 8
export function TossButtonPair({ children }: { children: ReactNode }) {
  return <div className="toss-btn-pair">{children}</div>;
}
