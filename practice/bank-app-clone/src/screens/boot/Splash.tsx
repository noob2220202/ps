import { useEffect, useState } from "react";
import { TIMING } from "../../config/timing";
import { useStatusBar } from "../../hooks/useStatusBar";
import { AdPhoto, AlbumLogo, BMark, Wordmark } from "../../components/art";
import "./Splash.css";

type Phase = "launch" | "logo" | "brand";

// 영상 0~5초 구간: 노란 화면이 커지며 열림 → 큰 B → B가 작아지며 워드마크 + 광고 등장
export function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("launch");
  useStatusBar("var(--yellow)", "dark");

  useEffect(() => {
    const t = TIMING.splash;
    const timers = [
      setTimeout(() => setPhase("logo"), t.logoIn),
      setTimeout(() => setPhase("brand"), t.wordmarkIn),
      setTimeout(onDone, t.end),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className={`splash splash--${phase}`}>
      <div className="splash__brand">
        <span className="splash__b">
          <BMark size={30} />
        </span>
        <span className="splash__wordmark">
          <Wordmark height={29} />
        </span>
      </div>

      <div className="splash__ad">
        <AlbumLogo size={30} />
        <p className="splash__ad-text">
          10.27 미니 2집 발매 <span className="splash__ad-badge">AD</span>
        </p>
        <AdPhoto className="splash__ad-photo" />
      </div>
    </div>
  );
}
