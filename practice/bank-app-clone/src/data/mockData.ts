import type {
  Account,
  Transaction,
  TransactionDetail,
  GroupAccount,
  MonthlyCardSpend,
} from "../types/bank";

// 전부 가상의 데이터입니다. 실제 개인 금융정보를 쓰지 마세요.

export const mockAccounts: Account[] = [
  { id: "acc-mini", nickname: "민수 mini", balanceWon: 0, isStarred: false },
  {
    id: "acc-main",
    nickname: "한도계좌",
    balanceWon: 452_300,
    isStarred: true,
    badge: "한도계좌",
  },
  { id: "acc-nh", nickname: "민수의 제휴은행 계좌", balanceWon: 0, isStarred: false },
];

export const mockMonthlyCardSpend: MonthlyCardSpend = {
  totalWon: 187_400,
  label: "이번달 쓴 돈",
};

export const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    accountId: "acc-main",
    date: "10.27",
    time: "09:12",
    merchant: "별빛커피",
    amountWon: -4_500,
    balanceAfterWon: 452_300,
    tag: "#체크카드",
  },
  {
    id: "tx-2",
    accountId: "acc-main",
    date: "10.27",
    time: "08:40",
    merchant: "지니뮤직 정기결제",
    amountWon: -9_900,
    balanceAfterWon: 456_800,
    tag: "#자동이체",
  },
  {
    id: "tx-3",
    accountId: "acc-main",
    date: "10.26",
    time: "19:20",
    merchant: "한끼도시락",
    amountWon: -8_200,
    balanceAfterWon: 466_700,
    tag: "#체크카드",
  },
  {
    id: "tx-4",
    accountId: "acc-main",
    date: "10.24",
    time: "05:40",
    merchant: "입출금통장 이자",
    amountWon: 12,
    balanceAfterWon: 474_900,
    tag: "#예금이자",
  },
];

export const mockTransactionDetails: Record<string, TransactionDetail> = {
  "tx-1": {
    ...mockTransactions[0],
    transactedAt: "2026.10.27 09:12:03",
    transactionType: "체크카드결제",
    cardInfo: "프렌즈 체크카드 (1234)",
    merchantAddress: "서울 강남구 테헤란로 123",
    merchantPhone: "02)123-4567",
  },
};

export const mockGroupAccount: GroupAccount = {
  id: "group-1",
  name: "스터디 모임통장",
  memberCount: 4,
  unpaidDuesCount: 1,
};
