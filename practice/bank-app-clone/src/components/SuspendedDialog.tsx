import { useState } from "react";
import { createPortal } from "react-dom";
import "./SuspendedDialog.css";

// 카카오뱅크 '계좌 지급정지' 팝업 (🔔 관리 패널 '계좌 지급정지' 켜기 → 이체에서 받는 분·금액을 넣고 확인 시트 '이체하기'를 누르면 뜸,
// 서버 403 ACCOUNT_SUSPENDED — AmountScreen). 상태바까지 폰 전체를 어둡게 덮음.
// 받은 스크린샷(360dp 기기, 800px) 에서 잼: 상자 양옆 24.3 · 모서리 19, 제목 16.3px 굵게 · 본문 13.5px 세 줄(줄 간격 19) ·
// '오류코드 보기 ∨' · 'AI 상담챗봇' 알약(101.7 × 35) · 노란 '확인'(높이 51.8, 양옆 15.75). 막은 검정 58%.
// 연습용 앱이라 상자 맨 위에 '연습용 화면 · 실제 이용 제한 아님' 표시가 늘 같이 나옴 (끄는 설정 없음 — 실제 제한 화면처럼 쓰이지 않게)
export const PRACTICE_MARK = "연습용 화면 · 실제 이용 제한 아님";

export function SuspendedDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState(false);
  const phone = document.querySelector(".phone");
  const el = (
    <div className="susp" role="alertdialog" aria-modal="true" aria-labelledby="susp-title" aria-describedby="susp-desc">
      <div className="susp__box">
        <p className="susp__mark">{PRACTICE_MARK}</p>
        <h2 id="susp-title" className="susp__title">
          고객센터로 문의해주세요.
        </h2>
        <p id="susp-desc" className="susp__desc">
          <span>현재 고객님께서는 명의도용/금융사기 등의 사고</span>
          <span>신고가 접수되었거나 대포통장 의심 고객으로 판단되어,</span>
          <span>서비스 이용이 제한되었습니다.</span>
        </p>
        <button className={`susp__code${code ? " susp__code--open" : ""}`} onClick={() => setCode(!code)} aria-expanded={code}>
          오류코드 보기
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M3.2 5.8 8 10.6l4.8-4.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {code && <p className="susp__codeval">[연습용] TEST-0000</p>}
        {/* AI 상담챗봇: 연습용이라 무반응 */}
        <button className="susp__bot">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path
              d="M2.6 9.4V8a5.4 5.4 0 0 1 10.8 0v1.4M2.6 9.4v1.6a1.2 1.2 0 0 0 1.2 1.2h.9V8.6h-.9a1.2 1.2 0 0 0-1.2.8Zm10.8 0v1.6a1.2 1.2 0 0 1-1.2 1.2h-.9V8.6h.9a1.2 1.2 0 0 1 1.2.8ZM12.2 12.2c0 1.2-1.3 1.9-3.4 1.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          AI 상담챗봇
        </button>
        <button className="susp__ok" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
  return phone ? createPortal(el, phone) : el;
}
