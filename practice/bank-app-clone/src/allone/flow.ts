// 영역 사이 약속 (plan.md §3.5): 영역은 다른 영역의 화면을 import 하지 않고 주소와 이 함수들로만 오감.
// 모든 이동은 CUT. via = 로딩 막 프로필 (nav.ts LOAD, §1.4) — 막 동안 다음 화면 데이터를 미리 받고, cut 에 새 화면을 막 밑에 그림.
//  const f = useAoFlow()
//  f.goHistory(accountId, via = "history")            거래내역조회 /history/:id   (메뉴 · 검색에서는 "menuLink")
//  f.goTx(txId, "in" | "out")                          거래내역 상세 /tx/:id       (txIn 184 · txOut 1100, 더 어둡게)
//  f.goSend({ from, origin, via })                     누구에게 보낼까요 /send?from= (origin home → sendFromHome, history → sendFromList, menu → menuLink)
//  f.goAmount({ from, to: { bankCode, number, holder }, replace, via })
//                                                      얼마를 보낼까요 /send/amount?… — via 없음 = 바로 CUT (T1 행), "lookup" = 계좌 조회 후
//                                                      (예금주는 조회 결과로, 404 면 이동 없이 false), "resend" = 다시보내기 (replace)
//  f.goTopup({ to, from, origin })                     잔액채우기 /topup?to=&from=&origin= (origin amount → topupLink, menu · card → menuLink)
//  f.goMenu() · f.goSearch()                           전체메뉴 (menu) · 통합검색 (search)
//  f.goHome()                                          홈으로 (새로 불러오지 않음, 홈은 밑에 그대로)
//  f.goHomeFresh()                                     취소: cancelHome 막 밑에서 홈으로 + aoHomeFresh 알림 (홈이 뼈대 · 정기점검 시트를 다시)
//  f.sendFinish()                                      이체 완료 확인: finish 막 밑에서 이체 흐름 전 화면으로 (홈이면 새로 불러온 홈)
//  f.go(to, { via, prefetch, task, replace, state })   그 밖 (막 없이 = useAoGo 와 같음)
//  모두 Promise<boolean> (이동했으면 true). 맨 위가 아닌 층의 누름 · 잠금 중의 누름은 false
//  새 칸의 location.state.aoVia = 들어올 때 쓴 프로필 (화면이 막 시각표에 맞춰 할 일이 있으면: 예 T5 의 T6 +983)
//
//  useAoHomeFresh(cb)   홈이 받음: 새로 불러온 홈으로 돌아온 순간 (아직 막 밑) — 막이 걷히면(onAoLoadingHidden) 뼈대 단계 · 정기점검 시트
//  aoVisit(menuKey)     만든 화면이 열릴 때 부름 → 전체메뉴 최근 이용메뉴 (prefs.ts)
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invalidate } from "../api/client";
import { prefetch } from "../api/useApi";
import { useLayerActive } from "../platform/LayerContext";
import { aoApi, aoPaths } from "./api";
import { aoLoad } from "./loading";
import { AO_NAV_LOCK } from "./motion";
import {
  aoCarry,
  aoHistoryGo,
  aoHistoryIdx,
  aoLock,
  aoOrigin,
  aoSendDepth,
  aoUnlock,
  goHomeNow,
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
      const state = aoCarry(location.state, o.replace, { ...o.state, aoVia: o.via ?? null });
      const nav = () => navigate(typeof to === "function" ? to() : to, { replace: o.replace, state });
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
    ({ from, to, replace = false, via }: { from: string; to: AoAmountTarget; replace?: boolean; via?: AoLoadProfile }) => {
      // 이체 흐름 밖(거래내역 상세 다시보내기)에서 들어오면 여기서 흐름 시작 (돌아갈 곳 = 거래내역조회)
      const inFlow = aoSendDepth(location.state) > 0;
      const extra = inFlow ? {} : { aoSendDepth: 1, aoOrigin: "history" as AoOrigin };
      let holder = to.holder ?? "";
      const url = () => `/send/amount?${q({ from, bank: to.bankCode, number: to.number.replace(/\D/g, ""), holder })}`;
      return go(url, {
        via,
        replace,
        state: extra,
        prefetch: via ? [aoPaths.home] : undefined,
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
    const { state, pathname } = location;
    const depth = aoSendDepth(state);
    const origin = aoOrigin(state) ?? "home";
    return aoLoad("finish", {
      onCut: () => {
        invalidate(); // 홈 · 계좌 · 거래내역 · 받는 분 목록 다시 받기
        const back = depth > 0 && aoHistoryIdx() >= depth ? aoHistoryGo(-depth) : goHomeNow(navigate, state, pathname);
        void back.then(() => origin === "home" && emitHomeFresh());
      },
    });
  }, [active, navigate, location]);

  return { go, goHistory, goTx, goSend, goAmount, goTopup, goMenu, goSearch, goHome, goHomeFresh, sendFinish };
}

// 화면이 자기 location.state 에서 읽는 값
export const aoViaOf = (state: unknown): AoLoadProfile | null => {
  const v = state && typeof state === "object" ? (state as Record<string, unknown>).aoVia : null;
  return typeof v === "string" && v in LOAD ? (v as AoLoadProfile) : null;
};
