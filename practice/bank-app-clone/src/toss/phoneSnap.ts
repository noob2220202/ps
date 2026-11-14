// 데스크톱에서 가운데 맞춘 폰((창 폭 − 384) / 2)이 기기 화소 사이에 걸리면 글자가 통째로 1화소 밀려 그려짐
// (배율 1.25 에서 창 폭이 8 의 배수가 아니면 글자 −0.8dp · 그림 −0.3–0.5dp) → .phone 을 translate 로 기기 화소에 맞춤.
// 창 크기 · 배율(devicePixelRatio) · 캡쳐모드(zoom · 위 여백)가 바뀌면 다시. 토스 상태바(TossStatusBar)가 부름 — 다른 앱은 안 씀
// (아래 useTossPhoneFit · tossScaleOf 도 토스 전용)
import { useLayoutEffect, type RefObject } from "react";

export function useTossPhoneSnap(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const phone = ref.current?.closest<HTMLElement>(".phone");
    if (!phone) return;
    let raf = 0;
    const snap = () => {
      phone.style.translate = "";
      const r = phone.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      const z = Number(getComputedStyle(phone).zoom) || 1; // 캡쳐모드 --capture-fit: translate 는 줄인 배율만큼 작게 그려짐
      const x = r.left + window.scrollX;
      const y = r.top + window.scrollY;
      const dx = (Math.round(x * d) / d - x) / z;
      const dy = (Math.round(y * d) / d - y) / z;
      phone.style.translate = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001 ? `${dx.toFixed(3)}px ${dy.toFixed(3)}px` : "";
    };
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(snap);
    };
    snap();
    window.addEventListener("resize", later);
    const mo = new MutationObserver(later);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-capture", "style"] });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", later);
      mo.disconnect();
      phone.style.translate = "";
    };
  }, [ref]);
}

// 진짜 폰 화면(500px 이하): 384 폭 폰을 창 폭에 맞게 배율(zoom)로 키우거나 줄임 (toss.css, allone Overlay.tsx 와 같은 방법).
// 좌표가 전부 384dp 기준이라 360 폭 폰에서 오른쪽(🔔 등)이 잘리거나 412 폭 폰에서 오른쪽 아이콘이 안쪽에 몰리던 것.
// 기기 화면 크기(CSS px) = 시각 뷰포트 × 배율 — 폰이 창보다 넓게 그려진 순간 모바일 크롬이 레이아웃 뷰포트를 넓히고 화면을 줄여 보여 줘도 되돌림
export const TOSS_W = 384;
export function useTossPhoneFit() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    const vv = window.visualViewport;
    const fit = () => {
      const w = vv ? vv.width * vv.scale : window.innerWidth;
      const h = vv ? vv.height * vv.scale : window.innerHeight;
      const f = w / TOSS_W;
      root.setProperty("--toss-fit", String(f));
      root.setProperty("--toss-phone-h", `${h / f}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    vv?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      vv?.removeEventListener("resize", fit);
      root.removeProperty("--toss-fit");
      root.removeProperty("--toss-phone-h");
    };
  }, []);
}

// 화면 안 요소의 실제 그려진 배율 (폰 zoom 이 걸리면 1 이 아님): 손가락 좌표(clientX) · getBoundingClientRect 차이를 요소 안 px 로 바꿀 때 나눔
export function tossScaleOf(el: HTMLElement) {
  const w = el.offsetWidth;
  const r = el.getBoundingClientRect().width;
  return w > 0 && r > 0 ? r / w : 1;
}
