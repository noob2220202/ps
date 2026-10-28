import type { Bank } from "../api/types";
import { Keypad } from "../components/Sheet";
import { applyKey } from "../lib/keypad";
import { nhBankList } from "./banks";
import { BackArrowKey, NhCloseIcon, NhKokKey } from "./common";
import { NhBankSquare } from "./NhBankPicker";
import "./nh-numbersheet.css";

// 은행 이름 옆 ⌄ (가운데선 폭 10.1, 높이 5.1, 굵기 1.5)
function ChevronDown() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6.95 9.45 12 14.55l5.05-5.1" />
    </svg>
  );
}

// 입력칸 오른쪽 ⓧ: 지름 24.6 회색 원 #535f6e + 9.7 크기 ×(굵기 2, #cbd2da)
function ClearCircle() {
  return (
    <svg width="24.6" height="24.6" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#535f6e" />
      <path d="m8.15 8.15 7.7 7.7m0-7.7-7.7 7.7" stroke="#cbd2da" strokeWidth="2" />
    </svg>
  );
}

// ---------- 계좌번호 시트: [은행 ⌄] [X] / 입력칸 / 키패드(콕) / 다음 ----------
// 녹화1 27.6~29초(NH농협, 빈 칸), 48.6~56초(하나은행, 입력 중), 녹화2 6~12초
export function NhNumberSheet({
  bank,
  digits,
  onChange,
  onBank,
  onClose,
  onDone,
}: {
  bank: Bank;
  digits: string;
  onChange: (d: string) => void;
  onBank: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <>
      <div className="nh-sheet-head nh-number__head">
        <button className="nh-number__bank" onClick={onBank}>
          <NhBankSquare bank={bank} size={24} />
          <span>{nhBankList([bank], bank.section)[0]?.label ?? bank.name}</span>
          <ChevronDown />
        </button>
        <button className="nh-icon-btn" aria-label="닫기" onClick={onClose}>
          <NhCloseIcon />
        </button>
      </div>
      {/* 비어 있으면 1dp 회색 테두리 + "계좌번호 입력", 치기 시작하면 2dp 청록 테두리 + 숫자·커서·ⓧ */}
      <div className={`nh-number__box ${digits ? "on" : ""}`}>
        {digits ? (
          <span className="nh-number__val">
            {digits}
            {/* 숫자가 바뀔 때마다 다시 그려서 깜빡임을 처음(켜짐)부터 — 녹화1 50~56초: 입력 직후 500ms 켜짐 → 500ms 꺼짐 */}
            <i key={digits} className="nh-number__caret" />
            <button className="nh-number__clear" aria-label="지우기" onClick={() => onChange("")}>
              <ClearCircle />
            </button>
          </span>
        ) : (
          <span className="nh-number__ph">계좌번호 입력</span>
        )}
      </div>
      <Keypad kok kokLabel={<NhKokKey />} rowHeight={68.25} back={<BackArrowKey />} onKey={(k) => onChange(applyKey(digits, k, 16))} />
      {/* 한 자리만 쳐도 '다음'이 켜짐 (녹화1 50초 "7") */}
      <button className="nh-btn nh-btn--teal nh-sheet-btn" disabled={!digits} onClick={onDone}>
        다음
      </button>
    </>
  );
}
