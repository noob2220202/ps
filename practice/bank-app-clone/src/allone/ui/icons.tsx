// NH올원뱅크 아이콘 (plan.md §3.3). 모두 SVG, 녹화에서 잰 잉크 상자 그대로:
//  기본 크기에서 <svg> 상자 = 녹화의 잉크 상자 (선 두께 · 둥근 끝까지 포함) → 영역은 스펙 표의 잉크 left / top 을 그대로 자리로 씀.
//  색은 color (기본 currentColor), 두께는 stroke. 크기를 바꾸면(size / w · h) 같은 모양을 그 상자에 다시 그림 (두께는 그대로).
// 어디서 쟀는지는 아이콘마다 적음 (C1 = …_1_3.mp4, C2 = …_1_4.mp4, C3 = …_2.mp4, pt = px / 3.0025 · y px / 3)
import type { CSSProperties, ReactNode } from "react";

export interface AoIconProps {
  color?: string;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}

type Pt = readonly [number, number];
const n = (v: number) => +v.toFixed(3);

// 꼭짓점마다 반지름 r 로 둥글린 다각형 (2차 베지어). r 은 꼭짓점별로 줄 수 있음
function roundPoly(pts: readonly Pt[], r: number | readonly number[], closed = true) {
  const len = pts.length;
  let d = "";
  for (let i = 0; i < len; i++) {
    const cur = pts[i];
    const ri = typeof r === "number" ? r : r[i];
    const isEnd = !closed && (i === 0 || i === len - 1);
    if (isEnd || ri <= 0) {
      d += `${d ? "L" : "M"}${n(cur[0])} ${n(cur[1])}`;
      continue;
    }
    const prev = pts[(i - 1 + len) % len];
    const next = pts[(i + 1) % len];
    const v1 = [prev[0] - cur[0], prev[1] - cur[1]];
    const v2 = [next[0] - cur[0], next[1] - cur[1]];
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    const k = Math.min(ri, l1 / 2, l2 / 2);
    const a = [cur[0] + (v1[0] / l1) * k, cur[1] + (v1[1] / l1) * k];
    const b = [cur[0] + (v2[0] / l2) * k, cur[1] + (v2[1] / l2) * k];
    d += `${d ? "L" : "M"}${n(a[0])} ${n(a[1])}Q${n(cur[0])} ${n(cur[1])} ${n(b[0])} ${n(b[1])}`;
  }
  return closed ? d + "Z" : d;
}

