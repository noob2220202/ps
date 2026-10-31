import type { ApiError } from "../api/client";
import "./ErrorState.css";

// 요청이 실패했을 때 화면. 실제 앱은 "잠시 후 다시 시도" + 버튼이 기본.
// 개발자 패널에서 "실패 확률"을 올리면 직접 볼 수 있다.
export function ErrorState({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div className="error-state">
      <strong>일시적인 오류가 발생했어요</strong>
      <span>
        {error.message}
        {error.status ? ` (${error.status})` : ""}
      </span>
      <button className="error-state__retry pressable" onClick={onRetry}>
        다시 시도
      </button>
    </div>
  );
}
