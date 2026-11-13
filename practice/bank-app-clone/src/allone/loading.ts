// NH올원뱅크 웹 로딩 막 + 초록 all one 스피너 — 주인은 여기 하나 (그리는 곳은 ui/Loading.tsx, AlloneOverlay 안 z 51).
// 막 rgba(55,55,55,.68) 은 웹뷰(59–818)만 덮고 한 프레임에 켜지고 꺼짐. 스피너는 화면 가운데 (196.5, 425.8), 켜질 때마다 동전 앞면부터.
//
//  aoLoad(profile, { task, onShow, onCut, onHidden, onError, marks })   plan.md §1.4 의 한 줄을 그대로 돌림 (표는 nav.ts LOAD)
//    - 손 뗀 때 = 부른 때. dimOn 에 막 + 스피너 (0 이면 이 프레임), onShow
//    - task (Promise 또는 Promise 를 주는 함수): 막 동안 받을 데이터. 기다림 = max(task, cut) — 늦으면 cut · off 가 같이 밀림
//    - cut 에 onCut (새 화면을 막 밑에 그림). task 가 실패하면 cut 없이 onError, 막은 같은 시각에 걷힘
//    - 스피너는 spinnerOff(없으면 off − 33)에, 막은 off 에 걷힘 → onHidden (그 프레임에 — T7 막을 같은 프레임에 켜려면 여기서)
//    - deepen: 검정 .22 한 겹을 더 깜 (거래 상세 · 잔액채우기 링크). menu: 스피너만 먼저. search: 막이 120ms 동안 서서히
//    - marks: [{ at, run }] 표 시각에 맞춰 더 할 일 (cut 뒤 시각은 cut 이 밀린 만큼 같이 밀림). 예: 잔액채우기 링크 T6 +983
//    - 막 동안 브라우저 뒤로(popstate)로 화면이 바뀌면 cut 하지 않고 막을 바로 걷음 (false)
//    돌려준 Promise: 막이 걷힐 때 cut 했으면 true
//  showAoLoading({ spinner, dim, deep }) 표에 없는 경우 직접 켬 → 돌려준 hide() 로 끔 (스피너 먼저, 33ms 뒤 막)
//  cutAoLoading()        바로 다 걷음 (녹화 다시 시작 · 로그아웃 · 뒤로) — 숨김 알림(onAoLoadingHidden)은 안 보냄
//  useAoLoadingVisible() 막이나 스피너가 떠 있는지 · isAoLoadingUp()
//  onAoLoadingHidden(cb) 막이 다 걷힐 때마다 cb({ profile, at }) (정기점검 시트 +583ms 등). 돌려준 함수로 그만 받음
import { useSyncExternalStore } from "react";
import { AO_DIM } from "./motion";
import { aoHereKey, LOAD, type AoLoadProfile } from "./nav";

export interface AoLoadingState {
  onset: number; // 스피너가 켜질 때마다 새 번호 (AoSpinner key → 앞면부터)
  profile: AoLoadProfile | null; // null = showAoLoading
  spinner: boolean;
  dim: boolean;
  fadeMs: number; // 0 = 한 프레임에, > 0 = 막(과 더 어두운 겹)이 이만큼 서서히
  deep: { key: number; ms: number } | null; // 검정 .22 겹 (ms 동안 ease-out 으로 나타남, 0 = 바로)
}

let state: AoLoadingState | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const set = (next: AoLoadingState | null) => {
  state = next;
  listeners.forEach((fn) => fn());
};
const patch = (p: Partial<AoLoadingState>) => state && set({ ...state, ...p });

export interface AoHiddenInfo {
  profile: AoLoadProfile | null;
  at: number; // performance.now
}
const hiddenListeners = new Set<(info: AoHiddenInfo) => void>();
let lastHidden: AoHiddenInfo | null = null;
export function onAoLoadingHidden(cb: (info: AoHiddenInfo) => void) {
  hiddenListeners.add(cb);
  return () => void hiddenListeners.delete(cb);
}
export const lastAoLoadingHidden = () => lastHidden;
function hideAll(profile: AoLoadProfile | null) {
  set(null);
  lastHidden = { profile, at: performance.now() };
  const info = lastHidden;
  hiddenListeners.forEach((fn) => fn(info));
}

// 지금 도는 것 (새로 켜면 이전 것의 타이머는 멈추고 false 로 끝남)
let current: { id: number; stop: () => void } | null = null;
function stopCurrent() {
  const c = current;
  current = null;
  c?.stop();
}

export interface AoLoadOptions {
  task?: Promise<unknown> | (() => Promise<unknown>);
  onShow?: () => void;
  onCut?: () => void;
  onHidden?: () => void;
  onError?: (error: unknown) => void;
  marks?: { at: number; run: () => void }[];
}

