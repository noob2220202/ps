import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { holdIbkSpinner, ibkNextPaint, ibkSleep, setIbkCover } from "./loading";

// i-ONE Bank 화면 이동. 녹화에서 화면 사이는 대부분 '전환 없이 한 번에' 바뀌고(로딩 점·빈 바탕이 사이에),
// 몇 곳만 미는 전환이 있음 → 이동할 때 location.state.ibkAnim 으로 알려 주면 ScreenStack 이 그 전환을 함.
//  menu-in   : 전체메뉴가 오른쪽에서 밀려 들어옴, 아래 화면은 그대로 (거래내역 ≡ → 메뉴, 70.37~70.43초 ≈100ms ease-in-out)
//  menu-out  : 위 화면이 오른쪽으로 밀려 나가고 밑의 화면이 드러남 (메뉴 ✕ → 홈, 89.24~89.37초 ≈130ms)
//  body-right: 머리줄은 그대로, 본문(.ibk-body)만 오른쪽에서 들어옴 (이체결과조회 행 → 이체확인증, 77.63~77.90초 200ms)
//  body-left : 본문만 왼쪽에서 들어옴 (확인증 < → 이체결과조회, 83.37~83.67초 ≈230ms)
// 뒤로가기(POP)는 나가는 화면이 들어올 때 쓴 전환을 거꾸로 (menu-in → menu-out, body-right → body-left)
export type IbkAnim = "menu-in" | "menu-out" | "body-right" | "body-left";
export const IBK_ANIM_MS: Record<IbkAnim, number> = { "menu-in": 100, "menu-out": 130, "body-right": 200, "body-left": 230 };
const REVERSE: Record<IbkAnim, IbkAnim> = { "menu-in": "menu-out", "menu-out": "menu-in", "body-right": "body-left", "body-left": "body-right" };

const animOf = (state: unknown): IbkAnim | null => {
  const a = (state as { ibkAnim?: unknown } | null)?.ibkAnim;
  return typeof a === "string" && a in IBK_ANIM_MS ? (a as IbkAnim) : null;
};
// ScreenStack 이 부름: 이번 이동에 쓸 전환
export function ibkAnimFor(navType: string, to: { state: unknown }, from: { state: unknown }): IbkAnim | null {
  if (navType === "POP") {
    const a = animOf(from.state);
    return a === "menu-in" || a === "body-right" ? REVERSE[a] : null;
  }
  return animOf(to.state);
}

export interface IbkGoOptions {
  replace?: boolean;
  state?: Record<string, unknown>;
  anim?: IbkAnim; // 위 전환 (없으면 한 번에 바뀜)
  spin?: number; // 이동 전에 지금 화면 위에 점만 보여 줄 ms
  white?: number; // 바뀌는 순간 흰 화면(점 없음) ms — 녹화 1~3프레임
  blank?: number; // 그다음 빈 바탕(cover) + 점(처음부터) ms. 새 화면은 이 막 밑에서 미리 그려짐
  cover?: string; // 빈 바탕 색 (기본 #fafafa = 상태바와 같은 색)
}
// 녹화에서 웹 화면(이체·거래내역·이체결과조회)을 열 때의 순서를 줄인 값. 실제 기다림(1.3~5초)은 통신 시간이라 짧게
export const IBK_PAGE: IbkGoOptions = { spin: 430, white: 67, blank: 700 };

let busy = false; // 이동 중 두 번 누름 막기

// navigate 대신. go(to) = 바로, go(to, IBK_PAGE) = 점 → 흰 화면 → 빈 바탕 + 점 → 새 화면, go(to, { anim: "menu-in" }) = 밀기
export function useIbkGo() {
  const navigate = useNavigate();
  return useCallback(
    async (to: string, o: IbkGoOptions = {}) => {
      const { spin = 0, white = 0, blank = 0, cover = "#fafafa", anim, state, replace } = o;
      const nav = { replace, state: anim ? { ...state, ibkAnim: anim } : state };
      if (!spin && !white && !blank) {
        navigate(to, nav);
        return;
      }
      if (busy) return;
      busy = true;
      let release: (() => void) | null = null;
      try {
        if (spin) {
          release = holdIbkSpinner();
          await ibkSleep(spin);
        }
        if (white || blank) {
          release?.();
          release = null;
          setIbkCover(white ? "#ffffff" : cover);
          navigate(to, nav);
          if (white) await ibkSleep(white);
          if (blank) {
            setIbkCover(cover);
            release = holdIbkSpinner(); // 바탕이 바뀌면 점은 처음부터 다시 (녹화 10.267초)
            await ibkSleep(blank);
          }
          await ibkNextPaint();
        } else {
          navigate(to, nav);
          await ibkNextPaint();
        }
      } finally {
        setIbkCover(null);
        release?.();
        busy = false;
      }
    },
    [navigate],
  );
}

// 머리줄 ← : 방문 기록이 있으면 뒤로, 주소로 바로 열었으면 fallback 으로 (앱 밖으로 나가지 않게)
// 녹화: ← 를 떼고 430~600ms 뒤 이전 화면 (통신 기다림) → delay 로 흉내 낼 수 있음 (기본 0)
export function useIbkBack(fallback = "/", delay = 0) {
  const navigate = useNavigate();
  return useCallback(() => {
    const go = () => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) navigate(-1);
      else navigate(fallback, { replace: true });
    };
    if (delay) window.setTimeout(go, delay);
    else go();
  }, [navigate, fallback, delay]);
}

// 안드로이드 뒤로(3버튼 바 <)를 화면 안에서 받기: active 인 동안 방문 기록 한 칸(주소·라우터 상태 그대로)을 쌓아 두고,
// 뒤로가기로 그 칸이 빠지면 onBack. 다른 이유로 끝나면(active=false) 쌓아 둔 칸을 걷어 냄. 여럿이 겹치면 나중 것부터.
// key 가 바뀌면(예: 이체 단계) 다시 쌓음 → 단계마다 뒤로 한 번씩. 시트·이체 단계에 씀
export function useIbkBackHandler(active: boolean, onBack: () => void, key?: unknown) {
  const ref = useRef(onBack);
  useEffect(() => {
    ref.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    let depth = 0;
    let popped = false;
    const level = () => ((window.history.state as { ibkBack?: number } | null)?.ibkBack ?? 0);
    const onPop = () => {
      if (level() >= depth) return; // 더 위에 쌓인 다른 칸이 빠진 것
      popped = true;
      window.removeEventListener("popstate", onPop);
      ref.current();
    };
    // 한 박자 늦게 쌓기: 개발 모드(StrictMode)가 effect 를 두 번 돌려도 한 칸만
    const t = window.setTimeout(() => {
      depth = level() + 1;
      window.history.pushState({ ...window.history.state, ibkBack: depth }, "");
      window.addEventListener("popstate", onPop);
    });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("popstate", onPop);
      if (depth && !popped && level() === depth) window.history.back();
    };
  }, [active, key]);
}
