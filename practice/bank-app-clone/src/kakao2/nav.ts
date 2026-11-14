// kakao2 화면 전환 종류 (ScreenStack 이 씀, 움직임은 nav.css)
import { useCallback, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLayerActive } from "../platform/LayerContext";
import { KAKAO2 } from "../profile/session";

// 뒤로 (< · X): 주소로 바로 열었으면(방문 기록 첫 칸) 앱 밖으로 나가지 않고 fallback 으로 (거래상세 '확인'과 같은 방법)
export function useK2Back(fallback = "/") {
  const navigate = useNavigate();
  return useCallback(() => {
    if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

// 화면을 여는 누름 한 번만: 새 층이 그려지기 전(라우터 전환)에 또 눌려 같은 화면이 두 번 쌓이지 않게. 이 층이 덮이면(active false) 잠그고
// 다시 맨 위가 되면 풂. 이동이 안 일어났으면 1.5초 뒤 풂
export function useK2Once() {
  const active = useLayerActive();
  const until = useRef(0);
  useLayoutEffect(() => {
    until.current = active ? 0 : Infinity;
  }, [active]);
  return useCallback((go: () => void) => {
    const now = performance.now();
    if (now < until.current) return;
    until.current = now + 1500;
    go();
  }, []);
}

// 아래에서 올라오는 전체 화면 모달: 홈 → 이체, 통장 → 거래상세 (녹화 8.17 · 41.4초). 밑 화면은 그대로(움직이거나 어두워지지 않음),
// 닫으면 내려감. 가장자리 스와이프로 닫히지 않음. 떠 있는 동안 밑 화면 층을 걷지 않음 (닫으면 스크롤 · 불러온 거래 그대로)
export const k2Modal = (path: string) => KAKAO2 && (path === "/transfer" || /^\/account\/[^/]+\/tx\//.test(path));

// layer--k2-{modal | detail | push | pop}: modal = 이체, detail = 거래상세(−24ms 앞당겨 시작), push · pop = 그 밖의 가로 이동
export type K2Anim = "modal" | "detail" | "push" | "pop";
export const k2AnimFor = (anim: "push" | "pop", path: string): K2Anim =>
  k2Modal(path) ? (path === "/transfer" ? "modal" : "detail") : anim;

export const K2_NAV = {
  modal: 500, // k2-modal-up · down (임계 감쇠 스프링 ω 18)
  push: 400, // cubic-bezier(.2,1,.45,1) (녹화 28.43초 통장 본문 왼끝, RMS 5.9pt)
  pushHold: 477, // push 끝나고도 아래 두 모서리를 둥글게 남겨 두는 시각 (밑 홈 층도 그때까지) — critic.md G2
  underDim: 0.1, // push 때 밑 화면 어둡게
} as const;
