// 화면 ↔ 서버가 주고받는 데이터 모양 ("API 계약"). 진짜 백엔드를 만들어도 이 모양만 지키면 화면은 그대로.

export type TxTag = "#체크카드" | "#자동이체" | "#예금이자" | "#이체";
export const TX_TAGS: TxTag[] = ["#체크카드", "#자동이체", "#예금이자", "#이체"];

// "main"(카카오뱅크 3333 통장)은 고정, 다른 은행 계좌는 서버가 만든 id ("nh", "bank-1a2b3c4d" ...)
export type AccountId = string;

// 접속할 때 고르는 프로필 (넷플릭스 프로필처럼). 프로필마다 은행 데이터가 따로 있다
export type AvatarName = "boy" | "girl" | "child" | "grandma" | "wave" | "star" | "coin" | "money-bag";
export interface AppProfile {
  id: string;
  name: string;
  avatar: AvatarName;
  color: string;
  os?: "android" | "ios"; // 이 프로필로 마지막에 본 기기
  theme?: "light" | "dark" | "system";
}

// 앱 안의 "내 정보" (지금 고른 프로필의 DB에 들어 있음)
export interface Profile {
  userName: string;
  cardSpend: number | null; // 이번달 쓴 돈 직접 입력값 (null = 체크카드 거래 합계로 자동)
  cashbackCount: number; // 현금 돌려받을 기회 N건
  cardLast4: string;
  suspended?: boolean; // 카카오뱅크 계좌 지급정지 (🔔 패널, 연습용) — 켜면 이체를 누를 때 '고객센터로 문의해주세요.' 팝업, 서버도 403
}

export interface Bank {
  code: string;
  name: string; // "신한은행"
  short: string; // 이체 화면에서 번호 앞에 붙는 짧은 이름 "신한"
  color: string; // 동그라미 아이콘 대표색
  section: "bank" | "securities"; // 은행선택 목록에서 구분선 위/아래
  pattern?: number[]; // 계좌번호 자리수 묶음 (예: [3, 3, 6] → 000-000-000000). 없으면 10~14자리
  alt?: number[]; // 자리수가 다른 두 번째 형식 (농협: 농협은행 13자리 [3,4,4,2] / 농축협 14자리 [6,2,6])
}

export interface Account {
  id: AccountId;
  kind: "main" | "external";
  label: string;
  balance: number;
  badge?: string;
  number?: string;
  bank: Bank; // main은 카카오뱅크
  safebox?: number; // 세이프박스 (main만, 통장 잔액과 별도)
}

export interface NewBankAccount {
  bankCode: string;
  name?: string; // 계좌 이름 (콕뱅크: 저축예금 등)
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
  toBank?: { code: string; digits: number }; // 내가 보낸 이체면 받은 은행과 계좌번호 자리수
}

export interface TransactionDetail extends Transaction {
  transactedAt: string;
  kind: string;
  cardInfo?: string;
  address?: string;
  phone?: string;
  memo?: string; // 거래메모 (콕뱅크)
  transfer?: { bank: Bank; number: string; holder: string }; // 내가 보낸 이체면 받은 계좌
  memoTo?: string; // 보낼 때 받는 분 통장에 표시한 글자 (없으면 내 이름)
}

export interface Banner {
  id: string;
  title: string; // 줄바꿈은 \n
  cta: string;
  image: "banner-and2ble" | "banner-mcard" | "banner-pcbang" | "banner-friday";
  ad?: boolean; // 유료 광고면 AD 뱃지
}

export interface HomeData {
  profile: Profile;
  accounts: Account[];
  monthlyCardSpend: number;
  cashbackCount: number;
  banners: Banner[];
  aiPromo: { title: string; desc: string };
  shortcuts: { id: string; label: string; icon: "shortcut-subsidy" | "shortcut-timetable" | "shortcut-allowance" | "shortcut-coupon" }[];
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
  receiveError?: boolean; // i-ONE Bank: 받는 은행 오류 안내 (녹화 28초)
}

export interface MyAccountRecipient {
  accountId: AccountId;
  kind: Account["kind"];
  label: string;
  bank: Bank;
  number?: string;
  holder: string;
  balance: number;
}

export interface TransferRecipients {
  mine: MyAccountRecipient[];
  recent: (Recipient & { lastAt: string })[];
  favorites: (Payee & { payeeId: string })[];
  dailyRemaining?: number; // 콕뱅크만: 오늘 더 보낼 수 있는 금액
}

export interface Payee {
  id: string;
  bank: Bank;
  number: string;
  holder: string;
  favorite: boolean;
  showRecent?: boolean; // 카카오뱅크: 이체 화면 '최근 이체'에 보임 (🔔 받는 분, ☆ 와 따로)
  receiveError?: boolean; // i-ONE Bank: 보내면 받는 은행 오류 안내 (🔔 관리 → 받는 분에서 켬)
}

export interface NewTransfer {
  fromAccountId: AccountId;
  bankCode: string;
  number: string;
  amount: number;
  memoTo?: string; // 받는 분에게 표기 (기본: 내 이름)
  memoMe?: string; // 나에게 표기 (기본: 받는 분 이름)
  checkDuplicate?: boolean; // 케이뱅크: 오늘 같은 계좌·같은 금액으로 보낸 이체가 있으면 409 DUPLICATE_TODAY (보내지 않음) → 확인창 뒤 이 값 없이 다시 보냄
}

export interface TransferResult {
  id: string;
  outTxId: string; // 내 통장 출금 거래 id
  fromAccountId: AccountId;
  to: Recipient;
  amount: number;
  at: string;
  balanceAfter: number;
}

// 이체 기록 한 건 (GET /api/transfers) — 보낸 계좌 번호, 받는 분, 통장 표시까지
export interface TransferRecord {
  id: string;
  at: string;
  fromAccountId: AccountId;
  fromNumber: string;
  bank: Bank;
  number: string; // 숫자만
  holder: string;
  amount: number;
  memoTo: string; // 받는 분 통장 표시 (없으면 내 이름)
  memoMe: string; // 내 통장 표시 (없으면 받는 분 이름)
  outTxId: string | null;
}

// ----- 요청 바디 -----
export interface NewTransaction {
  merchant: string;
  amount: number;
  tag: TxTag;
  at?: string; // 없으면 서버가 "지금"으로
}

// 🔔 관리 패널: 상세거래내역 시트에 보이는 값을 통째로 고치기 (들어 있는 자리만 바꿈)
export interface TransactionEdit {
  merchant?: string;
  amount?: number; // 출금은 음수
  tag?: TxTag;
  at?: string; // "2026-10-27T11:37:12"
  kind?: string; // 거래구분 ("" 이면 tag로 계산한 기본값으로 되돌아감)
  memo?: string;
  // 상대은행·상대계좌·상대계좌 예금주명: 셋을 같이 보냄. 셋 다 채우면 저장(출금 거래면 "다시이체"도 뜸), 하나라도 비우면 지움
  counterBank?: string;
  counterNumber?: string;
  counterHolder?: string;
}

// ----- 에러 응답 -----
export interface ApiErrorBody {
  code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "PROFILE_REQUIRED" | "PROFILE_NOT_FOUND" | "INSUFFICIENT_BALANCE" | "LIMIT_EXCEEDED" | "DUPLICATE_TODAY" | "ACCOUNT_SUSPENDED" | "ACCOUNT_NOT_FOUND" | "SERVER_ERROR";
  message: string;
  fields?: Record<string, string>; // 입력값별 에러 메시지
}

