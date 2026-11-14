// 영역 사이 약속 (plan.md §3.5): 영역은 다른 영역의 화면을 import 하지 않고 주소와 이 함수들로만 오감.
// 모든 이동은 CUT. via = 로딩 막 프로필 (nav.ts LOAD, §1.4) — 막 동안 다음 화면 데이터를 미리 받고, cut 에 새 화면을 막 밑에 그림.
//  const f = useAoFlow()
//  f.goHistory(accountId, via = "history")            거래내역조회 /history/:id   (메뉴 · 검색에서는 "menuLink")
//  f.goTx(txId, "in" | "out")                          거래내역 상세 /tx/:id       (txIn 184 · txOut 1100, 더 어둡게)
//  f.goSend({ from, origin, via })                     누구에게 보낼까요 /send?from= (origin home → sendFromHome, history → sendFromList, menu → menuLink)
//  f.goAmount({ from, to: { bankCode, number, holder }, replace, via, onError })
//                                                      얼마를 보낼까요 /send/amount?… — via 없음 = 바로 CUT (T1 행), "lookup" = 계좌 조회 후
//                                                      (예금주는 조회 결과로, 404 면 이동 없이 false + onError — 잠금 · 맨 위 아님의 false 와 구별),
//                                                      "resend" = 다시보내기 (replace). 막이 있으면 홈 · 은행 목록을 막 동안 받아 둠
//  f.goTopup({ to, from, origin })                     잔액채우기 /topup?to=&from=&origin= (origin amount → topupLink, menu · card → menuLink)
//  f.goMenu() · f.goSearch()                           전체메뉴 (menu) · 통합검색 (search)
//  f.goBlockNotice(accountId)                          지급정지 안내 + 이의제기 /account/:id/notice (invented, 녹화에 없음)
//  f.goHome()                                          홈으로 (새로 불러오지 않음, 홈은 밑에 그대로)
//  f.goHomeFresh()                                     취소: cancelHome 막 밑에서 홈으로 + aoHomeFresh 알림 (홈이 뼈대 · 정기점검 시트를 다시)
//  f.sendFinish()                                      이체 완료 확인: finish 막 밑에서 이체 흐름 전 화면으로 (홈이면 새로 불러온 홈)
//  f.go(to, { via, prefetch, task, replace, state })   그 밖 (막 없이 = useAoGo 와 같음)
//  모두 Promise<boolean> (이동했으면 true). 맨 위가 아닌 층의 누름 · 잠금 중의 누름은 바로 false (막을 띄우지 않음)
//  f.canGo()                                           지금 이동을 받을지 (맨 위 층 · 잠금 아님) — 이동 전에 네이티브 판을 먼저 움직이는 화면이 미리 확인
//  새 칸의 location.state.aoVia = 들어올 때 쓴 프로필 (화면이 막 시각표에 맞춰 할 일이 있으면: 예 T5 의 T6 +983)
//
//  useAoHomeFresh(cb)   홈이 받음: 새로 불러온 홈으로 돌아온 순간 (아직 막 밑) — 막이 걷히면(onAoLoadingHidden) 뼈대 단계 · 정기점검 시트
//  aoVisit(menuKey)     만든 화면이 열릴 때 부름 → 전체메뉴 최근 이용메뉴 (prefs.ts)
//  useAoDoneBack()      이체 완료가 부름: 이 칸을 떠나는 브라우저 뒤로 = 확인 (도착한 칸에서 finish 막 → 흐름 전 화면). 보낸 이체를 T2 에서 또 보내지 않게
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { invalidate } from "../api/client";
import { prefetch } from "../api/useApi";
import { useLayerActive } from "../platform/LayerContext";
import { aoApi, aoPaths } from "./api";
import { aoLoad } from "./loading";
import { AO_NAV_LOCK } from "./motion";
import { onAoNativeReset } from "./native";
import {
  aoCarry,
  aoHereKey,
  aoHereState,
  aoHistoryGo,
  aoHistoryIdx,
  aoLock,
  aoLocked,
  aoOrigin,
  aoSendDepth,
  aoUnlock,
  goHomeNow,
  onAoPopFirst,
  LOAD,
  type AoLoadProfile,
  type AoOrigin,
} from "./nav";
import { aoPrefs } from "./prefs";

// ---------- 새로 불러온 홈 알림 ----------
const freshListeners = new Set<() => void>();
const emitHomeFresh = () => freshListeners.forEach((fn) => fn());
export function useAoHomeFresh(cb: () => void) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  useEffect(() => {
    const fn = () => ref.current();
    freshListeners.add(fn);
    return () => void freshListeners.delete(fn);
  }, []);
}

export const aoVisit = (menuKey: string) => aoPrefs.pushRecentMenu(menuKey);

