// NH올원뱅크 화면 이동 (plan.md §1.2 · §1.4 · §1.5). 화면 사이는 모두 CUT (ScreenStack 의 allone 갈래: 움직임 · 가장자리 스와이프 없음,
// 밑 화면 층은 숨긴 채 그대로 둠 — 돌아오면 스크롤 · 불러온 내용 그대로). 기다림은 로딩 막 프로필(LOAD, loading.ts)이 대신함.
//  - LOAD               §1.4 로딩 막 프로필 표 (한 곳에만)
//  - aoDepth(state)     홈에서 몇 칸 들어왔는지 (push 마다 +1, replace 는 그대로). goHome = history.go(-aoDepth)
//  - aoSendDepth(state) 이체 흐름(goSend · 다시보내기)에 들어온 뒤 쌓은 칸 수. sendFinish 가 그만큼 뒤로
//  - useAoGo()          navigate 대신: 맨 위가 아닌 층의 누름은 버리고, 한 번 이동하면 450ms 잠금. 깊이 · 이체 흐름 값은 알아서 붙임
//  - useAoBack()        ‹ · ×: 방문 기록이 있으면 뒤로, 주소로 바로 열었으면 홈으로 바꿈
//  - useAoGoHome()      홈으로 (새로 불러오지 않음): 깊이만큼 뒤로, 깊이를 모르면 "/" 로 바꿈
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayerActive } from "../platform/LayerContext";
import { AO_NAV_LOCK } from "./motion";

// ---------- 로딩 막 프로필 (ms, 손을 뗀 때부터) ----------
// dimOn: 막 + 스피너가 켜지는 때 · cut: 새 화면을 막 밑에 그리는 때 · off: 막이 걷히는 때 · spinnerOff: 스피너가 꺼지는 때 (없으면 off − 33)
// 기다림은 늘 max(api, 시간): 막 동안 받는 데이터가 늦으면 cut 부터 그만큼 뒤로 밀림 (loading.ts)
export type AoLoadProfile =
  | "login"
  | "history"
  | "txIn"
  | "txOut"
  | "sendFromList"
  | "sendFromHome"
  | "lookup"
  | "password"
  | "send"
  | "topupLink"
  | "topupRow"
  | "topupSubmit"
  | "cancelHome"
  | "finish"
  | "menu"
  | "search"
  | "menuLink"
  | "resend"
  | "acctFilter";

export interface AoLoadSpec {
  dimOn: number;
  cut: number;
  off: number;
  spinnerOff?: number;
  // 스피너만 먼저 (막 없이) 이 시각까지, 그다음 막 (전체메뉴 ≡)
  spinnerOnlyUntil?: number;
  // 막이 from 부터 ms 동안 서서히 (통합검색: 더 어두운 단계까지)
  dimFade?: { from: number; ms: number; deep: boolean };
  // 검정 .22 한 겹을 from 부터 ms 동안 ease-out 으로 더 깜. resetAtCut: cut 에서 한 프레임에 기본 막으로 (잔액채우기 링크)
  deepen?: { from: number; ms: number; resetAtCut?: boolean };
  // 돈이 오가는 막 (보내기 · 잔액채우기): 막 동안 브라우저 뒤로를 무시 — 막 · 할 일 · cut 은 그대로 돌고, 결과(이체 완료 · 토스트)는 도착한 칸에서 (loading.ts)
  commit?: boolean;
}

