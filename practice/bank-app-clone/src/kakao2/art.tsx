// kakao2 공용 그림 (모두 인라인 SVG). 크기 기본값은 녹화에서 잰 잉크 상자(pt) — 화면마다 다르면 props 로.
// 화면 전용 아이콘은 각 화면 폴더에 따로 둬도 됨
import { useId } from "react";
import "./art.css";

type Ink = { color?: string; className?: string };

// ---------- 로딩 스피너 (critic.md C2 · X10, txdetail.md §2.2) ----------
// 머티리얼 식 늘었다 줄었다 하는 호, 0.8초 주기, 시계 방향, 둥근 끝. 각도표 17칸은 art.css k2-spin
// loading: 중심선 반지름 16.2 · 두께 6 (44 상자, 로딩 막 가운데) / more: 11.9 · 3.3 (30 상자, 통장 목록 맨 아래)
// 색: 어두운 홈 막 위 #dcdcdc · 흰 화면 막 위 #e9e9e9 · 목록 아래 #dfdfdf
const SPIN = { loading: { r: 16.2, w: 6, box: 44 }, more: { r: 11.9, w: 3.3, box: 30 } };
export function K2Spinner({ size = "loading", color = "#e9e9e9", className }: { size?: keyof typeof SPIN } & Ink) {
  const s = SPIN[size];
  const c = s.box / 2;
  return (
    <svg className={`k2-spinner${className ? ` ${className}` : ""}`} width={s.box} height={s.box} viewBox={`0 0 ${s.box} ${s.box}`} aria-label="로딩 중">
      {/* pathLength 360: 점선 길이를 각도(°)로 */}
      <circle cx={c} cy={c} r={s.r} pathLength={360} fill="none" stroke={color} strokeWidth={s.w} strokeLinecap="round" />
    </svg>
  );
}

// ---------- AI 별 (critic.md G10) ----------
// 오목한 네 꼭지 별, 끝은 둥글게 (이체 머리 아이콘 잉크 15 × 15.6 을 줄마다 재서 맞춘 초타원 n .74 + 둥근 모서리 1.6)
// pill = 홈 AI 알약 (16pt, 청록 → 초록 → 연두 대각선 + 가운데 어두운 세로 막대) / header = 이체 'AI로 이체하기' (15.7pt, 하늘 → 초록 → 노랑 세로, 막대 없음)
const AI_STAR =
  "M14.34 8L14.27 8.01 14.08 8.06 13.77 8.16 13.36 8.35 12.86 8.62 12.3 8.97 11.7 9.41 11.08 9.92 10.48 10.48 9.92 11.08 9.41 11.7 8.97 12.3 8.62 12.86 8.35 13.36 8.16 13.77 8.06 14.08 8.01 14.27 8 14.34 7.99 14.27 7.94 14.08 7.84 13.77 7.65 13.36 7.38 12.86 7.03 12.3 6.59 11.7 6.08 11.08 5.52 10.48 4.92 9.92 4.3 9.41 3.7 8.97 3.14 8.62 2.64 8.35 2.23 8.16 1.92 8.06 1.73 8.01 1.66 8 1.73 7.99 1.92 7.94 2.23 7.84 2.64 7.65 3.14 7.38 3.7 7.03 4.3 6.59 4.92 6.08 5.52 5.52 6.08 4.92 6.59 4.3 7.03 3.7 7.38 3.14 7.65 2.64 7.84 2.23 7.94 1.92 7.99 1.73 8 1.66 8.01 1.73 8.06 1.92 8.16 2.23 8.35 2.64 8.62 3.14 8.97 3.7 9.41 4.3 9.92 4.92 10.48 5.52 11.08 6.08 11.7 6.59 12.3 7.03 12.86 7.38 13.36 7.65 13.77 7.84 14.08 7.94 14.27 7.99Z";
