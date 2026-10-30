import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useNavigationType, type Location } from "react-router-dom";
import { TIMING } from "../config/timing";
import { OS } from "../platform/platform";
import { APP } from "../profile/session";
import { LayerContext } from "../platform/LayerContext";
import { IBK_ANIM_MS, ibkAnimFor, type IbkAnim } from "../ibk/nav";
import "./ScreenStack.css";

type Anim = "push" | "pop";
type Render = (loc: Location) => ReactNode;

const EDGE = 24; // 왼쪽 가장자리 몇 px 안에서 시작해야 스와이프로 인정할지
const EASE = "cubic-bezier(.2,.8,.2,1)";
// 콕뱅크(갤럭시) 녹화: 새 화면은 약 80ms 교차 페이드, 뒤로가기는 약 100ms 동안 나가는 화면이 흐려짐
// 하나원큐(갤럭시) 녹화: 새 화면이 오른쪽에서 밀고 들어옴 ≈330ms 감속 (라이트 30fps: 6.067s 462px → 6.433s 6px)
const NH_ANDROID = APP !== "kakao" && OS === "android";
const HANA_ANDROID = APP === "hana" && OS === "android";
const navMs = (anim: Anim | null) => (HANA_ANDROID ? 330 : NH_ANDROID ? (anim === "pop" ? 100 : 80) : TIMING.nav[OS]);
// i-ONE Bank(갤럭시) 녹화: 화면 사이는 대부분 전환 없이 한 번에 바뀜(로딩 점·빈 바탕은 src/ibk/loading.ts).
// 이동할 때 location.state.ibkAnim 으로 고른 곳만 밀기 (src/ibk/nav.ts: 메뉴 열기·닫기, 본문만 밀기)
const IBK_ANDROID = APP === "ibk" && OS === "android";

// 화면 내용은 loc/active가 그대로면 다시 그리지 않는다.
// 드래그·전환 중 ScreenStack이 리렌더돼도 화면 트리 전체를 다시 계산하지 않게 하는 핵심.
const LayerContent = memo(function LayerContent({ loc, active, render }: { loc: Location; active: boolean; render: Render }) {
  return <LayerContext.Provider value={{ active }}>{render(loc)}</LayerContext.Provider>;
});

