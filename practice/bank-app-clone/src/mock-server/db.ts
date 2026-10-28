import type { AccountId, DevSettings, Profile, TxTag } from "../api/types";

// ===== 가짜 서버의 "데이터베이스" =====
// 진짜 서버라면 MySQL/Postgres 테이블. 여기선 객체 하나를 localStorage에 JSON으로 저장한다.
// 화면 코드는 이 파일을 직접 import 하지 않는다 (반드시 /api 요청을 거침) — 서버/클라이언트 경계 연습.

export interface DbAccount {
  id: AccountId;
  kind: "mini" | "main" | "external";
  balance: number;
  badge?: string;
}

export interface DbTransaction {
  id: string;
  accountId: AccountId;
  at: string; // "2026-10-27T11:37:12"
  merchant: string;
  amount: number;
  tag: TxTag;
}

export interface Db {
  version: 1;
  profile: Profile;
  accounts: DbAccount[];
  transactions: DbTransaction[];
  nextId: number;
  settings: DevSettings;
}

const KEY = "bank-clone-db";

// 전부 가상의 예시 데이터
function seed(): Db {
  const raw: [string, string, number, TxTag][] = [
    ["2026-10-27T12:10:05", "예시편의점", -3_000, "#체크카드"],
    ["2026-10-27T09:30:20", "샘플카페", -4_500, "#체크카드"],
    ["2026-10-26T18:00:30", "예시통신요금", -20_000, "#자동이체"],
    ["2026-10-26T18:00:00", "예시보험", -10_000, "#자동이체"],
    ["2026-10-25T19:45:10", "샘플분식", -8_000, "#체크카드"],
    ["2026-10-25T13:20:40", "예시배달앱", -15_000, "#체크카드"],
    ["2026-10-24T05:00:00", "입출금통장 이자", 10, "#예금이자"],
    ["2026-10-23T20:15:00", "샘플마트", -5_000, "#체크카드"],
    ["2026-10-22T21:00:00", "샘플마트", -2_000, "#체크카드"],
    ["2026-10-22T16:30:00", "예시스터디카페", -20_000, "#체크카드"],
    ["2026-10-22T14:00:30", "예시자판기", -1_000, "#체크카드"],
    ["2026-10-22T14:00:10", "예시자판기", -1_000, "#체크카드"],
    ["2026-10-22T10:00:00", "예시자판기", -1_000, "#체크카드"],
    ["2026-10-21T13:00:00", "샘플서점", -12_000, "#체크카드"],
    ["2026-10-21T09:00:00", "예시자판기", -1_000, "#체크카드"],
    ["2026-10-20T19:00:00", "예시배달앱", -18_000, "#체크카드"],
    ["2026-10-20T08:00:00", "샘플카페", -4_500, "#체크카드"],
    ["2026-10-19T16:00:00", "샘플마트", -6_000, "#체크카드"],
    ["2026-10-18T12:00:00", "홍길동", 100_000, "#이체"],
  ];
  return {
    version: 1,
    profile: { userName: "홍길동", miniAccountNo: "0000-00-0000000", cardLast4: "0000" },
    accounts: [
      { id: "mini", kind: "mini", balance: 0 },
      { id: "main", kind: "main", balance: 500_000, badge: "한도계좌" },
      { id: "nh", kind: "external", balance: 0 },
    ],
    transactions: raw.map(([at, merchant, amount, tag], i) => ({
      id: `tx${i + 1}`,
      accountId: "main",
      at,
      merchant,
      amount,
      tag,
    })),
    nextId: raw.length + 1,
    settings: { latency: 420, failRate: 0 },
  };
}

function load(): Db {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Db;
      if (parsed.version === 1) return parsed;
    }
  } catch {
    // 손상된 데이터/저장소 접근 불가 → 초기값
  }
  return seed();
}

export const db: { current: Db } = { current: load() };

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db.current));
  } catch {
    // 저장 실패해도 메모리에는 남아 있음 (새로고침하면 사라짐)
  }
}

export function reset() {
  db.current = seed();
  save();
}
