// 주소를 바로 열었는데 보여 줄 것이 없을 때 (없는 주소 · 값 없는 이체/증명서 단계 · 다른 갈래 계좌): 맨 위 층일 때 한 번만 replace (전환 없음)
// 바뀌기 전 한 프레임은 빈 토스 바탕 (까만 빈 층 대신)
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLayerActive } from "../../platform/LayerContext";
import { TossPage } from "./Page";

export function TossRedirect({ to }: { to: string }) {
  const navigate = useNavigate();
  const active = useLayerActive();
  const done = useRef(false);
  useEffect(() => {
    if (!active || done.current) return;
    done.current = true;
    navigate(to, { replace: true });
  }, [active, navigate, to]);
  return <TossPage />;
}
