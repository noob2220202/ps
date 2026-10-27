export interface Account {
  id: string;
  nickname: string;
  balanceWon: number;
  isStarred: boolean;
  badge?: string; // e.g. "한도계좌"
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string; // "10.27"
  time: string; // "11:37"
  merchant: string;
  amountWon: number; // negative = 출금, positive = 입금
  balanceAfterWon: number;
  tag: string; // "#체크카드" | "#자동이체" | "#예금이자"
}

export interface TransactionDetail extends Transaction {
  transactedAt: string; // "2026.10.22 22:08:56"
  transactionType: string; // "체크카드결제"
  cardInfo?: string; // "프렌즈 체크카드 (5321)"
  merchantAddress?: string;
  merchantPhone?: string;
}

export interface GroupAccount {
  id: string;
  name: string;
  memberCount: number;
  unpaidDuesCount: number;
}

export interface MonthlyCardSpend {
  totalWon: number;
  label: string; // "이번달 쓴 돈"
}
