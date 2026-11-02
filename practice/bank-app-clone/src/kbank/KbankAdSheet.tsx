import { localAsset } from "../assets/Asset";
import { RESTART_EVENT } from "../platform/recorder";
import { kbBackLevel, useKbankBackStep } from "./sendback";
import "./kbank-adsheet.css";

// 홈 첫 진입 광고 바텀시트 (두 번째 녹화 7.6~8.6초 프레임 230~259). 언제 띄울지는 홈(KbankHome)이 시간표로 정함:
//   "dim" = 막만 한 프레임에 깔림(+358ms) → "up" = 시트가 아래에서 130ms 에 올라옴(+430ms). 막 아래 홈 시간표는 그대로 감.
// '일주일간 보지 않기'(녹화가 누른 것, 터치 원 254~258) · '닫기' 는 손 뗀 순간 막·시트가 한 프레임에 사라짐 (원본 8.570 → 8.595, 내려가기 없음).
// 막·시트 몸통 누름은 무반응, 막 아래 홈의 스크롤·누름은 막음. 안드로이드 뒤로(녹화 없음) = '닫기'.
export type KbankAdStage = "off" | "dim" | "up";

// 시트가 떠 있는 채로 ● 녹화(앱 끔 → 다시 켬)를 하면, App 이 '/' 로 바꿔 놓는 사이 시트가 쌓은 뒤로가기 칸이 그대로 남아
// 다음 실행에서 뒤로 한 번이 홈에 머물렀음 → 끌 때 홈('/')에 쌓인 칸을 먼저 걷음 (App 의 처리보다 먼저 불림: 모듈에서 단 듣개)
window.addEventListener(RESTART_EVENT, (e) => {
  const n = kbBackLevel();
  if ((e as CustomEvent).detail === "off" && n > 0 && window.location.pathname === "/") window.history.go(-n);
});

export function KbankAdSheet({ stage, onClose }: { stage: KbankAdStage; onClose: (week: boolean) => void }) {
  useKbankBackStep(stage !== "off", () => onClose(false));
  if (stage === "off") return null;
  const cloud = localAsset("kbank-home-adcloud");
  return (
    <div className="kbad">
      <i className="kbad-dim" />
      {stage === "up" && (
        <div className="kbad-sheet" role="dialog" aria-modal aria-label="광고">
          <div className="kbad-top">
            {cloud ? <img className="kbad-art" src={cloud} alt="" draggable={false} /> : <i className="kbad-art" />}
            <p className="kbad-t kbad-sub">개인사업자 신용대출도</p>
            <p className="kbad-t kbad-l1">더 낮은 금리로 갈아타고</p>
            <p className="kbad-t kbad-l2">이자 아껴보세요</p>
          </div>
          {/* 글자 누름 표시 없음 (녹화 254~258) */}
          <button className="kbad-week" onClick={() => onClose(true)}>
            <span className="kbad-t">일주일간 보지 않기</span>
          </button>
          <button className="kbad-close" onClick={() => onClose(false)}>
            <span className="kbad-t">닫기</span>
          </button>
        </div>
      )}
    </div>
  );
}
