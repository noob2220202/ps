import type { ReactNode } from "react";

// 토스에서 그대로 쓰는 공용 화면(로그인 · 프로필 고르기)을 감싸는 틀 (kakao2 K2Inset 과 같은 방법).
// 토스 상태바는 화면 위에 겹친 투명한 층이라(toss.css) 공용 화면을 그대로 두면 상태바 밑으로 들어감 →
// 맨 위 28dp 띠를 #171619 로 칠하고 화면은 그 아래 (아래 15dp 내비 띠 위까지)에 둠
export function TossInset({ children }: { children: ReactNode }) {
  return (
    <div className="toss-inset">
      <div className="toss-inset__band" />
      <div className="toss-inset__body">{children}</div>
    </div>
  );
}
