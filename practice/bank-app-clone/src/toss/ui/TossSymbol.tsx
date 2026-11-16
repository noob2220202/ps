// 토스 심볼 (toss-symbol.png, 시작화면 녹화에서 4배로 키워 바탕을 걷은 그림 · scripts/toss-crops/shared.py).
// grey: 홈 머리줄의 회색 토스 표시 — 그림을 가면(mask)으로 써서 #878d94 → #9aa0a8 그라데이션으로 칠함 (plan.md §5.1, 참고 A 10.698)
// 그림 비율 504 × 468 (가로 / 세로 1.077). height 를 주면 그 높이, 아니면 size 를 폭으로
import type { CSSProperties } from "react";
import { localAsset } from "../../assets/Asset";

export const TOSS_SYMBOL_RATIO = 504 / 468;

export function TossSymbol({ size = 24, height, grey, className, style }: { size?: number; height?: number; grey?: boolean; className?: string; style?: CSSProperties }) {
  const src = localAsset("toss-symbol");
  const w = height ? height * TOSS_SYMBOL_RATIO : size;
  const h = height ?? size / TOSS_SYMBOL_RATIO;
  if (!src) return <span className={className} style={{ display: "inline-block", width: w, height: h, borderRadius: "50%", background: grey ? "#8f949b" : "#3182f6", ...style }} aria-hidden />;
  if (!grey) return <img className={className} src={src} alt="" draggable={false} style={{ display: "block", width: w, height: h, ...style }} />;
  return (
    <span
      className={className}
      aria-hidden
      style={{
        display: "inline-block",
        width: w,
        height: h,
        background: "linear-gradient(#878d94, #9aa0a8)",
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        ...style,
      }}
    />
  );
}
