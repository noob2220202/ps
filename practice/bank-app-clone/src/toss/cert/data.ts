// 증명서 발급 흐름의 데이터 (cert.md §4). 계좌 = GET /api/home, 보낸 이체 = GET /api/transfers?from=, 발급 정보 = 주소의 at (서버에 남기지 않음)
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { paths } from "../../api/endpoints";
import type { TransferRecord } from "../../api/types";
import { useApi } from "../../api/useApi";
import type { TossAccount, TossHomeData } from "../api";
import { tossBankFull, tossBankShort } from "../bank";
import { num, tossDate } from "../format";

// ---------- 시간 (ms). 녹화의 웹뷰 기다림을 줄인 값 (cert.md §5.8) ----------
export const CERT_T = {
  homeContent: 250, // H: 빈 화면 → 내용
  homeRows: 130, // H: 첫 카드 줄은 카드보다 조금 늦게
  introSkeleton: 280, // I: 옅은 뼈대가 나타나는 때
  introContent: 600, // I: 내용
  accountBlank: 250, // I → A: 빈 화면
  itemsBlank: 300, // A → L: 빈 화면
  itemsCircles: 250, // L: ✓ 동그라미는 줄보다 늦게 (뒤로 와도)
  dotsAfter: 180, // 버튼을 뗀 뒤 다음 단계가 아직이면 점 3개
  methodTap: 150, // M: 휴대폰에 저장 → 기다림
  issuing: 2600, // W: 고리 두 바퀴 뒤 D 로 replace
  doneSkeleton: 600, // D: 회색 카드 → 흰 종이
  doneDoc: 150, // D: 흰 종이 → 문서 내용
  docIdle: 400, // D: 파일 저장하기 → 문서.pdf push
} as const;

// ---------- 주소 ----------
export interface CertQuery {
  account: string;
  ids: string[];
  at: number | null;
}
export function useCertQuery(): CertQuery {
  const { search } = useLocation();
  const q = new URLSearchParams(search);
  const at = Number(q.get("at"));
  return {
    account: q.get("account") ?? "",
    ids: (q.get("ids") ?? "").split(",").filter(Boolean),
    at: Number.isFinite(at) && at > 0 ? at : null,
  };
}
export const certUrl = (path: string, q: Partial<{ account: string; ids: string[]; at: number }>) => {
  const s = new URLSearchParams();
  if (q.account) s.set("account", q.account);
  if (q.ids) s.set("ids", q.ids.join(","));
  if (q.at) s.set("at", String(q.at));
  const qs = s.toString().replaceAll("%2C", ",");
  return qs ? `${path}?${qs}` : path;
};

