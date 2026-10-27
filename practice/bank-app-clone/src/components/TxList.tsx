import type { Transaction } from "../api/types";
import { groupByDate, signedWon, won } from "../lib/format";
import "./TxList.css";

interface TxListProps {
  items: Transaction[];
  onSelect?: (tx: Transaction) => void;
  variant?: "card" | "flat";
  activeId?: string | null;
}

export function TxList({ items, onSelect, variant = "flat", activeId }: TxListProps) {
  return (
    <div className={`txlist txlist--${variant}`}>
      {groupByDate(items).map(([date, txs]) => (
        <section key={date} className="txlist__group">
          <h3 className="txlist__date">{date}</h3>
          {txs.map((tx) => (
            <button
              key={tx.id}
              className={`txlist__row row-press ${activeId === tx.id ? "txlist__row--active" : ""}`}
              onClick={() => onSelect?.(tx)}
            >
              <span className="txlist__left">
                <span className="txlist__merchant">{tx.merchant}</span>
                <span className="txlist__meta">
                  {tx.time} <span className="txlist__tag">{tx.tag}</span>
                </span>
              </span>
              <span className="txlist__right">
                <span className={`txlist__amount ${tx.amount > 0 ? "txlist__amount--in" : ""}`}>
                  {signedWon(tx.amount)}
                </span>
                <span className="txlist__balance">{won(tx.balanceAfter)}</span>
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
