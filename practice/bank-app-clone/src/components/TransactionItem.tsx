import type { Transaction } from "../types/bank";

// SPEC.md의 "계좌 상세 화면 > 거래내역 아이템" 참고
// 요구사항:
// - 왼쪽: 시각(time), 거래처명(merchant), 태그(tag, 파란 글씨)
// - 오른쪽: 금액(양수는 파란색 "+", 음수는 기본색 "-"), 그 아래 작은 글씨로 거래후잔액
// - 같은 날짜(date)끼리는 TransactionList에서 날짜 헤더로 그룹핑됨 (이 컴포넌트는 날짜 표시 안함)

interface TransactionItemProps {
  transaction: Transaction;
  onClick?: () => void;
}

export function TransactionItem({ transaction, onClick }: TransactionItemProps) {
  return <div onClick={onClick}>TODO: TransactionItem 구현 ({transaction.merchant})</div>;
}
