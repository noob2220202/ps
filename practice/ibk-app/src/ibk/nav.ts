import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { holdIbkSpinner, ibkNextPaint, ibkSleep, setIbkCover } from "./loading";

// i-ONE Bank 화면 이동. 녹화에서 화면 사이는 대부분 '전환 없이 한 번에' 바뀌고(로딩 점·빈 바탕이 사이에),
// 몇 곳만 미는 전환이 있음 → 이동할 때 location.state.ibkAnim 으로 알려 주면 ScreenStack 이 그 전환을 함.
//  menu-in   : 전체메뉴가 오른쪽에서 밀려 들어옴, 아래 화면은 그대로 (거래내역 ≡ → 메뉴, 70.37~70.43초 ≈100ms ease-in-out)
//  menu-out  : 위 화면이 오른쪽으로 밀려 나가고 밑의 화면이 드러남 (메뉴 ✕ → 홈, 89.267 +102 → 89.333 +297 → 89.367 끝 = 진행률 26%·76%,
//              menu-in 과 같은 100ms ease-in-out. 89.300 프레임이 빠져 ≈130ms 로 보였던 것 — specB/menu.md §4)
//  body-right: 머리줄은 그대로, 본문(.ibk-body)만 오른쪽에서 들어옴 (이체결과조회 행 → 이체확인증, 77.63~77.90초 200ms)
//  body-left : 본문만 왼쪽에서 들어옴 (확인증 < → 이체결과조회, 83.37~83.60초. 빠진 프레임 탓에 곡선을 못 맞춰 body-right 200ms 를 거꾸로 — §4)
// 뒤로가기(POP)는 나가는 화면이 들어올 때 쓴 전환을 거꾸로 (menu-in → menu-out, body-right → body-left)
export type IbkAnim = "menu-in" | "menu-out" | "body-right" | "body-left";
export const IBK_ANIM_MS: Record<IbkAnim, number> = { "menu-in": 100, "menu-out": 100, "body-right": 200, "body-left": 200 };
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

// 지금 방문 기록 칸 위에 쌓인 뒤로가기 칸 수 (아래 useIbkBackHandler 가 history.state.ibkBack 에 적음)
export const ibkBackLevel = () => (window.history.state as { ibkBack?: number } | null)?.ibkBack ?? 0;
// 지금 화면(라우터 칸)의 key. 뒤로가기 칸은 주소·라우터 상태를 그대로 복사해 쌓으므로 칸이 쌓이고 빠져도 같음
export const ibkHereKey = () => (window.history.state as { key?: string } | null)?.key;
// history.go(delta) 하고 도착(popstate)까지 기다림. 범위 밖이라 popstate 가 안 오면 300ms 뒤 그냥 끝
export function ibkHistoryGo(delta: number) {
  if (!delta) return Promise.resolve();
  return new Promise<void>((done) => {
    const end = () => {
      window.removeEventListener("popstate", end);
      window.clearTimeout(t);
      done();
    };
    const t = window.setTimeout(end, 300);
    window.addEventListener("popstate", end);
    window.history.go(delta);
  });
}
// 방문 기록 첫 칸까지 걷기 (그 위의 뒤로가기 칸도). 홈으로 갈 때 지금 칸만 홈으로 바꾸면(replace) 기록이 [홈, 홈] 이 되어
// 홈에서 뒤로 하면 홈이 또 떴음 (V2 s1·s3·s7). 첫 칸이 홈('/')이면 true. 남은 칸(앞서 못 걷은 뒤로가기 칸)이 있으면 한 번 더
export async function ibkToFirst() {
  for (let i = 0; i < 3; i++) {
    const st = window.history.state as { idx?: number; ibkBack?: number } | null;
    const n = (st?.idx ?? 0) + (st?.ibkBack ?? 0);
    if (!n) break;
    await ibkHistoryGo(-n);
  }
  return window.location.pathname === "/";
}

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
      const at = ibkHereKey();
      const level = ibkBackLevel();
      let release: (() => void) | null = null;
      try {
        if (spin) {
          release = holdIbkSpinner();
          await ibkSleep(spin);
          // 점이 도는 동안 뒤로가기(3버튼 바 <)로 화면이 바뀌었으면 가지 않음 (예전엔 뒤로 간 화면 위에 새 화면이 열림 — V2 s7 back-during-go)
          if (ibkHereKey() !== at) return;
          // 그동안 띄운 안내창의 뒤로가기 칸은 걷고 감 (남기면 새 화면에서 돌아올 때 '<' 한 번이 헛돎 — V3 race)
          await ibkHistoryGo(Math.min(0, level - ibkBackLevel()));
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
  const depth = useRef(0); // 지금 쌓아 둔 칸의 깊이 (0 = 없음)
  // 칸이 빠지는 것 지켜보기: 켜져 있는 동안 한 번만 붙임. 꺼지거나 화면을 떠날 때 내 칸이 맨 위에 남아 있으면 걷어 냄
  useEffect(() => {
    if (!active) return;
    const onPop = () => {
      if (!depth.current || ibkBackLevel() >= depth.current) return; // 더 위에 쌓인 다른 칸이 빠진 것
      depth.current = 0;
      ref.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (depth.current && ibkBackLevel() === depth.current) window.history.back();
      depth.current = 0;
    };
  }, [active]);
  // 칸 쌓기: 켜져 있는데 칸이 없을 때만 (처음, 또는 뒤로가기로 빠진 뒤 key 가 바뀌면). 칸이 있는 채로 key 만 바뀌면 그대로 둠
  // (예전엔 key 가 바뀔 때마다 걷고 다시 쌓다가 history.back() 이 새 칸을 지워서 뒤로 한 번에 화면을 통째로 나갔음)
  // 한 박자 늦게 쌓기: 개발 모드(StrictMode)가 effect 를 두 번 돌려도 한 칸만
  useEffect(() => {
    if (!active || depth.current) return;
    const t = window.setTimeout(() => {
      if (depth.current) return;
      depth.current = ibkBackLevel() + 1;
      window.history.pushState({ ...window.history.state, ibkBack: depth.current }, "");
    });
    return () => window.clearTimeout(t);
  }, [active, key]);
}
