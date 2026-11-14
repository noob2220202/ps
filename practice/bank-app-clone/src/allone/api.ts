// NH올원뱅크 화면 ↔ 서버 (plan.md §2.4). 공용 엔드포인트는 src/api/endpoints.ts 의 paths · api 를 그대로 쓰고,
// allone 서버만 더 주는 칸(blocked/disputed · ao 블록)과 새 엔드포인트(DELETE /api/transfer/recent)의 모양 · 부르는 함수는 여기.
// 서버가 아직 안 준 칸이 있어도 화면이 깨지지 않게 더해진 칸은 모두 선택(?)으로 — 화면은 ?? 로 기본값
// 같은 데이터를 화면끼리(그리고 로딩 막 동안의 prefetch 와) 나눠 쓰도록 주소는 늘 aoPaths 로
import { http } from "../api/client";
import { api, paths } from "../api/endpoints";
import type {
  Account,
  Bank,
  HomeData,
  NewTransfer,
  Payee,
  Profile,
  Recipient,
  Transaction,
  TransactionDetail,
  TransferRecipients,
  TransferRecord,
  TransferResult,
} from "../api/types";

// ---------- 계좌 ----------
// blocked: 지급정지 — 이 계좌에서는 서버도 실제로 보내기를 막음(입금은 됨). disputed: 이의제기를 신청해 둠(검토 중, 신청만으론 안 풀림)
export interface AoAccount extends Account {
  blocked?: boolean;
  disputed?: boolean;
}
export const isAoNh = (a: { bank?: { code: string } | null }) => a.bank?.code === "nh"; // NH농협은행 계좌 (앱 id "nh" 콕뱅크와 다름)

// ---------- 홈 ----------
export interface AoNoticeItem {
  title: string; // ≤ 30
  when: string; // ≤ 40
}
// 정기점검 안내 시트 (홈 영역). items null = 홈이 날짜로 계산한 기본 문구
export interface AoNotice {
  on: boolean;
  items: AoNoticeItem[] | null;
}
export interface AoProfile extends Profile {
  noticeOn?: boolean;
  noticeItems?: AoNoticeItem[] | null;
}
export interface AoHome extends Omit<HomeData, "accounts" | "profile"> {
  profile: AoProfile;
  accounts: AoAccount[];
  ao?: { notice?: AoNotice };
}

// ---------- 거래 ----------
export type AoTransaction = Transaction;
// 거래내역 상세: ao.accountId = 이 거래가 있는 내 계좌, ao.payee = 받는 분 등록(☆) — transfer.bank.code + number 가 같은 것
export interface AoTxDetail extends TransactionDetail {
  ao?: { accountId: string; payee: { id: string; favorite: boolean } | null };
}

// ---------- 이체 ----------
export type AoRecipients = TransferRecipients;
export type AoRecipient = Recipient;
export type AoTransferRecord = TransferRecord;
export type AoTransferResult = TransferResult;

// ---------- 주소 ----------
export const AO_TX_LIMIT = 500; // 거래내역은 한 번에 받아 화면에서 거르고 · 정렬하고 · 20개씩 (서버 최대 500)
export const aoPaths = {
  home: paths.home,
  banks: paths.banks,
  profile: paths.profile,
  payees: paths.payees,
  account: (id: string) => paths.account(id),
  transactions: (accountId: string) => `${paths.transactions(accountId)}?limit=${AO_TX_LIMIT}`,
  transaction: (txId: string) => paths.transaction(txId),
  recipients: (from: string) => paths.recipients(from),
  transfers: (from?: string) => paths.transfers(from),
  recent: (bankCode: string, number: string) =>
    `/api/transfer/recent?bank=${encodeURIComponent(bankCode)}&number=${encodeURIComponent(number.replace(/\D/g, ""))}`,
  dispute: (accountId: string) => `/api/accounts/${accountId}/dispute`,
};

// ---------- 바꾸는 요청 (성공하면 api/client 가 모든 화면 데이터를 다시 받게 함) ----------
export const AO_TOPUP_MEMO = "잔액채우기";
export const aoApi = {
  updateName: (userName: string) => api.updateProfile({ userName }),
  // 정기점검 안내: 보이기 · 1쪽 항목 (null = 기본 문구)
  updateNotice: (patch: { noticeOn?: boolean; noticeItems?: AoNoticeItem[] | null }) => http.patch<AoProfile>(paths.profile, patch),
  setBlocked: (accountId: string, blocked: boolean) => http.patch<AoAccount>(paths.account(accountId), { blocked }),
  // 이의제기 신청: 신청만으론 지급정지가 풀리지 않음 (🔔 패널에서 관리자가 직접 풀어야 함)
  dispute: (accountId: string) => http.post<AoAccount>(aoPaths.dispute(accountId), {}),
  updateMemo: (txId: string, memo: string) => api.updateMemo(txId, memo),
  setFavorite: (payeeId: string, favorite: boolean) => api.updatePayee(payeeId, { favorite }),
  // ☆ 를 누른 받는 분이 아직 등록 안 됐으면 등록하면서 ☆
  addPayee: (body: { bankCode: string; number: string; holder: string; favorite?: boolean }) => http.post<Payee>(paths.payees, body),
  // T1 최근 삭제하기: 그 계좌를 지금까지 숨김 (새로 보내면 다시 보임)
  hideRecent: (bankCode: string, number: string) => http.delete(aoPaths.recent(bankCode, number)),
  lookup: (bankCode: string, number: string) => api.lookupAccount(bankCode, number),
  transfer: (body: NewTransfer) => api.transfer(body),
  // 잔액채우기 = 등록한 내 다른 계좌(from)에서 NH 계좌(to)로 이체, 양쪽 통장 표시 "잔액채우기"
  topup: (from: string, to: { bank: Bank; number?: string }, amount: number) =>
    api.transfer({ fromAccountId: from, bankCode: to.bank.code, number: (to.number ?? "").replace(/\D/g, ""), amount, memoTo: AO_TOPUP_MEMO, memoMe: AO_TOPUP_MEMO }),
};

// ---------- 받기 (화면은 보통 useApi(aoPaths.…) 를 씀) ----------
export const aoFetch = {
  home: () => http.get<AoHome>(aoPaths.home),
  account: (id: string) => http.get<AoAccount>(aoPaths.account(id)),
  transactions: (id: string) => http.get<AoTransaction[]>(aoPaths.transactions(id)),
  transaction: (txId: string) => http.get<AoTxDetail>(aoPaths.transaction(txId)),
  recipients: (from: string) => http.get<AoRecipients>(aoPaths.recipients(from)),
  transfers: (from?: string) => http.get<AoTransferRecord[]>(aoPaths.transfers(from)),
  banks: () => http.get<Bank[]>(aoPaths.banks),
};
