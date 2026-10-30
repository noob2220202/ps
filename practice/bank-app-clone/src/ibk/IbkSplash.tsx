import { useEffect } from "react";

// 구현 전 자리: 시작화면 → 홈
export function IbkSplash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 300);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="screen ibk" />;
}
