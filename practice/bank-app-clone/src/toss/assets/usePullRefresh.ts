// 자산 화면 당겨서 새로고침 (assets.md §2.2.6, 녹화 B 157.30–159.3초). 맨 위에서만:
//  당기는 동안 카드들이 손가락을 따라 내려감 (처음엔 1:1, 뒤로 갈수록 덜, 최대 +134) · 탭 밑 빈자리(가운데 y 227)에 가는 고리(⌀20 → 37)
//  · 머리줄(← · 자산 불러오기)은 50% 로 흐려짐
//  놓으면(64 이상) 카드는 +80 에 멈추고 고리가 동그라미 ↔ 아래로 뾰족한 물방울로 바뀌기를 되풀이 (470ms) · 다시 받기 (최소 600ms)
//  끝: 고리가 ⌀43 으로 커지며 14 위로 · 흐려지고(150ms) 카드는 살짝 넘치며 0 으로(350ms), 머리줄 돌아옴, 화면이 아주 옅게 밝아졌다 사라짐
import { useEffect, useRef, useState, type RefObject } from "react";

const PTR = { threshold: 64, hold: 80, max: 134, minMs: 600, finish: 400 } as const;

// 손가락 거리 → 내려가는 거리 (처음 80 은 1:1, 그 뒤 0.45 배, 최대 134)
const damp = (dy: number) => Math.min(PTR.max, dy <= 80 ? dy : 80 + (dy - 80) * 0.45);

export type PullPhase = "idle" | "pull" | "refresh" | "finish";
type Phase = PullPhase;

export function usePullRefresh({ bodyRef, enabled, onRefresh }: { bodyRef: RefObject<HTMLDivElement | null>; enabled: boolean; onRefresh: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const blobRef = useRef<HTMLSpanElement | null>(null);
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  });

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !enabled) return;
    const set = (p: Phase) => {
      phaseRef.current = p;
      setPhase(p);
    };
    const paint = (pull: number, transition = "none") => {
      const w = wrapRef.current;
      if (w) {
        w.style.transition = transition;
        w.style.transform = pull ? `translate3d(0, ${pull}px, 0)` : "";
      }
      const b = blobRef.current;
      if (b && phaseRef.current === "pull") {
        const k = Math.max(0, Math.min(1, (pull - 12) / 58));
        b.style.setProperty("--ptr-d", `${20 + 17 * k}px`);
        b.style.opacity = String(Math.max(0, Math.min(1, (pull - 6) / 24)));
      }
    };
    let drag: { y0: number; pull: number; touch: boolean } | null = null;
    const timers: number[] = [];

    const start = (y: number, touch: boolean) => {
      if (phaseRef.current !== "idle" || body.scrollTop > 0) return;
      drag = { y0: y, pull: 0, touch };
    };
    const move = (y: number) => {
      if (!drag) return false;
      const dy = y - drag.y0;
      if (dy <= 0 && !drag.pull) {
        drag = null; // 위로 밀면 보통 스크롤
        return false;
      }
      if (phaseRef.current !== "pull") set("pull");
      drag.pull = damp(Math.max(0, dy));
      paint(drag.pull);
      return true;
    };
    const end = () => {
      if (!drag) return;
      const pulled = drag.pull;
      drag = null;
      if (pulled < PTR.threshold) {
        paint(0, "transform 250ms cubic-bezier(0.2, 0, 0, 1)");
        if (blobRef.current) blobRef.current.style.opacity = "0";
        timers.push(window.setTimeout(() => phaseRef.current === "pull" && set("idle"), 250));
        return;
      }
      set("refresh");
      const b = blobRef.current;
      if (b) {
        b.style.setProperty("--ptr-d", "37px");
        b.style.opacity = "1";
      }
      paint(PTR.hold, "transform 230ms cubic-bezier(0.2, 0.9, 0.3, 1.05)");
      refreshRef.current();
      timers.push(
        window.setTimeout(() => {
          set("finish");
          paint(0, "transform 350ms cubic-bezier(0.3, 1.25, 0.5, 1)");
          timers.push(
            window.setTimeout(() => {
              if (blobRef.current) blobRef.current.style.opacity = "0";
              set("idle");
            }, PTR.finish),
          );
        }, PTR.minMs),
      );
    };

    // 마우스 (개발 PC): 누른 채 끌기
    const onDown = (e: PointerEvent) => e.pointerType === "mouse" && e.button === 0 && start(e.clientY, false);
    const onMove = (e: PointerEvent) => {
      if (drag && !drag.touch && e.buttons & 1) move(e.clientY);
    };
    const onUp = (e: PointerEvent) => e.pointerType === "mouse" && drag && !drag.touch && end();
    // 손가락: 맨 위에서 아래로 끌면 기본 스크롤(넘침 효과)을 막고 당김
    const onTStart = (e: TouchEvent) => e.touches.length === 1 && start(e.touches[0].clientY, true);
    const onTMove = (e: TouchEvent) => {
      if (drag?.touch && move(e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };
    const onTEnd = () => drag?.touch && end();

    body.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    body.addEventListener("touchstart", onTStart, { passive: true });
    body.addEventListener("touchmove", onTMove, { passive: false });
    body.addEventListener("touchend", onTEnd);
    body.addEventListener("touchcancel", onTEnd);
    return () => {
      body.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      body.removeEventListener("touchstart", onTStart);
      body.removeEventListener("touchmove", onTMove);
      body.removeEventListener("touchend", onTEnd);
      body.removeEventListener("touchcancel", onTEnd);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [bodyRef, enabled]);

  return { wrapRef, blobRef, phase, dim: phase === "pull" || phase === "refresh" };
}
