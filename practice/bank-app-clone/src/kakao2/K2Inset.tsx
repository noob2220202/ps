import { useState, type ReactNode } from "react";
import { StatusBandContext } from "./band";
import "./chrome.css";

// kakao2 에서 그대로 쓰는 카카오뱅크 화면(다른 은행 계좌 · 금액 입력 · 이체 완료, 아직 새로 안 만든 화면 · 프로필 고르기 · 로그인)을 감싸는 틀.
// kakao2 상태바는 화면 위에 겹친 투명한 층이라(chrome.css) 카카오뱅크 화면을 그대로 두면 상태바 밑으로 들어감 →
// 맨 위 54pt 띠를 그 화면이 useStatusBar 로 정한 바탕색으로 칠하고, 화면은 그 아래(top 54)에 둠. 띠는 화면 층과 같이 움직임
export function K2Inset({ children }: { children: ReactNode }) {
  const [band, setBand] = useState<string | null>(null);
  return (
    <div className="k2-inset">
      <div className="k2-inset__band" style={{ background: band ?? "#ffffff" }} />
      <div className="k2-inset__body">
        <StatusBandContext.Provider value={setBand}>{children}</StatusBandContext.Provider>
      </div>
    </div>
  );
}
