import { useState } from "react";
import "./art.css";

export function BMark({ size = 70, color = "#000", hole = "var(--yellow)" }: { size?: number; color?: string; hole?: string }) {
  return (
    <svg width={size} height={(size * 88) / 70} viewBox="0 0 70 88" aria-hidden>
      <path
        fill={color}
        d="M0 5a5 5 0 0 1 5-5h40c9 0 15 6 15 15v14c0 6-3 10-7 12 10 3 17 10 17 22v6c0 13-9 19-22 19H5a5 5 0 0 1-5-5Z"
      />
      <rect x="27" y="20" width="9" height="40" rx="1" fill={hole} />
    </svg>
  );
}

export function Wordmark({ height = 30 }: { height?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: height }}>
      <span className="wordmark__light">kakao</span>
      <span className="wordmark__bold">bank</span>
    </span>
  );
}

export function AlbumLogo({ size = 22 }: { size?: number }) {
  return (
    <span className="album-logo" style={{ fontSize: size }}>
      AND2BLE
    </span>
  );
}

// 아이돌 사진은 저작권 때문에 저장소에 안 올림. public/local/ad.jpg를 넣으면 그걸 쓰고,
// 없으면 실루엣 플레이스홀더를 그린다 (img onError로 대체).
export function AdPhoto({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return <img className={className} src="/local/ad.jpg" alt="" onError={() => setFailed(true)} />;
  }
  const people = [
    { x: 22, hair: "#6b2230", top: "#1d1d22" },
    { x: 50, hair: "#141418", top: "#23283a" },
    { x: 80, hair: "#e9d27a", top: "#1f2b2a" },
    { x: 108, hair: "#d8b562", top: "#18181c" },
    { x: 138, hair: "#16161a", top: "#3b3b40" },
  ];
  return (
    <svg className={className} viewBox="0 0 160 110" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="160" height="110" fill="#ecebe8" />
      {people.map((p, i) => (
        <g key={i}>
          <path d={`M${p.x - 22} 110c0-26 10-40 22-40s22 14 22 40Z`} fill={p.top} />
          <circle cx={p.x} cy={i % 2 ? 52 : 46} r="13" fill="#f1d6c6" />
          <path d={`M${p.x - 14} ${i % 2 ? 50 : 44}c0-12 6-18 14-18s14 6 14 18c-6-6-20-6-28 0Z`} fill={p.hair} />
        </g>
      ))}
      <path d="M150 74h10v36h-14Z" fill="#c8202a" opacity=".9" />
    </svg>
  );
}

export function FriendsIllustration({ width = 200 }: { width?: number }) {
  return (
    <svg width={width} viewBox="0 0 200 140" aria-hidden>
      {/* 왼쪽: 곱슬머리 + 풍선껌 */}
      <g>
        {[
          [46, 44, 14],
          [58, 31, 15],
          [76, 28, 15],
          [92, 36, 13],
          [42, 60, 10],
          [98, 52, 9],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="#f0872c" />
        ))}
        <circle cx="70" cy="62" r="28" fill="#ffcfb0" />
        <path d="M44 52c8-14 40-16 52-2-6-4-14-4-20 0-8-6-22-6-32 2Z" fill="#f0872c" />
        <circle cx="62" cy="62" r="2.6" fill="#222" />
        <circle cx="80" cy="62" r="2.6" fill="#222" />
        <circle cx="76" cy="79" r="9" fill="#ff9fcb" />
        <circle cx="73" cy="76" r="2.5" fill="#fff" opacity=".7" />
      </g>
      {/* 오른쪽: 머리띠 */}
      <g>
        <path d="M104 58c0-24 14-38 32-38s32 14 32 38Z" fill="#f47b25" />
        <circle cx="136" cy="62" r="28" fill="#ffc9a6" />
        <path d="M106 46c10-10 50-10 60 0v8c-10-8-50-8-60 0Z" fill="#e8402a" />
        <path d="M108 40c6-12 50-12 56 0" stroke="#f47b25" strokeWidth="8" fill="none" />
        <circle cx="127" cy="62" r="2.6" fill="#222" />
        <circle cx="145" cy="62" r="2.6" fill="#222" />
        <path d="M128 72c4 8 12 8 16 0Z" fill="#b8322a" />
      </g>
      {/* 가운데 앞: 단발 */}
      <g>
        <path d="M70 110c0-30 14-44 32-44s32 14 32 44Z" fill="#9c4a24" />
        <circle cx="102" cy="104" r="27" fill="#ffd3b6" />
        <path d="M74 98c4-20 18-28 28-28s24 8 28 28c-10-12-22-14-28-14s-18 2-28 14Z" fill="#9c4a24" />
        <circle cx="93" cy="104" r="2.6" fill="#222" />
        <circle cx="111" cy="104" r="2.6" fill="#222" />
        <path d="M95 113c3 7 11 7 14 0Z" fill="#c9372b" />
      </g>
    </svg>
  );
}

