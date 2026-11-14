// 홈 영역 공용 값 · 훅 (컴포넌트 파일은 컴포넌트만 내보내야 빠른 새로고침이 됨)
import { useEffect, useRef, useState } from "react";
import { subscribeVersion } from "../../api/client";
import { paths } from "../../api/endpoints";
import { prefetch } from "../../api/useApi";
import { useLayerActive } from "../../platform/LayerContext";
import { currentProfileId } from "../../profile/session";
import { tossAfterLock } from "../nav";

// ---------- 탭바 ----------
export type HomeTab = "home" | "benefit" | "shopping" | "stock" | "all";
// 탭 그림 가운데 (잉크 가운데: 50.0 · 120.0 · 190.4 · 260.8 · 331.2 — A 10.698)
export const TAB_CX: Record<HomeTab, number> = { home: 50.0, benefit: 120.0, shopping: 190.4, stock: 260.8, all: 331.2 };

// ---------- 시작화면 → 홈 교차 (home.md §3.1, plan.md §0.12) ----------
// App 은 시작화면(TossSplash)을 걷고 홈(ScreenStack)을 그림 → 두 화면이 같이 있지 않으므로,
// 시작화면이 끝날 때 시각을 적어 두고 홈이 처음 그려질 때 시작화면 그림을 위에 덮었다가 300ms 동안 걷음 (= 교차)
export const HOME_BOOT = {
  splash: 1200, // 시작화면 길이
  drop: 600, // 심볼이 7.2dp 내려가는 때 (시스템 → 앱 시작화면)
  fade: 300, // 교차
  pointsAt: 190, // 교차 중 '포인트' 줄이 펼쳐지기 시작 (A 10.31 − 10.118)
} as const;

let handoffAt = 0;
export const markSplashDone = () => {
  handoffAt = performance.now();
};
// 방금 시작화면에서 넘어왔는지 (읽기만 — 개발 모드가 초기값 함수를 두 번 불러도 같은 답). 홈이 그려지면 clearSplashHandoff
export const isSplashHandoff = () => handoffAt > 0 && performance.now() - handoffAt < 600;
export const clearSplashHandoff = () => {
  handoffAt = 0;
};

// ---------- 숫자 굴림을 화면이 다시 보일 때 (home.md §3.6) ----------
// ScreenStack 은 맨 위 화면만 그리므로 홈은 다른 화면에서 돌아올 때 새로 그려짐. 마지막으로 보인 값을 id 로 기억해 두고
// 처음엔 그 값을 그렸다가, 화면이 드러난 뒤(pop 의 내용 나타남 +120ms) 새 값으로 바꿈 → TossOdometer 가 바뀐 자리만 굴림.
// 처음 보는 값(앱 시작)은 굴리지 않음
const seen = new Map<string, number>();
export const HOME_ROLL_AFTER = 130;

// 홈이 안 그려져 있는 동안 데이터가 바뀌면(이체 · 관리 패널 — client invalidate) 홈 데이터를 그때 미리 받아 둠.
// 돌아와서 받기 시작하면 굴림이 응답을 기다리느라 늦음 (녹화는 pop +110ms 에 굴러감, B 149.445). 로그아웃 · 프로필 고르기 전에는 받지 않음
let mounted = 0;
let seenHome = false;
let queued = 0;
subscribeVersion(() => {
  if (!seenHome || mounted > 0 || queued) return;
  queued = window.setTimeout(() => {
    queued = 0;
    if (!mounted && currentProfileId()) void prefetch(paths.home);
  });
});
export function useHomeMounted() {
  useEffect(() => {
    mounted++;
    seenHome = true;
    return () => {
      mounted--;
    };
  }, []);
}

export function useRollValue(key: string, value: number | undefined) {
  const id = `${currentProfileId() ?? ""}:${key}`; // 프로필마다 따로 기억
  const active = useLayerActive();
  const [shown, setShown] = useState<number | undefined>(() => seen.get(id) ?? value);
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);
  useEffect(() => {
    if (value === undefined || value === shown || !active) return;
    const wait = Math.max(0, mountedAt.current + HOME_ROLL_AFTER - performance.now());
    const t = window.setTimeout(() => setShown(value), wait);
    return () => window.clearTimeout(t);
  }, [value, shown, active]);
  useEffect(() => {
    if (shown !== undefined) seen.set(id, shown);
  }, [id, shown]);
  return shown;
}

// ---------- 갤럭시 뒤로 받기 (광고 화면) ----------
// 이 화면이 맨 위인 동안 방문 기록 한 칸(tossBack 1)을 쌓아 두고, 뒤로가기로 그 칸이 빠지면 onBack (= 닫기).
// leave(fn): 버튼으로 닫을 때 — 쌓아 둔 칸을 먼저 걷고(popstate 를 기다림) fn. 안 그러면 history.go(-sendDepth) 가 한 칸 모자람
const backLevel = () => (window.history.state as { tossBack?: number } | null)?.tossBack ?? 0;
export function useAdBackGuard(onBack: () => void) {
  const active = useLayerActive();
  const ref = useRef(onBack);
  const leaving = useRef(false);
  useEffect(() => {
    ref.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    const arm = window.setTimeout(() => {
      if (!leaving.current && backLevel() === 0) window.history.pushState({ ...window.history.state, tossBack: 1 }, "");
    });
    let cancel = () => {};
    const onPop = () => {
      if (leaving.current || backLevel() > 0) return;
      leaving.current = true; // 한 번만
      // 방금 replace 로 와서 이동 잠금 중이면 풀린 뒤에 닫음 (버리면 지킴 칸만 빠지고, 다음 뒤로가 끝난 이체 화면으로 감)
      cancel = tossAfterLock(() => ref.current());
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.clearTimeout(arm);
      window.removeEventListener("popstate", onPop);
      cancel();
    };
  }, [active]);
  return (fn: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    const lv = backLevel();
    if (!lv) return fn();
    const done = () => {
      window.removeEventListener("popstate", done);
      window.clearTimeout(t);
      fn();
    };
    const t = window.setTimeout(done, 300);
    window.addEventListener("popstate", done);
    window.history.go(-lv);
  };
}
