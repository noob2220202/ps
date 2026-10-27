import type { Transaction } from "../types/bank";
import { TransactionItem } from "./TransactionItem";

// SPEC.md의 "계좌 상세 화면 > 거래내역 리스트" 참고
// 요구사항:
// - transactions를 date 기준으로 그룹핑해서 "10.27" 같은 날짜 헤더를 먼저 보여주고
//   그 아래에 해당 날짜의 TransactionItem들을 나열
// - 날짜 그룹 순서는 최신 날짜가 위로

interface TransactionListProps {
  transactions: Transaction[];
  onItemClick?: (tx: Transaction) => void;
}

export function TransactionList({ transactions, onItemClick }: TransactionListProps) {
  return (
    <div>
      TODO: 날짜별로 그룹핑해서 렌더링하세요
      {transactions.map((tx) => (
        <TransactionItem key={tx.id} transaction={tx} onClick={() => onItemClick?.(tx)} />
      ))}
    </div>
  );
}
