// 데스크톱에서 가운데 맞춘 폰((창 폭 − 384) / 2)이 기기 화소 사이에 걸리면 글자가 통째로 1화소 밀려 그려짐
// (배율 1.25 에서 창 폭이 8 의 배수가 아니면 글자 −0.8dp · 그림 −0.3–0.5dp) → .phone 을 translate 로 기기 화소에 맞춤.
// 창 크기 · 배율(devicePixelRatio) · 캡쳐모드(zoom · 위 여백)가 바뀌면 다시. 토스 상태바(TossStatusBar)가 부름 — 다른 앱은 안 씀
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
