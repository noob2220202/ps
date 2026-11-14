// 토스 선 아이콘 (SVG, 24 viewBox 기본). 색은 currentColor. 영역이 녹화에 더 맞게 고치려면 자기 폴더에 따로 그림 (이 파일은 공용이라 병렬 작업 중엔 고정)
import type { CSSProperties, ReactNode } from "react";

export interface TossIconProps {
  size?: number;
  color?: string;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
}

const Svg = ({ size = 24, color = "currentColor", className, style, children, vb = 24 }: TossIconProps & { children: ReactNode; vb?: number }) => (
  <svg className={className} style={{ color, flexShrink: 0, ...style }} width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none" aria-hidden>
    {children}
  </svg>
);
const line = (stroke = 2) => ({ stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

// ← (광고 화면 · 메모 고치기): 머리줄 AppBar ← 와 같은 그림 (화살촉이 조금 작고 0.6dp 오른쪽 · 아래)
export const BackIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="M21 12.3H3.9M11.6 4.6 3.9 12.3l7.7 7.7" {...line(p.stroke ?? 2)} />
  </Svg>
);
export const ChevronRightIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="m9.5 6 6 6-6 6" {...line(p.stroke ?? 2)} />
  </Svg>
);
export const ChevronLeftIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="m14.5 6-6 6 6 6" {...line(p.stroke ?? 2)} />
  </Svg>
);
export const ChevronDownIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="m6 9.5 6 6 6-6" {...line(p.stroke ?? 2)} />
  </Svg>
);
export const ChevronUpIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="m6 14.5 6-6 6 6" {...line(p.stroke ?? 2)} />
  </Svg>
);
// ◂ ▸ (소비 달 넘기기): 채운 작은 삼각형
export const TriLeftIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="M15 6.5v11L8 12Z" fill="currentColor" />
  </Svg>
);
export const TriRightIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="M9 6.5v11l7-5.5Z" fill="currentColor" />
  </Svg>
);
export const CloseIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" {...line(p.stroke ?? 2)} />
  </Svg>
);
export const SearchIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <circle cx="10.8" cy="10.8" r="6.8" {...line(p.stroke ?? 2)} />
    <path d="m15.8 15.8 4.7 4.7" {...line(p.stroke ?? 2)} />
  </Svg>
);
const GEAR =
  "M12 2.8l1.6.2.5 2.3a7 7 0 0 1 1.8 1l2.2-.8 1.6 1.4-1 2.2a7 7 0 0 1 .5 2l2 1.2v2.1l-2 1.2a7 7 0 0 1-.5 2l1 2.2-1.6 1.4-2.2-.8a7 7 0 0 1-1.8 1l-.5 2.3-1.6.2-1.6-.2-.5-2.3a7 7 0 0 1-1.8-1l-2.2.8-1.6-1.4 1-2.2a7 7 0 0 1-.5-2l-2-1.2v-2.1l2-1.2a7 7 0 0 1 .5-2l-1-2.2 1.6-1.4 2.2.8a7 7 0 0 1 1.8-1l.5-2.3Z";
export const GearIcon = (p: TossIconProps & { filled?: boolean }) => (
  <Svg {...p}>
    {p.filled ? (
      <>
        <path d={GEAR} fill="currentColor" />
        <circle cx="12" cy="12" r="3" fill="#171619" />
      </>
    ) : (
      <>
        <path d={GEAR} {...line(p.stroke ?? 1.6)} />
        <circle cx="12" cy="12" r="3" {...line(p.stroke ?? 1.6)} />
      </>
    )}
  </Svg>
);
export const CardIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" {...line(p.stroke ?? 1.8)} />
    <path d="M3 10h18M6.5 14.5h4" {...line(p.stroke ?? 1.8)} />
  </Svg>
);
export const ShareIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="M12 3.5v11M7.5 8 12 3.5 16.5 8M5 12.5v6.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-6.5" {...line(p.stroke ?? 1.8)} />
  </Svg>
);
// ★ 즐겨찾기: 꺼짐 #413f42 / 켜짐 #ffc342 (transfer.md)
export const StarIcon = (p: TossIconProps & { on?: boolean }) => (
  <Svg {...p} color={p.color ?? (p.on ? "#ffc342" : "#413f42")}>
    <path d="m12 3.2 2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 16.6l-5.3 2.9 1.1-5.9-4.4-4.1 6-.8Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </Svg>
);
export const CameraIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" {...line(p.stroke ?? 1.8)} />
    <circle cx="12" cy="12.8" r="3.3" {...line(p.stroke ?? 1.8)} />
  </Svg>
);
// 파란 방패 (사기계좌 조회 끝): 12.8 × 15.2 잉크, #2e7ff4
export const ShieldIcon = (p: TossIconProps) => (
  <Svg {...p} color={p.color ?? "#2e7ff4"}>
    <path d="M12 2.5 19.5 5v6.3c0 4.6-3.1 8.4-7.5 10.2-4.4-1.8-7.5-5.6-7.5-10.2V5Z" fill="currentColor" />
    <path d="m8.6 11.9 2.4 2.4 4.4-4.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
export const CheckIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" {...line(p.stroke ?? 2.2)} />
  </Svg>
);
// ✓ 동그라미: outline (선) / filled (채운 원 + 뚫린 ✓)
export const CheckCircleIcon = (p: TossIconProps & { filled?: boolean; knock?: string }) => (
  <Svg {...p}>
    {p.filled ? (
      <>
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="m7.6 12.2 3 3 5.8-6" stroke={p.knock ?? "#171619"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="9.2" {...line(p.stroke ?? 1.6)} />
        <path d="m7.8 12.2 3 3 5.6-5.8" {...line(p.stroke ?? 1.8)} />
      </>
    )}
  </Svg>
);
export const PlusIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" {...line(p.stroke ?? 2)} />
  </Svg>
);
export const MoreIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <circle cx="5.5" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.7" fill="currentColor" />
  </Svg>
);
// 금액 자판 ← : 20 × 17.6 잉크 (transfer.md §2.4)
export const KeypadBackIcon = (p: TossIconProps) => (
  <Svg {...p}>
    <path d="M21.5 12H3.5M10.8 4.7 3.5 12l7.3 7.3" {...line(p.stroke ?? 2)} />
  </Svg>
);
// ⓧ 지우기: 회색 원 + 뚫린 ×
export const ClearIcon = (p: TossIconProps & { knock?: string }) => (
  <Svg {...p} color={p.color ?? "#4e4d52"}>
    <circle cx="12" cy="12" r="9" fill="currentColor" />
    <path d="m8.8 8.8 6.4 6.4m0-6.4-6.4 6.4" stroke={p.knock ?? "#171619"} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

