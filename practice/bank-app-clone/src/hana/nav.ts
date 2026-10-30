import { useNavigate } from "react-router-dom";

// 주소로 바로 열었을 때(방문 기록이 없을 때) ←/X 가 앱 밖으로 나가지 않게: 기록이 있으면 뒤로, 없으면 fallback 으로
export function useSafeBack(fallback = "/") {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
