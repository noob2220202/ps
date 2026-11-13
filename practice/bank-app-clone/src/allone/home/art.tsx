// 홈 영역 그림: 녹화에서 자른 그림(allone-home-*.png, 4px/pt — 크기는 그림의 px / 4)과 지어낸 SVG 그림.
// 자른 그림은 녹화의 잉크 상자 왼쪽 위(x, y)에 그대로 놓음 (자리 값은 home.css · 각 화면에서)
import type { CSSProperties } from "react";
import { localAsset } from "../../assets/Asset";

// 자른 그림의 px 크기 (scripts/allone-crops/home.py 출력). 화면 크기 = px / 4 pt — 그림을 받기 전 첫 프레임부터 제 크기
const SIZE: Record<string, [number, number]> = {
  "allone-home-ad-bond": [310, 251],
  "allone-home-asset": [196, 207],
  "allone-home-banner": [302, 244],
  "allone-home-calendar": [339, 254],
  "allone-home-clover": [52, 63],
  "allone-home-group-capital": [130, 137],
  "allone-home-group-card": [138, 94],
  "allone-home-group-insurance": [127, 137],
  "allone-home-group-invest": [138, 134],
  "allone-home-group-life": [136, 138],
  "allone-home-group-savings": [138, 111],
  "allone-home-life-car": [260, 261],
  "allone-home-life-insurance": [263, 259],
  "allone-home-mart": [224, 204],
  "allone-home-menu-ai": [194, 195],
  "allone-home-menu-event": [108, 103],
  "allone-home-menu-help": [99, 98],
  "allone-home-menu-security": [92, 101],
  "allone-home-menu-wallet": [93, 89],
  "allone-home-moim": [410, 352],
  "allone-home-notice-bell": [251, 247],
  "allone-home-quick-accounts": [89, 106],
  "allone-home-quick-bills": [99, 112],
  "allone-home-quick-coupon": [116, 87],
  "allone-home-quick-limit": [114, 118],
  "allone-home-quick-owner": [97, 113],
  "allone-home-quick-register": [111, 106],
  "allone-home-quick-roulette": [109, 115],
  "allone-home-ticker-bag": [132, 132],
  "allone-home-ticker-flame": [111, 147],
  "allone-home-ticker-point": [132, 146],
};

// 자른 그림 한 장을 (x, y) pt 에 (없으면 같은 크기의 빈 자리 — 저장소에 그림이 빠져도 화면은 깨지지 않음)
export function Art({ name, x, y, className, style }: { name: string; x?: number; y?: number; className?: string; style?: CSSProperties }) {
  const src = localAsset(name);
  const [w, h] = SIZE[name] ?? [0, 0];
  const box: CSSProperties = { width: w / 4, height: h / 4, ...(x !== undefined && { left: x }), ...(y !== undefined && { top: y }), ...style };
  const cls = `ao-home-art${className ? ` ${className}` : ""}`;
  if (!src) return <span aria-hidden className={cls} style={box} />;
  return <img src={src} alt="" aria-hidden draggable={false} className={cls} style={box} />;
}

// ---------- 지어낸 그림 (SVG) ----------

// 광고 1: 초록 NH 체크카드 + 동전 (녹화의 인물 광고 대신, 손 그림 자리 x 262–356)
export function ArtCardAd() {
  return (
    <svg width="90" height="70" viewBox="0 0 90 70" aria-hidden>
      <defs>
        <linearGradient id="ao-home-card-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fbf6a" />
          <stop offset="1" stopColor="#14904a" />
        </linearGradient>
        <radialGradient id="ao-home-coin-g" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#f2a91c" />
        </radialGradient>
      </defs>
      <g transform="rotate(-12 45 36)">
        <rect x="10" y="14" width="62" height="40" rx="6" fill="url(#ao-home-card-g)" />
        <rect x="18" y="31" width="11" height="8" rx="1.5" fill="#d9f5c8" />
        <text x="18" y="27" fontSize="9" fontWeight="800" fill="#fff" style={{ fontFamily: "var(--ao-font)" }}>
          NH
        </text>
        <rect x="18" y="45" width="22" height="2.4" rx="1.2" fill="#0d6f36" />
      </g>
      <circle cx="70" cy="50" r="13" fill="url(#ao-home-coin-g)" />
      <circle cx="70" cy="50" r="9.5" fill="none" stroke="#e39612" strokeWidth="1.4" />
      <text x="70" y="54.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#c46f00" style={{ fontFamily: "var(--ao-font)" }}>
        ₩
      </text>
    </svg>
  );
}

