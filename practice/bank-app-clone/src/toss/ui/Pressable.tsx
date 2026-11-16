// 누를 수 있는 칸 (plan.md §3.3: home §3.2 · account §3.7 · transfer §2.1 · assets §3.3 · cert §2.0).
// 누르는 동안 둥근 바탕(highlight)이 inset 만큼 안쪽에 나타나고(fadeIn ms), 내용은 scale 로 살짝 작아짐. 떼면 fadeOut ms 동안 사라짐.
// 누른 채 8px 넘게 움직이면(스크롤) 누름이 취소되고 onPress 도 안 부름. onPress 는 손을 뗄 때 — 화면 이동은 useTossGo 가 120ms 뒤에
// 터치로 뗄 때 onPress 가 패널 · 시트 · 안내창을 바로 열면, 같은 터치가 뒤이어 만드는 click 이 새로 깔린 막에 떨어져 곧바로 닫힘
// (진짜 폰에서 🔔 가 안 열리던 까닭) → 그 click 이 이 칸 밖에 떨어지면 버림 (swallowGhostClick)
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { TOSS_NAV } from "../nav";

export interface TossPressableProps {
  onPress?: () => void;
  disabled?: boolean;
  inset?: number | string; // 바탕 안쪽 여백 (px 또는 "0 8px")
  radius?: number; // 바탕 모서리
  color?: string; // 바탕 색 (기본 흰색 .08)
  scale?: number; // 누르는 동안 내용 크기 (기본 1 = 그대로)
  fadeIn?: number; // ms
  fadeOut?: number; // ms (기본 170)
  className?: string;
  style?: CSSProperties;
  pressedClassName?: string; // 누르는 동안 붙는 클래스 (안의 작은 버튼 색 바꾸기 등)
  ariaLabel?: string;
  role?: string;
  children?: ReactNode;
}

const SLOP = 8;
const GHOST_MS = 700; // 터치를 뗀 뒤 브라우저가 click 을 만들기까지 넉넉히

// 이 터치가 만들 click 하나만: 다음 누름이 시작되거나 GHOST_MS 가 지나면 풀림. 이 칸 안에 떨어지면 그대로 둠 (마우스와 같게)
function swallowGhostClick(own: HTMLElement | null) {
  let timer = 0;
  const off = () => {
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("pointerdown", off, true);
    window.clearTimeout(timer);
  };
  const onClick = (e: MouseEvent) => {
    // 누름 없이 온 click (자판 Enter · Space, 보조 기기 · 코드의 click(): detail 0) 은 이 터치가 만든 것이 아님 → 그대로 두고 계속 기다림
    if (e.detail === 0) return;
    off();
    if (own?.isConnected && e.target instanceof Node && own.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("click", onClick, true);
  window.addEventListener("pointerdown", off, true);
  timer = window.setTimeout(off, GHOST_MS);
}
// 안쪽 칸(줄 안의 ★ 등)이 먼저 받은 누름은 바깥 칸이 무시 (전파는 막지 않음 — 당겨서 새로고침 등이 같은 이벤트를 봐야 함)
const claimed = new WeakSet<Event>();

export function TossPressable({
  onPress,
  disabled,
  inset = 0,
  radius = 0,
  color = "rgba(255,255,255,0.08)",
  scale = 1,
  fadeIn = 0,
  fadeOut = TOSS_NAV.pressOut,
  className,
  style,
  pressedClassName,
  ariaLabel,
  role = "button",
  children,
}: TossPressableProps) {
  const [pressed, setPressed] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const self = useRef<HTMLDivElement>(null);

  const cancel = () => {
    start.current = null;
    setPressed(false);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0) || claimed.has(e.nativeEvent)) return;
    claimed.add(e.nativeEvent);
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    setPressed(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    if (Math.abs(e.clientX - s.x) > SLOP || Math.abs(e.clientY - s.y) > SLOP) cancel();
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    cancel();
    if (e.pointerType !== "mouse") swallowGhostClick(self.current);
    onPress?.();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    onPress?.();
  };
  const insetCss = typeof inset === "number" ? `${inset}px` : inset;
  return (
    <div
      ref={self}
      className={`toss-press${pressed ? ` toss-press--on${pressedClassName ? ` ${pressedClassName}` : ""}` : ""}${disabled ? " toss-press--disabled" : ""}${className ? ` ${className}` : ""}`}
      style={
        {
          "--tp-inset": insetCss,
          "--tp-radius": `${radius}px`,
          "--tp-color": color,
          "--tp-scale": scale,
          "--tp-in": `${fadeIn}ms`,
          "--tp-out": `${fadeOut}ms`,
          ...style,
        } as CSSProperties
      }
      role={role}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="toss-press__bg" aria-hidden />
      <div className="toss-press__content">{children}</div>
    </div>
  );
}
