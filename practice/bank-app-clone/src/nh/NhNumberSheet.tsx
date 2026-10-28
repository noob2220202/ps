import type { Bank } from "../api/types";
import { Icon } from "../components/icons/Icon";
import { Keypad } from "../components/Sheet";
import { applyKey } from "../lib/keypad";
import { nhBankList } from "./banks";
import { BackArrowKey, ClearDot, NhBankIcon } from "./common";
import "./nh-numbersheet.css";

// ---------- 계좌번호 시트: [은행 ⌄] [X] / 입력칸 / 키패드(콕) / 다음 ----------
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
      <div className="nh-sheet-head">
        <button className="nh-number__bank" onClick={onBank}>
          <NhBankIcon bank={bank} size={20} /> {nhBankList([bank], bank.section)[0]?.label ?? bank.name}{" "}
          <Icon name="chevron-down" size={15} stroke={2} />
        </button>
        <button className="nh-icon-btn" aria-label="닫기" onClick={onClose}>
          <Icon name="close" size={22} stroke={1.7} />
        </button>
      </div>
      {/* 비어 있으면 회색 테두리 + "계좌번호 입력", 치기 시작하면 청록 테두리 */}
      <div className={`nh-number__box ${digits ? "on" : ""}`}>
        <span>
          {digits || <i>계좌번호 입력</i>}
          {digits && <i className="nh-caret" />}
        </span>
        {digits && (
          <button aria-label="지우기" onClick={() => onChange("")}>
            <ClearDot />
          </button>
        )}
      </div>
      <Keypad kok rowHeight={57} back={<BackArrowKey />} onKey={(k) => onChange(applyKey(digits, k, 16))} />
      <button className="nh-btn nh-btn--teal nh-sheet-btn" disabled={digits.length < 10} onClick={onDone}>
        다음
      </button>
    </>
  );
}
