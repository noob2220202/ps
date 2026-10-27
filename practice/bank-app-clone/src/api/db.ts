import { PROFILE } from "../config/profile";
import type { Account, Transaction, TransactionDetail, TxTag } from "./types";

const MAIN_BALANCE = 120_268;

type Raw = [date: string, time: string /* HH:MM:SS */, merchant: string, amount: number, tag: TxTag];

// 최신순. "거래 후 잔액"은 저장하지 않고 현재 잔액에서 거꾸로 계산한다(데이터 불일치 방지).
const RAW_TX: Raw[] = [
  ["10.27", "11:37:12", "매산음료자판기", -1_500, "#체크카드"],
  ["10.27", "10:53:41", "쿠팡(와우 멤버십)", -7_890, "#체크카드"],
  ["10.26", "18:47:03", "메리츠통합001", -12_570, "#자동이체"],
  ["10.26", "18:47:27", "흥화１０００５", -21_825, "#자동이체"],
  ["10.25", "20:13:50", "이벤트아이스크림(용", -600, "#체크카드"],
  ["10.25", "17:13:09", "우아한형제들", -12_300, "#체크카드"],
  ["10.24", "05:40:00", "입출금통장 이자", 7, "#예금이자"],
  ["10.23", "21:04:33", "창덕할인마트", -600, "#체크카드"],
  ["10.22", "22:08:56", "창덕할인마트", -600, "#체크카드"],
  ["10.22", "17:33:18", "고공수 스터디카페", -30_000, "#체크카드"],
  ["10.22", "14:34:44", "매산음료자판기", -2_000, "#체크카드"],
  ["10.22", "14:34:02", "매산음료자판기", -1_200, "#체크카드"],
  ["10.22", "10:36:29", "매산음료자판기", -1_500, "#체크카드"],
  ["10.21", "13:02:15", "매산음료자판기", -700, "#체크카드"],
  ["10.21", "09:15:38", "매산음료자판기", -1_200, "#체크카드"],
  ["10.20", "19:42:07", "우아한형제들", -15_800, "#체크카드"],
  ["10.20", "08:10:51", "매산음료자판기", -1_500, "#체크카드"],
  ["10.19", "16:25:24", "창덕할인마트", -3_400, "#체크카드"],
  ["10.18", "12:00:00", "홍길동", 50_000, "#자동이체"],
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

const KIND_BY_TAG: Record<TxTag, string> = {
  "#체크카드": "체크카드결제",
  "#자동이체": "자동이체",
  "#예금이자": "예금이자",
};

const MERCHANT_INFO: Record<string, { address: string; phone: string }> = {
  창덕할인마트: { address: "광주 광양시 광양읍 용강로 43\n.", phone: "061)762-6994" },
};

export function toDetail(tx: Transaction): TransactionDetail {
  return {
    ...tx,
    transactedAt: `2026.${tx.date} ${tx.time}:${tx.seconds}`,
    kind: KIND_BY_TAG[tx.tag],
    cardInfo: tx.tag === "#체크카드" ? `프렌즈 체크카드 (${PROFILE.cardLast4})` : undefined,
    ...MERCHANT_INFO[tx.merchant],
  };
}

export const ACCOUNTS: Account[] = [
  { id: "mini", kind: "mini", label: `${PROFILE.userName} mini`, balance: 0, number: PROFILE.miniAccountNo },
  { id: "main", kind: "main", label: "입출금통장", balance: MAIN_BALANCE, badge: "한도계좌" },
  { id: "nh", kind: "external", label: `${PROFILE.userName}의 농협은행 계좌`, balance: 0 },
];
