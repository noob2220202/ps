// 웹 로딩 막 + 초록 all one 스피너 그림 (상태 · 시각표는 loading.ts, 프로필 표는 nav.ts LOAD). AlloneOverlay 가 폰 화면 위 z 51 에 한 번 그림.
//  막: 웹뷰(59–818)만 rgba(55,55,55,.68) — 상태바 띠 · 아래 띠는 흰색 그대로. 막이 떠 있는 동안 웹뷰 누름을 막음
//  더 어둡게: 검정 .22 한 겹 (ms 동안 ease-out)
//  스피너: 화면 가운데 (196.5, 425.8) — 웹뷰 가운데가 아님. 켜질 때마다 새로 그려 동전 앞면부터 (key = onset)
import { useAoLoading } from "../loading";
import { AoSpinner } from "./Spinner";

export function AoLoadingLayer() {
  const s = useAoLoading();
  if (!s) return null;
  return (
    <div className="ao-loading" aria-busy="true">
      <div
        className={`ao-loading__web${s.dim ? " ao-loading__web--dim" : ""}${s.dim && s.fadeMs ? " ao-loading__web--fade" : ""}`}
        style={s.fadeMs ? { animationDuration: `${s.fadeMs}ms` } : undefined}
      >
        {s.dim && s.deep && (
          <div key={s.deep.key} className="ao-loading__deep" style={s.deep.ms ? { animationDuration: `${s.deep.ms}ms` } : { animation: "none" }} />
        )}
      </div>
      {s.spinner && (
        <div className="ao-loading__spin">
          <AoSpinner key={s.onset} size={61} />
        </div>
      )}
    </div>
  );
}