// ---------- 이체 완료 확인 (finish 막 → 이체 흐름 전 화면) ----------
// state · pathname = 출발한 칸 (확인 = 이체 완료 칸, 완료에서 뒤로 = 도착한 칸). 흐름 깊이만큼 뒤로 (홈이면 새로 불러온 홈, 거래내역조회면 목록을 다시 받아 새 올원이체가 맨 위)
function runFinish(navigate: NavigateFunction, state: unknown, pathname: string) {
  const depth = aoSendDepth(state);
  const origin = aoOrigin(state) ?? "home";
  return aoLoad("finish", {
    onCut: () => {
      stopDoneWatch(); // 아래 뒤로는 확인이 하는 것 — 완료 칸 지킴이가 또 받지 않게
      invalidate(); // 홈 · 계좌 · 거래내역 · 받는 분 목록 다시 받기
      const back = depth > 0 && aoHistoryIdx() >= depth ? aoHistoryGo(-depth) : goHomeNow(navigate, state, pathname);
      void back.then(() => origin === "home" && emitHomeFresh());
    },
  });
}

// 이체 완료 칸 지킴이: 그 칸을 떠나는 뒤로(브라우저 · 확인 막 도중 포함)는 확인과 같게. 화면이 아니라 여기(모듈)에 두어 완료 화면이 사라지는 뒤로도 받음.
// 확인의 finish 가 cut 에서 끄고, 녹화 다시 시작 · 로그아웃(onAoNativeReset) · 완료 화면이 없어질 때도 끔
let doneWatch: (() => void) | null = null;
function stopDoneWatch() {
  const stop = doneWatch;
  doneWatch = null;
  stop?.();
}
export function useAoDoneBack() {
  const navigate = useNavigate();
  useEffect(() => {
    stopDoneWatch();
    const key = aoHereKey();
    const onPop = () => {
      if (aoHereKey() === key) return;
      stopDoneWatch();
      // 확인의 finish 가 돌던 중이면 그것을 멈추고 도착한 칸에서 다시 (잠금은 이것이 이어 받음)
      aoUnlock();
      aoLock(LOAD.finish.off + 100);
      void runFinish(navigate, aoHereState(), window.location.pathname);
    };
    const offReset = onAoNativeReset(stopDoneWatch);
    // react-router 보다 먼저 받음 (nav.ts onAoPopFirst — 늦게 받으면 완료 화면이 이미 사라지며 이 수신도 떼어진 뒤)
    const offPop = onAoPopFirst(onPop);
    const stop = () => {
      offPop();
      offReset();
    };
    doneWatch = stop;
    return () => {
      if (doneWatch === stop) stopDoneWatch();
    };
  }, [navigate]);
}

export interface AoFlowGo {
  via?: AoLoadProfile;
  replace?: boolean;
  state?: Record<string, unknown>;
  prefetch?: string[]; // 막 동안 미리 받을 주소 (useApi 캐시)
  task?: () => Promise<unknown>; // 막 동안 할 일 (실패하면 이동 없이 false)
  marks?: { at: number; run: () => void }[];
  onShow?: () => void;
  onHidden?: () => void;
  onError?: (error: unknown) => void;
}

export interface AoAmountTarget {
  bankCode: string;
  number: string;
  holder?: string;
}