export function aoLoad(profile: AoLoadProfile, o: AoLoadOptions = {}): Promise<boolean> {
  stopCurrent();
  const spec = LOAD[profile];
  const id = ++seq;
  const t0 = performance.now();
  const spinnerOff = spec.spinnerOff ?? spec.off - AO_DIM.spinnerLead;
  const timers: number[] = [];
  const elapsed = () => performance.now() - t0;
  const at = (ms: number, fn: () => void) => {
    const wait = ms - elapsed();
    if (wait <= 0) fn();
    else timers.push(window.setTimeout(fn, wait));
  };

  return new Promise<boolean>((resolve) => {
    let finished = false;
    let cutDone = false;
    let failed = false;
    let error: unknown;
    let settled = !o.task;
    let reachedCut = false;
    const here = aoHereKey();

    const stop = () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("popstate", onPop);
      if (!finished) {
        finished = true;
        resolve(false);
      }
    };
    current = { id, stop };
    const live = () => current?.id === id;
    // 막 동안 뒤로: cut 전이면 막을 바로 걷고 끝
    const onPop = () => {
      if (!live() || cutDone || aoHereKey() === here) return;
      stopCurrent();
      if (state) set(null);
    };
    window.addEventListener("popstate", onPop);

    // ---- 켜기 ----
    const show = () => {
      if (!live()) return;
      const fade = spec.dimFade;
      set({
        onset: id,
        profile,
        spinner: true,
        dim: !spec.spinnerOnlyUntil && !fade,
        fadeMs: 0,
        deep: spec.deepen && spec.deepen.from <= 0 ? { key: ++seq, ms: spec.deepen.ms } : null,
      });
      o.onShow?.();
      if (spec.spinnerOnlyUntil) at(spec.spinnerOnlyUntil, () => live() && patch({ dim: true }));
      if (fade) at(fade.from, () => live() && patch({ dim: true, fadeMs: fade.ms, deep: fade.deep ? { key: ++seq, ms: 0 } : state?.deep ?? null }));
      if (spec.deepen && spec.deepen.from > 0) {
        const d = spec.deepen;
        at(d.from, () => live() && !(d.resetAtCut && reachedCut) && patch({ deep: { key: ++seq, ms: d.ms } }));
      }
    };
    at(spec.dimOn, show);

    // ---- 받을 데이터 ----
    if (o.task) {
      const p = typeof o.task === "function" ? o.task() : o.task;
      p.then(
        () => {
          settled = true;
          if (reachedCut) doCut();
        },
        (e) => {
          settled = true;
          failed = true;
          error = e;
          if (reachedCut) doCut();
        },
      );
    }

    // 스피너가 cut 보다 먼저 꺼지는 프로필 (txIn 151 < 167): 그때 데이터가 이미 왔으면 그 시각에, 아니면 cut 에
    if (spinnerOff < spec.cut) at(spinnerOff, () => live() && settled && patch({ spinner: false }));

    // marks: cut 앞 시각은 그대로
    for (const m of o.marks ?? []) if (m.at <= spec.cut) at(m.at, () => live() && m.run());

    // ---- cut ----
    at(spec.cut, () => {
      if (!live()) return;
      reachedCut = true;
      if (settled) doCut();
    });
    function doCut() {
      if (!live() || cutDone) return;
      cutDone = true;
      window.removeEventListener("popstate", onPop);
      const delay = Math.max(0, elapsed() - spec.cut); // 데이터가 늦은 만큼 뒤 시각을 밀어 줌
      const after = (ms: number, fn: () => void) => at(ms + delay, fn);
      if (spec.deepen?.resetAtCut && state?.deep) patch({ deep: null });
      if (spec.spinnerOnlyUntil && state && !state.dim) patch({ dim: true });
      if (failed) o.onError?.(error);
      else o.onCut?.();
      if (spinnerOff < spec.cut) {
        if (state?.spinner) patch({ spinner: false });
      } else after(spinnerOff, () => live() && patch({ spinner: false }));
      for (const m of o.marks ?? []) if (m.at > spec.cut) after(m.at, () => live() && m.run());
      after(spec.off, () => {
        if (!live()) return;
        current = null;
        finished = true;
        hideAll(profile);
        o.onHidden?.();
        resolve(!failed);
      });
    }
  });
}

// 표에 없는 경우: 직접 켜고 돌려준 hide() 로 끔 (스피너 먼저, spinnerLead 뒤 막). 다른 aoLoad 가 켜지면 이것은 그대로 덮임
export function showAoLoading({ spinner = true, dim = true, deep = null }: { spinner?: boolean; dim?: boolean; deep?: number | null } = {}) {
  stopCurrent();
  const id = ++seq;
  let timer = 0;
  current = {
    id,
    stop: () => window.clearTimeout(timer),
  };
  set({ onset: id, profile: null, spinner, dim, fadeMs: 0, deep: deep === null ? null : { key: ++seq, ms: deep } });
  return ({ spinnerLead = AO_DIM.spinnerLead }: { spinnerLead?: number } = {}) => {
    if (current?.id !== id) return;
    const end = () => {
      if (current?.id !== id) return;
      current = null;
      hideAll(null);
    };
    if (spinnerLead > 0 && state?.spinner) {
      patch({ spinner: false });
      timer = window.setTimeout(end, spinnerLead);
    } else end();
  };
}

export function cutAoLoading() {
  stopCurrent();
  if (state) set(null);
}

const subscribe = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));
export const useAoLoading = () => useSyncExternalStore(subscribe, () => state);
export const useAoLoadingVisible = () => useSyncExternalStore(subscribe, () => state !== null);
export const isAoLoadingUp = () => state !== null;
