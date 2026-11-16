import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate, useNavigationType, type Location } from "react-router-dom";
import { TIMING } from "../config/timing";
import { OS } from "../platform/platform";
import { ALLONE, APP, KAKAO2, TOSS } from "../profile/session";
import { LayerContext } from "../platform/LayerContext";
import { IBK_ANIM_MS, ibkAnimFor, ibkBackLevel, type IbkAnim } from "../ibk/nav";
import { K2_NAV, k2AnimFor, k2Modal, type K2Anim } from "../kakao2/nav";
import { k2ClockOnce } from "../kakao2/chrome";
import { TOSS_ANIM_END, TOSS_ANIM_MS, tossAnimFor, type TossAnim } from "../toss/nav";
import "./ScreenStack.css";
import "../kakao2/nav.css";

type Anim = "push" | "pop";
type Render = (loc: Location) => ReactNode;

const EDGE = 24; // 왼쪽 가장자리 몇 px 안에서 시작해야 스와이프로 인정할지
const SLOP = 8; // 가장자리에서 누른 뒤 가로로 이만큼 움직여야 스와이프 시작 (그 전엔 그냥 누름 → 머리줄 '<' click 이 살아 있음)
const EASE = "cubic-bezier(.2,.8,.2,1)";
// 콕뱅크(갤럭시) 녹화: 새 화면은 약 80ms 교차 페이드, 뒤로가기는 약 100ms 동안 나가는 화면이 흐려짐
// 하나원큐(갤럭시) 녹화: 새 화면이 오른쪽에서 밀고 들어옴 ≈330ms 감속 (라이트 30fps: 6.067s 462px → 6.433s 6px)
const NH_ANDROID = APP !== "kakao" && OS === "android";
const HANA_ANDROID = APP === "hana" && OS === "android";
// 케이뱅크(갤럭시) 녹화: 새 화면이 오른쪽에서 밀고 들어오고, 밑 화면은 덮이는 만큼 왼쪽으로 조금 밀리며(덮인 비율에 따라 가속) 8%까지 어두워짐.
// 뒤로는 그 반대. 녹화 원본 프레임 시각으로 새 화면 왼끝을 재서 곡선을 맞춤 (화면마다 다름, ScreenStack.css 케이뱅크 블록):
//   acc  = 계좌로 287ms (43.69~43.97초, RMS 3.6px)  · send = 이체로 328ms (21.88~22.20초, RMS 4.7px)
//   pop  = 뒤로 296ms (이체 완료 '확인' → 홈 41.78~42.08초, RMS 1.7px) · tx = 거래 상세 올라옴 445ms · 내려감 413ms (움직임은 kbank-tx.css)
const KBANK_ANDROID = APP === "kbank" && OS === "android";
// 거래 상세(/tx/)는 OS 와 상관없이 kbank-tx.css 의 올라오기 445ms · 내려가기 413ms (층 가로 밀기는 끔). 아이폰도 그 움직임이 끝났을 때 걷음 —
// iOS 전환 타이머(420ms)로 걷으면 상세가 덜 올라온 채(위끝 4~9px) 밑 계좌 층이 사라져 상태바 밑에 검은 띠가 3~4프레임 보였음 (raf-tx)
const kbankTx = (path: string) => APP === "kbank" && path.startsWith("/tx/");
// 이체확인증(/receipt/, 두 번째 녹화 45.7 · 73.9 · 90.2초)도 OS 와 상관없이 올라오기 445ms(거래 상세와 같은 움직임, kbank-receipt.css) · 밑 거래 상세는 그대로.
// 닫기('확인' · 뒤로)는 전환 없이 손 뗀 프레임에 바로 (52.032 → 52.056 · 77.723 → 77.748 · 94.227 → 94.252초). /tx/ 아래 두지 않음 — 'tx' 로 잡히면 닫을 때 413ms 내려감
const kbankReceipt = (path: string) => APP === "kbank" && path.startsWith("/receipt/");
type KbAnim = "acc" | "send" | "pop" | "tx" | "receipt";
const kbankAnim = (anim: Anim, path: string): KbAnim =>
  path.startsWith("/tx/") ? "tx" : path.startsWith("/receipt/") ? "receipt" : anim === "pop" ? "pop" : path.startsWith("/send") ? "send" : "acc";
const KBANK_MS: Record<KbAnim, number> = { acc: 287, send: 328, pop: 296, tx: 445, receipt: 445 };
const kbankMs = (anim: Anim | null, path: string) => {
  const k = kbankAnim(anim ?? "push", path);
  return k === "tx" && anim === "pop" ? 413 : KBANK_MS[k];
};
const navMs = (anim: Anim | null, path = "") =>
  KBANK_ANDROID ? kbankMs(anim, path) : HANA_ANDROID ? 330 : NH_ANDROID ? (anim === "pop" ? 100 : 80) : TIMING.nav[OS];