export const LOAD: Record<AoLoadProfile, AoLoadSpec> = {
  // 6번째 PIN 숫자 → 67ms 뒤 막 (키패드는 그 프레임에 사라짐), 홈은 2033 에 막 밑에, 스피너 2183 · 막 2233 에 걷힘 (C1 9.850–12.150)
  login: { dimOn: 67, cut: 2033, off: 2233, spinnerOff: 2183 },
  history: { dimOn: 0, cut: 967, off: 1000 }, // 홈 카드 거래내역 (C2 8.991–9.991)
  txIn: { dimOn: 0, cut: 167, off: 184, deepen: { from: 17, ms: 280 } }, // 거래 행 (입금) C2 14.274–14.458
  txOut: { dimOn: 0, cut: 1083, off: 1100, deepen: { from: 17, ms: 280 } }, // 거래 행 (출금) C2 16.558–17.658
  sendFromList: { dimOn: 0, cut: 717, off: 1050 }, // 거래내역조회 이체 C2 20.091–21.141
  sendFromHome: { dimOn: 0, cut: 284, off: 417 }, // 홈 카드 이체 C3 26.146–26.563
  lookup: { dimOn: 0, cut: 384, off: 417 }, // T1 다음 (invented) — 404 면 cut 없이 걷힘
  password: { dimOn: 0, cut: 450, off: 483 }, // 4번째 계좌 비밀번호 숫자 +50 → 이체 확인 C3 32.729–33.213
  send: { dimOn: 0, cut: 967, off: 1000, commit: true }, // 이체 확인 보내기 (invented) — POST /api/transfers
  // T2 잔액채우기 링크: 바로 .22 더 어둡게 300ms, cut 에서 기본 막으로, T6 은 +983 부터 막 밑에서 올라옴 (영역이 marks 로), 1433 에 막 · 스피너 걷힘
  topupLink: { dimOn: 0, cut: 367, off: 1433, deepen: { from: 0, ms: 300, resetAtCut: true } },
  topupRow: { dimOn: 0, cut: 284, off: 384 }, // T6 행 → T5 계좌 표시, 막이 걷힌 프레임에 T7 네이티브 막 (C3 5.179–5.643)
  topupSubmit: { dimOn: 0, cut: 534, off: 567, commit: true }, // 잔액채우기 버튼 (C3 12.029–12.146 + invented 끝)
  cancelHome: { dimOn: 0, cut: 383, off: 650, spinnerOff: 517 }, // 취소 → 새로 불러온 홈 (C3 21.596–22.246)
  finish: { dimOn: 0, cut: 383, off: 650, spinnerOff: 517 }, // 이체 완료 확인 (invented, cancelHome 과 같음)
  menu: { dimOn: 0, cut: 317, off: 367, spinnerOnlyUntil: 317 }, // 홈 ≡ (C3 38.629–38.996)
  search: { dimOn: 0, cut: 167, off: 167, dimFade: { from: 33, ms: 120, deep: true } }, // 전체메뉴 검색 줄 (C3 39.813–39.979)
  menuLink: { dimOn: 0, cut: 267, off: 300 }, // 메뉴 · 검색 결과 링크, 다른금융 잔액채우기 (invented)
  resend: { dimOn: 0, cut: 967, off: 1000 }, // 거래내역 상세 다시보내기 (invented, replace)
  // 거래내역조회 조회 조건 적용 (invented, account.md §5.2 의 600ms): 줄은 567 에 막 밑에서 바뀌고 스피너 567 · 막 600 에 걷힘. 화면이 바뀌지 않음
  acctFilter: { dimOn: 0, cut: 567, off: 600 },
};

// ---------- location.state ----------
export type AoOrigin = "home" | "history" | "menu";
export interface AoNavState {
  aoDepth?: number;
  aoSendDepth?: number;
  aoOrigin?: AoOrigin;
  [k: string]: unknown;
}
const st = (s: unknown) => (s && typeof s === "object" ? (s as Record<string, unknown>) : null);
const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : 0);
export const aoDepth = (state: unknown) => num(st(state)?.aoDepth);
export const aoSendDepth = (state: unknown) => num(st(state)?.aoSendDepth);
export const aoOrigin = (state: unknown): AoOrigin | null => {
  const o = st(state)?.aoOrigin;
  return o === "home" || o === "history" || o === "menu" ? o : null;
};

// 다음 칸의 state: 깊이 +1 (replace 는 그대로), 이체 흐름 안이면 흐름 깊이 +1 과 시작한 곳(aoOrigin)을 이어 받음. extra 가 위에 덮음
export function aoCarry(from: unknown, replace: boolean | undefined, extra?: Record<string, unknown>): AoNavState {
  const d = aoDepth(from);
  const s = aoSendDepth(from);
  const o = aoOrigin(from);
  return {
    aoDepth: replace ? d : d + 1,
    ...(s > 0 && { aoSendDepth: replace ? s : s + 1 }),
    ...(s > 0 && o && { aoOrigin: o }),
    ...extra,
  };
}

