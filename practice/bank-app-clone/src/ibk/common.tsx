import { localAsset } from "../assets/Asset";
import "./ibk.css";

// i-ONE Bank 화면들이 같이 쓰는 조각. 값은 실제 앱 녹화(384×832, 1px = 1dp)에서 잰 것

// 앱 아이콘 (런처). 그림이 없으면 파란 둥근 사각 + "i-ONE"
export function IbkAppIcon({ size = 46 }: { size?: number }) {
  const src = localAsset("ibk-app-icon");
  if (src) return <img src={src} alt="i-ONE Bank" width={size} height={size} draggable={false} style={{ display: "block" }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="i-ONE Bank">
      <rect width="48" height="48" rx="13" fill="#1f5fc8" />
      <text x="24" y="29" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800" fontFamily="inherit">
        i-ONE
      </text>
    </svg>
  );
}

// 화면 사이 로딩 막 (구현 전 자리)
export function IbkLoadingLayer() {
  return null;
}
