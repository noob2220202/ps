import { useEffect, useState } from "react";
import { localAsset } from "../assets/Asset";
import { useStatusBar } from "../hooks/useStatusBar";

// 시작화면 (다크 녹화 1~6초): 검은 화면 → 가운데 '1Q'가 뜸 → 양옆으로 '하나 · 원큐'가 펼쳐져 '하나 1Q 원큐' → 홈.
// 로고 가운데 y 202dp(252.5px@480), 폭 200dp. 라이트모드도 시작화면은 검은 바탕 (갤럭시 시작화면은 앱 테마와 따로)
const AT = { mark: 450, open: 1000, done: 2500 };

export function HanaSplash({ onDone }: { onDone: () => void }) {
  useStatusBar("#000000", "light");
  const [phase, setPhase] = useState<"black" | "mark" | "open">("black");
  useEffect(() => {
    const t = [
      window.setTimeout(() => setPhase("mark"), AT.mark),
      window.setTimeout(() => setPhase("open"), AT.open),
      window.setTimeout(onDone, AT.done),
    ];
    return () => t.forEach(clearTimeout);
  }, [onDone]);
  const logo = localAsset("hana-splash-logo");
  return (
    <div className="screen hana-splash">
      {phase !== "black" && (
        <div className={`hana-splash__logo hana-splash__logo--${phase}`}>
          {logo ? (
            <img src={logo} alt="하나 1Q 원큐" draggable={false} />
          ) : (
            <span>
              하나 <b>1Q</b> 원큐
            </span>
          )}
        </div>
      )}
    </div>
  );
}