// ---------- 방문 기록 ----------
export const aoHereKey = () => (window.history.state as { key?: string } | null)?.key;
export const aoHistoryIdx = () => (window.history.state as { idx?: number } | null)?.idx ?? 0;
// 지금 칸의 location.state (react-router 가 history.state.usr 에 둠) — 화면이 사라진 뒤에도 지금 칸을 알아야 할 때 (flow.ts)
export const aoHereState = (): unknown => (window.history.state as { usr?: unknown } | null)?.usr;
// 이 문서(페이지를 연 · 새로고침한 때)의 첫 칸. 그보다 앞 칸은 새로고침 전 문서라 history.go 로 가면 페이지를 다시 엶 (읽기만 함)
const firstIdx = aoHistoryIdx();
// 앱의 첫 칸으로 돌아감 (녹화 다시 시작: App.tsx). 그 위 칸들은 앞으로 가기 칸이 되어 다음 이동에 버려짐
export const aoHistoryGoFirst = () => aoHistoryGo(-Math.max(0, aoHistoryIdx() - firstIdx));
// history.go(delta) 하고 도착(popstate)까지 기다림. 범위 밖이라 popstate 가 안 오면 300ms 뒤 끝
export function aoHistoryGo(delta: number) {
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

// ---------- 뒤로(popstate)를 react-router 보다 먼저 받기 ----------
// 막 · 잠금(loading.ts)과 이체 완료 지킴이(flow.ts)는 도착한 화면이 그려지기 전에 알아야 함: React 19 는 popstate 안에서 화면 바꿈을 바로 그려서
// (그 사이 밑 화면의 useAoReturn 이 돎) react-router 뒤에 붙인 window 수신은 그 뒤에야 불리고, 그새 사라진 화면이 붙인 수신은 아예 안 불림.
// 그래서 수신 하나를 AlloneOverlay 가 앱이 켜질 때 붙임 (자식의 useLayoutEffect 라 BrowserRouter 의 history.listen 보다 먼저) — 여기에 등록한 것은 그 순서로 불림
const popFirst = new Set<() => void>();
export function onAoPopFirst(cb: () => void) {
  popFirst.add(cb);
  return () => void popFirst.delete(cb);
}
export function aoListenPopFirst() {
  const fn = () => {
    for (const cb of [...popFirst]) if (popFirst.has(cb)) cb(); // 도중에 빠진 것은 부르지 않음 (DOM 수신과 같게)
  };
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
}

// ---------- 이동 잠금 ----------
let lockedUntil = 0;
// 다른 곳(flow.ts)이 직접 이동할 때도 같은 잠금. 잠겨 있으면 false
export function aoLock(ms: number = AO_NAV_LOCK) {
  const now = performance.now();
  if (now < lockedUntil) return false;
  lockedUntil = now + ms;
  return true;
}
// 지금 잠겨 있는지 (잠그지 않고 보기만)
export const aoLocked = () => performance.now() < lockedUntil;
// 잠금을 풂 (이동이 취소됐을 때: 404 조회 등)
export const aoUnlock = () => void (lockedUntil = 0);

export interface AoGoOptions {
  replace?: boolean;
  state?: Record<string, unknown>; // 깊이 · 이체 흐름 값은 알아서 붙음
  lock?: number; // 기본 450ms
}

// navigate 대신 (kakao2 useK2Once · kbank useKbankGo 와 같은 생각): 손을 떼면 바로 이동 (로딩이 필요하면 flow.ts 의 go 를 씀)
//  - 맨 위가 아닌 층(숨겨진 밑 화면)에서 온 누름은 버림
//  - 한 번 이동하면 450ms 동안 다음 이동을 받지 않음
// 돌려준 값: 이동했으면 true
export function useAoGo() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = useLayerActive();
  return useCallback(
    (to: string | number, o: AoGoOptions = {}) => {
      if (!active || !aoLock(o.lock)) return false;
      if (typeof to === "number") navigate(to);
      else navigate(to, { replace: o.replace, state: aoCarry(location.state, o.replace, o.state) });
      return true;
    },
    [navigate, location.state, active],
  );
}

// ‹ · × (와 브라우저 뒤로 대신): 방문 기록이 있으면 뒤로, 주소로 바로 열었으면(첫 칸) 앱 밖으로 나가지 않고 fallback 으로 바꿈
export function useAoBack(fallback = "/") {
  const navigate = useNavigate();
  const active = useLayerActive();
  return useCallback(() => {
    if (!active || !aoLock()) return false;
    if (aoHistoryIdx() > 0) navigate(-1);
    else navigate(fallback, { replace: true });
    return true;
  }, [navigate, fallback, active]);
}

// 홈으로 (새로 불러오지 않음 — 홈은 밑에 그대로 있음): 깊이만큼 한 번에 뒤로. 깊이를 모르면(주소로 바로 열었음) "/" 로 바꿈
export function useAoGoHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = useLayerActive();
  return useCallback(() => {
    if (!active || !aoLock()) return false;
    goHomeNow(navigate, location.state, location.pathname);
    return true;
  }, [navigate, location.state, location.pathname, active]);
}
// 잠금 · 층 확인 없이 (flow.ts 가 로딩 막 밑에서 부름). 도착하면 끝나는 Promise
export function goHomeNow(navigate: ReturnType<typeof useNavigate>, state: unknown, pathname: string): Promise<void> {
  const d = aoDepth(state);
  if (pathname === "/" && d === 0) return Promise.resolve();
  if (d > 0 && aoHistoryIdx() >= d) return aoHistoryGo(-d);
  navigate("/", { replace: true });
  return Promise.resolve();
}

// 화면이 다시 맨 위가 된 순간 (밑에 숨어 있다가 돌아옴) 한 번 부름 — 처음 그릴 때는 부르지 않음
export function useAoReturn(fn: () => void) {
  const active = useLayerActive();
  const was = useRef(active);
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (active && !was.current) ref.current();
    was.current = active;
  }, [active]);
}
