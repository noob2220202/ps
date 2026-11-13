// 칸 너비(max)보다 길면 글자 크기를 줄여 한 줄에 맞춤 (소비 주간 달력 날마다 금액: 10.5 → 짧으면 그대로, 길면 ≈ 8.5 까지)
import { useLayoutEffect, useRef, useState } from "react";

export function FitText({ text, max, size = 10.5, className }: { text: string; max: number; size?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fs, setFs] = useState(size);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 너비는 글자 크기에 비례 → 지금 크기에서 잰 너비를 size 로 환산
    const now = parseFloat(getComputedStyle(el).fontSize) || size;
    const w = (el.offsetWidth * size) / now;
    setFs(w > max ? (size * max) / w : size);
  }, [text, max, size]);
  return (
    <span ref={ref} className={className} style={{ fontSize: fs }}>
      {text}
    </span>
  );
}