// 녹화에서 꼭지마다 뽑은 색 (critic.md G10): 홈 위 하늘 · 왼쪽 청록 · 오른쪽 아래 연두 / 이체 위 하늘 · 왼쪽 청록 · 오른쪽 연두 · 아래 노랑
const AI_GRAD = {
  pill: { x1: 5.6, y1: 0, x2: 10.4, y2: 16, stops: [[0, "#06b9e6"], [0.33, "#20c9c5"], [0.67, "#9ed62a"], [1, "#b6dc18"]] },
  header: { x1: 4, y1: 0, x2: 12, y2: 16, stops: [[0, "#00c5ff"], [0.3, "#46cda9"], [0.55, "#8bd92c"], [0.75, "#c8dc14"], [1, "#fcde01"]] },
} as const;
export function K2AiStar({ variant = "pill", size = variant === "pill" ? 16 : 15.7, className }: { variant?: "pill" | "header"; size?: number; className?: string }) {
  const id = useId();
  const g = AI_GRAD[variant];
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
          {g.stops.map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <path d={AI_STAR} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth="3.32" strokeLinejoin="round" />
      {variant === "pill" && <rect x="7.35" y="5" width="1.3" height="6" rx="0.3" fill="#27342a" />}
    </svg>
  );
}

// ---------- 선 아이콘: 크기 = 잉크 상자 (둥근 끝까지) ----------
// X 닫기 (이체 머리 16.3 × 16, 두께 2)
export function K2Close({ width = 16.3, height = 16, stroke = 2, color = "#000", className }: { width?: number; height?: number; stroke?: number } & Ink) {
  const c = stroke / 2;
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" aria-hidden>
      <path d={`M${c} ${c}L${width - c} ${height - c}M${width - c} ${c}L${c} ${height - c}`} />
    </svg>
  );
}

// 가는 꺾쇠 (> < ∨ ∧). 기본 = 'AI로 이체하기' 옆 > (5.7 × 10, 두께 1.3)
export function K2Chevron({
  dir = "right",
  width = dir === "up" || dir === "down" ? 10 : 5.7,
  height = dir === "up" || dir === "down" ? 5.7 : 10,
  stroke = 1.3,
  color = "#000",
  className,
}: { dir?: "right" | "left" | "down" | "up"; width?: number; height?: number; stroke?: number } & Ink) {
  const c = stroke / 2;
  const [w, h] = [width - c, height - c];
  const d = {
    right: `M${c} ${c}L${w} ${height / 2}L${c} ${h}`,
    left: `M${w} ${c}L${c} ${height / 2}L${w} ${h}`,
    down: `M${c} ${c}L${width / 2} ${h}L${w} ${c}`,
    up: `M${c} ${h}L${width / 2} ${c}L${w} ${h}`,
  }[dir];
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
// 머리줄 뒤로 < (통장 11 × 20, 두께 2.3)
export const K2BackChevron = (p: { width?: number; height?: number; stroke?: number } & Ink) => <K2Chevron dir="left" width={11} height={20} stroke={2.3} {...p} />;
// 아래 꺾쇠 ∨ (통장 '3개월 · 전체 · 최신순' 옆 8.7 × 4.7, 두께 1.1, #5b5b5b)
export const K2ChevronDown = (p: { width?: number; height?: number; stroke?: number } & Ink) => (
  <K2Chevron dir="down" width={8.7} height={4.7} stroke={1.1} color="#5b5b5b" {...p} />
);

// 돋보기 (이체 검색 15.7 × 16.3, 두께 1.55 / 통장 17 × 16.7, 1.7). 고리 바깥 지름 = 폭의 0.87, 손잡이는 오른쪽 아래로
export function K2Magnifier({ width = 15.7, height = 16.3, stroke = 1.55, color = "#000", className }: { width?: number; height?: number; stroke?: number } & Ink) {
  const d = Math.min(width, height) * 0.87;
  const r = (d - stroke) / 2;
  const cx = d / 2;
  const s = Math.SQRT1_2;
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" aria-hidden>
      <circle cx={cx} cy={cx} r={r} />
      <path d={`M${cx + r * s} ${cx + r * s}L${width - stroke / 2} ${height - stroke / 2}`} />
    </svg>
  );
}

