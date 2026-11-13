// 홈 영역의 끝없이 도는 넘기기 (계좌 카드 · 광고 · 정기점검 쪽). 위치 pos 는 소수 (0 = 첫 장이 제자리, 1 = 다음 장),
// 화면은 k − pos 만큼 옮겨 그림 (k 는 정수 칸, 장 번호 = k mod n). 손으로 끌기 · 놓으면 맞춰 서기 · 버튼 ±1 · 자동 넘기기.
//  - 끌기: 가로로 6pt 넘게 먼저 움직이면 잡음 (세로면 페이지 스크롤에 맡김). 놓을 때 빠르게 튕겼거나 반 넘게 끌었으면 한 장, 아니면 제자리로
//  - 맞춰 서기 시간 · 곡선은 부르는 곳이 정함 (카드는 둘 다 305ms — Accounts.tsx)
//  - 끈 뒤의 클릭(카드 버튼)은 버림
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";

// cubic-bezier(x1, y1, x2, y2) → t(0–1) 를 진행도로 (CSS 와 같은 곡선)
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = ((3 * ax * t + 2 * bx) * t + cx) || 1e-6;
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) break;
      t -= e / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}
export const EASE_OUT = bezier(0, 0, 0.58, 1);
export const mod = (k: number, n: number) => ((k % n) + n) % n;

export interface LoopPagerOptions {
  count: number;
  pitch: number; // 한 장 간격 (pt)
  snapMs: number; // 놓은 뒤 다음 장으로
  backMs?: number; // 놓은 뒤 제자리로 (기본 snapMs)
  stepMs?: number; // 버튼 · 자동 넘기기
  ease?: (t: number) => number;
  onTarget?: (index: number) => void; // 맞춰 서기를 시작할 때 (쪽 표시는 이때 바뀜)
  onDragStart?: () => void;
  disabled?: boolean;
}

export function useLoopPager({ count, pitch, snapMs, backMs = snapMs, stepMs = snapMs, ease = EASE_OUT, onTarget, onDragStart, disabled }: LoopPagerOptions) {
  const [pos, setPos] = useState(0);
  const [index, setIndex] = useState(0); // 맞춰 서는 곳 (쪽 표시)
  const posRef = useRef(0);
  const target = useRef(0);

  const raf = useRef(0);
  const cb = useRef({ onTarget, onDragStart });
  useEffect(() => {
    cb.current = { onTarget, onDragStart };
  });

  const put = (p: number) => {
    posRef.current = p;
    setPos(p);
  };
  const stop = () => cancelAnimationFrame(raf.current);
  useEffect(() => stop, []);

  const animate = useCallback(
    (to: number, ms: number) => {
      stop();
      const from = posRef.current;
      target.current = to;
      setIndex(mod(to, Math.max(1, count)));
      cb.current.onTarget?.(mod(to, Math.max(1, count)));
      if (ms <= 0 || from === to) return put(to);
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        put(from + (to - from) * ease(k));
        if (k < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    },
    [count, ease],
  );

  // 버튼 · 자동: 지금 가는 곳에서 ±1
  const step = useCallback((delta: number) => animate(Math.round(target.current) + delta, stepMs), [animate, stepMs]);
  // 바로 그 장으로 (움직임 없이)
  const reset = useCallback(
    (at = 0) => {
      stop();
      target.current = at;
      setIndex(mod(at, Math.max(1, count)));
      put(at);
    },
    [count],
  );

  // ---- 끌기 ----
  const drag = useRef<{ id: number; x0: number; y0: number; p0: number; mode: "?" | "h" | "v"; samples: [number, number][] } | null>(null);
  const dragged = useRef(false);
  const onPointerDown = (e: RPointerEvent<HTMLElement>) => {
    if (disabled || count < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: posRef.current, mode: "?", samples: [[performance.now(), e.clientX]] };
    dragged.current = false;
  };
  const scale = (e: RPointerEvent<HTMLElement>) => {
    // 화면 폭이 393 이 아닐 때 (진짜 폰 · 줄인 틀) 손가락 거리 → pt
    const box = e.currentTarget.closest(".phone") as HTMLElement | null;
    return box ? box.getBoundingClientRect().width / 393 : 1;
  };
  const onPointerMove = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const s = scale(e);
    const dx = (e.clientX - d.x0) / s;
    const dy = (e.clientY - d.y0) / s;
    if (d.mode === "?") {
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        d.mode = "h";
        dragged.current = true;
        stop();
        d.p0 = posRef.current;
        d.x0 = e.clientX;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* 이미 놓음 */
        }
        cb.current.onDragStart?.();
      } else if (Math.abs(dy) > 6) d.mode = "v";
      return;
    }
    if (d.mode !== "h") return;
    put(d.p0 - (e.clientX - d.x0) / s / pitch);
    d.samples.push([performance.now(), e.clientX]);
    if (d.samples.length > 6) d.samples.shift();
  };
  const onPointerUp = (e: RPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.mode !== "h") return;
    const s = scale(e);
    const [t1, x1] = d.samples[0];
    const v = (e.clientX - x1) / s / Math.max(1, performance.now() - t1); // pt/ms, + = 오른쪽으로 끔 (이전 장)
    const moved = posRef.current - d.p0;
    const base = Math.round(d.p0);
    let to = base;
    if (Math.abs(v) > 0.3) to = base + (v < 0 ? 1 : -1);
    else if (Math.abs(moved) > 0.5) to = base + Math.sign(moved);
    animate(to, to === base ? backMs : snapMs);
  };
  const onClickCapture = (e: { preventDefault(): void; stopPropagation(): void }) => {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    }
  };

  return {
    pos,
    index,
    step,
    reset,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture },
  };
}

// 지금 그릴 칸들: pos 둘레 from..to (장 번호 = k mod n)
export function visibleSlots(pos: number, count: number, before = 1, after = 1) {
  if (count < 2) return [0];
  const base = Math.floor(pos);
  const out: number[] = [];
  for (let k = base - before; k <= base + 1 + after; k++) out.push(k);
  return out;
}
