import { useEffect, useState } from "react";
import { useStatusBar } from "../hooks/useStatusBar";
import { NhDots, NhImg } from "./common";

// 콕뱅크 시작 (녹화 0~4초): 흰 화면에 콕 아이콘 → 어두운 화면 "금융, 정보, 쇼핑을 한 번에 / NH콕뱅크" + 점 3개.
// 실제 앱은 이다음 간편비밀번호 로그인이 있지만 연습용이라 건너뜀
export function NhSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"icon" | "brand">("icon");
  useStatusBar(phase === "icon" ? "#ffffff" : "#18171c", phase === "icon" ? "dark" : "light");
  useEffect(() => {
    const a = setTimeout(() => setPhase("brand"), 700);
    const b = setTimeout(onDone, 2600);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [onDone]);

  if (phase === "icon")
    return (
      <div className="screen nh-splash nh-splash--white">
        <NhImg name="nh-app-icon" w={69} h={66} className="nh-splash__icon" fallback={<b className="nh-splash__fallback-icon">콕</b>} />
      </div>
    );
  return (
    <div className="screen nh nh-splash">
      <NhImg name="nh-nonghyup" w={66} h={39} className="nh-splash__nonghyup" fallback={null} />
      <p className="nh-splash__tag">
        금융, 정보, 쇼핑을 <b>한 번에</b>
      </p>
      <NhImg name="nh-wordmark" w={183} h={65} fallback={<b className="nh-splash__fallback-word">NH콕뱅크</b>} />
      <span className="nh-splash__dots">
        <NhDots size={10} />
      </span>
      <NhImg name="nh-ma" w={63} h={42} className="nh-splash__ma" fallback={null} />
    </div>
  );
}
