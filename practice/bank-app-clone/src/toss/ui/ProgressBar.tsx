// 웹뷰 진행 막대 (home §2.6 · account §3.2 · cert §2.0): 머리줄 아래 y 80, 높이 2.4, 화면 폭
//  나타남(delay 150ms 뒤): 회색 줄 #4c4e55 가 200ms 에 나타나고 파란 #3182f6(.75) 가 80ms 에 70% 까지
//  ready 가 되면 70 → 100% 300ms, 그다음 400ms 에 사라짐. 처음부터 ready 면 안 그림
// AppBar 의 progress 자리에 넣음: <TossAppBar progress={<TossProgressBar ready={loaded} />} />
import { useEffect, useState } from "react";
import { TOSS_PROGRESS } from "./shared";

export function TossProgressBar({ ready, delay = TOSS_PROGRESS.delay }: { ready: boolean; delay?: number }) {
  const [initiallyReady] = useState(ready);
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (initiallyReady) return;
    const t = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(t);
  }, [delay, initiallyReady]);
  useEffect(() => {
    if (!ready || !shown) return;
    const t = window.setTimeout(() => setGone(true), TOSS_PROGRESS.fill + TOSS_PROGRESS.fadeOut + 50);
    return () => window.clearTimeout(t);
  }, [ready, shown]);
  if (initiallyReady || !shown || gone) return null;
  return (
    <div className={`toss-progress${ready ? " toss-progress--done" : ""}`} aria-hidden>
      <i className="toss-progress__fill" />
    </div>
  );
}
