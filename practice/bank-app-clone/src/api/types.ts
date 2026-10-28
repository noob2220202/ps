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
  short: string; // 이체 화면에서 번호 앞에 붙는 짧은 이름 "신한"
  color: string; // 동그라미 아이콘 대표색
  section: "bank" | "securities"; // 은행선택 목록에서 구분선 위/아래
  pattern?: number[]; // 계좌번호 자리수 묶음 (예: [3, 3, 6] → 000-000-000000). 없으면 10~14자리
}

export interface Account {
  id: AccountId;
  kind: "mini" | "main" | "external";
  label: string;
  balance: number;
  badge?: string;
  number?: string;
  bank: Bank; // mini·입출금통장은 카카오뱅크
  limit?: { daily: number; monthly: number }; // mini 이체 한도
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

// ----- 이체 -----
// 받는 분: 내 계좌(accountId) 이거나 🔔 패널에 등록한 사람(payeeId)
export interface Recipient {
  bank: Bank;
  number: string; // 숫자만
  holder: string; // 예금주
  accountId?: AccountId;
  payeeId?: string;
  favorite?: boolean;
}

export interface MyAccountRecipient {
  accountId: AccountId;
  kind: Account["kind"];
  label: string;
  bank: Bank;
  number?: string;
  holder: string;
}

export interface TransferRecipients {
  mine: MyAccountRecipient[];
  recent: Recipient[];
}

export interface Payee {
  id: string;
  bank: Bank;
  number: string;
  holder: string;
  favorite: boolean;
}

export interface NewTransfer {
  fromAccountId: AccountId;
  bankCode: string;
  number: string;
  amount: number;
  memoTo?: string; // 받는 분에게 표기 (기본: 내 이름)
  memoMe?: string; // 나에게 표기 (기본: 받는 분 이름)
}

export interface TransferResult {
  id: string;
  fromAccountId: AccountId;
  to: Recipient;
  amount: number;
  at: string;
  balanceAfter: number;
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
  code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "INSUFFICIENT_BALANCE" | "LIMIT_EXCEEDED" | "ACCOUNT_NOT_FOUND" | "SERVER_ERROR";
  message: string;
  fields?: Record<string, string>; // 입력값별 에러 메시지
}

