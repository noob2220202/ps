import { localAsset } from "../assets/Asset";

// 토스 앱 아이콘 (로그인 · 프로필 고르기 · 계정 관리, components/AppBrand). 그림은 scripts/toss-crops/shared.py 가 만든 toss-app-icon.png
// (App Store 원본을 갤럭시 아이콘 모양으로 자름). 없으면 흰 둥근 네모 + 파란 원
export function TossAppIcon({ size = 46 }: { size?: number }) {
  const src = localAsset("toss-app-icon");
  if (src) return <img src={src} alt="토스" width={size} height={size} draggable={false} style={{ display: "block" }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="토스">
      <rect width="48" height="48" rx="14" fill="#ffffff" />
      <circle cx="24" cy="24" r="12" fill="#3182f6" />
    </svg>
  );
}
