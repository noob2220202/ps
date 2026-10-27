import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useLocation, useNavigate, useNavigationType, type Location } from "react-router-dom";
import { TIMING } from "../config/timing";
import { OS } from "../platform/platform";
import { LayerContext } from "../platform/LayerContext";
import "./ScreenStack.css";

type Anim = "push" | "pop";

interface Drag {
  dx: number;
  width: number;
  releasing: "out" | "back" | null; // 손 뗀 뒤 마무리 애니메이션 방향
}

const EDGE = 24; // 왼쪽 가장자리 몇 px 안에서 시작해야 스와이프로 인정할지

// <Routes>는 "현재 주소" 하나만 그린다. 전환 애니메이션을 하려면 나가는 화면도 잠깐 살아 있어야 해서
// 방문 기록(entries)을 직접 들고, 각 화면을 <Routes location={그 화면의 주소}>로 따로 그린다.
// 화면을 감싼 div의 key를 location.key로 두면, 같은 화면은 위치가 바뀌어도 언마운트되지 않는다.
export function ScreenStack({ render }: { render: (loc: Location) => ReactNode }) {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<Location[]>([location]);
  const [exiting, setExiting] = useState<{ loc: Location; anim: Anim } | null>(null);
  const [enterAnim, setEnterAnim] = useState<Anim | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const skipAnim = useRef(false);
  const pointer = useRef<{ x: number; id: number } | null>(null);

  const top = entries[entries.length - 1];
  const below = entries.length > 1 ? entries[entries.length - 2] : null;

  // useLayoutEffect: 화면이 그려지기 "전에" 레이어를 바꿔야 한 프레임 깜빡임이 없다
  useLayoutEffect(() => {
    if (location.key === top.key) return;
    const prevTop = top;

    let anim: Anim | null = navType === "POP" ? "pop" : navType === "PUSH" ? "push" : null;
    if (navType === "POP") {
      setEntries((es) => {
        const i = es.findIndex((e) => e.key === location.key);
        return i >= 0 ? es.slice(0, i + 1) : [location];
      });
    } else if (navType === "PUSH") {
      setEntries((es) => [...es, location]);
    } else {
      setEntries((es) => [...es.slice(0, -1), location]);
    }

    // 스와이프로 이미 화면을 밀어냈으면 pop 애니메이션을 또 하지 않는다.
    // 안드로이드(영상)는 뒤로가기가 즉시 바뀌므로 pop 애니메이션 없음.
    if (skipAnim.current || (OS === "android" && anim === "pop")) anim = null;
    skipAnim.current = false;
    setDrag(null);
    setEnterAnim(anim);
    setExiting(anim ? { loc: prevTop, anim } : null);
    if (!anim) return;

    const id = setTimeout(() => {
      setExiting(null);
      setEnterAnim(null);
    }, TIMING.nav[OS]);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // ---------- iOS: 왼쪽 가장자리 스와이프로 뒤로가기 ----------
  const canSwipe = OS === "ios" && below !== null && exiting === null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canSwipe || drag?.releasing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left > EDGE) return;
    pointer.current = { x: e.clientX, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ dx: 0, width: rect.width, releasing: null });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointer.current || pointer.current.id !== e.pointerId) return;
    const dx = Math.max(0, e.clientX - pointer.current.x);
    setDrag((d) => d && { ...d, dx });
  };

  const onPointerUp = () => {
    if (!pointer.current || !drag) return;
    pointer.current = null;
    // 1/3 넘게 끌었으면 뒤로가기 확정, 아니면 제자리로
    if (drag.dx > drag.width / 3) {
      setDrag({ ...drag, dx: drag.width, releasing: "out" });
      setTimeout(() => {
        skipAnim.current = true;
        navigate(-1); // drag 상태는 주소가 바뀐 뒤 layout effect에서 지운다(깜빡임 방지)
      }, TIMING.swipeRelease);
    } else {
      setDrag({ ...drag, dx: 0, releasing: "back" });
      setTimeout(() => setDrag(null), TIMING.swipeRelease);
    }
  };

  // ---------- 레이어 구성 (배열 순서 = 쌓이는 순서) ----------
  const layers: { loc: Location; className: string; style?: CSSProperties; active: boolean }[] = [];
  const t = drag?.releasing ? `transform ${TIMING.swipeRelease}ms cubic-bezier(.2,.8,.2,1)` : "none";

  if (drag && below) {
    const progress = drag.dx / drag.width;
    layers.push({
      loc: below,
      className: "layer layer--under",
      style: { transform: `translateX(${-30 + progress * 30}%)`, transition: t },
      active: false,
    });
  }
  if (exiting?.anim === "push") layers.push({ loc: exiting.loc, className: "layer layer--push-exit", active: false });
  layers.push({
    loc: top,
    className: `layer ${enterAnim ? `layer--${enterAnim}-enter` : ""} ${drag ? "layer--dragging" : ""}`,
    style: drag ? { transform: `translateX(${drag.dx}px)`, transition: t } : undefined,
    active: true,
  });
  if (exiting?.anim === "pop") layers.push({ loc: exiting.loc, className: "layer layer--pop-exit", active: false });

  return (
    <>
      {layers.map((l) => (
        <div
          key={l.loc.key}
          className={l.className}
          style={{ ...l.style, ["--nav-ms" as string]: `${TIMING.nav[OS]}ms` }}
          {...(l.active && {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
          })}
        >
          <LayerContext.Provider value={{ active: l.active }}>{render(l.loc)}</LayerContext.Provider>
        </div>
      ))}
    </>
  );
}
