import { useEffect } from "react";
import { TIMING } from "../../config/timing";
import { useStatusBar } from "../../hooks/useStatusBar";
import { Spinner } from "../../components/Spinner";

// 스플래시 뒤 검은 화면 + 회색 스피너 (영상 5.5~10.7초, 로그인/보안 체크 대기)
export function BootLoading({ onDone }: { onDone: () => void }) {
  useStatusBar("#000", "light");

  useEffect(() => {
    const id = setTimeout(onDone, TIMING.bootLoading);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000", display: "grid", placeItems: "center" }}>
      <Spinner size={26} color="#8a8a8a" />
    </div>
  );
}
