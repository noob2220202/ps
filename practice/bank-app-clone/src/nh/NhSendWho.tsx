import type { Account, Bank, Recipient, TransferRecipients } from "../api/types";
import { Icon } from "../components/icons/Icon";
import { nhBankList } from "./banks";
import { ClearDot, NhAccountIcon, NhDots, QuickSendIcon } from "./common";
import { nhWon } from "./hangul";
import { NhRecipientList } from "./NhRecipientList";
import "./nh-send.css";

// 콕송금 첫 단계: 출금계좌 / "누구에게 보낼까요?" / 은행·계좌번호 / 빠른송금 + 아래 최근송금 목록 (녹화1 15~22초)
export function NhSendWho({
  account,
  bank,
  digits,
  busy,
  recipients,
  listOpen,
  onPickBank,
  onOpenNumber,
  onClearDigits,
  onToggleList,
  onPickRecipient,
}: {
  account?: Account;
  bank: Bank | null;
  digits: string;
  busy: boolean;
  recipients?: TransferRecipients;
  listOpen: boolean;
  onPickBank: () => void;
  onOpenNumber: () => void;
  onClearDigits: () => void;
  onToggleList: () => void;
  onPickRecipient: (r: Recipient) => void;
}) {
  return (
    <>
      <FromAccount account={account} />
      <span className="nh-send__chev">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 5 6 6 6-6M6 12l6 6 6-6" />
        </svg>
      </span>
      <h2 className="nh-send__who">누구에게 보낼까요?</h2>
      <div className="nh-seg nh-seg--box">
        <button className="on">계좌</button>
        <button>휴대전화</button>
      </div>
      <button className="nh-send__bank" onClick={onPickBank}>
        {bank ? (nhBankList([bank], bank.section)[0]?.label ?? bank.name) : " "} <Icon name="chevron-down" size={18} stroke={2} />
      </button>
      <div className={`nh-send__number ${digits ? "filled" : ""}`}>
        <button onClick={onOpenNumber}>{digits || "계좌번호 입력"}</button>
        {busy && <NhDots size={7} />}
        {digits && !busy && (
          <button aria-label="지우기" onClick={onClearDigits}>
            <ClearDot />
          </button>
        )}
      </div>
      <button className="nh-send__quick">
        <QuickSendIcon /> 빠른송금
      </button>
      <NhRecipientList open={listOpen} onToggle={onToggleList} data={recipients} onPick={onPickRecipient} />
    </>
  );
}

function FromAccount({ account }: { account?: Account }) {
  return (
    <div className="nh-send__from">
      <NhAccountIcon size={22} plain />
      <span className="nh-send__from-text">
        <b>{account?.label ?? " "}</b>
        <small>농축협 {account?.number}</small>
      </span>
      <Icon name="chevron-down" size={18} stroke={2} />
      <span className="nh-send__from-balance">{account ? nhWon(account.balance) : ""}</span>
    </div>
  );
}
