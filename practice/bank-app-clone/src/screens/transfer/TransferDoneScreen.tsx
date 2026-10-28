import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { accountLine } from "../../api/endpoints";
import type { TransferResult } from "../../api/types";
import { Icon } from "../../components/icons/Icon";
import { useStatusBar } from "../../hooks/useStatusBar";
import { won } from "../../lib/format";
import "./Transfer.css";

export interface DoneState {
  result: TransferResult;
}

// 이체 완료: 체크 → "OOO님에게 N원 보냈어요". 확인을 누르면 홈으로 (이체 화면들을 한 번에 닫음)
export function TransferDoneScreen() {
  const navigate = useNavigate();
  const state = useLocation().state as DoneState | null;
  useStatusBar("#ffffff", "dark");
  useEffect(() => {
    if (!state) navigate("/", { replace: true });
  }, [state, navigate]);
  if (!state) return null;
  const { to, amount } = state.result;

  // 기록: 홈 → 이체 → 완료(금액 화면을 replace) 이므로 두 칸 뒤가 홈
  const close = () => navigate(-2);

  return (
    <div className="screen done">
      <div className="done__body">
        <CheckBadge />
        <h1>
          {to.holder}님에게
          <br />
          <span className="done__amount">{won(amount)}</span> 보냈어요
        </h1>
        <p className="done__account">
          {accountLine(to.bank, to.number)} <Icon name="chevron-right" size={12} stroke={2} />
        </p>
        <button className="done__memo">
          <ChatIcon /> 메모입력..
        </button>
      </div>
      <div className="done__bottom">
        <button className="done__share" aria-label="공유">
          <Icon name="upload" size={22} stroke={2} />
        </button>
        <button className="cta" onClick={close}>
          확인
        </button>
      </div>
    </div>
  );
}

// 민트→초록 그라데이션 원 + 흰 체크 (선이 그려지는 애니메이션)
function CheckBadge() {
  return (
    <svg className="done__check" width="56" height="56" viewBox="0 0 56 56" aria-hidden>
      <defs>
        <linearGradient id="done-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fd3e8" />
          <stop offset="1" stopColor="#4fcf8f" />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r="28" fill="url(#done-grad)" />
      <path d="m17 28.5 7.5 7.5L39.5 21" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <path d="M8 2.5c3.3 0 6 2 6 4.6s-2.7 4.6-6 4.6c-.6 0-1.2-.1-1.7-.2L3 13l.8-2.6C2.7 9.5 2 8.4 2 7.1 2 4.5 4.7 2.5 8 2.5Z" />
    </svg>
  );
}