// ---------- 계좌 (A) ----------
// 토스뱅크 통장 (토스머니는 빼고) = '사용중인 통장', 다른 은행 = '오픈뱅킹 연결한 통장'. 주계좌 은행 코드가 비어 있으면 서버가 kakao 로 주므로 kind main 도 토스로 (infra §4)
const isToss = (a: TossAccount) => a.kind === "main" || a.bank.code === "toss";
export function certAccounts(home: TossHomeData | undefined) {
  const all = (home?.accounts ?? []) as TossAccount[];
  return {
    toss: all.filter((a) => isToss(a) && a.role !== "money"),
    linked: all.filter((a) => !isToss(a)),
  };
}
export const certBankShort = (a: TossAccount) => tossBankShort(a.bank.code, a.bank.short);
export const certAccountName = (a: TossAccount) => (isToss(a) ? "토스뱅크" : a.bank.name);
// "개설일 24.03.15" (없으면 줄을 안 그림)
export const certOpened = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(2, 4)}.${iso.slice(5, 7)}.${iso.slice(8, 10)}` : null);

// ---------- 보낸 이체 (L) ----------
const p2 = (n: number) => String(n).padStart(2, "0");
// "11월 03일" (앞 0 붙임)
export const certDay = (iso: string) => {
  const d = tossDate(iso);
  return `${p2(d.getMonth() + 1)}월 ${p2(d.getDate())}일`;
};
export const certHm = (iso: string) => {
  const d = tossDate(iso);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
// "-15,000 원" (원 앞 띄움)
export const certAmount = (n: number) => `-${num(Math.abs(n))} 원`;

export interface CertGroup {
  day: string;
  items: TransferRecord[];
}
export function certGroups(list: TransferRecord[]): CertGroup[] {
  const out: CertGroup[] = [];
  for (const t of list) {
    const day = certDay(t.at);
    const g = out.at(-1);
    if (g && g.day === day) g.items.push(t);
    else out.push({ day, items: [t] });
  }
  return out;
}
// 검색: 이름 일부 또는 금액 숫자 일부
export function certFilter(list: TransferRecord[], text: string) {
  const q = text.trim();
  if (!q) return list;
  const digits = q.replace(/[^\d]/g, "");
  return list.filter((t) => t.holder.includes(q) || (digits && String(t.amount).includes(digits)));
}

// ---------- 문서 (D · V) ----------
export interface CertDocRow {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  to: string; // 받는사람
  from: string; // 보낸사람 (나)
  amount: string; // -N,NNN
  fromAccount: string; // 1000-1234-5678(토스뱅크)
  toAccount: string; // 숫자만(은행 이름)
  memo: string; // 받는통장 표시
}
export interface CertDocData {
  userName: string;
  rows: CertDocRow[];
  issueDate: string; // YYYY년 M월 D일
  issueNo: string; // NNNN-AAAA-AAAAAAAA
}

// 발급번호: (ids, at) 로 정해지는 가짜 번호 — 다시 열어도 같은 값, 서버에 남지 않음
export function certIssueNo(ids: string[], at: number) {
  let h = 0x811c9dc5;
  for (const ch of `${ids.join(",")}|${at}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const next = () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h;
  };
  const digits = Array.from({ length: 4 }, () => next() % 10).join("");
  const letters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(65 + (next() % 26))).join("");
  return `${digits}-${letters(4)}-${letters(8)}`;
}
export const certIssueDate = (at: number) => {
  const d = new Date(at);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

export function certDocRows(list: TransferRecord[], ids: string[], userName: string, fromBank: string): CertDocRow[] {
  const want = new Set(ids);
  return list
    .filter((t) => want.has(t.id))
    .map((t) => {
      const [date, time = "00:00:00"] = t.at.split("T");
      return {
        id: t.id,
        date,
        time: time.slice(0, 8),
        to: t.holder,
        from: userName,
        amount: `-${num(Math.abs(t.amount))}`,
        fromAccount: `${t.fromNumber}(${fromBank})`,
        toAccount: `${t.number.replace(/\D/g, "")}(${tossBankFull(t.bank.code, t.bank.name)})`,
        memo: t.memoTo || userName,
      };
    });
}

// D · V 가 같이 씀: 주소(account · ids · at) → 문서 데이터. 받기 전이면 null
export function useCertDoc(q: CertQuery) {
  const home = useApi<TossHomeData>(paths.home);
  const list = useApi<TransferRecord[]>(paths.transfers(q.account || "main"));
  const [opened] = useState(() => Date.now()); // 주소에 at 이 없을 때(주소로 바로 열기) 발급 시각
  const error = home.status === "error" || list.status === "error";
  const retry = () => {
    home.retry();
    list.retry();
  };
  if (!home.data || !list.data) return { data: null, error, retry };
  const acct = (home.data.accounts as TossAccount[]).find((a) => a.id === q.account);
  const userName = home.data.profile.userName;
  const at = q.at ?? opened;
  const data: CertDocData = {
    userName,
    rows: certDocRows(list.data, q.ids, userName, acct ? certAccountName(acct) : "토스뱅크"),
    issueDate: certIssueDate(at),
    issueNo: certIssueNo(q.ids, at),
  };
  return { data, error, retry };
}

// A4 종이 (단위 = 문서.pdf 화면 dp). 미리보기(D)는 344 / 368 배
export const CERT_PAGE = { w: 368, h: 520.4 } as const;
// 한 장에 15줄 (cert.md §5.6). 줄이 없어도 한 장
export const CERT_DOC_ROWS_PER_PAGE = 15;
export function certPages<T>(rows: T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += CERT_DOC_ROWS_PER_PAGE) pages.push(rows.slice(i, i + CERT_DOC_ROWS_PER_PAGE));
  return pages.length ? pages : [[]];
}
