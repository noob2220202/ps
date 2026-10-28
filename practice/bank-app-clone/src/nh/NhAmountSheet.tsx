import { useState } from "react";
import { Keypad } from "../components/Sheet";
import { applyKey } from "../lib/keypad";
import { BackArrowKey, NhCloseIcon } from "./common";
import { hangulAmount } from "./hangul";
import { amountError } from "./nhAmount";
import "./nh-amountsheet.css";

// 금액 옆 ⓧ (지름 16, × 6.4·굵기 1.3). 시트 위는 밝은 원, 화면 위는 어두운 원 — 색은 CSS (.nh-amt-clear)
export function NhAmtClear() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="8" />
      <path d="m5.26 5.26 5.48 5.48m0-5.48-5.48 5.48" strokeWidth="1.3" />
    </svg>
  );
}

const CHIPS = [
  [10_000, "+ 1만"],
  [50_000, "+ 5만"],
  [100_000, "+ 10만"],
  [1_000_000, "+ 100만"],
] as const;

// ---------- 금액 시트 (녹화2 16~17.5초, 녹화1 59~61.6초) ----------
// [X] / 금액 입력 → 1|원 ⓧ (커서 청록, 0.5초 깜빡) / 일원 · 잔액 부족이면 빨간 금액 + 두 줄 안내 /
// +1만 +5만 +10만 +100만 전액 / 키패드(00) / 다음 (금액이 있으면 청록. 안내가 떠도 눌림 → 시트만 닫히고 화면에 안내)
export function NhAmountSheet({
  initial,
  balance,
  remaining,
  onClose,
  onDone,
}: {
  initial: number;
  balance: number;
  remaining: number;
  onClose: () => void;
  onDone: (amount: number) => void;
}) {
  const [raw, setRaw] = useState(initial ? String(initial) : "");
  const amount = Number(raw || 0);
  const error = amountError(amount, balance, remaining);
  const set = (v: string) => setRaw(/^0*$/.test(v) ? "" : v);
  const add = (n: number) => set(String(Math.min(amount + n, 99_999_999)));

  return (
    <>
      <div className="nh-as">
        <button className="nh-as__close" aria-label="닫기" onClick={onClose}>
          <NhCloseIcon />
        </button>
        <div className={`nh-as__value ${raw ? "filled" : ""} ${error ? "error" : ""}`}>
          {raw ? (
            <>
              <span>{amount.toLocaleString("ko-KR")}</span>
              {/* key: 누를 때마다 커서 깜빡임을 처음(보이는 상태)부터 */}
              <i className="nh-as__caret" key={raw} />
              <span>원</span>
              <button className="nh-amt-clear nh-amt-clear--sheet" aria-label="지우기" onClick={() => setRaw("")}>
                <NhAmtClear />
              </button>
            </>
          ) : (
            "금액 입력"
          )}
        </div>
        <p className="nh-as__hint">{error ?? hangulAmount(amount)}</p>
        <div className="nh-as__chips">
          {CHIPS.map(([n, label]) => (
            <button key={n} onClick={() => add(n)}>
              {label}
            </button>
          ))}
          <button onClick={() => set(String(Math.min(balance, remaining)))}>전액</button>
        </div>
      </div>
      <Keypad doubleZero rowHeight={68} back={<BackArrowKey />} onKey={(k) => set(applyKey(raw, k, 8))} />
      <button className="nh-btn nh-btn--teal nh-sheet-btn" disabled={!amount} onClick={() => onDone(amount)}>
        다음
      </button>
    </>
  );
}
