// 토스 화면 이동 (ScreenStack 의 toss 갈래가 씀, 움직임은 nav.css). plan.md §1.3 · §3.4 — 녹화에서 잰 값:
//  push   새 화면: 아래 +150dp → 0, 400ms cubic-bezier(.05,.7,.1,1), 처음 50ms 에 투명도 0 → 1
//         옛 화면: 내용이 60ms 직선으로 흐려지며 −12dp, 맨 위 28dp 띠(와 바탕)는 95ms 남았다가 사라짐 → 그 사이 상태바 자리가 잠깐 검정 (폰 바탕)
//         (A 14.134 · A 45.406 · B 9.960 세 번을 같이 맞춤, RMS 1.7dp)
//  load   push 와 같고, 옛 화면 내용은 처음부터 안 보임 (보내기 → LOAD 빈 화면 → 어디로 보낼까요)
//  pop    닫히는 화면: 0 → +40dp, 120ms cubic-bezier(.4,0,1,1), 흐려지지 않고 끝에 사라짐.
//         드러나는 화면: 바탕(과 띠)만 보이다가 닫힘이 끝나면 내용이 −5dp → 0, 120ms cubic-bezier(0,0,.2,1) (B 54.39–54.66)
//  fade   맨 위 화면이 90ms 직선으로 흐려짐, 밑 화면은 그대로 (쿠폰 광고 닫기, B 77.332–77.42)
//  reveal 이체 완료(S8)가 pop 처럼 내려가고, 그 밑에 처음부터 있는 새 화면(쿠폰)의 내용이 150ms 뒤 300ms ease-out 으로 나타남 (replace 로 감)
//  cut    움직임 없음 (탭 사이, 증명서 단계, 금액 → 확인 → 보내는 중/완료)
// 고르는 순서: location.state.tossAnim (push/replace 로 갈 때) → 길 규칙 (cut) → push 면 push, 뒤로면 pop.
// 뒤로 갈 때 나가는 화면 state 에 tossExit: "fade" 가 있으면 fade.
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, type NavigateOptions } from "react-router-dom";
import { useLayerActive } from "../platform/LayerContext";

export type TossAnim = "push" | "load" | "pop" | "fade" | "reveal";
export type TossAnimState = TossAnim | "cut";

// 전환 길이 (ms). 걷기는 끝 이벤트(ScreenStack onTossAnimEnd)로, 이 값 + 300 은 끝 이벤트가 안 올 때의 대비
export const TOSS_ANIM_MS: Record<TossAnim, number> = { push: 400, load: 400, pop: 240, fade: 90, reveal: 450 };
// 끝을 알리는 애니메이션 이름 (nav.css)
export const TOSS_ANIM_END: Record<TossAnim, string> = {
  push: "toss-push-in",
  load: "toss-push-in",
  pop: "toss-reveal",
  fade: "toss-fade-out",
  reveal: "toss-reveal-in",
};

export const TOSS_NAV = {
  push: 400,
  pushFrom: 150, // dp
  pushFade: 50,
  oldFade: 60,
  oldDrift: -12,
  bandHold: 95,
  popExit: 120,
  popDrop: 40,
  popSettle: 120,
  popFrom: -5,
  fade: 90,
  tapDelay: 120, // 손을 떼고 이만큼 뒤에 이동 (녹화의 웹뷰 기다림 0.46–1.7초를 줄인 값)
  lock: 450, // 한 번 이동하면 이만큼 다음 이동을 받지 않음
  pressOut: 170, // 누름 표시가 사라지는 시간
} as const;

const st = (s: unknown) => (s && typeof s === "object" ? (s as Record<string, unknown>) : null);
const ANIMS: TossAnimState[] = ["push", "load", "pop", "fade", "reveal", "cut"];
const explicit = (s: unknown): TossAnimState | null => {
  const a = st(s)?.tossAnim;
  return typeof a === "string" && (ANIMS as string[]).includes(a) ? (a as TossAnimState) : null;
};

