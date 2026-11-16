import { useEffect, useRef, useState, type PointerEvent } from "react";
import { BANNERS, BANNER_START, K2_HOME } from "./content";
import "./K2Banner.css";

// kakao2 홈 배너 (home.md §4.4): 점 3개는 제자리, 글 · 그림만 한 장씩 왼쪽으로 285ms 밀림. 켤 때 점 3 에서 시작.
// 자동 넘김은 홈이 맨 위일 때만 (이체 모달에 덮인 동안 멈춤, 스크롤 중엔 그대로) — 켤 때는 켜진 때부터 5391ms, 그 뒤로 5150ms 마다.
// 무한 루프: [마지막 복제, 1, 2, 3, 첫 복제] 로 깔고 복제에 닿으면 애니메이션 없이 진짜 자리로 (카카오뱅크 BannerCarousel 과 같은 방법)
let shown = BANNER_START; // 홈이 다시 그려져도(통장에서 뒤로) 보던 배너 그대로

export function K2Banner({ visit, held, active }: { visit: { id: number; launch: boolean; bannerAt: number } | null; held: boolean; active: boolean }) {
  const n = BANNERS.length;
  const slides = [BANNERS[n - 1], ...BANNERS, BANNERS[0]];
  const [index, setIndex] = useState(shown + 1);
  const [animate, setAnimate] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; dx: number; width: number } | null>(null);
  const advanced = useRef(false);
  const lastAt = useRef(0); // 마지막으로 넘어간 때 (복제 → 진짜 자리 순간이동은 타이머를 다시 세지 않게)

  // 켜질 때(그리고 인트로가 켜짐을 잡아 둔 동안)는 점 3 에서 (렌더 중에 바로). 방문마다 첫 넘김은 visit.bannerAt 에
  const restart = held ? "held" : visit?.launch ? `launch-${visit.id}` : null;
  const [restarted, setRestarted] = useState(held ? null : restart); // 새로 그려질 때(통장에서 뒤로)는 보던 배너 그대로
  if (restart !== restarted) {
    setRestarted(restart);
    if (restart) {
      setAnimate(false);
      setIndex(BANNER_START + 1);
    }
  }
  useEffect(() => {
    advanced.current = false;
  }, [visit?.id]);

  useEffect(() => {
    shown = (index - 1 + n) % n;
  }, [index, n]);

  useEffect(() => {
    if (!active || !visit) return;
    const wait = Math.max(0, (advanced.current ? lastAt.current + K2_HOME.bannerInterval : visit.bannerAt) - performance.now());
    const id = setTimeout(() => {
      advanced.current = true;
      lastAt.current = performance.now();
      setAnimate(true);
      setIndex((i) => i + 1);
    }, wait);
    return () => clearTimeout(id);
  }, [index, active, visit]);

  const jump = (i: number) => {
    setAnimate(false);
    setIndex(i);
  };
  const onTransitionEnd = () => {
    if (index === n + 1) jump(1);
    else if (index === 0) jump(n);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, dx: 0, width: e.currentTarget.clientWidth };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !trackRef.current) return;
    d.dx = e.clientX - d.x;
    trackRef.current.style.transition = "none";
    trackRef.current.style.transform = `translate3d(calc(${-index * 100}% + ${d.dx}px),0,0)`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !trackRef.current) return;
    // 끌던 자리를 지금 배너 자리로 (애니메이션으로). cssText 를 비우면 React 가 넣은 transform 까지 지워져, 배너가 그대로면(그냥 누름 ·
    // 조금 끌기) React 가 다시 넣지 않아 맨 앞 복제(마지막 배너)가 보였음
    Object.assign(trackRef.current.style, { transform: `translate3d(${-index * 100}%,0,0)`, transition: `transform ${K2_HOME.bannerSlide}ms cubic-bezier(.45,0,.25,1)` });
    advanced.current = true;
    lastAt.current = performance.now();
    setAnimate(true);
    if (Math.abs(d.dx) > d.width * 0.2) setIndex((i) => i + (d.dx < 0 ? 1 : -1));
  };

  const real = (index - 1 + n) % n;
  return (
    <div className="k2-banner">
      <div className="k2-banner__dots">
        {BANNERS.map((b, i) => (
          <span key={b.id} className={`k2-banner__dot${i === real ? " k2-banner__dot--on" : ""}`} />
        ))}
      </div>
      <div className="k2-banner__viewport" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div
          ref={trackRef}
          className="k2-banner__track"
          style={{
            transform: `translate3d(${-index * 100}%,0,0)`,
            transition: animate ? `transform ${K2_HOME.bannerSlide}ms cubic-bezier(.45,0,.25,1)` : "none",
          }}
          onTransitionEnd={(e) => e.target === e.currentTarget && onTransitionEnd()}
        >
          {slides.map((b, i) => (
            <div key={`${b.id}-${i}`} className="k2-banner__slide">
              <strong className="k2-banner__title">
                {b.title[0]}
                <br />
                {b.title[1]}
              </strong>
              <span className="k2-banner__cta">{b.cta}</span>
              {b.legal && (
                <span className="k2-banner__legal">
                  {b.legal[0]}
                  <br />
                  {b.legal[1]}
                </span>
              )}
              {b.image && <img className={`k2-banner__image k2-banner__image--${b.imageClass}`} src={b.image} alt="" draggable={false} />}
              {b.ad && <span className="k2-banner__ad">AD</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