export function FriendsAvatar({ size = 52 }: { size?: number }) {
  return (
    <div className="friends-avatar" style={{ width: size, height: size }}>
      <FriendsIllustration width={size * 0.82} />
    </div>
  );
}

export function AiDiamond({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 1 12 12 1 12Z" fill="#2fc48d" />
      <path d="M12 1 23 12 12 12Z" fill="#2f8cff" />
      <path d="M1 12 12 12 12 23Z" fill="#ffd400" />
      <path d="M23 12 12 12 12 23Z" fill="#20c3d0" />
      <path d="M12 7l1.2 3.8L17 12l-3.8 1.2L12 17l-1.2-3.8L7 12l3.8-1.2Z" fill="#fff" />
    </svg>
  );
}

export function CoinIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#f9c514" />
      <path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h6" stroke="#fff3b0" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function RingSpinner({ size = 22 }: { size?: number }) {
  return <span className="ring-spinner" style={{ width: size, height: size }} />;
}

export function ArcSpinner({ size = 28, color = "#9a9a9a" }: { size?: number; color?: string }) {
  return (
    <svg className="arc-spinner" width={size} height={size} viewBox="0 0 50 50" aria-label="로딩 중">
      <circle cx="25" cy="25" r="20" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function NhIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <circle cx="17" cy="17" r="17" fill="#33a54f" />
      <circle cx="17" cy="19" r="5.5" fill="none" stroke="#ffd640" strokeWidth="2.6" />
      <circle cx="14.2" cy="11.5" r="1.6" fill="#ffd640" />
      <circle cx="19.8" cy="11.5" r="1.6" fill="#ffd640" />
    </svg>
  );
}

export function AiSavingIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <circle cx="17" cy="17" r="17" fill="#3d4a42" />
      <rect x="8" y="10" width="17" height="12" rx="2" fill="#c1efdb" />
      <rect x="8" y="13" width="17" height="2.4" fill="#79c9a6" />
      <path d="m19 21 3 3 5-6" stroke="#ffd400" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MiniBIcon() {
  return (
    <div className="mini-b-icon">
      <BMark size={12} color="#fff" hole="var(--beige-icon)" />
    </div>
  );
}

export function CardThumb() {
  return (
    <svg width="28" height="44" viewBox="0 0 28 44" aria-hidden>
      <path d="M14 32v12" stroke="#6b6b6b" strokeWidth="1" />
      <rect x="3" y="1" width="22" height="32" rx="2.5" fill="#cfe2f3" />
      <rect x="15" y="1" width="10" height="32" rx="2.5" fill="#e9f2fa" />
      <circle cx="12" cy="22" r="5.5" fill="#f3c98b" />
      <circle cx="10.4" cy="21.4" r=".8" fill="#333" />
      <circle cx="13.6" cy="21.4" r=".8" fill="#333" />
      <path d="M8 28h8" stroke="#e08b3b" strokeWidth="2" />
    </svg>
  );
}

export function CashbackIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <circle cx="17" cy="17" r="17" fill="#3a3a3a" />
      <rect x="8" y="11" width="18" height="12" rx="2" fill="#7fd18b" />
      <circle cx="17" cy="17" r="3.2" fill="#3f9e4c" />
    </svg>
  );
}

export function TmoneyIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
      <circle cx="17" cy="17" r="17" fill="#3a3a3a" />
      <path d="M10 11h14v3.4h-5.2V24h-3.6v-9.6H10Z" fill="#ff7a2f" />
    </svg>
  );
}