// i-ONE Bank(갤럭시) 녹화: 화면 사이는 대부분 전환 없이 한 번에 바뀜(로딩 점·빈 바탕은 src/ibk/loading.ts).
// 이동할 때 location.state.ibkAnim 으로 고른 곳만 밀기 (src/ibk/nav.ts: 메뉴 열기·닫기, 본문만 밀기)
const IBK_ANDROID = APP === "ibk" && OS === "android";
// kakao2(아이폰 새 녹화, src/kakao2/nav.ts · nav.css): 이체 · 거래상세는 아래에서 올라오는 모달(500ms 스프링, 실제로 끝났을 때 걷음 — 케이뱅크 거래 상세처럼),
// 그 밖의 push 는 400ms 곡선 + 아래 두 모서리 둥글게 (477ms 에 각지며 밑 층도 그때 걷음), 뒤로는 보통 iOS. 밑 화면 어둡게는 .10
const K2_MS: Record<K2Anim, number> = { modal: K2_NAV.modal, detail: K2_NAV.modal, push: K2_NAV.push, pop: TIMING.nav.ios };
// 토스(갤럭시 고정, src/toss/nav.ts · nav.css): 아래에서 올라오는 push 400ms · 내려가는 pop + 드러나는 화면 내용 −5dp → 0 · cut(탭 · 증명서 단계 · 확인/완료)
// · fade(쿠폰 광고 닫기) · reveal(이체 완료 → 쿠폰). 모두 실제로 끝났을 때 걷음 (onTossAnimEnd). NH_ANDROID 의 80/100ms 는 토스엔 안 씀
const TOSS_ANDROID = TOSS && OS === "android";
// NH올원뱅크(아이폰 고정, 웹뷰 앱): 화면 사이는 모두 한 프레임 CUT (녹화에 밀기 전환 · 가장자리 스와이프 없음, 기다림은 로딩 막 — src/allone/nav.ts).
// 밑 화면 층은 숨긴 채 그대로 둠 (홈 · 거래내역조회로 돌아오면 스크롤 · 불러온 내용 그대로 — plan.md §1.5)
const ALLONE_IOS = ALLONE;
const UNDER_DIM = KAKAO2 ? K2_NAV.underDim : 0.12;

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
  const [animMs, setAnimMs] = useState(0); // 지금 전환 길이 (--nav-ms)
  const [kbAnim, setKbAnim] = useState<KbAnim | null>(null); // 케이뱅크 갤럭시: 지금 전환 종류 (layer--kb-*)
  const [k2Anim, setK2Anim] = useState<K2Anim | null>(null); // kakao2: 지금 전환 종류 (layer--k2-*)
  const [tossAnim, setTossAnim] = useState<TossAnim | null>(null); // 토스: 지금 전환 종류 (layer--toss-*)
  // 드래그 "중인지"만 state. 손가락 위치(dx)는 매 프레임 바뀌므로 ref + DOM 직접 조작.
  const [dragging, setDragging] = useState(false);
  const skipAnim = useRef(false);
  const drag = useRef<{ x: number; id: number; dx: number; width: number; frame: number } | null>(null);
  const press = useRef<{ x: number; y: number; id: number; el: EventTarget } | null>(null); // 가장자리에서 눌렀지만 아직 스와이프로 정해지지 않은 손가락
  const topEl = useRef<HTMLDivElement | null>(null);
  const underEl = useRef<HTMLDivElement | null>(null);
  const underDim = useRef<HTMLDivElement | null>(null);
  const k2Hold = useRef(0); // kakao2 push: 밀기가 끝난 뒤 걷기까지 기다리는 타이머
  // allone: 뒤로로 걷은 칸들 (가까운 것부터). 브라우저 앞으로가 그 칸으로 오면 밑 층들을 그대로 두고 다시 쌓음 (plan.md §1.5 — 홈 · 목록이 다시 그려지지 않게). push 하면 버림
  const aoForward = useRef<Location[]>([]);

  const top = entries[entries.length - 1];
  const below = entries.length > 1 ? entries[entries.length - 2] : null;

  // useLayoutEffect: 화면이 그려지기 "전에" 레이어를 바꿔야 한 프레임 깜빡임이 없다
  useLayoutEffect(() => {
    if (location.key === top.key) return;
    const prevTop = top;
    clearTimeout(k2Hold.current);

    let anim: Anim | null = navType === "POP" ? "pop" : navType === "PUSH" ? "push" : null;
    if (ALLONE_IOS && navType !== "REPLACE") {
      const i = entries.findIndex((e) => e.key === location.key);
      const j = aoForward.current.findIndex((e) => e.key === location.key);
      if (navType === "PUSH") {
        aoForward.current = [];
        setEntries([...entries, location]);
      } else if (i >= 0) {
        aoForward.current = [...entries.slice(i + 1), ...aoForward.current];
        setEntries(entries.slice(0, i + 1));
      } else if (j >= 0) {
        setEntries([...entries, ...aoForward.current.slice(0, j), location]);
        aoForward.current = aoForward.current.slice(j + 1);
      } else {
        aoForward.current = [];
        setEntries([location]);
      }
    } else if (navType === "POP") {
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
      // 걷는 건 전환이 실제로 끝났을 때 (아래 onIbkAnimEnd). 길이만큼의 타이머로 걷으면 새 화면을 그리느라 첫 프레임이 늦게 나온 만큼
      // 잘려 보였음 (개발 서버: 메뉴 열기·닫기 100ms 가 0~67ms 에서, 본문 200ms 가 167~183ms 에서 끊김). 타이머는 끝 이벤트가 안 올 때 대비
      const id = setTimeout(endIbkAnim, IBK_ANIM_MS[a] + 300);
      return () => clearTimeout(id);
    }

    if (ALLONE_IOS) {
      drag.current = null;
      setDragging(false);
      setEnterAnim(null);
      setExiting(null);
      return;
    }

    if (TOSS_ANDROID) {
      const a = tossAnimFor(navType, location, prevTop);
      // push · load: 나가는 층이 밑, 새 층이 위 / pop · fade · reveal: 나가는 층이 위 (reveal 은 replace 로 옴)
      const layerAnim: Anim | null = a === "push" || a === "load" ? "push" : a ? "pop" : null;
      drag.current = null;
      setDragging(false);
      setTossAnim(a);
      setEnterAnim(layerAnim);
      setExiting(layerAnim ? { loc: prevTop, anim: layerAnim } : null);
      if (!a) return;
      setAnimMs(TOSS_ANIM_MS[a]);
      // 걷는 건 움직임이 실제로 끝났을 때 (onTossAnimEnd). 타이머는 끝 이벤트가 안 올 때 대비
      const id = setTimeout(endTossAnim, TOSS_ANIM_MS[a] + 300);
      return () => clearTimeout(id);
    }

    // 스와이프로 이미 화면을 밀어냈으면 pop 애니메이션을 또 하지 않는다.
    // 안드로이드(카카오뱅크 영상)는 뒤로가기가 즉시 바뀌므로 pop 애니메이션 없음. 콕뱅크는 짧게 흐려짐.
    // 케이뱅크 이체확인증에서 뒤로는 갤럭시·아이폰 모두 바로 (위 kbankReceipt). 앞으로 가기로 확인증에 다시 들어갈 때(POP)도 전환 없이 —
    // 거래 상세 'tx' 내려가기가 걸리면 밑에 그려진 층 없이 확인증이 올라와 위쪽에 검은 띠가 보였음 (확인증도 한 번 그린 칸이면 올라오지 않음)
    if (
      skipAnim.current ||
      (OS === "android" && anim === "pop" && !NH_ANDROID) ||
      (anim === "pop" && (kbankReceipt(prevTop.pathname) || kbankReceipt(location.pathname)))
    )
      anim = null;
    skipAnim.current = false;
    drag.current = null;
    setDragging(false);
    setEnterAnim(anim);
    setExiting(anim ? { loc: prevTop, anim } : null);
    setKbAnim(null);
    setK2Anim(null);
    if (!anim) return;

    const path = anim === "pop" ? prevTop.pathname : location.pathname;
    const up = kbankTx(path) || kbankReceipt(path); // 아래에서 올라오는 화면 (아이폰도 같은 움직임)
    const kbAnimEnd = KBANK_ANDROID || up;
    const k2 = KAKAO2 ? k2AnimFor(anim, path) : null;
    const k2Up = k2 === "modal" || k2 === "detail";
    const ms = up ? kbankMs(anim, path) : k2 ? K2_MS[k2] : navMs(anim, path); // 케이뱅크는 어느 화면이 오가는지에 따라 길이·곡선이 다름
    setAnimMs(ms);
    if (kbAnimEnd) setKbAnim(kbankAnim(anim, path));
    setK2Anim(k2);
    // kakao2 이체 모달 닫기: 상태바 글자가 시계까지 한 프레임에 흰색으로 (녹화 27.355초)
    if (k2Up && anim === "pop") k2ClockOnce(0);
    // 케이뱅크는 움직임이 실제로 끝났을 때 걷음 (onKbAnimEnd) — 돌아가는 화면을 새로 그리느라 첫 프레임이 늦게 나온 만큼(≈45ms) 타이머가 먼저 끝나
    // 뒤로 갈 때 나가는 화면이 70% 지점에서 사라졌음 (rAF 기록 nav_pop). 타이머는 끝 이벤트가 안 올 때 대비. kakao2 모달 · push 도 같은 방법
    const id = setTimeout(endAnim, kbAnimEnd || k2Up ? ms + 300 : k2 === "push" ? K2_NAV.pushHold + 300 : ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const endAnim = () => {
    setExiting(null);
    setEnterAnim(null);
    setKbAnim(null);
    setK2Anim(null);
  };
  // kakao2 모달: 위 층의 올라오기 · 내려가기(nav.css k2-modal-*)가 끝났을 때. push: 새 화면(또는 그 .k2-push-body) 밀기가 끝나고
  // 77ms 뒤 — 아래 둥근 모서리가 각지는 때(녹화 28.915초 = 시작 + 477ms)까지 밑 층을 남겨 둠. 타이머로 재면 새 화면을 그리느라 늦은 만큼 일찍 끝남
  const onK2AnimEnd = (e: AnimationEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (k2Anim === "push") {
      if (e.animationName === "ios-push-in" && (t === e.currentTarget || t.classList.contains("k2-push-body")))
        k2Hold.current = window.setTimeout(endAnim, K2_NAV.pushHold - K2_NAV.push);
    } else if (t === e.currentTarget && /^k2-modal-(up|down)$/.test(e.animationName)) endAnim();
  };
  // 케이뱅크 전환 끝: 위 층의 가로 밀기(층 자신), 거래 상세는 .kbt 의 올라오기·내려가기,
  // 이체확인증은 .kbc 안(루트 · 머리줄 · 본문)의 올라오기 (kbc-up, 루트에 거래 상세 키프레임을 써도 kbt-up)
  const onKbAnimEnd = (e: AnimationEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t === e.currentTarget) {
      if (e.animationName.startsWith("layer-slide-")) endAnim();
    } else if (kbAnim === "receipt") {
      if (/^kb[ct]-up$/.test(e.animationName) && t.closest(".kbc")) endAnim();
    } else if (t.classList.contains("kbt") && /^kbt-(up|down)$/.test(e.animationName)) endAnim();
  };

  // i-ONE Bank 전환 끝: 메뉴 밀기(menu-*)는 층 자신의, 본문 밀기(body-*)는 새 화면 .ibk-body 의 애니메이션이 끝났을 때
  const endIbkAnim = () => {
    setExiting(null);
    setEnterAnim(null);
    setIbkAnim(null);
  };
  const onIbkAnimEnd = (e: AnimationEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (ibkAnim?.startsWith("menu") ? t === e.currentTarget : t.classList.contains("ibk-body") && e.animationName.startsWith("ibk-in-")) endIbkAnim();
  };

  // 토스 전환 끝: 그 전환의 마지막 애니메이션 (push = 새 층 toss-push-in, pop = 드러나는 내용 toss-reveal, fade = 나가는 층 toss-fade-out,
  // reveal = 새 층 내용 toss-reveal-in — nav.ts TOSS_ANIM_END). 안쪽 요소의 애니메이션 끝도 올라오므로 이름으로 가림
  const endTossAnim = () => {
    setExiting(null);
    setEnterAnim(null);
    setTossAnim(null);
  };
  const onTossAnimEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (tossAnim && e.animationName === TOSS_ANIM_END[tossAnim]) endTossAnim();
  };

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
      underDim.current.style.opacity = String(UNDER_DIM * (1 - p));
    }
  };

  // ---------- iOS: 왼쪽 가장자리 스와이프로 뒤로가기 ----------
  // kakao2 모달(이체 · 거래상세)은 iOS 전체 화면 모달처럼 가장자리 스와이프로 닫히지 않음
  const canSwipe = !ALLONE_IOS && OS === "ios" && below !== null && exiting === null && !k2Modal(top.pathname);
  // 화면 안 뒤로가기 칸(i-ONE Bank useIbkBackHandler: 시트 · 안내창 · 이체 금액/확인 단계)이 쌓여 있으면 끌지 않음. 끝까지 끌면 navigate(-1) 이
  // 그 칸만 빼고 주소(location.key)는 그대로라 위 층이 402px 밀린 채 멈췄음 (V2 s6b · V3 iosstuck). 실제 iOS 도 시트·알림이 떠 있으면 뒤로 끌기가 안 됨
  const inScreenBack = () => ibkBackLevel() > 0;
  // 안쪽 부품(홈 계좌 카드 AccountPager 등)이 같은 move 에서 먼저 포인터를 잡았는지. 층이 빼앗으면 카드가 끌기 상태로 남았음 (V3 pager).
  // 누른 곳(down)은 빼고 봄: 터치는 누른 요소가 저절로 포인터를 잡고 있음(암묵 캡처)
  const childOwns = (e: PointerEvent<HTMLDivElement>, down: EventTarget) => {
    for (let el = e.target as Element | null; el && el !== e.currentTarget; el = el.parentElement)
      if (el !== down && el.hasPointerCapture(e.pointerId)) return true;
    return false;
  };

  // 누르는 순간 포인터를 잡으면(setPointerCapture) 그 누름의 click 이 사라져 가장자리에 걸친 '<' 가 안 눌림 (네 앱 모두, x 24 안쪽)
  // → 누를 땐 자리만 적어 두고, 가로로 SLOP 넘게 움직였을 때 잡고 끌기 시작. 세로로 먼저 움직이면 스와이프 아님
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canSwipe || drag.current || inScreenBack()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left > EDGE) return;
    press.current = { x: e.clientX, y: e.clientY, id: e.pointerId, el: e.target };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = press.current;
    if (s && s.id === e.pointerId) {
      if (!e.buttons) {
        press.current = null; // 폰 밖에서 떼어 pointerup 을 못 받은 것
        return;
      }
      const mx = e.clientX - s.x;
      const my = Math.abs(e.clientY - s.y);
      if (Math.abs(mx) < SLOP && my < SLOP) return;
      press.current = null;
      if (mx < SLOP || my > mx || !canSwipe || drag.current || inScreenBack() || childOwns(e, s.el)) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: s.x, id: e.pointerId, dx: 0, width: e.currentTarget.getBoundingClientRect().width, frame: 0 };
      setDragging(true); // 뒤 화면을 마운트하기 위해 이 한 번만 리렌더
    }
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

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (press.current?.id === e.pointerId) press.current = null; // 움직이지 않고 뗌 = 그냥 누름 (click 은 그대로)
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
        // 주소가 바뀌지 않는 뒤로(화면이 직접 쌓은 칸 — 하나 hanaSend · 콕 nhBankPicker 등)면 layout effect 가 돌지 않아 밀린 채 남음 → 제자리로
        setTimeout(() => {
          if (drag.current !== d) return;
          if (topEl.current) topEl.current.style.cssText = "";
          skipAnim.current = false;
          drag.current = null;
          setDragging(false);
        }, 300);
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
  // allone: 쌓인 화면을 모두 그려 두고 맨 위만 보임 (밑 층은 숨김 · 누름 없음, allone.css .layer--ao-under)
  if (ALLONE_IOS) for (const e of entries.slice(0, -1)) layers.push({ loc: e, className: "layer layer--ao-under", active: false });
  if (dragging && below) layers.push({ loc: below, className: "layer layer--under", active: false, role: "under" });
  if (exiting?.anim === "push") layers.push({ loc: exiting.loc, className: "layer layer--push-exit", active: false });
  // kakao2: 모달이 떠 있는 동안 밑 화면 층을 그대로 둠 (올라올 때의 push-exit 층과 같은 key → 다시 그리지 않음). 닫으면 스크롤 · 불러온 거래가 그대로
  else if (below && !dragging && !exiting && k2Modal(top.pathname)) layers.push({ loc: below, className: "layer layer--k2-under", active: false });
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
          className={
            ibkAnim
              ? `${l.className} layer--ibk-${ibkAnim}`
              : kbAnim
                ? `${l.className} layer--kb-${kbAnim}`
                : k2Anim
                  ? `${l.className} layer--k2-${k2Anim}`
                  : tossAnim
                    ? `${l.className} layer--toss-${tossAnim}`
                    : l.className
          }
          style={{ ["--nav-ms" as string]: `${ibkAnim ? IBK_ANIM_MS[ibkAnim] : animMs || navMs(exiting?.anim ?? enterAnim)}ms` }}
          ref={l.role === "top" ? topEl : l.role === "under" ? underEl : undefined}
          onAnimationEnd={ibkAnim ? onIbkAnimEnd : kbAnim ? onKbAnimEnd : k2Anim ? onK2AnimEnd : tossAnim ? onTossAnimEnd : undefined}
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
