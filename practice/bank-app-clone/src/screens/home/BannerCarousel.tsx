import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Banner } from "../../api/types";
import { Asset } from "../../assets/Asset";
import { useLayerActive } from "../../platform/LayerContext";

const INTERVAL = 3500;
const SLIDE_MS = 450;

// 무한 루프 캐러셀: [마지막 복제, 1, 2, 3, 첫 번째 복제] 로 깔아 두고,
// 복제본에 도착하면 애니메이션 없이 진짜 위치로 순간이동 → 끝에서 처음으로 넘어갈 때도 끊김이 없다.
export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const n = banners.length;
  const slides = [banners[n - 1], ...banners, banners[0]];
  const [index, setIndex] = useState(1); // 1 = 첫 번째 진짜 슬라이드
  const [animate, setAnimate] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; dx: number; width: number } | null>(null);
  const active = useLayerActive();

  // 자동 넘김: 화면이 맨 위(active)일 때만. index가 바뀔 때마다 타이머를 새로 걸어서
  // 손으로 넘긴 직후 바로 또 넘어가는 일이 없게 한다.
  useEffect(() => {
    if (!active || n < 2) return;
    const id = setTimeout(() => {
      setAnimate(true);
      setIndex((i) => i + 1);
    }, INTERVAL);
    return () => clearTimeout(id);
  }, [index, active, n]);

  // 복제 슬라이드에 도착 → 애니메이션 끝나면 진짜 슬라이드로 순간이동
  const onTransitionEnd = () => {
    if (index === n + 1) jump(1);
    else if (index === 0) jump(n);
  };
  const jump = (i: number) => {
    setAnimate(false);
    setIndex(i);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, dx: 0, width: e.currentTarget.clientWidth };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !trackRef.current) return;
    d.dx = e.clientX - d.x;
    // 드래그 중엔 리렌더 없이 DOM만 직접 움직인다 (성능)
    trackRef.current.style.transition = "none";
    trackRef.current.style.transform = `translate3d(calc(${-index * 100}% + ${d.dx}px),0,0)`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !trackRef.current) return;
    trackRef.current.style.cssText = "";
    setAnimate(true);
    if (Math.abs(d.dx) > d.width * 0.2) setIndex((i) => i + (d.dx < 0 ? 1 : -1));
  };

  const real = ((index - 1 + n) % n) + 0; // 점 표시용 진짜 번호

  return (
    <div className="carousel">
      <div className="carousel__dots">
        {banners.map((b, i) => (
          <span key={b.id} className={`carousel__dot ${i === real ? "carousel__dot--on" : ""}`} />
        ))}
      </div>
      <div
        className="carousel__viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={trackRef}
          className="carousel__track"
          style={{
            transform: `translate3d(${-index * 100}%,0,0)`,
            transition: animate ? `transform ${SLIDE_MS}ms cubic-bezier(.3,.7,.2,1)` : "none",
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {slides.map((b, i) => (
            <div key={`${b.id}-${i}`} className="banner">
              <div className="banner__text">
                <strong className="banner__title">{b.title}</strong>
                <button className={`banner__cta ${b.ad ? "banner__cta--ad" : ""}`}>{b.cta}</button>
              </div>
              <Asset slot={b.image} className="banner__image" />
              {b.ad && <span className="banner__ad">AD</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
