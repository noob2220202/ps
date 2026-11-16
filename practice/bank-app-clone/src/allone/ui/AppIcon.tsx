// NH올원뱅크 앱 아이콘 (plan.md §3.1, launch.md §2.1): 초록 #0C8F2D iOS 연속 곡률 모서리(반지름 22.5 %) + 흰 "all NH one" 워드마크
// (allone-wordmark.png 마스크, 녹화 홈 화면 아이콘 64pt 에서 워드마크 ≈ 50 × 36.3 pt → 아이콘 폭의 78 %).
// 로그인 · 프로필 고르기 · 계정 관리(AppBrand)와 녹화 인트로 홈 화면(launch 영역)이 씀.
// pressed: 녹화 C1 0.650 누름 — 한 프레임에 색만 바뀜 (#034913 / 워드마크 #919291, 크기 · 자리 그대로).
// 손 떼면 100 ms ease-out 으로 원래 색 (누를 땐 전환 없음, 뗄 때만 전환)
import type { CSSProperties } from "react";
import { AoWordmark } from "./Wordmark";

export const AO_ICON_GREEN = "#0C8F2D";
export const AO_ICON_PRESSED_BG = "#034913";
export const AO_ICON_PRESSED_MARK = "#919291";
const RELEASE = "100ms ease-out";

/**
 * iOS 연속 곡률(continuous corner) 둥근 네모의 SVG path. w × h 상자, 모서리 반지름 r
 * (PaintCode 가 밝힌 iOS 7+ UIBezierPath 계수. 곡선이 모서리에서 1.52866 r 까지 이어짐 → r 은 짧은 변의 1/3.06 까지만)
 */
function continuousCornerPath(w: number, h: number, r: number) {
  const k = Math.min(r, Math.min(w, h) / 2 / 1.52866483);
  const n = (v: number) => +v.toFixed(3);
  // 위 오른쪽 모서리 하나를 (가로 a, 세로 b) 단위로 적어 두고 네 모서리에 돌려 씀
  const corner = (ox: number, oy: number, ax: number, ay: number, bx: number, by: number) => {
    // ox, oy = 모서리 꼭짓점. (ax, ay) = 변을 따라 모서리 '안쪽'으로 가는 방향, (bx, by) = 다음 변 방향
    const p = (u: number, v: number) => `${n(ox + ax * u * k + bx * v * k)} ${n(oy + ay * u * k + by * v * k)}`;
    return (
      `L${p(1.52866483, 0)}` +
      `C${p(1.08849323, 0)} ${p(0.86840689, 0)} ${p(0.66993427, 0.065496)}` +
      `L${p(0.63149399, 0.074911)}` +
      `C${p(0.37282392, 0.16905899)} ${p(0.16905899, 0.37282392)} ${p(0.074911, 0.63149399)}` +
      `L${p(0.065496, 0.66993427)}` +
      `C${p(0, 0.86840689)} ${p(0, 1.08849323)} ${p(0, 1.52866483)}`
    );
  };
  return (
    `M${n(1.52866483 * k)} 0` +
    corner(w, 0, -1, 0, 0, 1) + // 위 오른쪽: 위 변에서 오른쪽 변으로
    corner(w, h, 0, -1, -1, 0) + // 아래 오른쪽
    corner(0, h, 1, 0, 0, -1) + // 아래 왼쪽
    corner(0, 0, 0, 1, 1, 0) + // 위 왼쪽
    "Z"
  );
}

const ICON_PATH = continuousCornerPath(100, 100, 22.5);

/** iOS 앱 아이콘 모양 (연속 곡률 모서리, 반지름 = 한 변의 radius %) — 녹화 인트로 홈 화면의 다른 아이콘 · 폴더 · 독 그림에도 씀 */
export function AoSquircle({
  size,
  radius = 22.5,
  fill,
  stroke,
  className,
  style,
}: {
  size: number;
  radius?: number;
  fill: string;
  stroke?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={{ display: "block", ...style }} aria-hidden>
      <path d={radius === 22.5 ? ICON_PATH : continuousCornerPath(100, 100, radius)} fill={fill} stroke={stroke} strokeWidth={stroke ? 100 / size : undefined} />
    </svg>
  );
}

export function AlloneAppIcon({
  size,
  pressed = false,
  className,
  style,
}: {
  size: number;
  pressed?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      role="img"
      aria-label="NH올원뱅크"
      className={className}
      style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0, ...style }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: "absolute", inset: 0, display: "block" }} aria-hidden>
        <path d={ICON_PATH} style={{ fill: pressed ? AO_ICON_PRESSED_BG : AO_ICON_GREEN, transition: pressed ? "none" : `fill ${RELEASE}` }} />
      </svg>
      <AoWordmark
        width={size * (50 / 64)}
        color={pressed ? AO_ICON_PRESSED_MARK : "#ffffff"}
        transition={pressed ? "none" : `background-color ${RELEASE}`}
        style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      />
    </span>
  );
}
