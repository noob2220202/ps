import express from "express";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db, seed, transaction } from "./db.mjs";
import { BANKS, bankByCode, digitCount, formatAccountNumber } from "./banks.mjs";

// ===== 백엔드 서버 (Express + SQLite) =====
// npm start → 이 파일 하나가 API(/api/...)와 빌드된 화면(dist/)을 같은 포트(기본 9101)로 제공한다.
// 개발 중(npm run dev)에는 API만 8787에서 돌고, Vite 개발 서버가 /api 요청을 여기로 넘겨준다.

const app = express();
app.use(express.json());

// 스켈레톤/스피너가 실제 앱처럼 잠깐 보이도록 조회 요청에 약간의 지연 (API_DELAY_MS=0 이면 끔)
const DELAY = Number(process.env.API_DELAY_MS ?? 250);
app.use("/api", (req, _res, next) => (req.method === "GET" && DELAY ? setTimeout(next, DELAY) : next()));

// ---------- 공통 도우미 ----------
class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    Object.assign(this, { status, code, fields });
  }
}
const bad = (message, fields) => new HttpError(400, "VALIDATION", message, fields);
const notFound = (what) => new HttpError(404, "NOT_FOUND", `${what}을(를) 찾을 수 없어요`);

const pad = (n) => String(n).padStart(2, "0");
function nowIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const getProfile = () => {
  const p = db.prepare("SELECT user_name, mini_account_no, card_last4 FROM profile WHERE id = 1").get();
  return { userName: p.user_name, miniAccountNo: p.mini_account_no, cardLast4: p.card_last4 };
};

function toAccount(row, profile = getProfile()) {
  const bank = row.bank_code ? bankByCode(row.bank_code) : undefined;
  const label =
    row.kind === "mini" ? `${profile.userName} mini` : row.kind === "main" ? "입출금통장" : `${profile.userName}의 ${bank?.name ?? "다른 은행"} 계좌`;
  return {
    id: row.id,
    kind: row.kind,
    label,
    balance: row.balance,
    ...(row.badge && { badge: row.badge }),
    number: row.kind === "mini" ? profile.miniAccountNo : row.number ?? undefined,
    ...(bank && { bank: { code: bank.code, name: bank.name, short: bank.short, color: bank.color, text: bank.text } }),
  };
}

function findAccount(id) {
  const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id);
  if (!row) throw notFound("계좌");
  return row;
}

// "거래 후 잔액"은 저장하지 않고, 현재 잔액에서 최신 거래부터 거꾸로 빼며 계산
function listTransactions(accountId) {
  let balance = findAccount(accountId).balance;
  return db
    .prepare("SELECT * FROM transactions WHERE account_id = ? ORDER BY at DESC, id DESC")
    .all(accountId)
    .map((t) => {
      const tx = toTransaction(t, balance);
      balance -= t.amount;
      return tx;
    });
}

function toTransaction(t, balanceAfter) {
  const [d, time] = t.at.split("T");
  const [, mm, dd] = d.split("-");
  return {
    id: String(t.id),
    accountId: t.account_id,
    at: t.at,
    date: `${mm}.${dd}`,
    time: time.slice(0, 5),
    merchant: t.merchant,
    amount: t.amount,
    tag: t.tag,
    balanceAfter,
  };
}

const TAGS = ["#체크카드", "#자동이체", "#예금이자", "#이체"];
const KIND_BY_TAG = { "#체크카드": "체크카드결제", "#자동이체": "자동이체", "#예금이자": "예금이자", "#이체": "이체" };

// ---------- 화면용 API ----------
app.get("/api/home", (_req, res) => {
  const profile = getProfile();
  const accounts = db.prepare("SELECT * FROM accounts ORDER BY sort, rowid").all();
  const month = nowIso().slice(0, 7);
  const spend = db
    .prepare("SELECT COALESCE(-SUM(amount), 0) AS s FROM transactions WHERE tag = '#체크카드' AND amount < 0 AND at LIKE ?")
    .get(`${month}%`).s;
  res.json({
    profile,
    accounts: accounts.map((a) => toAccount(a, profile)),
    monthlyCardSpend: spend,
    cashbackCount: 2,
    banners: [
      { id: "b1", title: "mini카드로 삼성월렛 이용하고\n2천 포인트 받아가기", cta: "삼성월렛으로 이동", image: "banner-mcard" },
      { id: "b2", title: "우리 동네 가까운 봉사활동 찾기\n카카오뱅크에서 시작하세요", cta: "더 알아보기", image: "banner-volunteer" },
      { id: "b3", title: "피카PC방 전용 결제 이벤트\nmini카드로 마일리지 받기", cta: "자세히 보기", image: "banner-pcbang" },
      { id: "b4", title: "AND2BLE\n미니 2집 발매", cta: "MV 보러가기", image: "banner-and2ble", ad: true },
    ],
    aiPromo: { title: "AI 목표적금 출시", desc: "최고 연 5% 받고 목표 지원금까지" },
    shortcuts: [
      { id: "s1", label: "우리학교 시간표", icon: "shortcut-timetable" },
      { id: "s2", label: "정부지원금 찾기", icon: "shortcut-subsidy" },
      { id: "s3", label: "모바일 신분증 이용하기", icon: "shortcut-id" },
      { id: "s4", label: "mini 26일저금", icon: "shortcut-mini26" },
    ],
    nativeAd: { source: "쇼핑 앱에서 구매하기", title: "특가 탁구화", sponsor: "광고입니다" },
  });
});

