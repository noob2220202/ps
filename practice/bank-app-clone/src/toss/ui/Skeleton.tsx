// 어두운 뼈대 (account §3.2 · assets §2.1.7 · cert §2.2): 막대 #232228 (소비 웹 뼈대 #1d1c1f), 모서리 4–10, 대각선 반짝임.
// TossFadeIn: 순서대로 나타나게 (delay ms 뒤 duration 동안)
import type { CSSProperties, ReactNode } from "react";

export function TossSkeleton({ w, h, r = 6, tone = "acct", className, style }: { w?: number | string; h: number | string; r?: number; tone?: "acct" | "web"; className?: string; style?: CSSProperties }) {
  return <span className={`toss-skel toss-skel--${tone}${className ? ` ${className}` : ""}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden />;
}

export function TossFadeIn({ delay = 0, duration = 150, children, className, style }: { delay?: number; duration?: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`toss-fade-in${className ? ` ${className}` : ""}`} style={{ animationDelay: `${delay}ms`, animationDuration: `${duration}ms`, ...style }}>
      {children}
    </div>
  );
}
