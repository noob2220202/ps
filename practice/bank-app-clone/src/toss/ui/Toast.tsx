// 토스트 그림 (상태는 toast.ts). 알약 #1f1e21, 높이 49.5, 가운데 y 54.4, 폭은 내용만큼 (왼 19 · 오른 20),
// 토스 심볼 ≈18 + 4dp + 16 SB 글자. "토스뱅크"/"토스" 는 파란 밑줄 (1.6dp), 나머지 흰색. TossOverlay 가 한 번 그림
import { localAsset } from "../../assets/Asset";
import { endTossToast, useTossToast } from "../toast";

export function TossToast() {
  const t = useTossToast();
  if (!t) return null;
  const sym = localAsset("toss-symbol");
  return (
    <div className="toss-toast-wrap" aria-live="polite">
      <div
        key={t.id}
        className={`toss-toast${t.leaving ? " toss-toast--out" : ""}`}
        onAnimationEnd={(e) => e.animationName === "toss-toast-out" && endTossToast(t.id)}
      >
        {sym ? <img className="toss-toast__logo" src={sym} alt="" draggable={false} /> : <span className="toss-toast__logo toss-toast__logo--dot" />}
        <span className="toss-toast__text">
          <u>{t.word}</u>로 이동했어요
        </span>
      </div>
    </div>
  );
}
