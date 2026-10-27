import type { Transaction } from "../types/bank";
import { signedFormatWon } from "../lib/format";
import "./TransactionItem.css";

interface TransactionItemProps {
  transaction: Transaction;
  onClick?: () => void;
}

export function TransactionItem({ transaction, onClick }: TransactionItemProps) {
  const isIncome = transaction.amountWon > 0;

  return (
    <div className="tx-item" onClick={onClick} role="button" tabIndex={0}>
      <div className="tx-item__left">
        <span className="tx-item__time">{transaction.time}</span>
        <span className="tx-item__merchant">{transaction.merchant}</span>
        <span className="tx-item__tag">{transaction.tag}</span>
      </div>
      <div className="tx-item__right">
        <span className={`tx-item__amount ${isIncome ? "tx-item__amount--income" : ""}`}>
          {signedFormatWon(transaction.amountWon)}
        </span>
        <span className="tx-item__balance">{transaction.balanceAfterWon.toLocaleString("ko-KR")}원</span>
      </div>
    </div>
  );
}
