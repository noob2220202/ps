// 토스 폰 화면 위 전역 층 (App.tsx 가 PhoneFrame overlay 로 넘김): LOAD 빈 화면 · "잠시만 기다려주세요." 상자 · 토스트.
// 녹화를 새로 시작하거나(앱을 처음부터) 로그인이 풀리면 걷음 (kakao2 LoadingDim 과 같은 이유: 걷을 화면이 사라짐)
import { useEffect, useLayoutEffect } from "react";
import { useAuth } from "../auth/auth";
import { RESTART_EVENT } from "../platform/recorder";
import { cutTossLoading } from "./loading";
import { cutTossToast } from "./toast";
import { TossLoadingLayer } from "./ui/LoadingLayer";
import { TossToast } from "./ui/Toast";

export function TossOverlay() {
  useEffect(() => {
    const off = () => {
      cutTossLoading();
      cutTossToast();
    };
    window.addEventListener(RESTART_EVENT, off);
    return () => window.removeEventListener(RESTART_EVENT, off);
  }, []);
  const signedIn = useAuth().status === "in";
  useLayoutEffect(() => {
    if (!signedIn) {
      cutTossLoading();
      cutTossToast();
    }
  }, [signedIn]);
  return (
    <>
      <TossLoadingLayer />
      <TossToast />
    </>
  );
}
