import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TIMING } from "../../config/timing";
import { useStatusBar } from "../../hooks/useStatusBar";
import { AlbumLogo, BMark, Wordmark } from "../../components/art";
import { Asset } from "../../assets/Asset";
import "./Splash.css";

type Phase = "launch" | "logo" | "brand";

// 영상 0~5초 구간: 노란 화면이 커지며 열림 → 큰 B → B가 작아지며 워드마크 + 광고 등장
export function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("launch");
  const brandRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLSpanElement>(null);

  // B와 워드마크는 처음부터 "최종 위치"에 배치해 두고, B를 워드마크 폭의 절반만큼 오른쪽으로
  // 밀어서 가운데처럼 보이게 한다. 그러면 애니메이션은 transform만으로 끝난다(레이아웃 계산 0).
  useLayoutEffect(() => {
    const measure = () => {
      const w = wordmarkRef.current?.offsetWidth ?? 0;
      brandRef.current?.style.setProperty("--shift", `${(w + 9) / 2}px`);
    };
    measure();
    document.fonts?.ready.then(measure); // 웹폰트 로딩 후 폭이 달라지므로 한 번 더
  }, []);
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
      <div className="splash__brand" ref={brandRef}>
        <span className="splash__b">
          <BMark size={30} />
        </span>
        <span className="splash__wordmark" ref={wordmarkRef}>
          <span className="splash__wordmark-inner">
            <Wordmark height={29} />
          </span>
        </span>
      </div>

      <div className="splash__ad">
        <AlbumLogo size={30} />
        <p className="splash__ad-text">
          10.27 미니 2집 발매 <span className="splash__ad-badge">AD</span>
        </p>
        <Asset slot="banner-and2ble" className="splash__ad-photo" />
      </div>
    </div>
  );
}
