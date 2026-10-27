import { TIMING } from "../config/timing";
import { ACCOUNTS, MONTHLY_CARD_SPEND, TRANSACTIONS, toDetail } from "./db";
import type { Account, HomeData, Transaction, TransactionDetail } from "./types";

// 실제 서버처럼 지연을 주는 가짜 API. 화면은 "데이터가 늦게 온다"는 전제로 짜야
// 스켈레톤/스피너 같은 로딩 UI를 연습할 수 있다.
const wait = <T,>(value: T, ms = TIMING.apiLatency) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export const api = {
  home: (): Promise<HomeData> =>
    wait(
      {
        accounts: ACCOUNTS,
        monthlyCardSpend: MONTHLY_CARD_SPEND,
        ad: { title: "AND2BLE", subtitle: "미니 2집 발매", when: "10월 27일 오후 6시", cta: "MV 보러가기" },
        aiPromo: { title: "AI 목표적금 출시", desc: "최고 연 5% 받고 목표 지원금까지" },
      },
      0,
    ),

  account: (id: string): Promise<Account | undefined> => wait(ACCOUNTS.find((a) => a.id === id)),

  transactions: (accountId: string): Promise<Transaction[]> =>
    wait(accountId === "main" ? TRANSACTIONS : []),

  transaction: (txId: string): Promise<TransactionDetail | undefined> => {
    const tx = TRANSACTIONS.find((t) => t.id === txId);
    return wait(tx && toDetail(tx));
  },
};
