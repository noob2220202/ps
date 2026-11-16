// AoSkeleton (plan.md §3.3, home §2.17): 로딩 뼈대 막대 #fcfbfe, 둥글기 8. 움직임 없음 (녹화의 홈 H1 은 그냥 옅은 막대)
import type { CSSProperties } from "react";

export interface AoSkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}

export function AoSkeleton({ width = "100%", height = 24, radius = 8, className, style }: AoSkeletonProps) {
  return <div aria-hidden className={`ao-skel${className ? ` ${className}` : ""}`} style={{ width, height, borderRadius: radius, ...style }} />;
}
