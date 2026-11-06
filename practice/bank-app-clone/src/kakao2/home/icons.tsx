// kakao2 홈에만 쓰는 선 아이콘 (인라인 SVG, 크기 = 녹화에서 잰 잉크 상자 pt). 공용 그림은 ../art.tsx
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
