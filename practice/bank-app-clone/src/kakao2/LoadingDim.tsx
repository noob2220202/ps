// kakao2 로딩 막 (dim.ts 의 showK2Dim · leaveK2Dim · cutK2Dim 으로 켜고 끔). PhoneFrame 이 폰 화면(.phone__viewport) 안에 한 번 그림
import { useEffect, useLayoutEffect } from "react";
import { useAuth } from "../auth/auth";
import { RESTART_EVENT } from "../platform/recorder";
import { K2Spinner } from "./art";
import { cutK2Dim, endK2Dim, K2_DIM_FADE_MS, useK2Dim } from "./dim";
import "./chrome.css";

export function K2LoadingDim() {
  const dim = useK2Dim();
  // 녹화를 새로 시작하면(앱을 처음부터) 막도 걷음
  useEffect(() => {
    const off = () => cutK2Dim();
    window.addEventListener(RESTART_EVENT, off);
    return () => window.removeEventListener(RESTART_EVENT, off);
  }, []);
  // 로그인이 풀리면(요청이 401 · 403 → 로그인 화면) 막을 켠 화면이 사라지므로 막도 걷음. 거래를 눌러 막이 뜬 채 상세 요청이 401 이면
  // 걷을 화면(거래상세)이 없어 로그인 화면 위에 막 · 스피너가 남아 입력을 막았음
  const signedIn = useAuth().status === "in";
  useLayoutEffect(() => {
    if (!signedIn) cutK2Dim();
  }, [signedIn]);
  // 흐려지기 끝 이벤트가 안 와도(탭이 숨겨짐 등) 걷히게
  useEffect(() => {
    if (!dim?.leaving) return;
    const t = setTimeout(() => endK2Dim(dim.id), K2_DIM_FADE_MS + 100);
    return () => clearTimeout(t);
  }, [dim]);
  if (!dim) return null;
  return (
    <div
      className={`k2-dim${dim.leaving ? " k2-dim--leaving" : ""}`}
      onAnimationEnd={(e) => e.target === e.currentTarget && endK2Dim(dim.id)}
      aria-busy="true"
    >
      {dim.spinner && <K2Spinner className="k2-dim__spinner" color={dim.spinnerColor} />}
    </div>
  );
}
