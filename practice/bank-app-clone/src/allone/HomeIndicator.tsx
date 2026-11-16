// NH올원뱅크 홈 인디케이터: 앱이 켜진 직후에만 (흰 시작화면 위 검정 140 × 5, x 126.5–266.5 · y 839–844, 둥글기 2.5).
// 켜진 시각 D(launch.ts) 부터 D+1100 까지 투명도 표(motion.ts AO_HOME_INDICATOR, allone.css @keyframes ao-home-ind), 그 뒤로는 늘 숨김.
// PhoneFrame 이 ALLONE 일 때 그림 (z 58: 인트로 장면 · 네이티브 층 위, 아일랜드 아래)
import { useLayoutEffect, useRef, useState } from "react";
import { AO_HOME_INDICATOR_MS } from "./motion";
import { useAoLaunchAt } from "./launch";

export function AlloneHomeIndicator() {
  const at = useAoLaunchAt();
  return at === null ? null : <IndicatorAt key={at} at={at} />;
}

function IndicatorAt({ at }: { at: number }) {
  const [base] = useState(() => performance.now());
  const ref = useRef<HTMLDivElement>(null);
  // CSS 애니메이션 시작 시각은 그린 뒤 1~2 프레임 지나 정해짐 → base 로 박아 둠 (kakao2 useStartAt 과 같은 방법)
  useLayoutEffect(() => {
    ref.current?.getAnimations().forEach((a) => a instanceof CSSAnimation && (a.startTime = base));
  }, [base]);
  const delay = at - base;
  if (delay < -AO_HOME_INDICATOR_MS) return null;
  return <div ref={ref} className="phone__home-indicator phone__home-indicator--ao" style={{ animationDelay: `${delay}ms` }} aria-hidden />;
}
