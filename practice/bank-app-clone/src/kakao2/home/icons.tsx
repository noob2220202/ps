// kakao2 홈에만 쓰는 선 아이콘 (인라인 SVG, 크기 = 녹화에서 잰 잉크 상자 pt). 공용 그림은 ../art.tsx
import { useId } from "react";
type P = { color?: string; className?: string };

// ---------- 탭바 (녹화 1.8초 잉크 상자, 두께 2) ----------
// 홈: 채운 집 (둥근 모서리) + 아래 가운데 문 홈. 20.65 × 20.3
export function NavHome({ color = "currentColor" }: P) {
  return (
    <svg width="20.65" height="20.3" viewBox="0 0 20.65 20.3" aria-hidden>
      <path
        d="M10.33 1.1L19.5 8.2V18.4Q19.5 19.3 18.6 19.3H12.25V14.5A1.92 1.92 0 0 0 8.4 14.5V19.3H2.05Q1.15 19.3 1.15 18.4V8.2Z"
        fill={color}
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
// 혜택: 둥근 상자 + 가운데 세로줄 + 위로 벌어진 V (안테나 같은 리본). 20.65 × 21
export function NavBenefit({ color = "currentColor" }: P) {
  return (
    <svg width="20.65" height="21" viewBox="0 0 20.65 21" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1" y="7.2" width="18.65" height="12.8" rx="4" />
      <path d="M10.33 7.2V20M10.33 7.2L5.4 1M10.33 7.2L15.25 1" />
    </svg>
  );
}
// AI: 오목한 네 꼭지 별 테두리 (끝 둥글게) + 가운데 세로 막대. 23 × 23. 녹화 1.8초 아이콘을 5° 마다 잰 반지름(꼭지 10.5 · 대각선 6.83)에 맞춘 곡선
export function NavAi({ color = "currentColor" }: P) {
  return (
    <svg width="23" height="23" viewBox="0 0 23 23" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M22 11.5C22 13.55 19.16 13.5 16.33 16.33C13.5 19.16 13.55 22 11.5 22C9.45 22 9.5 19.16 6.67 16.33C3.84 13.5 1 13.55 1 11.5C1 9.45 3.84 9.5 6.67 6.67C9.5 3.84 9.45 1 11.5 1C13.55 1 13.5 3.84 16.33 6.67C19.16 9.5 22 9.45 22 11.5Z" />
      <path d="M11.5 8.5V14.5" />
    </svg>
  );
}
// 투자: 둥근 네모 + 오른쪽 위로 꺾여 오르는 화살표. 21.3 × 20
export function NavInvest({ color = "currentColor" }: P) {
  return (
    <svg width="21.3" height="20" viewBox="0 0 21.3 20" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1" y="1" width="19.3" height="18" rx="5" />
      <path d="M5.6 13.6L9 10.2L11.6 12.6L15.7 7.1M12.4 6.9H15.9V10.3" />
    </svg>
  );
}
// 전체: 가로 줄 셋. 18.25 × 14.6
export function NavAll({ color = "currentColor" }: P) {
  return (
    <svg width="18.25" height="14.6" viewBox="0 0 18.25 14.6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M1 1H17.25M1 7.3H17.25M1 13.6H17.25" />
    </svg>
  );
}

// ---------- 카드 안 ----------
// 더하기 (칩 9.7 × 9.3 두께 1.5 / 상품 추가 11.7 × 12 두께 1.8)
export function K2Plus({ width = 9.7, height = 9.3, stroke = 1.5, color = "currentColor", className }: { width?: number; height?: number; stroke?: number } & P) {
  const c = stroke / 2;
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" aria-hidden>
      <path d={`M${width / 2} ${c}V${height - c}M${c} ${height / 2}H${width - c}`} />
    </svg>
  );
}

// 간편 홈 앞 세리프 T (12 × 10.7, #9e9e9e)
export function K2SerifT({ color = "#9e9e9e" }: P) {
  return (
    <svg width="12" height="10.7" viewBox="0 0 12 10.7" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M0.7 2.6V0.7H11.3V2.6M6 0.7V10M4 10H8" />
    </svg>
  );
}

// 화면 편집 앞 조절 막대 둘 (11.7 × 11.3): 윗줄 고리는 오른쪽, 아랫줄 고리는 왼쪽
export function K2Sliders({ color = "#9e9e9e" }: P) {
  return (
    <svg width="11.7" height="11.3" viewBox="0 0 11.7 11.3" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" aria-hidden>
      <path d="M0.65 2.85H5.4M9.3 2.85H11.05M0.65 8.45H2.4M6.3 8.45H11.05" />
      <circle cx="7.35" cy="2.85" r="1.95" />
      <circle cx="4.35" cy="8.45" r="1.95" />
    </svg>
  );
}

// 떠 있는 광고 오른쪽 위 i (지름 15.5 회색 원 + 흰 i)
export function K2Info() {
  return (
    <svg width="15.5" height="15.5" viewBox="0 0 15.5 15.5" aria-hidden>
      <circle cx="7.75" cy="7.75" r="7.75" fill="#bababa" />
      <circle cx="7.75" cy="4.55" r="1.05" fill="#fff" />
      <path d="M7.75 7V11.4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

// ---------- AI 알약 별 ----------
// 모양은 ../art.tsx K2AiStar 와 같은 오목한 네 꼭지 별 (16pt). 색은 녹화 2.2초 별을 자리마다 뽑아 다시 맞춤: 오른쪽 위 · 왼쪽 아래가 같은 색
// → 왼쪽 위에서 오른쪽 아래로 (0.6, 0.8) 방향 그라데이션. 위 #13c6e5 · 왼쪽 #1dc9ca · 가운데 #66d44f · 오른쪽 #aadc17 · 아래 #b4dd16
// (K2AiStar pill 은 거의 세로라 오른쪽 꼭지가 청록으로 나옴). 가운데 막대 1.5 × 6 #1a2419
const PILL_STAR =
  "M14.34 8L14.27 8.01 14.08 8.06 13.77 8.16 13.36 8.35 12.86 8.62 12.3 8.97 11.7 9.41 11.08 9.92 10.48 10.48 9.92 11.08 9.41 11.7 8.97 12.3 8.62 12.86 8.35 13.36 8.16 13.77 8.06 14.08 8.01 14.27 8 14.34 7.99 14.27 7.94 14.08 7.84 13.77 7.65 13.36 7.38 12.86 7.03 12.3 6.59 11.7 6.08 11.08 5.52 10.48 4.92 9.92 4.3 9.41 3.7 8.97 3.14 8.62 2.64 8.35 2.23 8.16 1.92 8.06 1.73 8.01 1.66 8 1.73 7.99 1.92 7.94 2.23 7.84 2.64 7.65 3.14 7.38 3.7 7.03 4.3 6.59 4.92 6.08 5.52 5.52 6.08 4.92 6.59 4.3 7.03 3.7 7.38 3.14 7.65 2.64 7.84 2.23 7.94 1.92 7.99 1.73 8 1.66 8.01 1.73 8.06 1.92 8.16 2.23 8.35 2.64 8.62 3.14 8.97 3.7 9.41 4.3 9.92 4.92 10.48 5.52 11.08 6.08 11.7 6.59 12.3 7.03 12.86 7.38 13.36 7.65 13.77 7.84 14.08 7.94 14.27 7.99Z";
export function K2PillStar({ size = 16 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="4.16" y1="2.88" x2="11.84" y2="13.12">
          <stop offset="0" stopColor="#0ac3f0" />
          <stop offset="0.125" stopColor="#13c6e5" />
          <stop offset="0.219" stopColor="#1dc9ca" />
          <stop offset="0.281" stopColor="#30cea6" />
          <stop offset="0.5" stopColor="#66d44f" />
          <stop offset="0.719" stopColor="#9edb1b" />
          <stop offset="0.781" stopColor="#aadc17" />
          <stop offset="0.875" stopColor="#b4dd16" />
          <stop offset="1" stopColor="#b9dd15" />
        </linearGradient>
      </defs>
      <path d={PILL_STAR} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth="3.32" strokeLinejoin="round" />
      <rect x="7.25" y="5" width="1.5" height="6" rx="0.3" fill="#1a2419" />
    </svg>
  );
}
