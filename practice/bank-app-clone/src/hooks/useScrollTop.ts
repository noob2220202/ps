import { useEffect, useState } from "react";

// 스크롤 컨테이너의 scrollTop을 state로. rAF로 묶어서 스크롤 이벤트마다 리렌더 폭주를 막는다.
// ref 객체 대신 "요소"를 받는다: 스켈레톤 → 본문처럼 컨테이너가 나중에 생기는 경우
// useRef + [ref] 의존성으론 effect가 다시 안 돌아서 리스너가 영영 안 붙는다.
// 쓰는 쪽: const [el, setEl] = useState<HTMLDivElement | null>(null); <div ref={setEl}>
export function useScrollTop(el: HTMLElement | null) {
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTop(el.scrollTop));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, [el]);

  return top;
}
