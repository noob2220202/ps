export type TxTag = "#체크카드" | "#자동이체" | "#예금이자";

export interface Transaction {
  id: string;
  date: string; // "10.27"
  time: string; // "11:37"
  seconds: string; // 상세 화면의 거래시각에만 씀
  merchant: string;
  amount: number; // 출금은 음수
  balanceAfter: number;
  tag: TxTag;
}

export interface TransactionDetail extends Transaction {
  transactedAt: string;
  kind: string;
  cardInfo?: string;
  address?: string;
  phone?: string;
}

export interface Account {
  id: "mini" | "main" | "nh";
  kind: "mini" | "main" | "external";
  label: string;
  balance: number;
  badge?: string;
  number?: string;
}

export interface HomeData {
  accounts: Account[];
  monthlyCardSpend: number;
  ad: { title: string; subtitle: string; when: string; cta: string };
  aiPromo: { title: string; desc: string };
}
