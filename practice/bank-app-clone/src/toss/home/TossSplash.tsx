import { useEffect, useState } from "react";
import { localAsset } from "../../assets/Asset";

// 기초 단계 자리 — A1 home 영역이 진짜 시작화면으로 바꿈 (plan.md §0.12: 1.2초, +0.6초에 심볼이 8dp 내려감 → 홈으로 300ms 교차).
// toss-symbol-splash.png 잉크 상자 = 화면 x 126.8 · y 363.2, 132.5 × 124.75dp (scripts/toss-crops/shared.py 출력)
export function TossSplash({ onDone }: { onDone: () => void }) {
  const [dropped, setDropped] = useState(false);
  useEffect(() => {
    const a = window.setTimeout(() => setDropped(true), 600);
    const b = window.setTimeout(onDone, 1200);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [onDone]);
  const src = localAsset("toss-symbol-splash");
  return (
    <div style={{ position: "absolute", inset: 0, background: "#171619" }}>
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{ position: "absolute", left: 126.8, top: dropped ? 371.2 : 363.2, width: 132.5, height: 124.75 }}
        />
      )}
    </div>
  );
}
