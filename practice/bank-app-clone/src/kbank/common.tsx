import { localAsset } from "../assets/Asset";

// 앱 아이콘 (로그인·프로필 고르기 위): App Store 원본을 갤럭시 모양으로 (scripts/kbank-crops/appicon.py)
export function KbankAppIcon({ size = 46 }: { size?: number }) {
  const src = localAsset("kbank-app-icon");
  if (src) return <img src={src} alt="케이뱅크" width={size} height={size} draggable={false} style={{ display: "block" }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="케이뱅크">
      <rect width="48" height="48" rx="13" fill="#0212a4" />
      <text x="24" y="33" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="800" fontFamily="inherit">
        K
      </text>
    </svg>
  );
}

// 시작화면 'Kbank' 글자: 녹화 5.6~6.2초 정지 프레임 14장 평균을 8배로 키워 윤곽을 딴 벡터 (src/assets/local/kbank-wordmark.svg, 색 #0212a4)
export function KbankWordmark({ className }: { className?: string }) {
  const src = localAsset("kbank-wordmark");
  return src ? <img className={className} src={src} alt="Kbank" draggable={false} /> : <b className={className}>Kbank</b>;
}
