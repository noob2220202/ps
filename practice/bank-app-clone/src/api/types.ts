// 화면 ↔ 서버가 주고받는 데이터 모양 ("API 계약"). 진짜 백엔드를 만들어도 이 모양만 지키면 화면은 그대로.

export type TxTag = "#체크카드" | "#자동이체" | "#예금이자" | "#이체";
export const TX_TAGS: TxTag[] = ["#체크카드", "#자동이체", "#예금이자", "#이체"];

// "mini", "main"은 고정, 다른 은행 계좌는 서버가 만든 id ("nh", "bank-1a2b3c4d" ...)
export type AccountId = string;

export interface Profile {
  userName: string;
  miniAccountNo: string; // 0000-00-0000000
  cardLast4: string;
}

export interface Bank {
  code: string;
  name: string; // "신한은행"
  short: string; // 아이콘에 쓰는 짧은 이름 "신한"
  color: string; // 대표색
  text: string; // 아이콘 글자색
  pattern?: number[]; // 계좌번호 자리수 묶음 (예: [3, 3, 6] → 000-000-000000)
}

export interface Account {
  id: AccountId;
  kind: "mini" | "main" | "external";
  label: string;
  balance: number;
  badge?: string;
  number?: string;
  bank?: Bank; // 다른 은행 계좌일 때만
}

export interface NewBankAccount {
  bankCode: string;
  number: string;
  balance: number;
}

export interface Transaction {
  id: string;
  accountId: AccountId;
  at: string; // ISO 로컬 시각 "2026-10-27T11:37:12"
  date: string; // 화면용 "10.27"
  time: string; // 화면용 "11:37"
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

export interface Banner {
  id: string;
  title: string; // 줄바꿈은 \n
  cta: string;
  image: "banner-and2ble" | "banner-mcard" | "banner-volunteer" | "banner-pcbang";
  ad?: boolean; // 유료 광고면 AD 뱃지
}

export interface HomeData {
  profile: Profile;
  accounts: Account[];
  monthlyCardSpend: number;
  cashbackCount: number;
  banners: Banner[];
  aiPromo: { title: string; desc: string };
  shortcuts: { id: string; label: string; icon: "shortcut-timetable" | "shortcut-subsidy" | "shortcut-id" | "shortcut-mini26" }[];
  nativeAd: { source: string; title: string; sponsor: string };
}

// ----- 요청 바디 -----
export interface NewTransaction {
  merchant: string;
  amount: number;
  tag: TxTag;
  at?: string; // 없으면 서버가 "지금"으로
}

// ----- 에러 응답 -----
export interface ApiErrorBody {
  code: "VALIDATION" | "NOT_FOUND" | "INSUFFICIENT_BALANCE" | "SERVER_ERROR";
  message: string;
  fields?: Record<string, string>; // 입력값별 에러 메시지
}

