import { PROFILE } from "../config/profile";
import type { Account, Transaction, TransactionDetail, TxTag } from "./types";

// 전부 가상의 예시 데이터 (실제 계좌/거래/가게 정보 아님)
const MAIN_BALANCE = 500_000;

type Raw = [date: string, time: string /* HH:MM:SS */, merchant: string, amount: number, tag: TxTag];

// 최신순. "거래 후 잔액"은 저장하지 않고 현재 잔액에서 거꾸로 계산한다(데이터 불일치 방지).
const RAW_TX: Raw[] = [
  ["10.27", "12:10:05", "예시편의점", -3_000, "#체크카드"],
  ["10.27", "09:30:20", "샘플카페", -4_500, "#체크카드"],
  ["10.26", "18:00:00", "예시보험", -10_000, "#자동이체"],
  ["10.26", "18:00:30", "예시통신요금", -20_000, "#자동이체"],
  ["10.25", "19:45:10", "샘플분식", -8_000, "#체크카드"],
  ["10.25", "13:20:40", "예시배달앱", -15_000, "#체크카드"],
  ["10.24", "05:00:00", "입출금통장 이자", 10, "#예금이자"],
  ["10.23", "20:15:00", "샘플마트", -5_000, "#체크카드"],
  ["10.22", "21:00:00", "샘플마트", -2_000, "#체크카드"],
  ["10.22", "16:30:00", "예시스터디카페", -20_000, "#체크카드"],
  ["10.22", "14:00:30", "예시자판기", -1_000, "#체크카드"],
  ["10.22", "14:00:10", "예시자판기", -1_000, "#체크카드"],
  ["10.22", "10:00:00", "예시자판기", -1_000, "#체크카드"],
  ["10.21", "13:00:00", "샘플서점", -12_000, "#체크카드"],
  ["10.21", "09:00:00", "예시자판기", -1_000, "#체크카드"],
  ["10.20", "19:00:00", "예시배달앱", -18_000, "#체크카드"],
  ["10.20", "08:00:00", "샘플카페", -4_500, "#체크카드"],
  ["10.19", "16:00:00", "샘플마트", -6_000, "#체크카드"],
  ["10.18", "12:00:00", PROFILE.userName, 100_000, "#자동이체"],
];

export const TRANSACTIONS: Transaction[] = (() => {
  let balance = MAIN_BALANCE;
  return RAW_TX.map(([date, time, merchant, amount, tag], i) => {
    const [hhmm, seconds] = [time.slice(0, 5), time.slice(6)];
    const tx = { id: `tx${i}`, date, time: hhmm, seconds, merchant, amount, tag, balanceAfter: balance };
    balance -= amount;
    return tx;
  });
})();

// "이번달 쓴 돈"도 하드코딩하지 않고 체크카드 결제 합계로 계산
export const MONTHLY_CARD_SPEND = TRANSACTIONS.filter((t) => t.tag === "#체크카드").reduce(
  (sum, t) => sum - t.amount,
  0,
);

const KIND_BY_TAG: Record<TxTag, string> = {
  "#체크카드": "체크카드결제",
  "#자동이체": "자동이체",
  "#예금이자": "예금이자",
};

const SAMPLE_ADDRESS = { address: "서울 예시구 샘플로 123", phone: "02)000-0000" };

export function toDetail(tx: Transaction): TransactionDetail {
  return {
    ...tx,
    transactedAt: `2026.${tx.date} ${tx.time}:${tx.seconds}`,
    kind: KIND_BY_TAG[tx.tag],
    cardInfo: tx.tag === "#체크카드" ? `체크카드 (${PROFILE.cardLast4})` : undefined,
    ...(tx.tag === "#체크카드" ? SAMPLE_ADDRESS : {}),
  };
}

export const ACCOUNTS: Account[] = [
  { id: "mini", kind: "mini", label: `${PROFILE.userName} mini`, balance: 0, number: PROFILE.miniAccountNo },
  { id: "main", kind: "main", label: "입출금통장", balance: MAIN_BALANCE, badge: "한도계좌" },
  { id: "nh", kind: "external", label: `${PROFILE.userName}의 농협은행 계좌`, balance: 0 },
];
