// NH올원뱅크 이 브라우저 · 프로필별 화면 설정 (localStorage, kbank prefs.ts 와 같은 방법). 저장이 막힌 브라우저면 기본값으로 동작 (이번 실행만 기억).
// 서버로 보내지 않는 보기 설정만 — 간편비밀번호 · 계좌 비밀번호는 절대 여기(어디에도) 저장하지 않음
//  정기점검 '1일동안 안보기' · 홈 잔액 숨김(계좌별) · 최근 이용메뉴(전체메뉴, 최근 3개) · 통합검색 자동완성 · 거래내역 잔액 숨기기 · 큰글
import { useSyncExternalStore } from "react";
import { currentProfileId } from "../profile/session";

const DAY = 86_400_000;
const key = (k: string) => `ao-${k}-${currentProfileId() ?? "none"}`;
const memory = new Map<string, string | null>(); // 저장이 막혔을 때 이번 실행만
const listeners = new Set<() => void>();
let version = 0;

function read(k: string): string | null {
  const full = key(k);
  try {
    return localStorage.getItem(full);
  } catch {
    return memory.get(full) ?? null;
  }
}
function write(k: string, v: string | null) {
  const full = key(k);
  try {
    if (v == null) localStorage.removeItem(full);
    else localStorage.setItem(full, v);
  } catch {
    memory.set(full, v);
  }
  version++;
  listeners.forEach((fn) => fn());
}
function readJson<T>(k: string, fallback: T): T {
  try {
    const v = read(k);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

// 설정이 바뀌면 다시 그림: const hidden = useAoPrefs(aoPrefs.hiddenBalances)
const subscribe = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));
const getVersion = () => version;
export function useAoPrefs<T>(get: () => T): T {
  useSyncExternalStore(subscribe, getVersion); // 설정이 바뀌면 다시 그림
  return get();
}

// 최근 이용메뉴 기본값 (전체메뉴, plan.md §1.7): 거래내역조회 · 계좌이체 · 잔액채우기
export const AO_RECENT_MENUS_DEFAULT = ["history", "send", "topup"];

export const aoPrefs = {
  // 정기점검 안내 '1일동안 안보기' (보는 사람마다, 🔔 에서 지우기)
  noticeSnoozedUntil: () => Number(read("notice-snooze")) || 0,
  isNoticeSnoozed: () => (Number(read("notice-snooze")) || 0) > Date.now(),
  snoozeNotice: (days = 1) => write("notice-snooze", String(Date.now() + days * DAY)),
  clearNoticeSnooze: () => write("notice-snooze", null),

  // 홈 카드 잔액 숨김 (계좌 id 목록)
  hiddenBalances: () => readJson<string[]>("hidden-balances", []),
  isBalanceHidden: (accountId: string) => readJson<string[]>("hidden-balances", []).includes(accountId),
  setBalanceHidden: (accountId: string, hidden: boolean) => {
    const list = readJson<string[]>("hidden-balances", []).filter((id) => id !== accountId);
    write("hidden-balances", JSON.stringify(hidden ? [...list, accountId] : list));
  },

  // 최근 이용메뉴: 만든 화면 중 마지막에 연 3개 (가장 최근이 앞)
  recentMenus: () => readJson<string[]>("recent-menus", AO_RECENT_MENUS_DEFAULT),
  pushRecentMenu: (menuKey: string) => {
    const list = readJson<string[]>("recent-menus", AO_RECENT_MENUS_DEFAULT).filter((k) => k !== menuKey);
    write("recent-menus", JSON.stringify([menuKey, ...list].slice(0, 3)));
  },

  // 통합검색 자동완성 (기본 끔 — 녹화 C3 40.546)
  autocomplete: () => read("autocomplete") === "on",
  setAutocomplete: (on: boolean) => write("autocomplete", on ? "on" : null),

  // 거래내역조회 잔액 숨기기 (행의 거래 후 잔액 줄)
  hideTxBalance: () => read("hide-tx-balance") === "on",
  setHideTxBalance: (on: boolean) => write("hide-tx-balance", on ? "on" : null),

  // 홈 머리줄 큰글 (손잡이만 움직임)
  bigText: () => read("big-text") === "on",
  setBigText: (on: boolean) => write("big-text", on ? "on" : null),
};
