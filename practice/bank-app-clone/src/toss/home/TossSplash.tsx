// 토스 시작화면 (home.md §2.2 · §3.1, plan.md §0.12). 바탕 #171619 에 3D 토스 심볼 (잉크 x 128.8–253.6, y 368–483.2).
// 창이 열리는 확대(0.92 → 1, 둥근 모서리, 220ms) → 1.2초 머묾, 0.6초에 심볼이 7.2dp 내려감 (시스템 → 앱 시작화면 넘김, 한 프레임) → onDone.
// 홈으로의 300ms 교차는 홈이 처음 그려질 때 이 그림을 위에 덮었다 걷어서 함 (TossHome · SplashFade). 잠금 화면은 없음 (R22).
// 기다리는 동안 홈 데이터를 미리 받아 둠 → 홈이 바로 그려짐
import { useEffect, useState } from "react";
import { paths } from "../../api/endpoints";
import { prefetchMissing } from "../../api/useApi";
import { localAsset } from "../../assets/Asset";
import { HOME_BOOT, markSplashDone } from "./boot";
import "./home.css";

// 시작화면 심볼을 앱이 뜰 때(로그인 · 프로필 고르기 전) 미리 받아 풀어 둠 → 시작화면 첫 프레임부터 심볼이 보임
const splashSrc = localAsset("toss-symbol-splash");
// 모듈이 붙잡고 있어야 풀어 둔 그림이 메모리에 남음
const splashPreload = splashSrc && typeof Image !== "undefined" ? new Image() : null;
if (splashPreload && splashSrc) {
  splashPreload.src = splashSrc;
  splashPreload.decode?.().catch(() => {});
}

export function TossSplash({ onDone }: { onDone: () => void }) {
  const [dropped, setDropped] = useState(false);
  useEffect(() => {
    prefetchMissing(paths.home);
    const a = window.setTimeout(() => setDropped(true), HOME_BOOT.drop);
    const b = window.setTimeout(() => {
      markSplashDone();
      onDone();
    }, HOME_BOOT.splash);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [onDone]);
  return (
    <div className="toss-home-splash toss-home-splash--open">
      <SplashLogo dropped={dropped} />
    </div>
  );
}

// toss-symbol-splash.png (심볼 + 아래 그림자, 132.5 × 124.75dp, 잉크 상자 = 화면 x 126.8 · y 363.2 — scripts/toss-crops/shared.py)
export function SplashLogo({ dropped = true }: { dropped?: boolean }) {
  const src = splashPreload?.src || splashSrc;
  if (!src) return <span className={`toss-home-splash__dot${dropped ? " toss-home-splash__logo--drop" : ""}`} />;
  return <img className={`toss-home-splash__logo${dropped ? " toss-home-splash__logo--drop" : ""}`} src={src} alt="" decoding="sync" draggable={false} />;
}
