import { useState } from "react";
import type { Recipient, TransferRecipients } from "../api/types";
import { Icon } from "../components/icons/Icon";
import { nhAccountLine, nhNumber } from "./banks";
import { NhAccountIcon, NhBankIcon } from "./common";
import { nhWon } from "./hangul";
import "./nh-recipients.css";

// ---------- 최근송금 / 내계좌 / 자주쓰는 (아래에 깔린 시트, 손잡이 누르면 위로) ----------
export function NhRecipientList({
  open,
  onToggle,
  data,
  onPick,
}: {
  open: boolean;
  onToggle: () => void;
  data?: TransferRecipients;
  onPick: (r: Recipient) => void;
}) {
  const [tab, setTab] = useState<"recent" | "mine" | "fav">("recent");
  // line: 이름 아래 줄. 내계좌 탭은 "농축협 352-…" + 오른쪽 잔액
  const rows: (Recipient & { at?: string; line?: string; balance?: number })[] =
    tab === "recent"
      ? (data?.recent ?? []).map((r) => ({ ...r, at: r.lastAt.replace("T", " ").replaceAll("-", ".") }))
      : tab === "mine"
        ? (data?.mine ?? []).map((m) => ({
            bank: m.bank,
            number: (m.number ?? "").replace(/\D/g, ""),
            holder: m.label,
            accountId: m.accountId,
            line: `농축협 ${nhNumber(m.number ?? "")}`,
            balance: m.balance,
          }))
        : (data?.favorites ?? []);
  return (
    <section className={`nh-rlist ${open ? "open" : ""}`}>
      <button className="nh-rlist__handle" aria-label={open ? "내리기" : "올리기"} onClick={onToggle} />
      <div className="nh-rlist__tabs">
        {(
          [
            ["recent", "최근송금"],
            ["mine", "내계좌"],
            ["fav", "자주쓰는"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="nh-rlist__tools">
        <Icon name="search" size={21} stroke={1.9} />
        {tab === "recent" ? (
          <TrashIcon />
        ) : (
          <span className="nh-rlist__reg">
            <Icon name="plus" size={13} stroke={2} /> 등록
          </span>
        )}
      </div>
      <div className="nh-rlist__rows">
        {rows.map((r) => (
          <div key={`${r.bank.code}-${r.number}`} className="nh-rlist__row" onClick={() => onPick(r)}>
            {r.accountId ? <NhAccountIcon size={36} plain /> : <NhBankIcon bank={r.bank} size={36} />}
            <span className="nh-rlist__text">
              <b>{r.holder}</b>
              <small>{r.line ?? nhAccountLine(r.bank, r.number)}</small>
              {r.at && <small>{r.at}</small>}
            </span>
            {r.balance !== undefined ? (
              <em className="nh-rlist__bal">{nhWon(r.balance)}</em>
            ) : (
              <button className="nh-rlist__plus" aria-label="자주쓰는계좌로 추가" onClick={(e) => e.stopPropagation()}>
                <Icon name="plus" size={14} stroke={2.4} />
              </button>
            )}
          </div>
        ))}
        {data && !rows.length && <p className="nh-empty">{tab === "fav" ? "자주쓰는 계좌가 없어요." : "내역이 없어요."}</p>}
      </div>
    </section>
  );
}

function TrashIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6m4-6v6" />
    </svg>
  );
}
