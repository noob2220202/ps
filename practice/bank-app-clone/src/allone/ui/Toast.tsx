// 토스트 그림 (상태는 toast.ts). AlloneOverlay 가 폰 화면 위 z 54 에 한 번 그림. 모양은 allone.css .ao-toast
import { endAoToast, useAoToast } from "../toast";

export function AoToastLayer() {
  const t = useAoToast();
  if (!t) return null;
  return (
    <div className="ao-toast-layer" aria-live="polite">
      <div
        key={t.id}
        className={`ao-toast${t.leaving ? " ao-toast--leaving" : ""}`}
        style={{ ["--ao-toast-y" as string]: `${818 - t.bottom}px` }}
        onAnimationEnd={(e) => e.animationName === "ao-toast-out" && endAoToast(t.id)}
      >
        {t.text}
      </div>
    </div>
  );
}
