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