// 증명서 단계 (/cert/transfer/…): 단계 사이 · 소개(/cert/transfer) ↔ 단계는 cut. 문서(/cert/doc)는 push
const certStep = (p: string) => p.startsWith("/cert/transfer/");
const certFlow = (p: string) => p === "/cert/transfer" || certStep(p);
const tabLike = (p: string) => p === "/" || p.startsWith("/tab/");
const cutPair = (a: string, b: string) =>
  (certFlow(a) && certFlow(b) && (certStep(a) || certStep(b))) || (tabLike(a) && tabLike(b) && (a !== "/" || b !== "/"));
// 이 화면으로 들어올 때 cut (금액 → 확인, 확인 → 보내는 중/완료)
const cutPage = (p: string) => p === "/send/confirm" || p === "/send/done";
// 이 화면에서 뒤로 나갈 때 cut (확인 → 금액). 완료(S8)에서 흐름을 나가는 history.go(-sendDepth) 는 pop
const cutBack = (p: string) => p === "/send/confirm";

// ScreenStack 이 부름: 이번 이동에 쓸 전환 (null = cut)
export function tossAnimFor(navType: string, to: { pathname: string; state: unknown }, from: { pathname: string; state: unknown }): TossAnim | null {
  if (navType === "POP") {
    if (st(from.state)?.tossExit === "fade") return "fade";
    if (explicit(from.state) === "cut" || cutPair(from.pathname, to.pathname) || cutBack(from.pathname)) return null;
    return "pop";
  }
  const a = explicit(to.state);
  if (a) return a === "cut" ? null : a;
  if (cutPair(from.pathname, to.pathname) || cutPage(to.pathname)) return null;
  return navType === "PUSH" ? "push" : null; // replace 는 따로 정하지 않으면 cut
}

// ---------- 깊이 (location.state) ----------
// sendDepth: 이체 흐름에 들어온 뒤 쌓은 칸 수 (goSend 가 1로 시작), certDepth: 상세 → 증명서 이후 칸 수 (상세가 1로 시작).
// useTossGo 의 push 는 지금 화면의 깊이에 1을 더해 넘기고 (replace 는 그대로) → 흐름을 나갈 때 history.go(-depth)
export type TossDepthKey = "sendDepth" | "certDepth";
const DEPTHS: TossDepthKey[] = ["sendDepth", "certDepth"];
export const tossDepth = (state: unknown, key: TossDepthKey) => {
  const v = st(state)?.[key];
  return typeof v === "number" && v > 0 ? v : 0;
};
export function carryDepth(from: unknown, replace: boolean | undefined, extra?: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of DEPTHS) {
    const d = tossDepth(from, k);
    if (d) out[k] = replace ? d : d + 1;
  }
  return { ...out, ...extra };
}

// ---------- 방문 기록 ----------
// history.go(delta) 하고 도착(popstate)까지 기다림. 범위 밖이라 popstate 가 안 오면 300ms 뒤 끝
export function tossHistoryGo(delta: number) {
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
const hereKey = () => (window.history.state as { key?: string } | null)?.key;
const historyIdx = () => (window.history.state as { idx?: number } | null)?.idx ?? 0;

// ---------- 이동 잠금 ----------
let lockedUntil = 0;
// 다른 곳(flow.ts 등)이 직접 이동할 때도 같은 잠금을 씀. 잠겨 있으면 false
export function tossLock(ms: number = TOSS_NAV.lock) {
  const now = performance.now();
  if (now < lockedUntil) return false;
  lockedUntil = now + ms;
  return true;
}

export interface TossGoOptions extends Pick<NavigateOptions, "replace"> {
  state?: Record<string, unknown>; // tossAnim · tossExit 등 (깊이는 알아서 붙음)
  anim?: TossAnimState; // = state.tossAnim
  delay?: number; // 손 뗀 뒤 이동까지 ms (기본 TOSS_NAV.tapDelay 120)
  lock?: number; // 이동 뒤 다음 이동을 받지 않는 ms (기본 TOSS_NAV.lock 450 — 전환 없는 탭 사이 등은 짧게)
}

// navigate 대신 (kbank useKbankGo 를 옮겨 온 것): 같은 곳을 빠르게 두 번 눌러 같은 화면이 두 칸 쌓이는 것을 막음
//  - 맨 위 층이 아닌 화면(전환 중 나가는 층)에서 온 이동은 버림
//  - 한 번 이동하면 450ms 동안 다음 이동을 받지 않음
//  - 손 뗀 뒤 120ms 에 이동 (그 사이 누름 표시가 170ms 동안 사라짐). 그 사이 뒤로 갔으면(지금 칸이 바뀜) 가지 않음
// 돌려준 값: 이동을 받았으면 true
export function useTossGo() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = useLayerActive();
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  return useCallback(
    (to: string | number, o: TossGoOptions = {}) => {
      if (!active) return false;
      const delay = o.delay ?? TOSS_NAV.tapDelay;
      if (!tossLock((o.lock ?? TOSS_NAV.lock) + delay)) return false;
      const at = hereKey();
      const run = () => {
        if (!activeRef.current || hereKey() !== at) return;
        if (typeof to === "number") navigate(to);
        else navigate(to, { replace: o.replace, state: carryDepth(location.state, o.replace, { ...o.state, ...(o.anim && { tossAnim: o.anim }) }) });
      };
      if (delay > 0) window.setTimeout(run, delay);
      else run();
      return true;
    },
    [navigate, location.state, active],
  );
}

