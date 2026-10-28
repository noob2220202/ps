import type {
  Account,
  ApiErrorBody,
  Banner,
  DevSettings,
  HomeData,
  NewTransaction,
  Profile,
  Transaction,
  TransactionDetail,
} from "../api/types";
import { TX_TAGS } from "../api/types";
import { db, reset, save, type DbAccount, type DbTransaction } from "./db";

// ===== 브라우저 안의 가짜 REST 서버 =====
// window.fetch를 감싸서 "/api/..." 요청만 가로채 여기서 처리한다. 나머지 요청은 진짜 네트워크로.
// 화면 쪽은 진짜 서버와 똑같이 fetch + JSON + 상태코드로 통신하므로, 나중에 진짜 백엔드를 붙일 땐
// installMockServer()만 빼면 된다.
//
// 서비스워커 기반 도구(MSW)를 안 쓴 이유: 서비스워커는 HTTPS(또는 localhost)에서만 동작하는데,
// VPS에 http://IP:9101 로 띄우면 막히기 때문.

type Json = unknown;
interface Req {
  params: Record<string, string>;
  query: URLSearchParams;
  body: Json;
}
interface Res {
  status: number;
  body?: Json;
}
type Handler = (req: Req) => Res;

const ok = (body: Json, status = 200): Res => ({ status, body });
const fail = (status: number, code: ApiErrorBody["code"], message: string, fields?: Record<string, string>): Res => ({
  status,
  body: { code, message, ...(fields && { fields }) } satisfies ApiErrorBody,
});

// ---------- 읽기용 변환 (DB 행 → API 응답 모양) ----------
const labelOf = (a: DbAccount, p: Profile) =>
  a.kind === "mini" ? `${p.userName} mini` : a.kind === "main" ? "입출금통장" : `${p.userName}의 농협은행 계좌`;

function toAccount(a: DbAccount): Account {
  const p = db.current.profile;
  return { ...a, label: labelOf(a, p), ...(a.kind === "mini" && { number: p.miniAccountNo }) };
}

const pad = (n: number) => String(n).padStart(2, "0");

// "거래 후 잔액"은 저장하지 않고, 현재 잔액에서 최신 거래부터 거꾸로 빼며 계산
function listTransactions(accountId: string): Transaction[] {
  const account = db.current.accounts.find((a) => a.id === accountId);
  if (!account) return [];
  let balance = account.balance;
  return db.current.transactions
    .filter((t) => t.accountId === accountId)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((t) => {
      const tx = toTransaction(t, balance);
      balance -= t.amount;
      return tx;
    });
}

function toTransaction(t: DbTransaction, balanceAfter: number): Transaction {
  const [d, time] = t.at.split("T");
  const [, mm, dd] = d.split("-");
  return { ...t, date: `${mm}.${dd}`, time: time.slice(0, 5), balanceAfter };
}

const KIND_BY_TAG: Record<string, string> = {
  "#체크카드": "체크카드결제",
  "#자동이체": "자동이체",
  "#예금이자": "예금이자",
  "#이체": "이체",
};

function toDetail(tx: Transaction): TransactionDetail {
  const card = tx.tag === "#체크카드";
  return {
    ...tx,
    transactedAt: `${tx.at.slice(0, 10).replaceAll("-", ".")} ${tx.at.slice(11, 19)}`,
    kind: KIND_BY_TAG[tx.tag],
    ...(card && {
      cardInfo: `체크카드 (${db.current.profile.cardLast4})`,
      address: "서울 예시구 샘플로 123",
      phone: "02)000-0000",
    }),
  };
}

const BANNERS: Banner[] = [
  { id: "b1", title: "mini카드로 삼성월렛 이용하고\n2천 포인트 받아가기", cta: "삼성월렛으로 이동", image: "banner-mcard" },
  { id: "b2", title: "우리 동네 가까운 봉사활동 찾기\n카카오뱅크에서 시작하세요", cta: "더 알아보기", image: "banner-volunteer" },
  { id: "b3", title: "피카PC방 전용 결제 이벤트\nmini카드로 마일리지 받기", cta: "자세히 보기", image: "banner-pcbang" },
  { id: "b4", title: "AND2BLE\n미니 2집 발매", cta: "MV 보러가기", image: "banner-and2ble", ad: true },
];

// ---------- 입력값 검사 ----------
function validateNewTx(body: Partial<NewTransaction>): Record<string, string> {
  const e: Record<string, string> = {};
  if (typeof body.merchant !== "string" || !body.merchant.trim()) e.merchant = "거래처를 입력해 주세요";
  else if (body.merchant.length > 20) e.merchant = "20자 이하로 입력해 주세요";
  if (typeof body.amount !== "number" || !Number.isInteger(body.amount) || body.amount === 0)
    e.amount = "0이 아닌 정수 금액을 입력해 주세요";
  else if (Math.abs(body.amount) > 10_000_000) e.amount = "한 번에 1천만원까지만 가능해요";
  if (!TX_TAGS.includes(body.tag as never)) e.tag = `태그는 ${TX_TAGS.join(", ")} 중 하나`;
  if (body.at !== undefined && Number.isNaN(Date.parse(body.at))) e.at = "날짜 형식이 올바르지 않아요";
  return e;
}

