import { http } from "./client";
import type { Account, DevSettings, NewTransaction, Profile, Transaction } from "./types";

// 주소는 한 곳에서만 만든다 (오타 방지 + 나중에 API 주소가 바뀌어도 여기만 수정)
export const paths = {
  home: "/api/home",
  profile: "/api/profile",
  account: (id: string) => `/api/accounts/${id}`,
  transactions: (accountId: string) => `/api/accounts/${accountId}/transactions`,
  transaction: (txId: string) => `/api/transactions/${txId}`,
  devSettings: "/api/dev/settings",
};

// 데이터를 바꾸는 요청들 (GET은 화면에서 useApi(paths.xxx)로)
export const api = {
  updateProfile: (patch: Partial<Profile>) => http.patch<Profile>(paths.profile, patch),
  updateBalance: (accountId: string, balance: number) => http.patch<Account>(paths.account(accountId), { balance }),
  createTransaction: (accountId: string, body: NewTransaction) =>
    http.post<Transaction>(paths.transactions(accountId), body),
  deleteTransaction: (txId: string) => http.delete(paths.transaction(txId)),
  reset: () => http.post<void>("/api/reset"),
  getDevSettings: () => http.get<DevSettings>(paths.devSettings),
  updateDevSettings: (s: Partial<DevSettings>) => http.patch<DevSettings>(paths.devSettings, s),
};
