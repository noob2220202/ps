import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStatusBar } from "../hooks/useStatusBar";
import { useNhGo } from "./loading";
import { Icon } from "../components/icons/Icon";
import { nhAccountLine } from "./banks";
import { NhImg } from "./common";
import { nhWon } from "./hangul";
import { Row } from "./NhConfirm";
import type { NhDoneState } from "./NhConfirm";
import "./nh-done.css";

// 송금 완료 (녹화2 30~36초): 동전 "송금 할게요" → 초록 체크 "송금 했어요", 상세보기, 메시지 보내기, [☰][송금계속][확인]
export function NhDone() {
  const navigate = useNavigate();
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const state = useLocation().state as NhDoneState | null;
  const [done, setDone] = useState(false);
  const [detail, setDetail] = useState(false);
  useStatusBar("#18171c", "light");
  useEffect(() => {
    if (!state) navigate("/", { replace: true });
    const t = setTimeout(() => setDone(true), 900);
    return () => clearTimeout(t);
  }, [state, navigate]);
  if (!state) return null;
  const { result, memoTo, memoMe } = state;
  const { to, amount } = result;

  return (
    <div className="screen nh nh-done">
      <div className="nh-done__body">
        <div className={`nh-done__mark ${done ? "nh-done__mark--done" : ""}`}>
          <NhImg name="nh-coin" w={60} h={64} className="nh-done__coin" fallback={<span style={{ fontSize: 44 }}>🪙</span>} />
          <span className="nh-done__check">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
        </div>
        <h2>
          <b>{to.holder}</b>님에게
          <br />
          {nhWon(amount)}
          <br />
          송금 {done ? "했어요" : <span className="nh-purple">할게요</span>}
        </h2>
        {done && (
          <button className="nh-done__more" onClick={() => setDetail((d) => !d)}>
            상세보기 <Icon name={detail ? "chevron-down" : "chevron-right"} size={13} stroke={2} />
          </button>
        )}
        {detail && (
          <dl className="nh-rows nh-done__rows">
            <Row k="받는 분" v={nhAccountLine(to.bank, to.number)} />
            <Row k="송금일시" v={result.at.replace("T", " ").replaceAll("-", ".")} />
            <Row k="받는계좌 표시" v={memoTo} />
            <Row k="내계좌 표시" v={memoMe} />
            <Row k="수수료" v="0원" />
            <Row k="송금 후 잔액" v={nhWon(result.balanceAfter)} />
          </dl>
        )}
      </div>
      <div className={`nh-done__msg ${done ? "" : "hide"}`}>
        <p>메시지 보내기</p>
          <div>
            {(
              [
                ["card", "메시지카드"],
                ["kakao", "카카오톡"],
                ["mms", "문자(MMS)"],
              ] as const
            ).map(([k, label]) => (
              <button key={k}>
                <NhImg name={`nh-msg-${k}`} w={47} h={45} fallback={<span>💬</span>} />
                {label}
              </button>
            ))}
        </div>
      </div>
      <div className="nh-bottom nh-bottom--done">
        <button className="nh-btn nh-btn--line nh-done__menu" aria-label="메뉴" onClick={() => go(`/history/${result.fromAccountId}`)}>
          <Icon name="menu" size={22} stroke={1.8} />
        </button>
        <button className="nh-btn nh-btn--outline-purple" onClick={() => go(`/send?from=${result.fromAccountId}`, { replace: true })}>
          송금계속
        </button>
        <button className="nh-btn" onClick={() => navigate("/")}>
          확인
        </button>
      </div>
    </div>
  );
}
