// "all NH one" 워드마크 (plan.md §3.1, §5.2). 그림은 src/assets/local/allone-wordmark.png — 시작화면 워드마크를 흰색 알파 마스크로
// 만든 것 (scripts/allone-crops/shared.py, 115.75 × 85.5 pt, 4px/pt). 색은 CSS mask-image 위의 배경색이라 아무 색이나 칠할 수 있음
// (앱 아이콘 흰색 · 누름 #919291, 스피너 흰색, 시작화면이라면 초록 · 파랑 두 색은 스플래시 그림 그대로).
// 마스크가 없으면(에셋을 안 만든 저장소) 같은 자리에 글자로.
import type { CSSProperties } from "react";
import { localAsset } from "../../assets/Asset";

const MASK = localAsset("allone-wordmark");
/** 마스크 그림의 가로 / 세로 (463 × 342 px = 115.75 × 85.5 pt, 잉크 상자에 맞춰 자름) */
export const AO_WORDMARK_RATIO = 463 / 342;

export function AoWordmark({
  width,
  color = "#ffffff",
  transition,
  className,
  style,
}: {
  width: number;
  color?: string;
  /** 색 바뀜 전환 (예: 앱 아이콘 손 뗄 때 "background-color 100ms ease-out") */
  transition?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const height = width / AO_WORDMARK_RATIO;
  if (!MASK)
    return (
      <span
        aria-hidden
        className={className}
        style={{ display: "block", width, height, color, fontWeight: 800, fontSize: height * 0.42, lineHeight: 1, letterSpacing: "-0.04em", ...style }}
      >
        all <small style={{ fontSize: "0.45em" }}>NH</small>
        <br />
        one
      </span>
    );
  const mask = `url("${MASK}") center / 100% 100% no-repeat`;
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "block",
        width,
        height,
        flexShrink: 0,
        backgroundColor: color,
        WebkitMask: mask,
        mask,
        transition,
        ...style,
      }}
    />
  );
}
