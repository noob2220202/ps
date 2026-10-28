import type { Account, Recipient } from "../api/types";
import { Icon } from "../components/icons/Icon";
import { EditRow } from "./common";
import { nhWon } from "./hangul";
import "./nh-send.css";

// 콕송금 받는 분을 고른 뒤: "얼마를 보낼까요?"(amount) → "1원을 보낼게요" 표시 내용(memo) (녹화2 12~24초)
export function NhSendAmount({
  account,
  to,
  stage,
  amount,
  remaining,
  memoTo,
  memoMe,
  onMemoTo,
  onMemoMe,
  onOpenAmount,
  onNext,
}: {
  account?: Account;
  to: Recipient;
  stage: "amount" | "memo";
  amount: number;
  remaining: number;
  memoTo: string;
  memoMe: string;
  onMemoTo: (v: string) => void;
  onMemoMe: (v: string) => void;
  onOpenAmount: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="nh-send__mini">
        <span>
          <small>농축협 {account?.number}</small>
          <b>{account && nhWon(account.balance)}</b>
        </span>
        <Icon name="chevron-down" size={18} stroke={2} />
      </div>
      <div className="nh-send__to">
        <p>
          <u>{to.holder}</u>님에게
        </p>
        {stage === "memo" && (
          <p>
            <u>{nhWon(amount)}</u>을 보낼게요
          </p>
        )}
        <small>
          {to.bank.name}
          {to.number}
        </small>
      </div>
      {stage === "amount" ? (
        <>
          <h2 className="nh-send__how">얼마를 보낼까요?</h2>
          <button className="nh-send__amount-box" onClick={onOpenAmount}>
            {amount ? nhWon(amount) : <i>금액 입력</i>}
          </button>
          <div className="nh-send__limit">
            <span>
              1일 송금 잔여한도 <i className="nh-q">?</i>
            </span>
            <b>{nhWon(remaining)}</b>
          </div>
        </>
      ) : (
        <>
          <div className="nh-box nh-send__memo">
            <EditRow label="받는계좌에 표시" value={memoTo} placeholder="" onChange={onMemoTo} />
            <EditRow label="내계좌에 표시" value={memoMe} placeholder="받는분 이름 표시" onChange={onMemoMe} />
          </div>
          <p className="nh-send__more">
            상세 정보 <Icon name="chevron-down" size={14} stroke={2} />
          </p>
          <div className="nh-bottom">
            <button className="nh-btn" onClick={onNext}>
              다음
            </button>
          </div>
        </>
      )}
    </>
  );
}
