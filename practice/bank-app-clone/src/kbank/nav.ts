import { useCallback } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";
import { useLayerActive } from "../platform/LayerContext";

// 케이뱅크 화면 이동. 같은 곳을 빠르게 두 번 누르면(120~200ms) 같은 화면이 기록에 두 번 쌓여 뒤로 한 번이 헛돌았음
// (홈 계좌 카드 · 이체하기 · 거래 행 · ‹ · ×). 다른 앱의 로딩 막(useNhGo·useHanaGo)·busy 잠금(useIbkGo)처럼 막음:
//  - 맨 위 층이 아닌 화면(전환 중 나가는 층)에서 온 이동은 버림
//  - 한 번 이동하면 가장 긴 전환(거래 상세 올라옴 445ms)이 끝날 때까지 다음 이동을 받지 않음
const LOCK_MS = 450;
let lockedUntil = 0;

export function useKbankGo() {
  const navigate = useNavigate();
  const active = useLayerActive();
  return useCallback(
    (to: string | number, opts?: NavigateOptions) => {
      const now = performance.now();
      if (!active || now < lockedUntil) return;
      lockedUntil = now + LOCK_MS;
      if (typeof to === "number") navigate(to);
      else navigate(to, opts);
    },
    [navigate, active],
  );
}
