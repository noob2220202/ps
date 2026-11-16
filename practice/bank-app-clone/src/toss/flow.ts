// 영역 사이 약속 (plan.md §1.5): 영역은 다른 영역의 화면을 import 하지 않고 주소와 이 함수들로만 오감
//  goBank(id, { toast })            (토스트 "토스뱅크로 이동했어요") → push /bank/:id
//  goSend({ from, toastFromHome })  LOAD 빈 화면 → 받는 분 목록을 미리 받고(≥400ms) → push /send?from= (sendDepth 1)
//  sendFinish(kind)                 이체 완료 '확인': 광고를 안 미뤘으면 /ad/coupon (옮기기, reveal) · /ad/payback (보내기, push + "토스로 이동했어요")
//                                   으로 S8 자리를 바꿈(replace), 미뤘으면 history.go(-sendDepth) 로 이체 흐름 전에 있던 화면으로 (pop)
//  adDismiss({ snooze })            광고 화면 닫기: snooze 면 3일 동안 안보기 저장 → history.go(-sendDepth) (쿠폰은 fade, 2,000원은 pop)
//  certExit()                       증명서 발급 '확인했어요' → history.go(-certDepth) 로 상세 (pop)
// 이체가 끝나면 POST 가 알아서 모든 화면 데이터를 다시 받게 함 (api/client invalidate)
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { paths } from "../api/endpoints";
import { prefetch, useApi } from "../api/useApi";
import { useLayerActive } from "../platform/LayerContext";
import { tossAdSnoozed, tossApi, type TossHomeData } from "./api";
import { cutTossLoad, isTossLoadUp, showTossLoad } from "./loading";
import { TOSS_NAV, tossDepth, tossLock, useTossExit, useTossGo } from "./nav";
import { showTossToast } from "./toast";

export const TOSS_FLOW = {
  loadMin: 400, // LOAD 빈 화면 최소 (녹화 0.66–2.2초를 줄인 값)
  toastAfterPush: 100, // 토스트는 push 시작 100ms 뒤
  adSnoozeDays: 3,
} as const;

const hereKey = () => (window.history.state as { key?: string } | null)?.key;

export function useTossFlow() {
  const navigate = useNavigate();
  const go = useTossGo();
  const exit = useTossExit();
  const location = useLocation();
  const active = useLayerActive();

  const goBank = useCallback(
    (id: string, { toast = false }: { toast?: boolean } = {}) => {
      if (go(`/bank/${encodeURIComponent(id)}`) && toast) showTossToast("토스뱅크", { delay: TOSS_NAV.tapDelay + TOSS_FLOW.toastAfterPush, waitReady: true });
    },
    [go],
  );

  const goSend = useCallback(
    ({ from = "main", toastFromHome = false }: { from?: string; toastFromHome?: boolean } = {}) => {
      if (!active || !tossLock(TOSS_NAV.tapDelay + TOSS_FLOW.loadMin + TOSS_NAV.lock)) return;
      const at = hereKey();
      window.setTimeout(() => {
        if (hereKey() !== at) return; // 그사이 뒤로 감
        if (toastFromHome) showTossToast("토스뱅크");
        const id = showTossLoad();
        const t0 = performance.now();
        prefetch(paths.recipients(from)).then(() => {
          window.setTimeout(
            () => {
              if (!isTossLoadUp() || hereKey() !== at) return cutTossLoad(id);
              navigate(`/send?from=${encodeURIComponent(from)}`, { state: { tossAnim: "load", sendDepth: 1 } });
              cutTossLoad(id); // push 가 시작하는 프레임에 (같은 렌더로 묶임)
            },
            Math.max(0, TOSS_FLOW.loadMin - (performance.now() - t0)),
          );
        });
      }, TOSS_NAV.tapDelay);
    },
    [navigate, active],
  );

  const certExit = useCallback(() => exit(tossDepth(location.state, "certDepth")), [exit, location.state]);

  return { goBank, goSend, certExit };
}

// 이체 완료(S8) 화면에서: 광고 미루기 값을 미리 받아 둠 (홈 데이터)
export function useSendFinish() {
  const home = useApi<TossHomeData>(paths.home);
  const location = useLocation();
  const navigate = useNavigate();
  const exit = useTossExit();
  const snoozeUntil = home.data?.toss?.adSnoozeUntil;
  return useCallback(
    (kind: "move" | "send") => {
      const depth = tossDepth(location.state, "sendDepth");
      if (tossAdSnoozed(snoozeUntil)) return exit(depth);
      if (!tossLock()) return;
      navigate(kind === "move" ? "/ad/coupon" : "/ad/payback", {
        replace: true,
        state: kind === "move" ? { tossAnim: "reveal", tossExit: "fade", sendDepth: depth } : { tossAnim: "push", sendDepth: depth },
      });
      if (kind === "send") showTossToast("토스", { delay: TOSS_FLOW.toastAfterPush });
    },
    [location.state, navigate, exit, snoozeUntil],
  );
}

// 광고 화면(쿠폰 · 2,000원)에서
export function useAdDismiss() {
  const location = useLocation();
  const exit = useTossExit();
  return useCallback(
    ({ snooze = false }: { snooze?: boolean } = {}) => {
      // 닫기를 받았을 때만 미루기 저장 (잠금에 막힌 닫기가 미루기만 남기지 않게)
      if (exit(tossDepth(location.state, "sendDepth")) && snooze)
        tossApi.updateProfile({ adSnoozeUntil: new Date(Date.now() + TOSS_FLOW.adSnoozeDays * 86_400_000).toISOString() }).catch(() => {});
    },
    [location.state, exit],
  );
}