app.get("/api/banks", (_req, res) => res.json(BANKS));

app.get("/api/profile", (_req, res) => res.json(getProfile()));

app.patch("/api/profile", (req, res) => {
  const { userName, miniAccountNo, cardLast4 } = req.body ?? {};
  const fields = {};
  if (userName !== undefined && !/^.{1,10}$/u.test(String(userName).trim())) fields.userName = "이름은 1~10자";
  if (miniAccountNo !== undefined && !/^\d{4}-\d{2}-\d{7}$/.test(miniAccountNo)) fields.miniAccountNo = "0000-00-0000000 형식";
  if (cardLast4 !== undefined && !/^\d{4}$/.test(cardLast4)) fields.cardLast4 = "숫자 4자리";
  if (Object.keys(fields).length) throw bad("입력값을 확인해 주세요", fields);
  const p = getProfile();
  db.prepare("UPDATE profile SET user_name = ?, mini_account_no = ?, card_last4 = ? WHERE id = 1").run(
    userName !== undefined ? String(userName).trim() : p.userName,
    miniAccountNo ?? p.miniAccountNo,
    cardLast4 ?? p.cardLast4,
  );
  res.json(getProfile());
});

app.get("/api/accounts/:id", (req, res) => res.json(toAccount(findAccount(req.params.id))));

// 다른 은행 계좌 추가
app.post("/api/accounts", (req, res) => {
  const { bankCode, number, balance = 0 } = req.body ?? {};
  const bank = bankByCode(bankCode);
  const fields = {};
  if (!bank) fields.bankCode = "은행을 골라 주세요";
  const digits = String(number ?? "").replace(/\D/g, "");
  if (bank && digits.length !== digitCount(bankCode)) fields.number = `${bank.name} 계좌번호는 숫자 ${digitCount(bankCode)}자리예요`;
  if (!Number.isInteger(balance) || balance < 0 || balance > 1_000_000_000) fields.balance = "0원 이상 10억원 이하";
  if (Object.keys(fields).length) throw bad("입력값을 확인해 주세요", fields);

  const formatted = formatAccountNumber(bankCode, digits);
  if (db.prepare("SELECT 1 FROM accounts WHERE bank_code = ? AND number = ?").get(bankCode, formatted))
    throw bad("이미 추가된 계좌예요", { number: "이미 추가된 계좌예요" });

  const id = `bank-${randomUUID().slice(0, 8)}`;
  const sort = db.prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM accounts").get().s;
  db.prepare("INSERT INTO accounts (id, kind, bank_code, number, balance, sort) VALUES (?, 'external', ?, ?, ?, ?)").run(
    id,
    bankCode,
    formatted,
    balance,
    sort,
  );
  res.status(201).json(toAccount(findAccount(id)));
});

// 잔액/계좌번호 수정
app.patch("/api/accounts/:id", (req, res) => {
  const row = findAccount(req.params.id);
  const { balance, number } = req.body ?? {};
  if (balance !== undefined && (!Number.isInteger(balance) || balance < 0 || balance > 1_000_000_000))
    throw bad("입력값을 확인해 주세요", { balance: "0원 이상 10억원 이하" });
  let formatted = row.number;
  if (number !== undefined) {
    if (row.kind !== "external") throw bad("다른 은행 계좌만 계좌번호를 바꿀 수 있어요");
    const digits = String(number).replace(/\D/g, "");
    if (digits.length !== digitCount(row.bank_code))
      throw bad("입력값을 확인해 주세요", { number: `숫자 ${digitCount(row.bank_code)}자리` });
    formatted = formatAccountNumber(row.bank_code, digits);
  }
  db.prepare("UPDATE accounts SET balance = ?, number = ? WHERE id = ?").run(balance ?? row.balance, formatted, row.id);
  res.json(toAccount(findAccount(row.id)));
});

