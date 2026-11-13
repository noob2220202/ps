// 토스 화면 ↔ 서버 (plan.md §2.4). 공용 엔드포인트는 src/api/endpoints.ts 의 paths · api 를 그대로 쓰고,
// 토스만 쓰는 블록 · 새 엔드포인트(/api/toss/*)의 모양과 부르는 함수는 여기. 서버가 아직 안 준 칸이 있어도 화면이 깨지지 않게 대부분 선택 칸(?)
import { http } from "../api/client";
import type { Account, Bank, HomeData, Profile, Transaction, TransactionDetail } from "../api/types";

// ---------- GET /api/home 의 toss 블록 ----------
export interface TossHomeBlock {
  spend: { month: string; total: number }; // "{M}월에 쓴 돈" = 소비 합계 (서버 spendTotal, 🔔 card_spend 를 넣었으면 그 값)
  pointChances: number; // 송금·결제 후 받는 포인트 N번
  // max null = 배너 숨김, dismissed = 이번 달에 × 를 눌렀는지 (profile.rewardDismissed === month). 날짜 값은 profile.rewardDismissed
  reward: { month: string; max: number | null; dismissed: boolean };
  youthCard: { id: string; name: string; balance: number; lastUsedAt: string | null } | null; // 첫 선불 카드 (토스유스카드)
  adSnoozeUntil: string | null; // 이체 뒤 광고 화면 '3일 동안 안보기' 끝나는 때 (Date.parse 되는 글자)
}
export interface TossHomeData extends HomeData {
  toss?: Partial<TossHomeBlock>;
}

// ---------- 계좌 · 거래 (공용 응답에 토스만 더해지는 칸) ----------
export type TossAccountRole = "money" | null;
export interface TossAccount extends Account {
  openedAt?: string | null; // "YYYY-MM-DD" (증명서 '개설일')
  favorite?: boolean; // 어디로 보낼까요 ★ (내 계좌)
  role?: TossAccountRole; // "money" = 토스머니
}
export type TossChannel = "card" | "account" | "pay";
export interface TossTransaction extends Transaction {
  category?: string | null;
  channel?: TossChannel | null;
  cardId?: string | null;
  cancelled?: boolean;
  exclude?: boolean;
  own?: boolean; // 내 계좌끼리 옮긴 돈
}
// 상세 내역의 상대 계좌. out = 내가 보낸 이체, in + own = 내 다른 계좌에서 온 돈 (holder = 내 이름), in + !own = 다른 사람이 보낸 돈
export interface TossCounterparty {
  direction: "in" | "out";
  own: boolean;
  accountId?: string; // own 이면 내 계좌 id
  accountName?: string; // own 이면 내 계좌 이름
  bank: Bank;
  number: string; // 은행 형식대로 하이픈
  digits: string; // 숫자만
  holder: string;
}
export interface TossTxDetail extends TransactionDetail {
  kindLabel?: "입금" | "출금";
  counterparty?: TossCounterparty | null; // 카드 결제 등 이체가 아닌 거래는 null
  category?: string | null;
  channel?: TossChannel | null;
  cardId?: string | null;
  cancelled?: boolean;
  exclude?: boolean;
  own?: boolean;
}
export interface TossProfile extends Profile {
  pointChances?: number;
  rewardMax?: number | null;
  rewardDismissed?: string | null;
  adSnoozeUntil?: string | null;
}

// ---------- GET /api/toss/spend ----------
export type TossSpendTab = "all" | "card" | "account" | "pay";
export type TossSpendIcon = string; // "transfer" | "store" | "cashback" | "interest" | "bank:<code>" | "cat:<category>"
// spend = 소비 합계에 든 출금 · excluded = 회색 (소비에서 제외 · 내 계좌끼리) · income = 받은 돈 · cancelled = 취소 (취소선)
export type TossSpendTone = "spend" | "excluded" | "income" | "cancelled";
export interface TossSpendItem {
  id: string;
  txId: string;
  accountId: string;
  channel: TossChannel; // "account" 일 때만 줄을 누르면 /tx/:txId
  time: string; // "HH:MM"
  title: string; // 가게 이름 · "내 계좌 이체"
  suffix?: "취소";
  subtitle: string;
  amount: number; // 부호 있음
  tone: TossSpendTone;
  icon: TossSpendIcon;
}
export interface TossSpendGroup {
  date: string; // "YYYY-MM-DD"
  label: string; // "D일 요일"
  overspent: boolean; // 평소보다 많이 씀
  items: TossSpendItem[];
}
export interface TossSpendCategory {
  key: string;
  label: string;
  color: string;
  amount: number; // 비율은 화면이 total 로 계산
}
export interface TossSpendDay {
  date: string; // "YYYY-MM-DD"
  dow: number; // 0 = 일
  income: number;
  expense: number;
}
export interface TossSpend {
  month: string; // "YYYY-MM"
  label: string; // "11월" · 다른 해면 "2025년 12월"
  today: string; // "YYYY-MM-DD"
  hasPrev: boolean;
  hasNext: boolean;
  tab: TossSpendTab;
  total: number;
  vsLastMonth: { diff: number };
  categories: TossSpendCategory[]; // 많은 순 3개 + "그 외"
  days: TossSpendDay[]; // 그 달 모든 날
  cashback: { count: number } | null; // 이번 달 · 전체/카드 탭 · 캐시백 기회가 있을 때만. 그땐 groups[0] 이 늘 오늘
  groups: TossSpendGroup[];
}