// 광고 3: 운동화 + 발자국 + P 동전 (만보기)
export function ArtStepsAd() {
  return (
    <svg width="90" height="70" viewBox="0 0 90 70" aria-hidden>
      <defs>
        <linearGradient id="ao-home-shoe-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6aa8ff" />
          <stop offset="1" stopColor="#2f6fe8" />
        </linearGradient>
      </defs>
      <path d="M14 44c0-9 4-17 9-21l7 6c3 2 7 3 11 3h10c8 0 15 5 15 12v3H14Z" fill="url(#ao-home-shoe-g)" />
      <path d="M12 47h56a3 3 0 0 1 0 6H15a3 3 0 0 1-3-3Z" fill="#eef3fb" stroke="#c9d6ea" strokeWidth="1" />
      <path d="M31 33l5-4M36 35l5-4M41 37l5-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <g fill="#a9d8b8">
        <ellipse cx="9" cy="24" rx="3" ry="4.4" transform="rotate(-18 9 24)" />
        <ellipse cx="18" cy="13" rx="3" ry="4.4" transform="rotate(-18 18 13)" />
      </g>
      <circle cx="72" cy="20" r="12" fill="#ff8a1f" />
      <circle cx="72" cy="20" r="8.6" fill="none" stroke="#ffd2a6" strokeWidth="1.2" />
      <text x="72" y="24.6" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#fff" style={{ fontFamily: "var(--ao-font)" }}>
        P
      </text>
    </svg>
  );
}

// 카드 아래 광고 그림 (80.6 × 56, 둥글기 6): 연두 바탕에 달력 + 돼지 저금통 (녹화의 공익 광고 대신)
export function ArtSavingAd() {
  return (
    <svg width="80.6" height="56" viewBox="0 0 80.6 56" aria-hidden>
      <rect width="80.6" height="56" rx="6" fill="#e6f6ea" />
      <rect x="9" y="12" width="30" height="32" rx="4" fill="#fff" stroke="#9fd3ae" strokeWidth="1.2" />
      <rect x="9" y="12" width="30" height="9" rx="4" fill="#2fb357" />
      <rect x="9" y="17" width="30" height="4" fill="#2fb357" />
      <path d="M15 27h4M22 27h4M29 27h4M15 33h4M22 33h4M29 33h4M15 39h4" stroke="#bfe3c9" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="31" cy="38.5" r="4.2" fill="#ff6b5b" />
      <path d="M29.3 38.6l1.3 1.3 2.4-2.6" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="59" cy="34" rx="15" ry="12" fill="#ff9fb3" />
      <circle cx="70.5" cy="31.5" r="4.6" fill="#ff8aa2" />
      <circle cx="71.6" cy="31" r="0.9" fill="#b0405a" />
      <circle cx="69.3" cy="31" r="0.9" fill="#b0405a" />
      <path d="M53 22.8l2.6 4.2h-5.3Z" fill="#ff8aa2" />
      <rect x="54" y="22.6" width="9" height="2" rx="1" fill="#b0405a" />
      <rect x="49" y="43" width="4" height="5" rx="1.5" fill="#ff8aa2" />
      <rect x="62" y="43" width="4" height="5" rx="1.5" fill="#ff8aa2" />
      <circle cx="58" cy="15" r="5.5" fill="#ffd44d" stroke="#f0a91c" strokeWidth="1" />
    </svg>
  );
}

// 생활자산 3번째 카드(헬스케어) 흰 타일 64 × 64 (자른 타일과 같은 초타원 모양)
export function ArtHealthTile() {
  const s = 64;
  const n = 2.6;
  const pts: string[] = [];
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2;
    const c = Math.cos(a);
    const si = Math.sin(a);
    const x = Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = Math.sign(si) * Math.abs(si) ** (2 / n);
    pts.push(`${(s / 2 + x * (s / 2)).toFixed(2)} ${(s / 2 + y * (s / 2)).toFixed(2)}`);
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
      <path d={`M${pts.join("L")}Z`} fill="#fff" />
      <path d="M32 47c-9-6-15-11.5-15-18a7.5 7.5 0 0 1 15-2.5A7.5 7.5 0 0 1 47 29c0 6.5-6 12-15 18Z" fill="#ff5b6e" />
      <path d="M19 31h7l2.5-5 4 9 2.5-4h10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 바로가기 메뉴설정: 회색 점선 둥근 네모 + (17.75 × 17.5, #c9c9c9)
export function ArtMenuSetting() {
  return (
    <svg width="17.75" height="17.5" viewBox="0 0 17.75 17.5" aria-hidden>
      <rect x="0.6" y="0.6" width="16.55" height="16.3" rx="4.2" fill="none" stroke="#c9c9c9" strokeWidth="1.1" strokeDasharray="2.2 1.8" />
      <path d="M8.875 5.2v7.1M5.3 8.75h7.15" stroke="#c9c9c9" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
