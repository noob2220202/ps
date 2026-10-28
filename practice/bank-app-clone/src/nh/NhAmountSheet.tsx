import { useState } from "react";
import { Icon } from "../components/icons/Icon";
import { Keypad } from "../components/Sheet";
import { applyKey } from "../lib/keypad";
import { BackArrowKey, ClearDot } from "./common";
import { hangulAmount, nhWon } from "./hangul";
import "./nh-amountsheet.css";

// ---------- 금액 시트: [X] / 1원 ⓧ / 일원 / +1만 +5만 +10만 +100만 전액 / 키패드(00) / 다음 ----------
export function NhAmountSheet({
  balance,
  remaining,
  onClose,
  onDone,
}: {
  balance: number;
  remaining: number;
  onClose: () => void;
  onDone: (amount: number) => void;
}) {
  const [raw, setRaw] = useState("");
  const amount = Number(raw || 0);
  // 녹화1 60초: 잔액보다 많으면 금액이 빨개지고 아래 안내 두 줄
  const error =
    amount > balance ? "통장의 잔액이 부족합니다.\n잔액을 확인해 주세요." : amount > remaining ? "1일 송금 잔여한도를 초과했습니다.\n금액을 확인해 주세요." : null;
  const add = (n: number) => setRaw(String(Math.min(amount + n, 99_999_999)));

  return (
    <>
      <div className="nh-sheet-head nh-sheet-head--end">
        <button className="nh-icon-btn" aria-label="닫기" onClick={onClose}>
          <Icon name="close" size={22} stroke={1.7} />
        </button>
      </div>
      <div className={`nh-amount__value ${raw ? "" : "empty"} ${error ? "error" : ""}`}>
        {raw ? (
          <>
            {nhWon(amount)}
            <i className="nh-caret" />
            <button aria-label="지우기" onClick={() => setRaw("")}>
              <ClearDot />
            </button>
          </>
        ) : (
          "금액 입력"
        )}
      </div>
      <p className={`nh-amount__hint ${error ? "error" : ""}`}>{error ?? hangulAmount(amount)}</p>
      <div className="nh-chips">
        {(
          [
            [10_000, "+ 1만"],
            [50_000, "+ 5만"],
            [100_000, "+ 10만"],
            [1_000_000, "+ 100만"],
          ] as const
        ).map(([n, label]) => (
          <button key={n} onClick={() => add(n)}>
            {label}
          </button>
        ))}
        <button onClick={() => setRaw(String(Math.min(balance, remaining)))}>전액</button>
      </div>
      <Keypad doubleZero rowHeight={68} back={<BackArrowKey />} onKey={(k) => setRaw((v) => applyKey(v, k, 8))} />
      <button className="nh-btn nh-btn--teal nh-sheet-btn" disabled={!amount || !!error} onClick={() => onDone(amount)}>
        다음
      </button>
    </>
  );
}
