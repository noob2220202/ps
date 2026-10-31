import { useEffect, useState } from "react";
import { IbkHomeSkeleton, IbkTabBar } from "./common";
import { holdIbkSpinner } from "./loading";
import { useIbkStatusBar } from "./theme";

// 시작화면 = 녹화 145.7~150.67초 '홈 뼈대' 로딩을 줄인 것 (home 6-5):
//   145.700 빈 홈 껍데기(앱 영역 #fafafa + 아래 탭바) → 145.867 로딩 점 → 148.200 뼈대(바탕 #eff4f3 + 회색 상자, 반짝임)
//   → 149.53 점 100ms 페이드아웃 → 150.667 홈 내용. 껍데기 구간(2.5초)은 0.5초로 줄임
const AT = { spinner: 170, skeleton: 500, spinnerOff: 1830, done: 2970 };

export function IbkSplash({ onDone }: { onDone: () => void }) {
  useIbkStatusBar();
  const [skeleton, setSkeleton] = useState(false);
  useEffect(() => {
    let release: (() => void) | null = null;
    const t = [
      window.setTimeout(() => (release = holdIbkSpinner()), AT.spinner),
      window.setTimeout(() => setSkeleton(true), AT.skeleton),
      window.setTimeout(() => release?.(), AT.spinnerOff),
      window.setTimeout(onDone, AT.done),
    ];
    return () => {
      t.forEach(clearTimeout);
      release?.();
    };
  }, [onDone]);
  return (
    <div className="ibk ibk-splash">
      {skeleton && <IbkHomeSkeleton />}
      <IbkTabBar />
    </div>
  );
}
