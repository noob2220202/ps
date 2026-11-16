// 시작 흐름의 시각 맞추기: 정해 둔 시각(performance.now 기준)이 된 첫 프레임에 바로 그림.
//  - 프레임 시각(rAF 의 now) = CSS 애니메이션이 쓰는 문서 시각이라 같은 시각표로 맞물림
//  - flushSync: 그 프레임 안에 그려지게 (rAF 안의 보통 setState 는 다음 프레임에 그려짐)
//  - pinStart: CSS 애니메이션의 시작 시각을 그린 때(base)로 박아 둠 (그린 뒤 1~2 프레임 지나 정해지는 것을 막음 — HomeIndicator 와 같은 방법)
import { flushSync } from "react-dom";

// 지금 바로 그림 (타이머 · 다른 모듈 알림 안에서 부른 setState 를 같은 프레임에)
export function flushNow(fn: () => void) {
  try {
    flushSync(fn);
  } catch {
    fn(); // 그리는 도중이면 그냥
  }
}

export function atFrame(t: number, fn: () => void): () => void {
  let dead = false;
  let raf = 0;
  const tick = (now: number) => {
    if (dead) return;
    if (now < t - 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    dead = true;
    flushNow(fn);
  };
  // 먼 시각은 타이머로 기다렸다가 마지막 몇 프레임만 rAF 로 (숨은 탭에서 rAF 가 멈춰도 타이머가 깨움)
  const wait = t - performance.now() - 80;
  const timer = window.setTimeout(() => !dead && (raf = requestAnimationFrame(tick)), Math.max(0, wait));
  return () => {
    dead = true;
    window.clearTimeout(timer);
    cancelAnimationFrame(raf);
  };
}

export function pinStart(el: Element | null, base: number) {
  el?.getAnimations().forEach((a) => a instanceof CSSAnimation && (a.startTime = base));
}

export const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, Math.max(0, ms)));