const q = (params: Record<string, string | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");

export function useAoFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = useLayerActive();

  const go = useCallback(
    (to: string | (() => string), o: AoFlowGo = {}): Promise<boolean> => {
      if (!active) return Promise.resolve(false);
      if (!aoLock(o.via ? LOAD[o.via].off + 100 : AO_NAV_LOCK)) return Promise.resolve(false);
      const extra = { ...o.state, aoVia: o.via ?? null };
      const state = aoCarry(location.state, o.replace, extra);
      const here = aoHereKey();
      // 돈이 오가는 막(send) 동안 브라우저 뒤로로 다른 칸에 내려왔으면: 바꿀 칸(이체 확인)은 이미 없으므로 도착한 칸 위에 새로 쌓음 —
      // 깊이 · 이체 흐름 값은 도착한 칸에서 이어 받고(확인이 흐름 전 화면으로 정확히 돌아가게), 앞으로 가기 칸(떠난 이체 확인)은 버려짐 (다시 보내기 방지)
      const nav = () => {
        const path = typeof to === "function" ? to() : to;
        if (o.replace && aoHereKey() !== here) navigate(path, { state: aoCarry(aoHereState(), false, extra) });
        else navigate(path, { replace: o.replace, state });
      };
      if (!o.via) {
        nav();
        return Promise.resolve(true);
      }
      const tasks: Promise<unknown>[] = (o.prefetch ?? []).map((p) => prefetch(p));
      if (o.task) tasks.push(o.task());
      return aoLoad(o.via, {
        task: tasks.length ? Promise.all(tasks) : undefined,
        onCut: nav,
        onShow: o.onShow,
        onHidden: o.onHidden,
        marks: o.marks,
        onError: (e) => {
          aoUnlock();
          o.onError?.(e);
        },
      });
    },
    [active, location.state, navigate],
  );

  const goHistory = useCallback(
    (accountId: string, via: AoLoadProfile = "history") =>
      go(`/history/${encodeURIComponent(accountId)}`, { via, prefetch: [aoPaths.account(accountId), aoPaths.transactions(accountId)] }),
    [go],
  );

  const goTx = useCallback(
    (txId: string, direction: "in" | "out") =>
      go(`/tx/${encodeURIComponent(txId)}`, { via: direction === "in" ? "txIn" : "txOut", prefetch: [aoPaths.transaction(txId)] }),
    [go],
  );

  const goSend = useCallback(
    ({ from = "main", origin = "home", via }: { from?: string; origin?: AoOrigin; via?: AoLoadProfile } = {}) =>
      go(`/send?${q({ from })}`, {
        via: via ?? (origin === "history" ? "sendFromList" : origin === "menu" ? "menuLink" : "sendFromHome"),
        state: { aoSendDepth: 1, aoOrigin: origin },
        prefetch: [aoPaths.recipients(from), aoPaths.home],
      }),
    [go],
  );

  const goAmount = useCallback(
    ({
      from,
      to,
      replace = false,
      via,
      onError,
    }: {
      from: string;
      to: AoAmountTarget;
      replace?: boolean;
      via?: AoLoadProfile;
      onError?: (error: unknown) => void; // 막 동안의 조회가 실패했을 때 (예: 404)
    }) => {
      // 이체 흐름 밖(거래내역 상세 다시보내기)에서 들어오면 여기서 흐름 시작 (돌아갈 곳 = 거래내역조회)
      const inFlow = aoSendDepth(location.state) > 0;
      const extra = inFlow ? {} : { aoSendDepth: 1, aoOrigin: "history" as AoOrigin };
      let holder = to.holder ?? "";
      const url = () => `/send/amount?${q({ from, bank: to.bankCode, number: to.number.replace(/\D/g, ""), holder })}`;
      return go(url, {
        via,
        replace,
        state: extra,
        // T2 가 그리는 출금계좌 줄 · 받는 분 은행 이름 (없으면 막이 걷힌 뒤 잠깐 은행 코드가 보임)
        prefetch: via ? [aoPaths.home, aoPaths.banks] : undefined,
        onError,
        task:
          via === "lookup"
            ? () =>
                aoApi.lookup(to.bankCode, to.number).then((r) => {
                  holder = r.holder;
                })
            : undefined,
      });
    },
    [go, location.state],
  );

  const goTopup = useCallback(
    ({ to = "main", from, origin }: { to?: string; from?: string; origin: "amount" | "menu" | "card" }) =>
      go(`/topup?${q({ to, from, origin })}`, {
        via: origin === "amount" ? "topupLink" : "menuLink",
        prefetch: [aoPaths.home, ...(from ? [aoPaths.transfers(from)] : [])],
      }),
    [go],
  );

  const goMenu = useCallback(() => go("/menu", { via: "menu" }), [go]);
  const goSearch = useCallback(() => go("/search", { via: "search" }), [go]);

  // 지급정지 안내 (invented): 홈 카드 · T2 출금계좌 줄 · 잔액채우기 출금계좌 줄의 "지급정지" 글자를 누르면
  const goBlockNotice = useCallback(
    (accountId: string) => go(`/account/${encodeURIComponent(accountId)}/notice`, { via: "blockNotice", prefetch: [aoPaths.account(accountId)] }),
    [go],
  );

  const goHome = useCallback(() => {
    if (!active || !aoLock()) return Promise.resolve(false);
    return goHomeNow(navigate, location.state, location.pathname).then(() => true);
  }, [active, navigate, location.state, location.pathname]);

  // 취소 (T1 · T2 · 이체 확인): 막 밑에서 홈으로 돌아가고 새로 불러온 홈 (뼈대 · 정기점검 시트는 홈이)
  const goHomeFresh = useCallback(() => {
    if (!active || !aoLock(LOAD.cancelHome.off + 100)) return Promise.resolve(false);
    const { state, pathname } = location;
    return aoLoad("cancelHome", {
      task: prefetch(aoPaths.home),
      onCut: () => void goHomeNow(navigate, state, pathname).then(emitHomeFresh),
    });
  }, [active, navigate, location]);

  // 이체 완료 확인: 흐름에 들어오기 전 화면으로 (홈이면 새로 불러온 홈, 거래내역조회면 목록을 다시 받아 새 올원이체가 맨 위)
  const sendFinish = useCallback(() => {
    if (!active || !aoLock(LOAD.finish.off + 100)) return Promise.resolve(false);
    return runFinish(navigate, location.state, location.pathname);
  }, [active, navigate, location]);

  const canGo = useCallback(() => active && !aoLocked(), [active]);

  return { go, canGo, goHistory, goTx, goSend, goAmount, goTopup, goMenu, goSearch, goBlockNotice, goHome, goHomeFresh, sendFinish };
}

// 화면이 자기 location.state 에서 읽는 값
export const aoViaOf = (state: unknown): AoLoadProfile | null => {
  const v = state && typeof state === "object" ? (state as Record<string, unknown>).aoVia : null;
  return typeof v === "string" && v in LOAD ? (v as AoLoadProfile) : null;
};
