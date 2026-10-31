import { OS } from "../platform/platform";
import { ArcSpinner } from "./art";

// 같은 "로딩 중"이라도 OS마다 생김새가 다르다.
// 안드로이드: 호가 늘었다 줄었다 하며 도는 머티리얼 스피너
// iOS: 살 8개가 한 칸씩 "뚝뚝" 도는 UIActivityIndicatorView (steps(8)로 구현)
export function Spinner({ size = 24, color = "#9a9a9a" }: { size?: number; color?: string }) {
  if (OS === "android") return <ArcSpinner size={size} color={color} />;
  return (
    <svg className="ios-spinner" width={size} height={size} viewBox="0 0 24 24" aria-label="로딩 중">
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={i}
          x1="12"
          y1="2.8"
          x2="12"
          y2="7.4"
          stroke={color}
          strokeWidth="2.3"
          strokeLinecap="round"
          opacity={1 - i * 0.11}
          transform={`rotate(${-i * 45} 12 12)`}
        />
      ))}
    </svg>
  );
}
