import { http } from "./client";
import type {
  Account,
  NewBankAccount,
  NewTransaction,
  NewTransfer,
  Payee,
  Profile,
  Recipient,
  Transaction,
  TransferResult,
} from "./types";

// 주소는 한 곳에서만 만든다 (오타 방지 + 나중에 API 주소가 바뀌어도 여기만 수정)
export const paths = {
  home: "/api/home",
  banks: "/api/banks",
  profile: "/api/profile",
  account: (id: string) => `/api/accounts/${id}`,
  transactions: (accountId: string) => `/api/accounts/${accountId}/transactions`,
  transaction: (txId: string) => `/api/transactions/${txId}`,
  payees: "/api/payees",
  recipients: (from: string) => `/api/transfer/recipients?from=${encodeURIComponent(from)}`,
};

// 데이터를 바꾸는 요청들 (조회는 화면에서 useApi(paths.xxx)로)
export const api = {
  updateProfile: (patch: Partial<Profile>) => http.patch<Profile>(paths.profile, patch),
  addBankAccount: (body: NewBankAccount) => http.post<Account>("/api/accounts", body),
  updateAccount: (id: string, patch: { balance?: number; number?: string; safebox?: number }) => http.patch<Account>(paths.account(id), patch),
  deleteAccount: (id: string) => http.delete(paths.account(id)),
  createTransaction: (accountId: string, body: NewTransaction) =>
    http.post<Transaction>(paths.transactions(accountId), body),
  deleteTransaction: (txId: string) => http.delete(paths.transaction(txId)),
  reset: () => http.post<void>("/api/reset"),

  // 받는 분 (🔔 패널)
  addPayee: (body: { bankCode: string; number: string; holder: string }) => http.post<Payee>(paths.payees, body),
  updatePayee: (id: string, patch: { number?: string; holder?: string; favorite?: boolean }) =>
    http.patch<Payee>(`${paths.payees}/${id}`, patch),
  deletePayee: (id: string) => http.delete(`${paths.payees}/${id}`),

  // 이체: 계좌번호로 예금주 찾기(조회라 캐시 없이 바로) → 보내기
  lookupAccount: (bankCode: string, number: string) =>
    http.get<Recipient>(`/api/transfer/lookup?bank=${bankCode}&number=${number.replace(/\D/g, "")}`),
  transfer: (body: NewTransfer) => http.post<TransferResult>("/api/transfers", body),
};

// 이체 화면 표기: 카카오뱅크는 "카카오뱅크 3333-00-0000000", 다른 은행은 "농협 3020000000000"(숫자만)
export const accountLine = (bank: { code: string; short: string; pattern?: number[] }, number = "") =>
  `${bank.short} ${bank.code === "kakao" ? formatAccountNumber(bank.pattern, number) : number.replace(/\D/g, "")}`;

// 은행별 계좌번호 형식대로 하이픈 넣기: ("3,3,6", "110123456789") → "110-123-456789"
export function formatAccountNumber(pattern: number[] | undefined, raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!pattern) return digits;
  const parts: string[] = [];
  let i = 0;
  for (const len of pattern) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + len));
    i += len;
  }
  return parts.join("-");
}
