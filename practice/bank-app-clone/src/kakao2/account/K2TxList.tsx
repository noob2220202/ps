import { memo } from "react";
import type { Transaction } from "../../api/types";
import { groupByDate, signedWon, won } from "../../lib/format";

// 통장 거래 목록 (account.md 2.6, 이름은 critic.md X16): 흰 바탕에 날짜(MM.DD)로 묶음, 날짜는 같이 스크롤(고정 아님).
// 행 = 이름 · 금액 / 시각 · 거래 후 잔액. #태그 없음, 구분선 없음, 누른 모습 없음 (누르면 로딩 막 + 거래상세 모달 — 화면이)
export const K2TxList = memo(function K2TxList({ items, onSelect }: { items: Transaction[]; onSelect: (tx: Transaction) => void }) {
  return (
    <div className="k2list">
      {groupByDate(items).map(([date, txs]) => (
        <section key={date}>
          <h3 className="k2list__date">{date}</h3>
          {txs.map((tx) => (
            <button key={tx.id} className="k2list__row" onClick={() => onSelect(tx)}>
              <span className="k2list__merchant">{tx.merchant}</span>
              <span className={`k2list__amount${tx.amount > 0 ? " k2list__amount--in" : ""}`}>{signedWon(tx.amount)}</span>
              <span className="k2list__time">{tx.time}</span>
              <span className="k2list__after">{won(tx.balanceAfter)}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
});
