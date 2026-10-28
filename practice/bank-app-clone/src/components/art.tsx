import "./art.css";

// 카카오뱅크 B. 실제 앱 아이콘을 8배로 키워 줄마다 잰 윤곽(70×88 기준)으로 그림:
// 위·아래 배가 똑같이 꽉 차고(오른쪽 끝 70), 가운데 허리만 60까지 들어감. 세로 홈은 두 배를 길게 관통
export function BMark({ size = 70, color = "#000", hole = "var(--yellow)" }: { size?: number; color?: string; hole?: string }) {
  return (
    <svg width={size} height={(size * 88) / 70} viewBox="0 0 70 88" aria-hidden>
      <path
        fill={color}
        d="M4 0H46C60 0 70 9 70 21V27C70 35 65 40 60.5 43.8C65 47.5 70 52 70 60V66C70 79 60 88 47 88H4Q0 88 0 84V4Q0 0 4 0Z"
      />
      <rect x="28.5" y="23" width="9.2" height="42" rx="0.6" fill={hole} />
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

