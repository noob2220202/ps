import type { CSSProperties } from "react";
import { ART } from "./art";

// 잉크만 남긴 그림(art.ts)을 예전 상자(w × h, 기본은 잘라 온 크기) 안 같은 자리에: 크기는 잉크 상자, 나머지는 margin
// → 바깥 상자(margin 상자)가 예전과 같아서 레이아웃·위치가 그대로
export function artStyle(name: string, w?: number, h?: number): CSSProperties | undefined {
  const a = ART[name];
  if (!a) return undefined;
  const [bw, bh, x, y, iw, ih] = a;
  const sx = (w ?? bw) / bw;
  const sy = (h ?? bh) / bh;
  return { width: iw * sx, height: ih * sy, margin: `${y * sy}px ${(bw - x - iw) * sx}px ${(bh - y - ih) * sy}px ${x * sx}px` };
}