// 잉크 상자 w × h 의 SVG. 안의 좌표는 pt (viewBox = 0 0 w h), 크기를 바꾸면 sx · sy 로 늘림
function Svg({
  w,
  h,
  W = w,
  H = h,
  color = "currentColor",
  className,
  style,
  label,
  children,
}: {
  w: number;
  h: number;
  W?: number;
  H?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={n(W)}
      height={n(H)}
      viewBox={`0 0 ${n(w)} ${n(h)}`}
      preserveAspectRatio="none"
      className={className}
      style={{ display: "block", flexShrink: 0, overflow: "visible", color, ...style }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {children}
    </svg>
  );
}
const line = (s: number, cap: "round" | "square" | "butt" = "round") =>
  ({ fill: "none", stroke: "currentColor", strokeWidth: s, strokeLinecap: cap, strokeLinejoin: "round" }) as const;

// ---------- ‹ 뒤로 ----------
// nav (거래내역조회, C2 11.341): 잉크 8.32 × 15.34 (x 31.31, y 76.33), 두께 1.4
// flow (누구에게 · 얼마를 · 이체 확인, C3 29.2): 잉크 11.66 × 20 (x 23.98, y 74.0), 두께 1.6
export function AoBackIcon({ variant = "nav", stroke, ...p }: AoIconProps & { variant?: "nav" | "flow" }) {
  const [w, h, s0] = variant === "flow" ? [11.66, 20, 1.6] : [8.32, 15.34, 1.4];
  const s = stroke ?? s0;
  const i = s / 2;
  return (
    <Svg w={w} h={h} {...p}>
      <path d={`M${n(w - i)} ${n(i)}L${n(i)} ${n(h / 2)}L${n(w - i)} ${n(h - i)}`} {...line(s)} />
    </Svg>
  );
}

// ---------- × 닫기 ----------
// 머리줄 · 웹 시트 (C2 18.324 · C3 4.5 · 8.5 · 40.546): 잉크 16.65 정사각 (x 348.71, y 75.67), 두께 1.6 둥근 끝
// T7 금액 입력: size 16, stroke 1.9, cap "square", color #656571 · T3 계좌 비밀번호: size 17.32, stroke 1.45
export function AoCloseIcon({ size = 16.65, stroke = 1.6, cap = "round", ...p }: AoIconProps & { size?: number; cap?: "round" | "square" }) {
  const i = cap === "round" ? stroke / 2 : stroke * 0.7071;
  const e = size - i;
  return (
    <Svg w={size} h={size} {...p}>
      <path d={`M${n(i)} ${n(i)}L${n(e)} ${n(e)}M${n(e)} ${n(i)}L${n(i)} ${n(e)}`} {...line(stroke, cap)} />
    </Svg>
  );
}

// ---------- ▾ 아래 꺾쇠 ----------
// md: 계좌 줄 ▾ 12 × 6.66, 두께 1.6 (C2 11.341 x 350.71 y 141.67) · sm: 조회 조건 ▾ 9.33 × 5.34, 두께 1.7 (x 352.37 y 356.33)
// T2 계좌 줄 ▾: w 13, h 7.67, stroke 1.3 · T5 선택 상자: w 12.3, h 6.7, stroke 1.5
export function AoChevronDownIcon({ size = "md", w, h, stroke, ...p }: AoIconProps & { size?: "md" | "sm"; w?: number; h?: number }) {
  const [w0, h0, s0] = size === "sm" ? [9.33, 5.34, 1.7] : [12, 6.66, 1.6];
  const W = w ?? w0;
  const H = h ?? h0;
  const s = stroke ?? s0;
  const i = s / 2;
  return (
    <Svg w={W} h={H} {...p}>
      <path d={`M${n(i)} ${n(i)}L${n(W / 2)} ${n(H - i)}L${n(W - i)} ${n(i)}`} {...line(s)} />
    </Svg>
  );
}

// ---------- › 오른쪽 꺾쇠 ----------
// 자동이체 등록 › 5.33 × 9.34, 두께 1.3 (C2 18.324 x 358.37 y 554.33). 전체메뉴 이름 › 는 w 7, h 12
export function AoChevronRightIcon({ w = 5.33, h = 9.34, stroke = 1.3, ...p }: AoIconProps & { w?: number; h?: number }) {
  const i = stroke / 2;
  return (
    <Svg w={w} h={h} {...p}>
      <path d={`M${n(i)} ${n(i)}L${n(w - i)} ${n(h / 2)}L${n(i)} ${n(h - i)}`} {...line(stroke)} />
    </Svg>
  );
}

// ---------- 집 (홈) ----------
// 거래내역조회 · 전체메뉴 (C2 11.341 x 311.74 y 74.67): 잉크 18.65 × 18.66, 두께 1.5, 아래에 문 막대 (잉크 x 316.3–325.5, y 89.33)
export function AoHomeIcon({ stroke = 1.5, ...p }: AoIconProps) {
  const w = 18.65;
  const h = 18.66;
  const i = stroke / 2;
  const house = roundPoly(
    [
      [w / 2, i - 0.5], // 꼭대기를 둥글리면 잉크가 0.5 내려가므로 미리 올림
      [w - i, 5.6],
      [w - i, h - i],
      [i, h - i],
      [i, 5.6],
    ],
    [2, 1.6, 3, 3, 1.6],
  );
  return (
    <Svg w={w} h={h} {...p}>
      <path d={house} {...line(stroke)} />
      <path d={`M${n(4.56 + i)} 14.66H${n(13.76 - i)}`} {...line(stroke)} />
    </Svg>
  );
}

// ---------- 메뉴 + 돋보기 (≡🔍) ----------
// 거래내역조회 (C2 11.341 x 347.38 y 76.33) · 홈 머리줄 (C2 7.000 x 351.37) · PIN (C1 7.333, 흰색): 잉크 19.98 × 15.34, 두께 1.4
export function AoMenuSearchIcon({ stroke = 1.4, ...p }: AoIconProps) {
  const w = 19.98;
  const h = 15.34;
  const i = stroke / 2;
  return (
    <Svg w={w} h={h} {...p}>
      <path d={`M${n(i)} ${n(i)}H${n(w - i)}M${n(i)} 7.67H6.3M${n(i)} ${n(h - i)}H6.3`} {...line(stroke)} />
      <circle cx="13.37" cy="8.92" r="4.25" {...line(stroke)} />
      <path d={`M16.4 11.95L${n(w - i)} ${n(h - i)}`} {...line(stroke)} />
    </Svg>
  );
}

// ---------- 지구 (globe) ----------
// 전체메뉴 (C3 39.750 x 230.81 y 73.33) · PIN (C1 7.333, 흰색): 잉크 20.3 정사각, 두께 1.55. 원 + 세로 타원(반지름 5.15) + 위아래 위도선 (±3.5)
export function AoGlobeIcon({ size = 20.3, stroke = 1.55, ...p }: AoIconProps & { size?: number }) {
  const c = size / 2;
  const r = c - stroke / 2;
  const rx = r * 0.548;
  const dy = r * 0.372;
  const chord = Math.sqrt(r * r - dy * dy);
  return (
    <Svg w={size} h={size} {...p}>
      <circle cx={n(c)} cy={n(c)} r={n(r)} {...line(stroke)} />
      <ellipse cx={n(c)} cy={n(c)} rx={n(rx)} ry={n(r)} {...line(stroke)} />
      <path d={`M${n(c - chord)} ${n(c - dy)}H${n(c + chord)}M${n(c - chord)} ${n(c + dy)}H${n(c + chord)}`} {...line(stroke)} />
    </Svg>
  );
}

// ---------- 톱니 (설정) ----------
// 전체메뉴 (C3 39.750 x 271.11 y 74.0): 잉크 19.98 × 20, 두께 1.55. 둥근 꽃잎 8개 (바깥 9.2 / 안 7.7) + 가운데 원 (반지름 3)
export function AoGearIcon({ stroke = 1.55, ...p }: AoIconProps) {
  const w = 19.98;
  const h = 20;
  const cx = w / 2;
  const cy = h / 2;
  const pts: string[] = [];
  for (let k = 0; k <= 96; k++) {
    const a = (k / 96) * Math.PI * 2;
    const r = 8.45 + 0.75 * Math.cos(8 * a);
    pts.push(`${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}`);
  }
  return (
    <Svg w={w} h={h} {...p}>
      <path d={`M${pts.join("L")}Z`} {...line(stroke)} />
      <circle cx={n(cx)} cy={n(cy)} r="3" {...line(stroke)} />
    </Svg>
  );
}

// ---------- 종 (알림) ----------
// 홈 머리줄 (C2 7.000 x 315.74 y 74.0): 잉크 17.65 × 20.67, 두께 1.5. 위 고리 · 몸통 · 아래 받침줄 · 추
export function AoBellIcon({ stroke = 1.5, ...p }: AoIconProps) {
  const w = 17.65;
  const h = 20.67;
  const cx = w / 2;
  const i = stroke / 2;
  const base = 16.4;
  const rc = 1.9; // 추 반지름: 아래 끝 = base + 1.6 + rc + i = h
  return (
    <Svg w={w} h={h} {...p}>
      <circle cx={n(cx)} cy={n(1.3 + i)} r="1.3" {...line(stroke)} />
      <path
        d={`M${n(i)} ${base}C${n(i)} ${base - 1.3} 2.6 ${base - 1.6} 2.6 ${base - 3.6}V9.7C2.6 6.1 5.4 3.35 ${n(cx)} 3.35S${n(w - 2.6)} 6.1 ${n(w - 2.6)} 9.7V${base - 3.6}C${n(w - 2.6)} ${base - 1.6} ${n(w - i)} ${base - 1.3} ${n(w - i)} ${base}Z`}
        {...line(stroke)}
      />
      <path d={`M${n(cx - rc)} ${base}V${n(h - i - rc)}A${rc} ${rc} 0 0 0 ${n(cx + rc)} ${n(h - i - rc)}V${base}`} {...line(stroke)} />
    </Svg>
  );
}

// ---------- 지갑 ----------
// 홈 머리줄 (C2 7.000 x 278.1 y 76.33): 잉크 21.65 × 16.34, 두께 1.5. 둥근 네모 + 덮개 줄 + 오른쪽 잠금 탭과 점
export function AoWalletIcon({ stroke = 1.5, ...p }: AoIconProps) {
  const w = 21.65;
  const h = 16.34;
  const i = stroke / 2;
  return (
    <Svg w={w} h={h} {...p}>
      <rect x={n(i)} y={n(i)} width={n(w - stroke)} height={n(h - stroke)} rx="2.6" {...line(stroke)} />
      <path d={`M${n(i)} 4.7H${n(w - i)}`} {...line(stroke)} />
      <path d={`M${n(w - i)} 7.1H16.2A2.55 2.55 0 0 0 16.2 12.2H${n(w - i)}`} {...line(stroke)} />
      <circle cx="16.45" cy="9.65" r="1.05" fill="currentColor" />
    </Svg>
  );
}

// ---------- 돋보기 ----------
// 전체메뉴 검색 줄 16.32 정사각, 두께 1.3 (C3 39.750 x 31.64 y 132.67) · 통합검색 칸: size 19.98, stroke 1.45 (C3 40.546 x 328.06 y 154)
export function AoMagnifierIcon({ size = 16.32, stroke = 1.3, ...p }: AoIconProps & { size?: number }) {
  const i = stroke / 2;
  const r = size * 0.36;
  const c = i + r;
  const k = c + r * 0.7071;
  return (
    <Svg w={size} h={size} {...p}>
      <circle cx={n(c)} cy={n(c)} r={n(r)} {...line(stroke)} />
      <path d={`M${n(k)} ${n(k)}L${n(size - i)} ${n(size - i)}`} {...line(stroke)} />
    </Svg>
  );
}

// ---------- ☆ / ★ ----------
// 거래내역 상세 ☆ 14 × 14, 두께 1.3, 검정 (C2 18.324 x 78.6 y 133) · T1 줄 ☆: size 20, stroke 1.5, color #8f8f8f (C3 27.5 x 347.04)
// filled: 칠한 별 (#ffc31a 바탕 + 같은 색 테, plan Q23)
export function AoStarIcon({ size = 14, stroke = 1.3, filled = false, fill = "#ffc31a", color, ...p }: AoIconProps & { size?: number; filled?: boolean; fill?: string }) {
  const i = stroke / 2;
  // 뾰족한 별: 가로 = 1.902 R, 세로 = 1.809 R
  const R = Math.min((size - stroke) / 1.902, (size * 0.983 - stroke) / 1.809);
  const cx = size / 2;
  const cy = i + R;
  const r = R * 0.45;
  const pts: Pt[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const h = size * 0.983;
  const d = roundPoly(pts, 0.6);
  const c = filled ? fill : color;
  return (
    <Svg w={size} h={h} color={c} {...p}>
      <path d={d} {...line(stroke)} fill={filled ? "currentColor" : "none"} />
    </Svg>
  );
}

// ---------- ↻ 다시 섞기 ----------
// account (T3 계좌 비밀번호 아래 줄, C3 32.5 x 56.29 y 769.67): 잉크 19.65 × 20, 두께 1.7 — 위 오른쪽이 트인 원 + 끝에 ┘ 화살촉
// pin (간편비밀번호 키패드, C1 7.333 x 54.62 y 764.67): 잉크 22.65 × 26.66, 두께 1.5 — 마주 보는 두 호 + 꺾쇠 머리
export function AoReshuffleIcon({ variant = "account", stroke, ...p }: AoIconProps & { variant?: "account" | "pin" }) {
  if (variant === "pin") {
    const s = stroke ?? 1.5;
    const w = 22.65;
    const h = 26.66;
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - s / 2;
    const at = (deg: number) => [cx + Math.cos((deg * Math.PI) / 180) * r, cy + Math.sin((deg * Math.PI) / 180) * r];
    const [ax, ay] = at(250);
    const [bx, by] = at(110);
    const [cx2, cy2] = at(70);
    const [dx, dy] = at(290);
    const head = 3.4;
    return (
      <Svg w={w} h={h} {...p}>
        {/* 왼쪽 호 (위 → 아래) 와 위 꺾쇠, 오른쪽 호 (아래 → 위) 와 아래 꺾쇠 */}
        <path d={`M${n(ax)} ${n(ay)}A${n(r)} ${n(r)} 0 0 0 ${n(bx)} ${n(by)}`} {...line(s)} />
        <path d={`M${n(cx2)} ${n(cy2)}A${n(r)} ${n(r)} 0 0 0 ${n(dx)} ${n(dy)}`} {...line(s)} />
        <path d={`M${n(cx + 1.2)} ${n(s / 2)}L${n(cx - 2.4)} ${n(cy - r + 0.1)}L${n(cx + 1.2)} ${n(s / 2 + head * 1.9)}`} {...line(s)} />
        <path d={`M${n(cx - 1.2)} ${n(h - s / 2)}L${n(cx + 2.4)} ${n(cy + r - 0.1)}L${n(cx - 1.2)} ${n(h - s / 2 - head * 1.9)}`} {...line(s)} />
      </Svg>
    );
  }
  const s = stroke ?? 1.7;
  const w = 19.65;
  const h = 20;
  const cx = 9.83;
  const cy = 10;
  const r = 9;
  const end = (-25 * Math.PI) / 180;
  const ex = cx + Math.cos(end) * r;
  const ey = cy + Math.sin(end) * r;
  return (
    <Svg w={w} h={h} {...p}>
      <path d={`M${n(cx + r)} ${n(cy)}A${r} ${r} 0 1 1 ${n(ex)} ${n(ey)}`} {...line(s)} />
      <path d={`M${n(ex)} ${n(ey - 4.2)}V${n(ey)}H${n(ex - 4.2)}`} {...line(s)} />
    </Svg>
  );
}

// ---------- ⌫ 지우기 ----------
// pentagon (간편비밀번호, C1 7.333 x 311.07 y 767.33): 잉크 31.98 × 21.34, 두께 1.6 — 왼쪽이 뾰족한 오각형 + ×
// tag (T3 계좌 비밀번호, C3 32.5 x 184.85 y 771.67): 잉크 22.98 × 16, 두께 1.5 — 오른쪽 모서리가 둥근 꼬리표 + ×
export function AoBackspaceIcon({ variant = "tag", stroke, ...p }: AoIconProps & { variant?: "pentagon" | "tag" }) {
  if (variant === "pentagon") {
    const s = stroke ?? 1.6;
    const w = 31.98;
    const h = 21.34;
    const i = s / 2;
    const d = roundPoly(
      [
        [i, h / 2],
        [10.6, i],
        [w - i, i],
        [w - i, h - i],
        [10.6, h - i],
      ],
      [0.4, 0.4, 0, 0, 0.4],
    );
    return (
      <Svg w={w} h={h} {...p}>
        <path d={d} {...line(s, "butt")} strokeLinejoin="miter" />
        <path d={`M16.2 ${n(h / 2 - 4.4)}l8.8 8.8M25 ${n(h / 2 - 4.4)}l-8.8 8.8`} {...line(s)} />
      </Svg>
    );
  }
  const s = stroke ?? 1.5;
  const w = 22.98;
  const h = 16;
  const i = s / 2;
  const d = roundPoly(
    [
      [i, h / 2],
      [6.6, i],
      [w - i, i],
      [w - i, h - i],
      [6.6, h - i],
    ],
    [0.6, 0.8, 2.6, 2.6, 0.8],
  );
  return (
    <Svg w={w} h={h} {...p}>
      <path d={d} {...line(s)} />
      <path d={`M11.9 ${n(h / 2 - 2.7)}l5.4 5.4M17.3 ${n(h / 2 - 2.7)}l-5.4 5.4`} {...line(s)} />
    </Svg>
  );
}

// ---------- ← 금액 키패드 지우기 ----------
// T2 키패드 (C3 29.2 x 298.42 y 697.67): 잉크 17.32 × 13.33, 두께 1.5 둥근 끝
export function AoKeypadBackIcon({ stroke = 1.5, ...p }: AoIconProps) {
  const w = 17.32;
  const h = 13.33;
  const i = stroke / 2;
  return (
    <Svg w={w} h={h} {...p}>
      <path d={`M${n(i)} ${n(h / 2)}H${n(w - i)}M${n(h / 2)} ${n(i)}L${n(i)} ${n(h / 2)}L${n(h / 2)} ${n(h - i)}`} {...line(stroke)} />
    </Svg>
  );
}

// ---------- ✓ 동그라미 ----------
// 간편비밀번호 자동로그인 (C1 7.333 x 152.21 y 298.67, 흰색): 잉크 16.32 정사각, 테 1.3 + 안쪽 체크 ≈ 7 × 5. checked 면 칠한 원 (invented)
export function AoCheckCircleIcon({ size = 16.32, stroke = 1.3, checked = false, ...p }: AoIconProps & { size?: number; checked?: boolean }) {
  const c = size / 2;
  const k = size / 16.32;
  return (
    <Svg w={size} h={size} {...p}>
      <circle cx={n(c)} cy={n(c)} r={n(c - stroke / 2)} {...line(stroke)} fill={checked ? "currentColor" : "none"} />
      <path
        d={`M${n(c - 3.5 * k)} ${n(c + 0.1 * k)}L${n(c - 1.1 * k)} ${n(c + 2.4 * k)}L${n(c + 3.5 * k)} ${n(c - 2.4 * k)}`}
        {...line(stroke)}
        stroke={checked ? "#0c8f2d" : "currentColor"}
      />
    </Svg>
  );
}

// ---------- 압정 (최근 이용메뉴) ----------
// 전체메뉴 (C3 39.750 x 353.0 y ≈ 336): 16.7 정사각, 두께 1.5, #171717 — 45° 기운 압정 (머리 + 몸통 + 바늘)
export function AoPinIcon({ size = 16.7, stroke = 1.5, color = "#171717", ...p }: AoIconProps & { size?: number }) {
  const k = size / 16.7;
  const P = (x: number, y: number) => [x * k, y * k] as const;
  const body = roundPoly([P(9.2, 1.0), P(15.7, 7.5), P(12.6, 10.0), P(12.0, 14.8), P(1.9, 4.7), P(6.7, 4.1)], [1.4, 1.4, 0.8, 1.2, 1.2, 0.8]);
  const [nx, ny] = P(6.9, 9.8);
  const [tx, ty] = P(0.8, 15.9);
  return (
    <Svg w={size} h={size} color={color} {...p}>
      <path d={body} {...line(stroke)} />
      <path d={`M${n(nx)} ${n(ny)}L${n(tx)} ${n(ty)}`} {...line(stroke)} />
    </Svg>
  );
}

// ---------- NH 표시 (고리 + V) ----------
// T3 계좌 비밀번호 빈 키 (C3 32.5 x 334.05 y 577): 잉크 18.66 × 21, #d4d4d8 (칠한 모양)
export function AoNhSymbol({ color = "#d4d4d8", className, style, size = 18.66 }: { color?: string; className?: string; style?: CSSProperties; size?: number }) {
  const w = 18.66;
  const h = 21;
  const cx = w / 2;
  return (
    <Svg w={w} h={h} W={size} H={(size * h) / w} color={color} className={className} style={style}>
      {/* 고리 */}
      <path d={`M${cx} 5.6a7.7 7.7 0 1 1 0 15.4a7.7 7.7 0 1 1 0-15.4Zm0 4.1a3.6 3.6 0 1 0 0 7.2a3.6 3.6 0 1 0 0-7.2Z`} fill="currentColor" fillRule="evenodd" />
      {/* 양쪽 날개 (가운데가 V 로 트임) */}
      <path d={`M0 1.2H5.2L${cx - 0.55} 9.9L${cx - 2.6} 10.2C3.2 8.7 0.9 6.2 0 1.2Z`} fill="currentColor" />
      <path d={`M${w} 1.2H${w - 5.2}L${cx + 0.55} 9.9L${cx + 2.6} 10.2C${w - 3.2} 8.7 ${w - 0.9} 6.2 ${w} 1.2Z`} fill="currentColor" />
      <path d={`M${cx - 2.2} 0L${cx} 4.6L${cx + 2.2} 0Z`} fill="currentColor" />
    </Svg>
  );
}

// ---------- 홈 아래 탭 바 아이콘 (24 × 24, 두께 1.55) ----------
// C2 7.000, 잉크 위 757.0: 홈 x 39.97 (칠한 집 + 흰 문 막대) · 금융상품 113.24 (21.98 폭, 쇼핑백 + 웃음) · 내 자산 184.51 (23.65, "MY")
// 포인트쌓기 256.79 (원 + "P") · 생활혜택 329.06 (선물 상자). 고른 탭은 칠한 아이콘뿐 (글자색은 그대로)
export type AoTabIconName = "home" | "products" | "assets" | "points" | "benefits";
export function AoTabIcon({ name, filled = name === "home", stroke = 1.55, ...p }: AoIconProps & { name: AoTabIconName; filled?: boolean }) {
  const i = stroke / 2;
  if (name === "home") {
    const w = 23.98;
    const h = 24;
    const d = roundPoly(
      [
        [w / 2, i],
        [w - i, 7.3],
        [w - i, h - i],
        [i, h - i],
        [i, 7.3],
      ],
      [2.6, 2, 4, 4, 2],
    );
    return (
      <Svg w={w} h={h} {...p}>
        <path d={d} {...line(stroke)} fill={filled ? "currentColor" : "none"} />
        <path d={`M7.7 18.7H16.3`} {...line(1.9)} stroke={filled ? "#fff" : "currentColor"} />
      </Svg>
    );
  }
  if (name === "products") {
    const w = 21.98;
    const h = 24;
    return (
      <Svg w={w} h={h} {...p}>
        <path d={roundPoly([[i, 6.2], [w - i, 6.2], [w - i, h - i], [i, h - i]], 2.2)} {...line(stroke)} fill={filled ? "currentColor" : "none"} />
        <path d={`M${n(i)} 6.2L3.6 ${n(i)}H${n(w - 3.6)}L${n(w - i)} 6.2`} {...line(stroke)} />
        <path d="M6.9 11.6C7.6 14.3 9.2 15.4 10.99 15.4S14.4 14.3 15.1 11.6" {...line(stroke)} stroke={filled ? "#fff" : "currentColor"} />
      </Svg>
    );
  }
  if (name === "assets") {
    const w = 23.65;
    const h = 24;
    return (
      <Svg w={w} h={h} {...p}>
        <rect x={i} y={i} width={n(w - stroke)} height={n(h - stroke)} rx="3.4" {...line(stroke)} fill={filled ? "currentColor" : "none"} />
        <text x={n(w / 2)} y="16.1" textAnchor="middle" fontSize="9.4" fontWeight="800" fill={filled ? "#fff" : "currentColor"} style={{ fontFamily: "var(--ao-font)", letterSpacing: "-0.2px" }}>
          MY
        </text>
      </Svg>
    );
  }
  if (name === "points") {
    const w = 23.98;
    const h = 24;
    return (
      <Svg w={w} h={h} {...p}>
        <circle cx={n(w / 2)} cy={n(h / 2)} r={n(w / 2 - i)} {...line(stroke)} fill={filled ? "currentColor" : "none"} />
        <text x={n(w / 2)} y="16.3" textAnchor="middle" fontSize="11.5" fontWeight="800" fill={filled ? "#fff" : "currentColor"} style={{ fontFamily: "var(--ao-font)" }}>
          P
        </text>
      </Svg>
    );
  }
  const w = 23.98;
  const h = 24;
  return (
    <Svg w={w} h={h} {...p}>
      <rect x={i} y="6.6" width={n(w - stroke)} height="5" rx="1" {...line(stroke)} fill={filled ? "currentColor" : "none"} />
      <path d={`M2.3 11.6V${n(h - i - 1.2)}Q2.3 ${n(h - i)} 3.5 ${n(h - i)}H${n(w - 3.5)}Q${n(w - 2.3)} ${n(h - i)} ${n(w - 2.3)} ${n(h - i - 1.2)}V11.6`} {...line(stroke)} />
      <path d={`M${n(w / 2)} 6.6V${n(h - i)}`} {...line(stroke)} />
      <path d={`M${n(w / 2)} 6.4C10.4 2.2 6.2 0.4 5.3 2.6C4.5 4.7 8.6 6.4 ${n(w / 2)} 6.4C13.6 2.2 17.8 0.4 18.7 2.6C19.5 4.7 15.4 6.4 ${n(w / 2)} 6.4Z`} {...line(stroke)} />
    </Svg>
  );
}
