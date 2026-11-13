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