// 둥근 꼭지 별 (이체 즐겨찾기 18.6 × 18.3, 꺼짐 #f0f0f0)
export function K2Star({ width = 18.6, height = 18.3, color = "#f0f0f0", className }: { width?: number; height?: number } & Ink) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 22.22 21.29" preserveAspectRatio="none" aria-hidden>
      <path
        d="M11.11 1.6L14.05 7.55 20.62 8.51 15.87 13.15 16.99 19.69 11.11 16.6 5.23 19.69 6.36 13.15 1.6 8.51 8.17 7.55Z"
        fill={color}
        stroke={color}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 톱니 (통장 머리 21.3 × 22): 둥근 톱니 6개 테두리 + 가운데 고리 (바깥 지름 8.7), 두께 2
export function K2Gear({ height = 22, stroke = 2, color = "#000", className }: { height?: number; stroke?: number } & Ink) {
  return (
    <svg className={className} width={(height * 20.73) / 22} height={height} viewBox="0 0 20.73 22" fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" aria-hidden>
      <path d="M18.67 11L18.65 11.54 18.61 12.08 18.61 12.64 19.21 13.37 19.73 14.18 19.6 14.82 19.33 15.42 19.03 16 18.68 16.56 18.29 17.08 17.8 17.52 16.84 17.47 15.91 17.32 15.43 17.59 14.98 17.9 14.52 18.19 14.04 18.45 13.55 18.68 13.07 18.96 12.74 19.84 12.3 20.7 11.67 20.9 11.02 20.98 10.37 21 9.71 20.98 9.06 20.9 8.44 20.7 8 19.84 7.66 18.96 7.19 18.68 6.7 18.45 6.22 18.19 5.76 17.9 5.31 17.59 4.82 17.32 3.9 17.47 2.93 17.52 2.44 17.08 2.05 16.56 1.71 16 1.4 15.42 1.14 14.82 1 14.18 1.53 13.37 2.12 12.64 2.13 12.08 2.08 11.54 2.07 11 2.08 10.46 2.13 9.92 2.12 9.36 1.53 8.63 1 7.82 1.14 7.18 1.4 6.58 1.71 6 2.05 5.44 2.44 4.92 2.93 4.48 3.9 4.53 4.82 4.68 5.31 4.41 5.76 4.1 6.22 3.81 6.7 3.55 7.19 3.32 7.66 3.04 8 2.16 8.44 1.3 9.06 1.1 9.71 1.02 10.37 1 11.02 1.02 11.67 1.1 12.3 1.3 12.74 2.16 13.07 3.04 13.55 3.32 14.04 3.55 14.52 3.81 14.98 4.1 15.43 4.41 15.91 4.68 16.84 4.53 17.8 4.48 18.29 4.92 18.68 5.44 19.03 6 19.33 6.58 19.6 7.18 19.73 7.82 19.21 8.63 18.61 9.36 18.61 9.92 18.65 10.46Z" />
      <circle cx="10.37" cy="11" r="3.35" />
    </svg>
  );
}

// 연필 (머티리얼 'edit', 채움). 거래상세 메모 옆 12 × 11.6
export function K2Pencil({ size = 12, color = "#000", className }: { size?: number } & Ink) {
  return (
    <svg className={className} width={size} height={size} viewBox="3 3 18 18" fill={color} aria-hidden>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}

// 종 (홈 오른쪽 위 17.7 × 21, #fbfbfb, 두께 1.8): 테두리 종 + 아래 채운 반원 추. 빨간 점은 홈 화면이
export function K2Bell({ width = 17.7, height = 21, stroke = 1.8, color = "#fbfbfb", className }: { width?: number; height?: number; stroke?: number } & Ink) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 17.7 21" preserveAspectRatio="none" aria-hidden>
      <path
        d="M8.85.9C5.3.9 3.05 3.55 3.05 7.2V12.2L1.15 14.9Q.85 15.6 1.6 15.6H16.1Q16.85 15.6 16.55 14.9L14.65 12.2V7.2C14.65 3.55 12.4.9 8.85.9Z"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
      <path d="M6.25 18.4A2.6 2.6 0 0 0 11.45 18.4Z" fill={color} />
    </svg>
  );
}
