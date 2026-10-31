import { useEffect, useLayoutEffect, useRef } from "react";

// 스크롤할 때마다 onFrame(scrollTop)을 "프레임당 최대 1번" 불러준다. state를 쓰지 않는다.
//
// 왜 state가 아닌가: 스크롤은 초당 60번 이상 일어나는데, 매번 setState 하면 화면 전체가
// 초당 60번 다시 렌더링된다(측정해보니 PC에서도 프레임당 ~6ms, 폰이면 25ms+ → 끊김).
// 그래서 패럴랙스처럼 매 프레임 바뀌는 값은 ref로 DOM 스타일을 직접 바꾸고,
// "맨 위로 버튼 보일까?" 같은 on/off 값만 바뀌는 순간에 setState 한다.
//
// el은 ref 객체가 아니라 요소 자체: 스켈레톤 → 본문처럼 컨테이너가 나중에 생기면
// [ref] 의존성으론 effect가 다시 안 돌아 리스너가 영영 안 붙기 때문.
// 쓰는 쪽: const [el, setEl] = useState<HTMLDivElement | null>(null); <div ref={setEl}>
export function useScrollFrame(el: HTMLElement | null, onFrame: (top: number) => void) {
  const cb = useRef(onFrame);
  // 최신 콜백을 쓰되 리스너는 다시 달지 않도록. 렌더 중 ref를 바꾸면 안 되므로 effect에서 갱신
  useLayoutEffect(() => {
    cb.current = onFrame;
  });

  useEffect(() => {
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return; // 이미 이번 프레임에 예약됨
      frame = requestAnimationFrame(() => {
        frame = 0;
        cb.current(el.scrollTop);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    cb.current(el.scrollTop);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, [el]);
}
