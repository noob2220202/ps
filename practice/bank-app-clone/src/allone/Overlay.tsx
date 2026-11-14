// NH올원뱅크 폰 화면 위 전역 층 (App.tsx 가 PhoneFrame overlay 로 넘김 — .phone 안 맨 끝, 아일랜드 60 · 상태바 글자 70 아래). plan.md §3.1
//  z 51 웹 로딩 막 + 스피너 (웹뷰 59–818 만, 스피너는 화면 가운데)   ui/Loading.tsx · loading.ts
//  z 53 네이티브 판 자리 #ao-native-panel (T2 금액 키패드 판)          AoNativePortal layer="panel"
//  z 54 토스트                                                       ui/Toast.tsx · toast.ts
//  z 55 네이티브 막 + 시트 자리 #ao-native (T7 · T3 · 스플래시 그림)    AoNativePortal (기본)
//  z 56 iOS 키보드 자리 #ao-native-kb                                 AoNativePortal layer="keyboard"
//  z 57 녹화 인트로 장면 자리 #ao-native-scene                         setAoScene(node) 또는 직접
//  (z 58 홈 인디케이터는 PhoneFrame)
// 녹화를 새로 시작하거나(RESTART "off", 앱을 처음부터) 로그인이 풀리면 로딩 막 · 토스트 · 상태바 덮어쓰기를 걷고 네이티브 층에 비우라고 알림 (토스 Overlay 와 같은 이유)
import { useEffect, useLayoutEffect } from "react";
import { useAuth } from "../auth/auth";
import { RESTART_EVENT } from "../platform/recorder";
import { cutAoLoading } from "./loading";
import { aoListenPopFirst } from "./nav";
import { AO_NATIVE_IDS, aoNativeReset, setAoNativeHost, useAoScene, type AoNativeLayer } from "./native";
import { resetAoStatusFg } from "./statusFg";
import { cutAoToast } from "./toast";
import { AoLoadingLayer } from "./ui/Loading";
import { AoToastLayer } from "./ui/Toast";

function clearNative() {
  cutAoLoading();
  cutAoToast();
  resetAoStatusFg();
  aoNativeReset();
}

// 자리 div 가 붙고 떨어질 때 native.ts 에 알림 (AoNativePortal 이 그 자리를 찾음)
const attach = (layer: AoNativeLayer) => (el: HTMLDivElement | null) => setAoNativeHost(layer, el);
const attachPanel = attach("panel");
const attachSheet = attach("sheet");
const attachKeyboard = attach("keyboard");
const attachScene = attach("scene");

// 녹화 시작의 "off" 에만 (인트로가 "start" 를 보낼 땐 장면 · 상태바 글자색을 인트로가 이어서 다룸)
const onRestart = (e: Event) => (e as CustomEvent).detail === "off" && clearNative();

export function AlloneOverlay() {
  // 뒤로(popstate)를 react-router 보다 먼저 받는 수신 (nav.ts). 자식의 useLayoutEffect 는 BrowserRouter 의 history.listen 보다 먼저 돎
  useLayoutEffect(aoListenPopFirst, []);
  // 진짜 폰 화면(500px 이하)에서 393 폭 폰을 창 폭에 맞추는 배율 (allone.css)
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    // 기기 화면 크기(CSS px): 시각 뷰포트 × 배율 — 393 폭 폰이 창보다 넓게 그려진 순간에는 모바일 크롬이 레이아웃 뷰포트를 393 으로 넓히고 화면을 줄여 보여서
    // innerWidth 가 393 이 되므로 (그러면 배율 1 에 갇힘) 줄인 배율을 곱해 되돌림. 손가락으로 확대해도 값은 그대로
    const vv = window.visualViewport;
    const fit = () => {
      const w = vv ? vv.width * vv.scale : window.innerWidth;
      const h = vv ? vv.height * vv.scale : window.innerHeight;
      const f = w / 393;
      root.setProperty("--ao-fit", String(f));
      root.setProperty("--ao-phone-h", `${h / f}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    vv?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      vv?.removeEventListener("resize", fit);
      root.removeProperty("--ao-fit");
      root.removeProperty("--ao-phone-h");
    };
  }, []);
  useEffect(() => {
    window.addEventListener(RESTART_EVENT, onRestart);
    return () => window.removeEventListener(RESTART_EVENT, onRestart);
  }, []);
  const signedIn = useAuth().status === "in";
  useLayoutEffect(() => {
    if (!signedIn) clearNative();
  }, [signedIn]);
  const scene = useAoScene();
  return (
    <>
      <AoLoadingLayer />
      <div id={AO_NATIVE_IDS.panel} className="ao-native ao-native--panel" ref={attachPanel} />
      <AoToastLayer />
      <div id={AO_NATIVE_IDS.sheet} className="ao-native ao-native--sheet" ref={attachSheet} />
      <div id={AO_NATIVE_IDS.keyboard} className="ao-native ao-native--keyboard" ref={attachKeyboard} />
      <div id={AO_NATIVE_IDS.scene} className="ao-native ao-native--scene" ref={attachScene}>
        {scene}
      </div>
    </>
  );
}