// ---------- GET /api/toss/assets (내 계좌도 같은 응답) ----------
export interface TossAssetAccount {
  id: string;
  bankCode: string;
  name: string;
  number: string | null;
  balance: number;
  isMain: boolean;
  role: TossAccountRole;
  favorite: boolean;
}
export interface TossAssetCard {
  id: string;
  name: string;
  bankCode: string;
  accountId: string | null;
  art: string | null;
  kind: "check" | "prepaid";
  balance?: number; // 선불 카드만
  lastUsedAt: string | null;
  sort: number;
  monthAmount: number; // 이번 달 취소 안 된 출금 합계
}
export interface TossAssetPoint {
  id: string;
  name: string;
  balance: number;
  icon: string | null;
  sort: number;
}
export interface TossAssets {
  total: number; // 계좌 + 포인트 (카드는 자산이 아님)
  accounts: { count: number; total: number; items: TossAssetAccount[] }; // sort 순
  cards: { count: number; items: TossAssetCard[] }; // 이번 달 많이 쓴 순
  points: { count: number; items: TossAssetPoint[] };
}

// ---------- 카드 · 포인트 (🔔 관리 패널) ----------
export interface TossCard {
  id: string;
  name: string;
  bankCode: string;
  accountId: string | null;
  art: string | null;
  kind: "check" | "prepaid";
  balance?: number; // 선불 카드만 (보낼 땐 null 로 지움)
  lastUsedAt: string | null; // "YYYY-MM-DDTHH:MM:SS" (보낼 땐 YYYY-MM-DD[THH:mm[:ss]])
  sort: number;
}
export interface TossPoint {
  id: string;
  name: string;
  balance: number;
  icon: string | null;
  sort: number;
}

// POST/PATCH /api/toss/cards 에 보내는 칸 (빠진 칸은 그대로 · kind 기본 "check")
export type TossCardInput = Partial<Omit<TossCard, "id" | "balance" | "accountId" | "art" | "lastUsedAt">> & {
  balance?: number | null;
  accountId?: string | null;
  art?: string | null;
  lastUsedAt?: string | null;
};

export const tossPaths = {
  spend: (month?: string, tab: TossSpendTab = "all") => `/api/toss/spend?${month ? `month=${encodeURIComponent(month)}&` : ""}tab=${tab}`,
  assets: "/api/toss/assets",
  cards: "/api/toss/cards",
  card: (id: string) => `/api/toss/cards/${encodeURIComponent(id)}`,
  points: "/api/toss/points",
  point: (id: string) => `/api/toss/points/${encodeURIComponent(id)}`,
};

// 데이터를 바꾸는 요청 (성공하면 client 가 invalidate → 화면들이 다시 받음)
export const tossApi = {
  updateProfile: (patch: Partial<Pick<TossProfile, "pointChances" | "rewardMax" | "rewardDismissed" | "adSnoozeUntil" | "userName" | "cardSpend" | "cashbackCount">>) =>
    http.patch<TossProfile>("/api/profile", patch),
  updateAccount: (id: string, patch: { balance?: number; number?: string; name?: string; favorite?: boolean; openedAt?: string | null; sort?: number; role?: TossAccountRole }) =>
    http.patch<TossAccount>(`/api/accounts/${encodeURIComponent(id)}`, patch),
  updateTransaction: (id: string, patch: { memo?: string; category?: string | null; channel?: TossChannel | null; cardId?: string | null; cancelled?: boolean; exclude?: boolean }) =>
    http.patch<TossTxDetail>(`/api/transactions/${encodeURIComponent(id)}`, patch),
  addCard: (body: TossCardInput & Pick<TossCard, "name" | "bankCode">) => http.post<TossCard>(tossPaths.cards, body),
  updateCard: (id: string, patch: TossCardInput) => http.patch<TossCard>(tossPaths.card(id), patch),
  deleteCard: (id: string) => http.delete(tossPaths.card(id)),
  addPoint: (body: Partial<Omit<TossPoint, "id">> & Pick<TossPoint, "name">) => http.post<TossPoint>(tossPaths.points, body),
  updatePoint: (id: string, patch: Partial<Omit<TossPoint, "id">>) => http.patch<TossPoint>(tossPaths.point(id), patch),
  deletePoint: (id: string) => http.delete(tossPaths.point(id)),
};

// 이체 뒤 광고 화면을 건너뛸지 (3일 동안 안보기)
export const tossAdSnoozed = (until: string | null | undefined, now = Date.now()) => !!until && Date.parse(until) > now;