// <Routes>는 "현재 주소" 하나만 그린다. 전환 애니메이션을 하려면 나가는 화면도 잠깐 살아 있어야 해서
// 방문 기록(entries)을 직접 들고, 각 화면을 <Routes location={그 화면의 주소}>로 따로 그린다.
// 화면을 감싼 div의 key를 location.key로 두면, 같은 화면은 위치가 바뀌어도 언마운트되지 않는다.
export function ScreenStack({ render }: { render: Render }) {
  const location = useLocation();
  const navType = useNavigationType();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<Location[]>([location]);
  const [exiting, setExiting] = useState<{ loc: Location; anim: Anim } | null>(null);
  const [enterAnim, setEnterAnim] = useState<Anim | null>(null);
  const [ibkAnim, setIbkAnim] = useState<IbkAnim | null>(null);
  // 드래그 "중인지"만 state. 손가락 위치(dx)는 매 프레임 바뀌므로 ref + DOM 직접 조작.
  const [dragging, setDragging] = useState(false);
  const skipAnim = useRef(false);
  const drag = useRef<{ x: number; id: number; dx: number; width: number; frame: number } | null>(null);
  const topEl = useRef<HTMLDivElement | null>(null);
  const underEl = useRef<HTMLDivElement | null>(null);
  const underDim = useRef<HTMLDivElement | null>(null);

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

    if (IBK_ANDROID) {
      const a = ibkAnimFor(navType, location, prevTop);
      // menu-in: 새 화면이 위에서 밀려 들어오고 이전 화면은 밑에 그대로 / menu-out: 나가는 화면이 위에서 밀려 나감
      // body-*: 나가는 화면은 바로 사라지고 새 화면의 본문(.ibk-body)만 밀려 들어옴
      const layerAnim: Anim | null = a === "menu-in" ? "push" : a === "menu-out" ? "pop" : null;
      drag.current = null;
      setDragging(false);
      setIbkAnim(a);
      setEnterAnim(layerAnim);
      setExiting(layerAnim ? { loc: prevTop, anim: layerAnim } : null);
      if (!a) return;
      const id = setTimeout(() => {
        setExiting(null);
        setEnterAnim(null);
        setIbkAnim(null);
      }, IBK_ANIM_MS[a]);
      return () => clearTimeout(id);
    }

    // 스와이프로 이미 화면을 밀어냈으면 pop 애니메이션을 또 하지 않는다.
    // 안드로이드(카카오뱅크 영상)는 뒤로가기가 즉시 바뀌므로 pop 애니메이션 없음. 콕뱅크는 짧게 흐려짐.
    if (skipAnim.current || (OS === "android" && anim === "pop" && !NH_ANDROID)) anim = null;
    skipAnim.current = false;
    drag.current = null;
    setDragging(false);
    setEnterAnim(anim);
    setExiting(anim ? { loc: prevTop, anim } : null);
    if (!anim) return;

    const id = setTimeout(() => {
      setExiting(null);
      setEnterAnim(null);
    }, navMs(anim));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // 손가락 위치를 화면 2장 + 어둡게 덮는 막에 반영. transform/opacity만 → GPU 합성만으로 처리.
  const paint = (dx: number, width: number, animate: boolean) => {
    const t = animate ? `transform ${TIMING.swipeRelease}ms ${EASE}` : "none";
    const p = dx / width;
    if (topEl.current) {
      topEl.current.style.transition = t;
      topEl.current.style.transform = `translate3d(${dx}px,0,0)`;
    }
    if (underEl.current) {
      underEl.current.style.transition = t;
      underEl.current.style.transform = `translate3d(${(-30 + p * 30).toFixed(2)}%,0,0)`;
    }
    if (underDim.current) {
      underDim.current.style.transition = animate ? `opacity ${TIMING.swipeRelease}ms ${EASE}` : "none";
      underDim.current.style.opacity = String(0.12 * (1 - p));
    }
  };

  // ---------- iOS: 왼쪽 가장자리 스와이프로 뒤로가기 ----------
  const canSwipe = OS === "ios" && below !== null && exiting === null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canSwipe || drag.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left > EDGE) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, id: e.pointerId, dx: 0, width: rect.width, frame: 0 };
    setDragging(true); // 뒤 화면을 마운트하기 위해 이 한 번만 리렌더
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dx = Math.max(0, e.clientX - d.x);
    // pointermove는 120Hz 화면에선 프레임보다 자주 온다 → 프레임당 한 번만 그리기
    if (!d.frame) {
      d.frame = requestAnimationFrame(() => {
        d.frame = 0;
        paint(d.dx, d.width, false);
      });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d || d.id < 0) return;
    cancelAnimationFrame(d.frame);
    d.id = -1; // 손 뗌 표시 (마무리 애니메이션 중 재시작 방지)
    // 1/3 넘게 끌었거나, 빠르게 튕겼으면 뒤로가기 확정
    if (d.dx > d.width / 3) {
      paint(d.width, d.width, true);
      setTimeout(() => {
        skipAnim.current = true;
        navigate(-1); // 드래그 표시는 주소가 바뀐 뒤 layout effect에서 지운다(깜빡임 방지)
      }, TIMING.swipeRelease);
    } else {
      paint(0, d.width, true);
      setTimeout(() => {
        if (topEl.current) topEl.current.style.cssText = "";
        drag.current = null;
        setDragging(false);
      }, TIMING.swipeRelease);
    }
  };

  // ---------- 레이어 구성 (배열 순서 = 쌓이는 순서) ----------
  const layers: { loc: Location; className: string; active: boolean; role?: "top" | "under" }[] = [];
  if (dragging && below) layers.push({ loc: below, className: "layer layer--under", active: false, role: "under" });
  if (exiting?.anim === "push") layers.push({ loc: exiting.loc, className: "layer layer--push-exit", active: false });
  layers.push({
    loc: top,
    className: `layer ${enterAnim ? `layer--${enterAnim}-enter` : ""} ${dragging ? "layer--dragging" : ""}`,
    active: true,
    role: "top",
  });
  if (exiting?.anim === "pop") layers.push({ loc: exiting.loc, className: "layer layer--pop-exit", active: false });

  return (
    <>
      {layers.map((l) => (
        <div
          key={l.loc.key}
          className={ibkAnim ? `${l.className} layer--ibk-${ibkAnim}` : l.className}
          style={{ ["--nav-ms" as string]: `${ibkAnim ? IBK_ANIM_MS[ibkAnim] : navMs(exiting?.anim ?? enterAnim)}ms` }}
          ref={l.role === "top" ? topEl : l.role === "under" ? underEl : undefined}
          {...(l.active && {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
          })}
        >
          <LayerContent loc={l.loc} active={l.active} render={render} />
          {/* 이전 화면을 살짝 어둡게 덮는 막. filter: brightness() 대신 opacity라 훨씬 가볍다 */}
          <div className="layer__dim" ref={l.role === "under" ? underDim : undefined} />
        </div>
      ))}
    </>
  );
}
