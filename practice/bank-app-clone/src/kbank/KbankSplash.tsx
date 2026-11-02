import { useEffect } from "react";
import { KbankWordmark } from "./common";
import { useKbankStatusBar } from "./theme";

// 시작화면: 녹화 5.60~6.20초 — 흰 바탕 가운데 파란 'Kbank' 글자. 그 뒤 3.2초는 간편비밀번호(보안 화면이라 녹화가 검게 찍힘) → 건너뜀
const SHOW_MS = 600;

export function KbankSplash({ onDone }: { onDone: () => void }) {
  useKbankStatusBar();
  useEffect(() => {
    const t = window.setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="kb kb-splash">
      <KbankWordmark className="kb-splash__logo" />
    </div>
  );
}
