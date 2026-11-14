// 자산 화면 당겨서 새로고침 (assets.md §2.2.6, 녹화 B 157.30–159.3초 프레임에서 잰 값). 맨 위에서만:
//  당기는 동안 카드들이 손가락을 따라 내려감 (처음 80 은 1:1, 그 뒤 덜, 최대 +134) · 탭과 첫 카드 사이 빈자리 가운데에 가는 고리
//  (당긴 만큼 같이 내려오다 +80 에서 멈춤 — 가운데 y 187.2 + 당김/2, 지름 15 → 37 은 당김 35 → 79) · 머리줄(← · 자산 불러오기)은 당긴 만큼 50% 까지 흐려짐
//  64 이상 당기면 고리가 동그라미 ↔ 아래로 뾰족한 물방울 (470ms, 놓기 전부터). 놓으면 카드는 400ms 에 걸쳐 +80 으로 (넘치지 않고 감속) · 다시 받기 (최소 520ms, 응답 올 때까지)
//  끝: 고리가 ⌀43 으로 커지며 16 위로 · 흐려짐(200ms) · 카드는 500ms 감속으로 0 (넘치지 않음) · 고리 자리에서 옅은 빛 고리가 화면 끝까지 퍼짐
//  · 머리줄은 200ms 뒤 230ms 에 걸쳐 돌아옴
import { useEffect, useRef, useState, type RefObject } from "react";

const PTR = { threshold: 64, hold: 80, max: 134, minMs: 520, maxMs: 3000, finish: 850 } as const;
const EASE_HOLD = "transform 400ms cubic-bezier(0.1, 0.65, 0.4, 1)"; // 놓은 뒤 +80 으로 (B 157.72–158.11)
const EASE_BACK = "transform 500ms cubic-bezier(0.3, 0.45, 0, 1)"; // 끝나고 0 으로 (B 158.24–158.84)
const EASE_CANCEL = "transform 250ms cubic-bezier(0.2, 0, 0, 1)";

// 손가락 거리 → 내려가는 거리 (처음 80 은 1:1, 그 뒤 0.45 배, 최대 134)
const damp = (dy: number) => Math.min(PTR.max, dy <= 80 ? dy : 80 + (dy - 80) * 0.45);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export type PullPhase = "idle" | "pull" | "refresh" | "finish";
type Phase = PullPhase;

export function usePullRefresh({ bodyRef, enabled, onRefresh }: { bodyRef: RefObject<HTMLDivElement | null>; enabled: boolean; onRefresh: () => Promise<unknown> }) {
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
    const root = body.closest<HTMLElement>(".toss-page");
    const set = (p: Phase) => {
      phaseRef.current = p;
      setPhase(p);
    };
    // 머리줄 흐림: 당긴 만큼 (B 157.34–157.49: 255 → 130 휘도, 당김 ≈ 80 에서 50%)
    const headDim = (v: number | null) => {
      if (!root) return;
      if (v === null) root.style.removeProperty("--toss-assets-hdim");
      else root.style.setProperty("--toss-assets-hdim", String(v));
    };
    const paint = (pull: number, transition = "none") => {
      const w = wrapRef.current;
      if (w) {
        w.style.transition = transition;
        w.style.transform = pull ? `translate3d(0, ${pull}px, 0)` : "";
      }
      const b = blobRef.current;
      if (b && phaseRef.current === "pull") {
        b.style.setProperty("--ptr-d", `${Math.min(37, Math.max(12, 15 + (pull - 35) * 0.5))}px`);
        b.style.setProperty("--ptr-y", `${-(PTR.hold - Math.min(pull, PTR.hold)) / 2}px`);
        b.style.opacity = String(clamp01((pull - 24) / 14));
        b.classList.toggle("toss-assets-ptr--armed", pull >= PTR.threshold);
      }
    };
    let drag: { y0: number; pull: number; touch: boolean } | null = null;
    const timers: number[] = [];
    let alive = true;

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
      if (phaseRef.current !== "pull") {
        root?.classList.add("toss-assets-ptr-drag");
        set("pull");
      }
      drag.pull = damp(Math.max(0, dy));
      paint(drag.pull);
      headDim(1 - 0.49 * clamp01((drag.pull - 8) / 72));
      return true;
    };
    const end = () => {
      if (!drag) return;
      const pulled = drag.pull;
      drag = null;
      root?.classList.remove("toss-assets-ptr-drag");
      if (pulled < PTR.threshold) {
        paint(0, EASE_CANCEL);
        headDim(null);
        if (blobRef.current) {
          blobRef.current.style.opacity = "0";
          blobRef.current.classList.remove("toss-assets-ptr--armed");
        }
        timers.push(window.setTimeout(() => phaseRef.current === "pull" && set("idle"), 250));
        return;
      }
      set("refresh");
      headDim(0.51);
      const b = blobRef.current;
      if (b) {
        b.style.setProperty("--ptr-d", "37px");
        b.style.setProperty("--ptr-y", "0px");
        b.style.opacity = "1";
      }
      paint(PTR.hold, EASE_HOLD);
      // 최소 520ms (녹화: 놓고 520ms 뒤 끝남) + 응답이 올 때까지 (최대 3초)
      const t0 = performance.now();
      const finish = () => {
        if (!alive || phaseRef.current !== "refresh") return;
        set("finish");
        headDim(null);
        paint(0, EASE_BACK);
        timers.push(
          window.setTimeout(() => {
            if (blobRef.current) blobRef.current.style.opacity = "0";
            set("idle");
          }, PTR.finish),
        );
      };
      const max = window.setTimeout(finish, PTR.maxMs);
      timers.push(max);
      Promise.resolve(refreshRef.current())
        .catch(() => {})
        .then(() => {
          window.clearTimeout(max);
          timers.push(window.setTimeout(finish, Math.max(0, PTR.minMs - (performance.now() - t0))));
        });
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
      alive = false;
      body.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      body.removeEventListener("touchstart", onTStart);
      body.removeEventListener("touchmove", onTMove);
      body.removeEventListener("touchend", onTEnd);
      body.removeEventListener("touchcancel", onTEnd);
      timers.forEach((t) => window.clearTimeout(t));
      headDim(null);
      root?.classList.remove("toss-assets-ptr-drag");
    };
  }, [bodyRef, enabled]);

  return { wrapRef, blobRef, phase };
}
