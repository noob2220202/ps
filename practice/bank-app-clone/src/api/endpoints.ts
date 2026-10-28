import { http } from "./client";
import type { Account, NewBankAccount, NewTransaction, Profile, Transaction } from "./types";

// 주소는 한 곳에서만 만든다 (오타 방지 + 나중에 API 주소가 바뀌어도 여기만 수정)
export const paths = {
  home: "/api/home",
  banks: "/api/banks",
  profile: "/api/profile",
  account: (id: string) => `/api/accounts/${id}`,
  transactions: (accountId: string) => `/api/accounts/${accountId}/transactions`,
  transaction: (txId: string) => `/api/transactions/${txId}`,
};

// 데이터를 바꾸는 요청들 (조회는 화면에서 useApi(paths.xxx)로)
export const api = {
  updateProfile: (patch: Partial<Profile>) => http.patch<Profile>(paths.profile, patch),
  addBankAccount: (body: NewBankAccount) => http.post<Account>("/api/accounts", body),
  updateAccount: (id: string, patch: { balance?: number; number?: string }) => http.patch<Account>(paths.account(id), patch),
  deleteAccount: (id: string) => http.delete(paths.account(id)),
  createTransaction: (accountId: string, body: NewTransaction) =>
    http.post<Transaction>(paths.transactions(accountId), body),
  deleteTransaction: (txId: string) => http.delete(paths.transaction(txId)),
  reset: () => http.post<void>("/api/reset"),
};

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