// 머리줄 ← (와 갤럭시 뒤로): 방문 기록이 있으면 뒤로, 주소로 바로 열었으면 fallback 으로 (앱 밖으로 나가지 않게). 이동 잠금 같이
export function useTossBack(fallback = "/") {
  const navigate = useNavigate();
  const active = useLayerActive();
  return useCallback(() => {
    if (!active || !tossLock()) return;
    if (historyIdx() > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback, active]);
}

// 흐름 나가기: depth 칸을 한 번에 뒤로 (이체 완료 → 처음 화면, 증명서 확인 → 상세). 방문 기록이 모자라면 fallback 으로 바꿈
export function useTossExit() {
  const navigate = useNavigate();
  return useCallback(
    (depth: number, fallback = "/") => {
      if (!tossLock()) return;
      if (depth > 0 && historyIdx() >= depth) window.history.go(-depth);
      else navigate(fallback, { replace: true });
    },
    [navigate],
  );
}

// ---------- 화면 안 뒤로가기 (시트 · 안내창 · 키보드) ----------
// 갤럭시 뒤로(= 브라우저 뒤로)를 화면 안에서 받기: active 인 동안 방문 기록 한 칸(주소 · 라우터 상태 그대로 + tossBack 깊이)을 쌓아 두고,
// 뒤로가기로 그 칸이 빠지면 onBack. 다른 이유로 끝나면(active=false) 쌓아 둔 칸을 걷어 냄. 여럿이 겹치면 나중 것부터 (kbank sendback.ts 를 옮겨 온 것)
export const tossBackLevel = () => (window.history.state as { tossBack?: number } | null)?.tossBack ?? 0;

export function useTossBackStep(active: boolean, onBack: () => void, key?: unknown) {
  const ref = useRef(onBack);
  useEffect(() => {
    ref.current = onBack;
  });
  const depth = useRef(0);
  useEffect(() => {
    if (!active) return;
    const onPop = () => {
      if (!depth.current || tossBackLevel() >= depth.current) return; // 더 위에 쌓인 다른 칸이 빠진 것
      depth.current = 0;
      ref.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (depth.current && tossBackLevel() === depth.current) window.history.back();
      depth.current = 0;
    };
  }, [active]);
  // 한 박자 늦게 쌓기: 개발 모드(StrictMode)가 effect 를 두 번 돌려도 한 칸만
  useEffect(() => {
    if (!active || depth.current) return;
    const t = window.setTimeout(() => {
      if (depth.current) return;
      depth.current = tossBackLevel() + 1;
      window.history.pushState({ ...window.history.state, tossBack: depth.current }, "");
    });
    return () => window.clearTimeout(t);
  }, [active, key]);
}
