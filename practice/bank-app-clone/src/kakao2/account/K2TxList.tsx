import { memo, type CSSProperties } from "react";
import type { Transaction } from "../../api/types";
import { groupByDate, signedWon, won } from "../../lib/format";

// 통장 거래 목록 (account.md 2.6, 이름은 critic.md X16): 흰 바탕에 날짜(MM.DD)로 묶음, 날짜는 같이 스크롤(고정 아님).
// 행 = 이름 · 금액 / 시각 · 거래 후 잔액. #태그 없음, 구분선 없음, 누른 모습 없음 (누르면 로딩 막 + 거래상세 모달 — 화면이)

// 녹화 기기 px(1/3pt) 로 쌓음: 날짜 칸 107 (35.67pt) · 행 232 (77.33pt). 크롬은 글자 세로 위치를 CSS px 로 붙이므로
// 칸 높이는 정수 pt 로 반올림해 두고 남는 ±1/3pt 는 transform 으로 → 몇 번째 행이든 녹화와 같은 기기 px 에 그려짐
const DATE_PX = 107;
const ROW_PX = 232;

// 칸 하나: 목록 위끝에서 기기 px 로 top 부터 h 만큼 → 정수 높이 + 남는 1/3pt
function slot(top: number, h: number): CSSProperties {
  const y = Math.round(top / 3);
  const dy = top / 3 - y;
  return { height: Math.round((top + h) / 3) - y, transform: dy ? `translateY(${dy.toFixed(4)}px)` : undefined };
}

export const K2TxList = memo(function K2TxList({ items, onSelect }: { items: Transaction[]; onSelect: (tx: Transaction) => void }) {
  let at = 0;
  return (
    <div className="k2list">
      {groupByDate(items).map(([date, txs]) => {
        const head = slot(at, DATE_PX);
        at += DATE_PX;
        return (
          <section key={date}>
            <h3 className="k2list__date" style={head}>
              {date}
            </h3>
            {txs.map((tx) => {
              const style = slot(at, ROW_PX);
              at += ROW_PX;
              return (
                <button key={tx.id} className="k2list__row" style={style} onClick={() => onSelect(tx)}>
                  <span className="k2list__l1">
                    <span className="k2list__merchant">{tx.merchant}</span>
                    <span className={`k2list__amount${tx.amount > 0 ? " k2list__amount--in" : ""}`}>{signedWon(tx.amount)}</span>
                  </span>
                  <span className="k2list__l2">
                    <span className="k2list__time">{tx.time}</span>
                    <span className="k2list__after">{won(tx.balanceAfter)}</span>
                  </span>
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
});
