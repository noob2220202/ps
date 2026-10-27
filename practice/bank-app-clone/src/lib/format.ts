// 금액 포맷팅은 화면 3곳(AccountCard, TransactionItem, TransactionDetailPage)에서
// 반복되므로 공용 함수로 뽑아둔다. toLocaleString("ko-KR")이 천단위 콤마를 알아서 찍어준다.
export function formatWon(amountWon: number): string {
  return `${amountWon.toLocaleString("ko-KR")}원`;
}

// 거래내역의 +/- 부호와 색상 클래스를 결정할 때 음수/0/양수 여부가 반복해서 필요해서 뽑아둠
export function signedFormatWon(amountWon: number): string {
  const sign = amountWon > 0 ? "+" : "-";
  return `${sign}${Math.abs(amountWon).toLocaleString("ko-KR")}원`;
}
