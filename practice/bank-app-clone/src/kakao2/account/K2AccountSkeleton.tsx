import type { CSSProperties } from "react";

// 통장 뼈대 (녹화 28.438 – 29.507초, account.md 3.2): 머리줄 아래 본문 기준 좌표. 막대 #f0f0f0, 거래 두 묶음까지만 (그 아래는 비어 있음)
// 반짝임은 화면 전체가 한 띠: 모든 막대가 같은 화면 x 에서 밝아짐 → 막대마다 제 왼끝(--x)만큼 빼서 같은 띠를 그림 (K2Account.css)
const TOP = 112.9; // 녹화에서 머리줄 아래끝 (화면 y)
type Bar = [x0: number, y0: number, x1: number, y1: number, r: number];
const BARS: Bar[] = [
  [20, 152.9, 132.9, 169.9, 6], // 계좌번호
  [136.2, 155.05, 148.5, 167.35, 6.15], // 그 옆 동그라미 (복사 아이콘)
  [20, 173.9, 197.2, 211.8, 6], // 잔액
  [20, 243.8, 373, 308.7, 16], // 검색 상자
  ...[0, 113.9].flatMap((d): Bar[] => [
    [20, 340.7 + d, 59.3, 356.7 + d, 4], // 날짜
    [20, 374.7 + d, 169.9, 394.7 + d, 6], // 거래 첫 줄 왼쪽 · 오른쪽
    [254.8, 374.7 + d, 373, 394.7 + d, 6],
    [20, 400.7 + d, 95.3, 416.7 + d, 4], // 둘째 줄
    [294.1, 400.7 + d, 372.7, 416.7 + d, 4],
  ]),
];

export function K2AccountSkeleton({ leaving, onGone }: { leaving: boolean; onGone: () => void }) {
  return (
    <div
      className={`k2acct__skel${leaving ? " k2acct__skel--out" : ""}`}
      onAnimationEnd={(e) => e.target === e.currentTarget && onGone()}
      aria-hidden
    >
      {BARS.map(([x0, y0, x1, y1, r]) => (
        <i
          key={`${x0}-${y0}`}
          className="k2acct__sk"
          style={{ left: x0, top: y0 - TOP, width: x1 - x0, height: y1 - y0, borderRadius: r, "--x": `${x0}px` } as CSSProperties}
        />
      ))}
    </div>
  );
}
