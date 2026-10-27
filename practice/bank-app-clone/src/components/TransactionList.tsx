import type { Transaction } from "../types/bank";
import { TransactionItem } from "./TransactionItem";
import "./TransactionList.css";

interface TransactionListProps {
  transactions: Transaction[];
  onItemClick?: (tx: Transaction) => void;
}

// date로 그룹핑: "같은 date 값끼리 묶는다"가 목표.
// reduce로 { "10.27": [...], "10.26": [...] } 같은 객체를 만든다.
// mock 데이터가 이미 최신순으로 정렬되어 있어서 Object의 key 순서도 그대로 유지됨
// (JS는 문자열 key를 삽입 순서대로 순회하므로 날짜를 다시 정렬할 필요가 없음).
//
// 더 짧게: 최신 JS/TS 환경(ES2024+)이면 reduce 대신 `Object.groupBy(transactions, tx => tx.date)`
// 한 줄로 끝낼 수 있다. 다만 타입스크립트 lib 설정에 따라 타입 지원이 아직 덜 되어 있을 수 있어서
// 여기선 호환성 걱정 없는 reduce 버전을 씀.
function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    (acc[tx.date] ??= []).push(tx);
    return acc;
  }, {});
  return Object.entries(grouped);
}

export function TransactionList({ transactions, onItemClick }: TransactionListProps) {
  const groups = groupByDate(transactions);

  return (
    <div className="tx-list">
      {groups.map(([date, txs]) => (
        <div key={date} className="tx-list__group">
          <div className="tx-list__date">{date}</div>
          {txs.map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} onClick={() => onItemClick?.(tx)} />
          ))}
        </div>
      ))}
    </div>
  );
}
