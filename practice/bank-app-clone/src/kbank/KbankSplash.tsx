import { useEffect } from "react";
import { KbankWordmark } from "./common";
import { useKbankStatusBar } from "./theme";

// 시작화면: 녹화 원본 5.591~6.107초 — 흰 바탕 가운데 파란 'Kbank' 글자 (6.129초부터 3.25초는 간편비밀번호: 보안 화면이라 녹화가 검게 찍힘 → 건너뜀).
// 첫 흰 장면(5.591초)부터 검은 화면(6.129초)까지 0.54초. kbank2 녹화에선 영상 마지막 장면이 나올 때 영상 밑에 미리 띄우고(1/30초 일찍)
// 타이머·그리기에 35ms 쯤 늦어져서 서로 비김 → 0.52초 (kbank2 실제 녹화 시험: 흰 장면 첫 프레임 → 홈 첫 프레임 0.54초).
// 'Kbank' 는 영상 끝 장면(5.566초, 반쯤 밝아진 회색)과 같은 자리 (녹화 x 190~399 · y 544~594px)
const SHOW_MS = 520;

export function KbankSplash({ onDone }: { onDone: () => void }) {
  useKbankStatusBar();
  useEffect(() => {
    const t = window.setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="kb kb-splash">
      <KbankWordmark className="kb-splash__logo" />
    </div>
  );
}
