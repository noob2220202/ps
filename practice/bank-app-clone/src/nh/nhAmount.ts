// 콕송금 금액 규칙 (담당 amount). 금액 시트·금액 화면이 같이 씀

// 보낼 금액이 잔액·1일 한도를 넘으면 나오는 안내 (녹화1 60초: 금액이 빨개지고 두 줄 안내). 화면 쪽 금액 상자 아래에도 같은 글
export function amountError(amount: number, balance: number, remaining: number) {
  if (amount > balance) return "통장의 잔액이 부족합니다.\n잔액을 확인해 주세요.";
  if (amount > remaining) return "1일 송금 잔여한도를 초과했습니다.\n금액을 확인해 주세요.";
  return null;
}