// 다른 은행 계좌 삭제 (거래내역도 ON DELETE CASCADE로 같이 지워짐)
app.delete("/api/accounts/:id", (req, res) => {
  const row = findAccount(req.params.id);
  if (row.kind !== "external") throw bad("카카오뱅크 계좌는 여기서 지울 수 없어요");
  db.prepare("DELETE FROM accounts WHERE id = ?").run(row.id);
  res.status(204).end();
});

app.get("/api/accounts/:id/transactions", (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 500);
  res.json(listTransactions(req.params.id).slice(0, limit));
});

// 거래 추가 → 잔액도 같이 바뀜 (둘 중 하나만 되면 안 되니까 transaction으로 묶음)
app.post("/api/accounts/:id/transactions", (req, res) => {
  const row = findAccount(req.params.id);
  const { merchant, amount, tag = "#이체", at } = req.body ?? {};
  const fields = {};
  if (typeof merchant !== "string" || !merchant.trim()) fields.merchant = "거래처를 입력해 주세요";
  else if (merchant.length > 20) fields.merchant = "20자 이하";
  if (!Number.isInteger(amount) || amount === 0) fields.amount = "0이 아닌 금액을 입력해 주세요";
  else if (Math.abs(amount) > 10_000_000) fields.amount = "한 번에 1천만원까지";
  if (!TAGS.includes(tag)) fields.tag = "알 수 없는 거래 종류";
  if (at !== undefined && Number.isNaN(Date.parse(at))) fields.at = "날짜 형식 오류";
  if (Object.keys(fields).length) throw bad("입력값을 확인해 주세요", fields);
  if (row.balance + amount < 0)
    throw new HttpError(400, "INSUFFICIENT_BALANCE", `잔액이 부족해요 (현재 ${row.balance.toLocaleString("ko-KR")}원)`);

  const id = transaction(() => {
    const r = db
      .prepare("INSERT INTO transactions (account_id, at, merchant, amount, tag) VALUES (?, ?, ?, ?, ?)")
      .run(row.id, at ? String(at).slice(0, 19).padEnd(19, ":00") : nowIso(), merchant.trim(), amount, tag);
    db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amount, row.id);
    return String(r.lastInsertRowid);
  });
  res.status(201).json(listTransactions(row.id).find((t) => t.id === id));
});

function findTx(id) {
  const t = db.prepare("SELECT * FROM transactions WHERE id = ?").get(Number(id));
  if (!t) throw notFound("거래");
  return t;
}

app.get("/api/transactions/:id", (req, res) => {
  const t = findTx(req.params.id);
  const tx = listTransactions(t.account_id).find((x) => x.id === String(t.id));
  const card = tx.tag === "#체크카드";
  res.json({
    ...tx,
    transactedAt: `${tx.at.slice(0, 10).replaceAll("-", ".")} ${tx.at.slice(11, 19)}`,
    kind: KIND_BY_TAG[tx.tag],
    ...(card && { cardInfo: `체크카드 (${getProfile().cardLast4})`, address: "서울 예시구 샘플로 123", phone: "02)000-0000" }),
  });
});

// 거래 삭제 → 그 거래가 없던 일이 되므로 잔액도 되돌림
app.delete("/api/transactions/:id", (req, res) => {
  const t = findTx(req.params.id);
  transaction(() => {
    db.prepare("DELETE FROM transactions WHERE id = ?").run(t.id);
    db.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").run(t.amount, t.account_id);
  });
  res.status(204).end();
});

app.post("/api/reset", (_req, res) => {
  seed();
  res.status(204).end();
});

app.use("/api", (_req, _res, next) => next(new HttpError(404, "NOT_FOUND", "없는 API예요")));

// 에러를 항상 { code, message, fields } 모양으로
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ code: "VALIDATION", message: "JSON 형식 오류" });
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ code: err.code ?? "SERVER_ERROR", message: status >= 500 ? "서버 오류예요" : err.message, ...(err.fields && { fields: err.fields }) });
});

// ---------- 빌드된 화면 제공 (npm run build 후) ----------
const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  // /account/main 같은 주소로 바로 들어와도 index.html을 줘야 화면 쪽 라우터가 처리할 수 있다
  app.get("/{*path}", (_req, res) => res.sendFile(resolve(dist, "index.html")));
}

const portArg = process.argv.indexOf("--port");
const PORT = Number(process.env.PORT ?? (portArg > 0 ? process.argv[portArg + 1] : 9101));
app.listen(PORT, "0.0.0.0", () => console.log(`bank-clone server → http://localhost:${PORT}${existsSync(dist) ? "" : " (API만, dist 없음)"}`));