function validateProfile(body: Partial<Profile>): Record<string, string> {
  const e: Record<string, string> = {};
  if (body.userName !== undefined && !/^.{1,10}$/u.test(body.userName.trim())) e.userName = "이름은 1~10자";
  if (body.miniAccountNo !== undefined && !/^\d{4}-\d{2}-\d{7}$/.test(body.miniAccountNo))
    e.miniAccountNo = "0000-00-0000000 형식";
  if (body.cardLast4 !== undefined && !/^\d{4}$/.test(body.cardLast4)) e.cardLast4 = "숫자 4자리";
  return e;
}

function nowIso() {
  const d = new Date(Date.now());
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ---------- 라우트 ----------
const routes: [method: string, pattern: string, handler: Handler][] = [
  ["GET", "/api/profile", () => ok(db.current.profile)],

  [
    "PATCH",
    "/api/profile",
    ({ body }) => {
      const patch = (body ?? {}) as Partial<Profile>;
      const errors = validateProfile(patch);
      if (Object.keys(errors).length) return fail(400, "VALIDATION", "입력값을 확인해 주세요", errors);
      db.current.profile = { ...db.current.profile, ...patch, userName: (patch.userName ?? db.current.profile.userName).trim() };
      save();
      return ok(db.current.profile);
    },
  ],

  [
    "GET",
    "/api/home",
    () => {
      const month = nowIso().slice(0, 7);
      const spend = db.current.transactions
        .filter((t) => t.tag === "#체크카드" && t.amount < 0 && t.at.startsWith(month))
        .reduce((sum, t) => sum - t.amount, 0);
      const home: HomeData = {
        profile: db.current.profile,
        accounts: db.current.accounts.map(toAccount),
        monthlyCardSpend: spend,
        cashbackCount: 2,
        banners: BANNERS,
        aiPromo: { title: "AI 목표적금 출시", desc: "최고 연 5% 받고 목표 지원금까지" },
        shortcuts: [
          { id: "s1", label: "우리학교 시간표", icon: "shortcut-timetable" },
          { id: "s2", label: "정부지원금 찾기", icon: "shortcut-subsidy" },
          { id: "s3", label: "모바일 신분증 이용하기", icon: "shortcut-id" },
          { id: "s4", label: "mini 26일저금", icon: "shortcut-mini26" },
        ],
        nativeAd: { source: "쇼핑 앱에서 구매하기", title: "특가 탁구화", sponsor: "광고입니다" },
      };
      return ok(home);
    },
  ],

  [
    "GET",
    "/api/accounts/:id",
    ({ params }) => {
      const a = db.current.accounts.find((x) => x.id === params.id);
      return a ? ok(toAccount(a)) : fail(404, "NOT_FOUND", "계좌를 찾을 수 없어요");
    },
  ],

  [
    "PATCH",
    "/api/accounts/:id",
    ({ params, body }) => {
      const a = db.current.accounts.find((x) => x.id === params.id);
      if (!a) return fail(404, "NOT_FOUND", "계좌를 찾을 수 없어요");
      const { balance } = (body ?? {}) as { balance?: unknown };
      if (typeof balance !== "number" || !Number.isInteger(balance) || balance < 0 || balance > 1_000_000_000)
        return fail(400, "VALIDATION", "입력값을 확인해 주세요", { balance: "0 이상 10억 이하 정수" });
      a.balance = balance;
      save();
      return ok(toAccount(a));
    },
  ],

  [
    "GET",
    "/api/accounts/:id/transactions",
    ({ params, query }) => {
      if (!db.current.accounts.some((x) => x.id === params.id)) return fail(404, "NOT_FOUND", "계좌를 찾을 수 없어요");
      const limit = Number(query.get("limit") ?? 100);
      return ok(listTransactions(params.id).slice(0, limit));
    },
  ],

  [
    "POST",
    "/api/accounts/:id/transactions",
    ({ params, body }) => {
      const a = db.current.accounts.find((x) => x.id === params.id);
      if (!a) return fail(404, "NOT_FOUND", "계좌를 찾을 수 없어요");
      if (a.kind === "external") return fail(400, "VALIDATION", "다른 금융 계좌에는 거래를 만들 수 없어요");
      const input = (body ?? {}) as Partial<NewTransaction>;
      const errors = validateNewTx(input);
      if (Object.keys(errors).length) return fail(400, "VALIDATION", "입력값을 확인해 주세요", errors);
      if (a.balance + input.amount! < 0)
        return fail(400, "INSUFFICIENT_BALANCE", `잔액이 부족해요 (현재 ${a.balance.toLocaleString("ko-KR")}원)`);
      const row: DbTransaction = {
        id: `tx${db.current.nextId++}`,
        accountId: a.id,
        at: input.at ? input.at.slice(0, 19).padEnd(19, ":00") : nowIso(),
        merchant: input.merchant!.trim(),
        amount: input.amount!,
        tag: input.tag!,
      };
      db.current.transactions.push(row);
      a.balance += row.amount;
      save();
      const created = listTransactions(a.id).find((t) => t.id === row.id)!;
      return ok(created, 201);
    },
  ],

  [
    "GET",
    "/api/transactions/:id",
    ({ params }) => {
      const row = db.current.transactions.find((t) => t.id === params.id);
      if (!row) return fail(404, "NOT_FOUND", "거래를 찾을 수 없어요");
      return ok(toDetail(listTransactions(row.accountId).find((t) => t.id === row.id)!));
    },
  ],

  [
    "DELETE",
    "/api/transactions/:id",
    ({ params }) => {
      const i = db.current.transactions.findIndex((t) => t.id === params.id);
      if (i < 0) return fail(404, "NOT_FOUND", "거래를 찾을 수 없어요");
      const [row] = db.current.transactions.splice(i, 1);
      const a = db.current.accounts.find((x) => x.id === row.accountId)!;
      a.balance -= row.amount; // 거래를 없던 일로 → 잔액도 되돌림
      save();
      return { status: 204 };
    },
  ],

  [
    "POST",
    "/api/reset",
    () => {
      const settings = db.current.settings;
      reset();
      db.current.settings = settings;
      save();
      return { status: 204 };
    },
  ],

  ["GET", "/api/dev/settings", () => ok(db.current.settings)],

  [
    "PATCH",
    "/api/dev/settings",
    ({ body }) => {
      const s = (body ?? {}) as Partial<DevSettings>;
      if (s.latency !== undefined) db.current.settings.latency = Math.max(0, Math.min(5000, Math.round(s.latency)));
      if (s.failRate !== undefined) db.current.settings.failRate = Math.max(0, Math.min(1, s.failRate));
      save();
      return ok(db.current.settings);
    },
  ],
];

// "/api/accounts/:id" → 정규식 + 파라미터 이름
const compiled = routes.map(([method, pattern, handler]) => {
  const names: string[] = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, n) => (names.push(n), "([^/]+)"))}$`);
  return { method, re, names, handler, pattern };
});

function handle(method: string, url: URL, body: Json): Res {
  const candidates = compiled.filter((r) => r.re.test(url.pathname));
  if (!candidates.length) return fail(404, "NOT_FOUND", `없는 API: ${url.pathname}`);
  const route = candidates.find((r) => r.method === method);
  if (!route) return { status: 405, body: { code: "VALIDATION", message: `${method} 메서드는 지원하지 않아요` } };
  const m = url.pathname.match(route.re)!;
  const params = Object.fromEntries(route.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
  return route.handler({ params, query: url.searchParams, body });
}

// ---------- 요청 로그 (개발자 패널에서 보기) ----------
export interface LogEntry {
  id: number;
  at: string;
  method: string;
  path: string;
  status: number;
  ms: number;
  request?: Json;
  response?: Json;
}
let logSeq = 0;
const log: LogEntry[] = [];
const listeners = new Set<() => void>();
export const getLog = () => log;
// useSyncExternalStore는 "값이 바뀌었는지"를 === 로 비교한다. 배열은 같은 객체를 계속 고치므로
// 대신 바뀔 때마다 올라가는 번호를 스냅샷으로 쓴다.
export const getLogVersion = () => logSeq;
export function subscribeLog(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

// ---------- fetch 가로채기 ----------
export function installMockServer() {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/")) return realFetch(input, init);

    const started = performance.now();
    const text = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
    let body: Json;
    let res: Res | undefined;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      res = fail(400, "VALIDATION", "요청 본문이 올바른 JSON이 아니에요");
    }

    const dev = url.pathname.startsWith("/api/dev/");
    const { latency, failRate } = db.current.settings;
    if (!dev && latency) await new Promise((r) => setTimeout(r, latency));

    res ??= !dev && Math.random() < failRate ? fail(500, "SERVER_ERROR", "일시적인 서버 오류예요 (실패 확률 설정)") : handle(request.method, url, body);

    if (!dev) {
      log.unshift({
        id: ++logSeq,
        at: new Date(Date.now()).toTimeString().slice(0, 8),
        method: request.method,
        path: url.pathname + url.search,
        status: res.status,
        ms: Math.round(performance.now() - started),
        request: body,
        response: res.body,
      });
      log.length = Math.min(log.length, 60);
      listeners.forEach((fn) => fn());
    }

    // structuredClone: 응답 객체를 화면이 수정해도 DB가 같이 바뀌지 않도록 (진짜 네트워크처럼 복사본)
    return new Response(res.status === 204 ? null : JSON.stringify(structuredClone(res.body)), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  };
}
