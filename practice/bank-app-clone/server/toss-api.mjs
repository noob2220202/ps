import { randomUUID } from "node:crypto";
import { db } from "./db.mjs";
import { bankByCode, bankInfo, digitsOf, formatAccountNumber } from "./banks.mjs";

// ===== 토스 (toss) 전용 API · 계산 =====
// server/index.mjs 는 APP === "toss" 일 때만 이 파일의 함수를 부름 (다른 앱 응답은 그대로).
//   GET /api/toss/spend   소비 (월 · 탭별 합계, 분류 막대, 주간 달력, 날짜별 목록)
//   GET /api/toss/assets  자산 · 내 계좌 (계좌 · 카드 · 포인트, 총 자산)
//   /api/toss/cards, /api/toss/points  🔔 관리 패널용 카드 · 포인트 CRUD
// 공용 API 에 붙는 토스 칸 (홈 toss 블록, 계좌 role/favorite/openedAt, 거래 category/channel/own …, 상세 counterparty) 도 여기서 만듦.
// 쓴 돈은 한 함수(spendTotal)만 셈 — 홈 '{M}월에 쓴 돈' 과 소비 합계가 늘 같게.

// 소비 분류 색: 이체 · 카테고리 없음 · 교육은 녹화에서 잼, 나머지는 지어냄. '그 외'는 늘 #3e3d40
export const CATEGORY_COLORS = {
  이체: "#2f7ff3",
  "카테고리 없음": "#1e7055",
  교육: "#804b20",
  식비: "#d9822b",
  "카페·간식": "#b0703a",
  "편의점·마트": "#c9a227",
  쇼핑: "#8a5cf5",
  교통: "#27a5a0",
  "문화·여가": "#d6458f",
  "주거·통신": "#e2574c",
};
const OTHER_COLOR = "#3e3d40";
const UNKNOWN_COLOR = "#5b5a5e"; // 🔔 에서 새로 만든 분류
const DOW = "일월화수목금토";
const TABS = ["all", "card", "account", "pay"];
const CHANNELS = ["card", "account", "pay"];
const MAX_MONEY = 1_000_000_000;

const pad = (n) => String(n).padStart(2, "0");
const daysInMonth = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
const shiftMonth = (ym, by) => {
  const t = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + by, 1);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`;
};
const isMonth = (v) => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isMoney = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_MONEY;

// 결제 수단: 직접 지정이 없으면 tag 로 (#체크카드 → 카드, 이체 · 자동이체 · 이자 → 입·출금)
export const channelOf = (t) => t.channel ?? (t.tag === "#체크카드" ? "card" : "account");
// 소비 분류: 직접 지정이 없으면 #이체 → 이체, 그 밖엔 카테고리 없음
export const categoryOf = (t) => t.category ?? (t.tag === "#이체" ? "이체" : "카테고리 없음");

// h = server/index.mjs 의 도우미 { getProfile, toAccount, nowIso, bad, notFound, isLocalIso, myAccountByNumber }
export function tossApi(h) {
  const rawProfile = () => db().prepare("SELECT * FROM profile WHERE id = 1").get();
  const thisMonth = () => h.nowIso().slice(0, 7);

  // 내 계좌 · 이체 기록 색인 (요청마다 새로 — 데이터가 작아서 충분히 빠름)
  function ledger() {
    const accounts = db().prepare("SELECT * FROM accounts ORDER BY sort, rowid").all();
    const accById = new Map(accounts.map((a) => [a.id, a]));
    const mineByKey = new Map(accounts.map((a) => [`${a.bank_code ?? "kakao"}:${digitsOf(a.number)}`, a]));
    const byOut = new Map();
    const byIn = new Map();
    for (const t of db().prepare("SELECT * FROM transfers").all()) {
      if (t.out_tx_id != null) byOut.set(t.out_tx_id, t);
      if (t.in_tx_id != null) byIn.set(t.in_tx_id, t);
    }
    const ownTarget = (tr) => mineByKey.get(`${tr.bank_code}:${tr.number}`);
    // 내 계좌끼리 옮긴 돈: 받은 쪽(in_tx_id), 또는 보낸 쪽인데 받는 계좌가 내 계좌
    const isOwn = (txId) => byIn.has(txId) || (byOut.has(txId) && !!ownTarget(byOut.get(txId)));
    return { accounts, accById, byOut, byIn, ownTarget, isOwn };
  }

  const counted = (t, L) => t.amount < 0 && !t.cancelled && !t.exclude && !L.isOwn(t.id);
  const inTab = (t, tab) => tab === "all" || (tab === "pay" ? !["card", "account"].includes(channelOf(t)) : channelOf(t) === tab);
  // 그 달 1일 ~ uptoDay 일 쓴 돈 (uptoDay 없으면 한 달 전부)
  const sumSpend = (rows, L, ym, tab, uptoDay = 31) =>
    rows
      .filter((t) => t.at.startsWith(ym) && Number(t.at.slice(8, 10)) <= uptoDay && inTab(t, tab) && counted(t, L))
      .reduce((s, t) => s - t.amount, 0);
  // 🔔 '이번 달 쓴 돈'(profile.card_spend)을 넣었으면 이번 달 전체 합계는 그 값 (지난 달 · 탭별 합계는 계산값)
  const override = (ym, tab) => (tab === "all" && ym === thisMonth() ? (rawProfile().card_spend ?? null) : null);

  // 홈 '{M}월에 쓴 돈' = 소비 '전체' 합계
  function spendTotal(ym = thisMonth()) {
    const o = override(ym, "all");
    if (o !== null) return o;
    const rows = db().prepare("SELECT * FROM transactions WHERE at LIKE ?").all(`${ym}%`);
    return sumSpend(rows, ledger(), ym, "all");
  }

  // ---------- 공용 API 에 붙는 칸 ----------
  const profileFields = (p) => ({
    pointChances: p.point_chances,
    rewardMax: p.reward_max ?? null,
    rewardDismissed: p.reward_dismissed ?? null,
    adSnoozeUntil: p.ad_snooze_until ?? null,
  });

  const accountFields = (row) => ({ openedAt: row.opened_at ?? null, favorite: !!row.favorite, role: row.role ?? null });

  // 신용카드 다음 결제일 'YYYY-MM-DD': 오늘이 이번 달 결제일 이전(당일 포함)이면 이번 달, 지났으면 다음 달 (그 달에 없는 날이면 마지막 날)
  function nextPayDate(payDay) {
    if (!Number.isInteger(payDay)) return null;
    const today = h.nowIso().slice(0, 10);
    const ym = today.slice(0, 7);
    const dayIn = (m) => Math.min(payDay, daysInMonth(m));
    const due = Number(today.slice(8, 10)) <= dayIn(ym) ? ym : shiftMonth(ym, 1);
    return `${due}-${pad(dayIn(due))}`;
  }

  // GET /api/home 의 toss 블록. cardBill = 첫 신용카드의 다음 카드값 (홈 소비 카드 둘째 줄 '{D}일 낼 카드값', 없으면 줄 숨김)
  function homeBlock(month, total) {
    const p = rawProfile();
    const credit = db().prepare("SELECT * FROM cards WHERE kind = 'credit' ORDER BY sort, rowid LIMIT 1").get();
    return {
      spend: { month, total },
      pointChances: p.point_chances,
      reward: { month, max: p.reward_max ?? null, dismissed: p.reward_dismissed === month },
      cardBill: credit ? { id: credit.id, name: credit.name, amount: credit.bill ?? 0, dueDate: nextPayDate(credit.pay_day) } : null,
      adSnoozeUntil: p.ad_snooze_until ?? null,
    };
  }

  // listTransactions 한 줄에 붙일 칸 (계좌 하나 목록 만들 때 한 번 색인)
  function txFieldsFor() {
    const L = ledger();
    return (t) => ({
      category: t.category ?? null,
      channel: channelOf(t),
      cardId: t.card_id ?? null,
      cancelled: !!t.cancelled,
      exclude: !!t.exclude,
      own: L.isOwn(t.id),
    });
  }

  // 상세 내역: 거래 유형 + 상대 계좌 (입금처 / 출금처). 순서: 내가 보낸 이체 → 내 계좌에서 온 돈 → 다른 사람이 보낸 돈(보낸 분 기록)
  function txDetailFields(t) {
    const L = ledger();
    const profile = h.getProfile();
    const side = (direction, code, digits, holder) => {
      const mine = L.ownTarget({ bank_code: code, number: digits });
      return {
        direction,
        own: !!mine,
        ...(mine && { accountId: mine.id, accountName: h.toAccount(mine, profile).label }),
        bank: bankInfo(bankByCode(code)),
        number: formatAccountNumber(code, digits),
        digits,
        holder,
      };
    };
    const sent = L.byOut.get(t.id);
    const came = L.byIn.get(t.id);
    const from = came && L.accById.get(came.from_account_id);
    let counterparty = null;
    if (sent && t.amount < 0) counterparty = side("out", sent.bank_code, sent.number, sent.holder);
    else if (from) counterparty = side("in", from.bank_code ?? "kakao", digitsOf(from.number), profile.userName);
    else if (sent) counterparty = side("in", sent.bank_code, sent.number, sent.holder);
    return { kindLabel: t.amount < 0 ? "출금" : "입금", counterparty };
  }

  // 받는 분 '최근 보낸 계좌': 내 계좌도 남김 (녹화처럼 '내 주거래하나 통장' 같은 줄), 보내는 계좌 자신만 뺌
  const keepRecent = (r, from) => myOwn(r)?.id !== from;
  const myOwn = (r) => h.myAccountByNumber(r.bank_code, r.number);
  const recentFields = (r) => {
    const a = myOwn(r);
    return a ? { accountId: a.id, favorite: !!a.favorite, role: a.role ?? null } : {};
  };
  const mineFields = (a) => ({ role: a.role ?? null, favorite: !!a.favorite });

  // ---------- 바꾸기 (🔔 패널 · 화면) — 공용 PATCH/POST 에 붙는 토스 칸 ----------
  // PATCH /api/profile: 고칠 값을 검사해 fields 에 오류를 넣고, 저장 함수를 돌려줌
  function profilePatch(body, fields) {
    const sets = [];
    const vals = [];
    const set = (col, v) => (sets.push(`${col} = ?`), vals.push(v));
    if (body.pointChances !== undefined) {
      if (!(Number.isInteger(body.pointChances) && body.pointChances >= 0 && body.pointChances <= 99)) fields.pointChances = "0~99번";
      else set("point_chances", body.pointChances);
    }
    if (body.rewardMax !== undefined) {
      if (body.rewardMax !== null && !isMoney(body.rewardMax)) fields.rewardMax = "0원 이상 10억원 이하 (숨기려면 비우기)";
      else set("reward_max", body.rewardMax);
    }
    if (body.rewardDismissed !== undefined) {
      if (body.rewardDismissed !== null && !isMonth(body.rewardDismissed)) fields.rewardDismissed = "YYYY-MM";
      else set("reward_dismissed", body.rewardDismissed);
    }
    if (body.adSnoozeUntil !== undefined) {
      const v = body.adSnoozeUntil;
      if (v !== null && !(typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)))) fields.adSnoozeUntil = "날짜 형식 오류";
      else set("ad_snooze_until", v);
    }
    return () => sets.length && db().prepare(`UPDATE profile SET ${sets.join(", ")} WHERE id = 1`).run(...vals);
  }

  // PATCH /api/accounts/:id: favorite · openedAt · sort · role. 잘못된 값이면 바로 400
  function accountPatch(body) {
    const fields = {};
    const sets = [];
    const vals = [];
    const set = (col, v) => (sets.push(`${col} = ?`), vals.push(v));
    if (body.favorite !== undefined) {
      if (typeof body.favorite !== "boolean") fields.favorite = "켜기/끄기";
      else set("favorite", body.favorite ? 1 : 0);
    }
    if (body.openedAt !== undefined) {
      if (body.openedAt !== null && !isDate(body.openedAt)) fields.openedAt = "YYYY-MM-DD";
      else set("opened_at", body.openedAt);
    }
    if (body.sort !== undefined) {
      if (!(Number.isInteger(body.sort) && body.sort >= 0 && body.sort <= 9999)) fields.sort = "0~9999";
      else set("sort", body.sort);
    }
    if (body.role !== undefined) {
      if (body.role !== null && body.role !== "money") fields.role = "money 또는 비우기";
      else set("role", body.role);
    }
    if (Object.keys(fields).length) throw h.bad("입력값을 확인해 주세요", fields);
    return (id) => sets.length && db().prepare(`UPDATE accounts SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
  }

  // POST /api/accounts 뒤: 토스뱅크 계좌는 개설일 = 오늘 (증명서 '개설일')
  function accountCreated(id, bankCode) {
    if (bankCode === "toss") db().prepare("UPDATE accounts SET opened_at = ? WHERE id = ?").run(h.nowIso().slice(0, 10), id);
  }

  // POST /api/accounts/:id/transactions · PATCH /api/transactions/:id: category · channel · cardId · cancelled · exclude
  function txEdit(body, fields, sets, vals) {
    const set = (col, v) => (sets.push(`${col} = ?`), vals.push(v));
    if ("category" in body) {
      const v = body.category;
      if (v !== null && (typeof v !== "string" || v.trim().length > 20)) fields.category = "20자 이하";
      else set("category", v?.trim() || null); // 비우면 tag 로 계산 (이체 / 카테고리 없음)
    }
    if ("channel" in body) {
      if (body.channel !== null && body.channel !== "" && !CHANNELS.includes(body.channel)) fields.channel = "card, account, pay 중 하나";
      else set("channel", body.channel || null); // 비우면 tag 로 계산
    }
    if ("cardId" in body) {
      const v = body.cardId;
      if (v !== null && v !== "" && !(typeof v === "string" && db().prepare("SELECT 1 FROM cards WHERE id = ?").get(v))) fields.cardId = "없는 카드예요";
      else set("card_id", v || null);
    }
    for (const [key, col] of [["cancelled", "cancelled"], ["exclude", "exclude"]]) {
      if (!(key in body)) continue;
      if (typeof body[key] !== "boolean") fields[key] = "켜기/끄기";
      else set(col, body[key] ? 1 : 0);
    }
  }

  // ---------- 소비 ----------
  function spend(month, tab) {
    const now = h.nowIso();
    const current = now.slice(0, 7);
    const today = now.slice(0, 10);
    const L = ledger();
    const profile = h.getProfile();
    const rows = db().prepare("SELECT * FROM transactions ORDER BY at DESC, id DESC").all();
    const cards = new Map(db().prepare("SELECT * FROM cards").all().map((c) => [c.id, c]));
    const prev = shiftMonth(month, -1);
    const isCurrent = month === current;

    // 합계 · 지난달 비교 (같은 날까지)
    const total = override(month, tab) ?? sumSpend(rows, L, month, tab);
    const upto = isCurrent ? Number(today.slice(8, 10)) : daysInMonth(month);
    const partial = override(month, tab) ?? sumSpend(rows, L, month, tab, upto);
    const diff = partial - sumSpend(rows, L, prev, tab, Math.min(upto, daysInMonth(prev)));

    // 이 달 · 이 탭 거래. 내 계좌끼리 옮긴 돈은 보낸 쪽 한 줄만 (받은 쪽 입금은 그 출금이 남아 있으면 뺌)
    const txIds = new Set(rows.map((t) => t.id));
    const list = rows.filter((t) => {
      if (!t.at.startsWith(month) || !inTab(t, tab)) return false;
      const came = L.byIn.get(t.id);
      return !(came && came.out_tx_id != null && txIds.has(came.out_tx_id));
    });

    // 분류 막대: 많은 순 3개 + 그 외
    const byCat = new Map();
    for (const t of list) if (counted(t, L)) byCat.set(categoryOf(t), (byCat.get(categoryOf(t)) ?? 0) - t.amount);
    const sorted = [...byCat].sort((a, b) => b[1] - a[1]);
    const categories = sorted.slice(0, 3).map(([key, amount]) => ({ key, label: key, color: CATEGORY_COLORS[key] ?? UNKNOWN_COLOR, amount }));
    const rest = sorted.slice(3).reduce((s, [, a]) => s + a, 0);
    if (rest > 0) categories.push({ key: "그 외", label: "그 외", color: OTHER_COLOR, amount: rest });

    // 날짜별 받은 돈 · 쓴 돈 (주간 달력). 받은 돈 = 내 계좌끼리 옮긴 돈 · 취소 빼고
    const days = Array.from({ length: daysInMonth(month) }, (_, i) => {
      const date = `${month}-${pad(i + 1)}`;
      const day = list.filter((t) => t.at.startsWith(date));
      return {
        date,
        dow: new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, i + 1).getDay(),
        income: day.filter((t) => t.amount > 0 && !t.cancelled && !L.isOwn(t.id)).reduce((s, t) => s + t.amount, 0),
        expense: day.filter((t) => counted(t, L)).reduce((s, t) => s - t.amount, 0),
      };
    });
    const elapsed = isCurrent ? Number(today.slice(8, 10)) : days.length;
    const average = days.slice(0, elapsed).reduce((s, d) => s + d.expense, 0) / Math.max(1, elapsed);
    const overspent = (expense) => expense >= 30_000 && expense > 2 * average;

    // 목록 한 줄
    const phrase = (a) =>
      !a ? "" : a.role === "money" ? "토스머니" : a.bank_code === "toss" ? `내 ${a.name || "토스뱅크 통장"}` : `내 ${bankByCode(a.bank_code ?? "kakao")?.name ?? "다른 은행"} 계좌`;
    const bankWord = (a) => (!a ? "다른 계좌" : a.role === "money" ? "토스머니" : (bankByCode(a.bank_code ?? "kakao")?.name ?? "다른 은행"));
    const item = (t) => {
      const acct = L.accById.get(t.account_id);
      const own = L.isOwn(t.id);
      const channel = channelOf(t);
      const card = t.card_id ? cards.get(t.card_id) : null;
      const category = categoryOf(t);
      let subtitle;
      if (own) {
        const out = L.byOut.get(t.id);
        const came = L.byIn.get(t.id);
        subtitle = out ? `${bankWord(acct)} → ${bankWord(L.ownTarget(out))}` : `${bankWord(L.accById.get(came.from_account_id))} → ${bankWord(acct)}`;
      } else if (channel === "pay") subtitle = `${card?.name ?? phrase(acct)} · ${t.merchant.replace(/_PG$/, "")}`;
      else if (channel === "card") subtitle = card?.name ?? phrase(acct);
      else subtitle = phrase(acct);
      const icon =
        t.tag === "#이체" ? "transfer"
        : category === "캐시백" ? "cashback"
        : t.tag === "#예금이자" || category === "이자" ? "interest"
        : t.tag === "#자동이체" ? `bank:${acct?.bank_code ?? "kakao"}`
        : category === "편의점·마트" ? "store"
        : `cat:${category}`;
      const tone = t.cancelled ? "cancelled" : t.amount < 0 ? (counted(t, L) ? "spend" : "excluded") : own ? "excluded" : "income";
      return {
        id: String(t.id),
        txId: String(t.id),
        accountId: t.account_id,
        channel,
        time: t.at.slice(11, 16),
        title: own ? "내 계좌 이체" : t.merchant,
        ...(t.cancelled && { suffix: "취소" }),
        subtitle,
        amount: t.amount,
        tone,
        icon,
      };
    };

    const groups = [];
    for (const t of list) {
      const date = t.at.slice(0, 10);
      let g = groups.at(-1);
      if (g?.date !== date) {
        const d = days[Number(date.slice(8, 10)) - 1];
        groups.push((g = { date, label: `${Number(date.slice(8, 10))}일 ${DOW[d.dow]}요일`, overspent: overspent(d.expense), items: [] }));
      }
      g.items.push(item(t));
    }
    // 캐시백 줄은 오늘 묶음 맨 위 (화면). 오늘 거래가 없어도 오늘 묶음을 만들어 둠
    const cashback = isCurrent && (tab === "all" || tab === "card") && profile.cashbackCount > 0 ? { count: profile.cashbackCount } : null;
    if (cashback && groups[0]?.date !== today) {
      const d = days[Number(today.slice(8, 10)) - 1];
      groups.unshift({ date: today, label: `${Number(today.slice(8, 10))}일 ${DOW[d.dow]}요일`, overspent: false, items: [] });
    }

    const hasPrev = !!db().prepare("SELECT 1 FROM transactions WHERE at < ? LIMIT 1").get(`${month}-01`);
    const label = month.slice(0, 4) === current.slice(0, 4) ? `${Number(month.slice(5))}월` : `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
    return { month, label, today, hasPrev, hasNext: month < current, tab, total, vsLastMonth: { diff }, categories, days, cashback, groups };
  }

  // ---------- 자산 · 내 계좌 ----------
  const toCard = (c, monthAmount) => ({
    id: c.id,
    name: c.name,
    bankCode: c.bank_code,
    accountId: c.account_id ?? null,
    art: c.art ?? null,
    kind: c.kind,
    ...(c.kind === "credit" && { bill: c.bill ?? 0, payDay: c.pay_day ?? null }),
    sort: c.sort,
    ...(monthAmount !== undefined && { monthAmount }),
  });
  const toPoint = (p) => ({ id: p.id, name: p.name, balance: p.balance, icon: p.icon ?? null, sort: p.sort });

  function assets() {
    const profile = h.getProfile();
    const accounts = db()
      .prepare("SELECT * FROM accounts ORDER BY sort, rowid")
      .all()
      .map((a) => {
        const acc = h.toAccount(a, profile);
        return { id: a.id, bankCode: acc.bank.code, name: acc.label, number: acc.number ?? null, balance: a.balance, isMain: a.kind === "main", role: a.role ?? null, favorite: !!a.favorite };
      });
    // 카드별 이번 달 쓴 돈 = 취소 안 된 출금 합계
    const spent = new Map(
      db()
        .prepare("SELECT card_id, -SUM(amount) AS s FROM transactions WHERE card_id IS NOT NULL AND amount < 0 AND cancelled = 0 AND at LIKE ? GROUP BY card_id")
        .all(`${thisMonth()}%`)
        .map((r) => [r.card_id, r.s]),
    );
    const cards = db()
      .prepare("SELECT * FROM cards ORDER BY sort, rowid")
      .all()
      .map((c) => toCard(c, spent.get(c.id) ?? 0))
      .sort((a, b) => b.monthAmount - a.monthAmount); // 많이 쓴 순 (같으면 sort 순 — 안정 정렬)
    const points = db().prepare("SELECT * FROM points ORDER BY sort, rowid").all().map(toPoint);
    const accountTotal = accounts.reduce((s, a) => s + a.balance, 0);
    return {
      total: accountTotal + points.reduce((s, p) => s + p.balance, 0), // 카드는 자산이 아님
      accounts: { count: accounts.length, total: accountTotal, items: accounts },
      cards: { count: cards.length, items: cards },
      points: { count: points.length, items: points },
    };
  }

  // ---------- 카드 · 포인트 CRUD (🔔 관리 패널) ----------
  const findCard = (id) => {
    const c = typeof id === "string" && db().prepare("SELECT * FROM cards WHERE id = ?").get(id);
    if (!c) throw h.notFound("카드");
    return c;
  };
  const findPoint = (id) => {
    const p = typeof id === "string" && db().prepare("SELECT * FROM points WHERE id = ?").get(id);
    if (!p) throw h.notFound("포인트");
    return p;
  };
  const nextSort = (table) => db().prepare(`SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM ${table}`).get().s;
  const nameError = (v) => (typeof v === "string" && v.trim() && v.trim().length <= 20 ? null : "이름은 1~20자");

  // 새 값(cur 에 body 를 덮은 것)을 통째로 검사
  function checkCard(next) {
    const fields = {};
    const e = nameError(next.name);
    if (e) fields.name = e;
    if (!bankByCode(next.bankCode)) fields.bankCode = "은행을 골라 주세요";
    if (next.accountId != null && next.accountId !== "" && !(typeof next.accountId === "string" && db().prepare("SELECT 1 FROM accounts WHERE id = ?").get(next.accountId)))
      fields.accountId = "없는 계좌예요";
    if (next.art != null && !(typeof next.art === "string" && next.art.length <= 40)) fields.art = "40자 이하";
    if (!["check", "credit"].includes(next.kind)) fields.kind = "check 또는 credit";
    const credit = next.kind === "credit"; // 카드값 · 결제일은 신용카드만 (체크카드면 비움)
    if (credit && next.bill != null && !isMoney(next.bill)) fields.bill = "0원 이상 10억원 이하";
    if (credit && !(Number.isInteger(next.payDay) && next.payDay >= 1 && next.payDay <= 31)) fields.payDay = "결제일 1~31일";
    if (!(Number.isInteger(next.sort) && next.sort >= 0 && next.sort <= 9999)) fields.sort = "0~9999";
    if (Object.keys(fields).length) throw h.bad("입력값을 확인해 주세요", fields);
    return [next.name.trim(), next.bankCode, next.accountId || null, next.art ?? null, next.kind, credit ? (next.bill ?? 0) : null, credit ? next.payDay : null, next.sort];
  }
  function checkPoint(next) {
    const fields = {};
    const e = nameError(next.name);
    if (e) fields.name = e;
    if (!isMoney(next.balance)) fields.balance = "0 이상 10억 이하";
    if (next.icon != null && !(typeof next.icon === "string" && next.icon.length <= 40)) fields.icon = "40자 이하";
    if (!(Number.isInteger(next.sort) && next.sort >= 0 && next.sort <= 9999)) fields.sort = "0~9999";
    if (Object.keys(fields).length) throw h.bad("입력값을 확인해 주세요", fields);
    return [next.name.trim(), next.balance, next.icon ?? null, next.sort];
  }
  const pick = (body, keys) => Object.fromEntries(keys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
  const CARD_KEYS = ["name", "bankCode", "accountId", "art", "kind", "bill", "payDay", "sort"];
  const POINT_KEYS = ["name", "balance", "icon", "sort"];

  function routes(app) {
    app.get("/api/toss/spend", (req, res) => {
      const current = thisMonth();
      const month = req.query.month === undefined ? current : String(req.query.month);
      const tab = req.query.tab === undefined ? "all" : String(req.query.tab);
      if (!isMonth(month)) throw h.bad("month 는 YYYY-MM", { month: "YYYY-MM" });
      if (!TABS.includes(tab)) throw h.bad("tab 은 all, card, account, pay 중 하나", { tab: "all, card, account, pay" });
      res.json(spend(month > current ? current : month, tab));
    });

    app.get("/api/toss/assets", (_req, res) => res.json(assets()));

    app.get("/api/toss/cards", (_req, res) => res.json(db().prepare("SELECT * FROM cards ORDER BY sort, rowid").all().map((c) => toCard(c))));
    app.post("/api/toss/cards", (req, res) => {
      const next = { kind: "check", sort: nextSort("cards"), ...pick(req.body ?? {}, CARD_KEYS) };
      const vals = checkCard(next);
      const id = `card-${randomUUID().slice(0, 8)}`;
      db().prepare("INSERT INTO cards (id, name, bank_code, account_id, art, kind, bill, pay_day, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, ...vals);
      res.status(201).json(toCard(findCard(id)));
    });
    app.patch("/api/toss/cards/:id", (req, res) => {
      const c = findCard(req.params.id);
      const cur = { name: c.name, bankCode: c.bank_code, accountId: c.account_id, art: c.art, kind: c.kind, bill: c.bill, payDay: c.pay_day, sort: c.sort };
      const vals = checkCard({ ...cur, ...pick(req.body ?? {}, CARD_KEYS) });
      db().prepare("UPDATE cards SET name = ?, bank_code = ?, account_id = ?, art = ?, kind = ?, bill = ?, pay_day = ?, sort = ? WHERE id = ?").run(...vals, c.id);
      res.json(toCard(findCard(c.id)));
    });
    app.delete("/api/toss/cards/:id", (req, res) => {
      const c = findCard(req.params.id);
      db().prepare("UPDATE transactions SET card_id = NULL WHERE card_id = ?").run(c.id); // 그 카드로 결제한 거래는 남기고 카드만 떼어 냄
      db().prepare("DELETE FROM cards WHERE id = ?").run(c.id);
      res.status(204).end();
    });

    app.get("/api/toss/points", (_req, res) => res.json(db().prepare("SELECT * FROM points ORDER BY sort, rowid").all().map(toPoint)));
    app.post("/api/toss/points", (req, res) => {
      const vals = checkPoint({ balance: 0, sort: nextSort("points"), ...pick(req.body ?? {}, POINT_KEYS) });
      const id = `pt-${randomUUID().slice(0, 8)}`;
      db().prepare("INSERT INTO points (id, name, balance, icon, sort) VALUES (?, ?, ?, ?, ?)").run(id, ...vals);
      res.status(201).json(toPoint(findPoint(id)));
    });
    app.patch("/api/toss/points/:id", (req, res) => {
      const p = findPoint(req.params.id);
      const vals = checkPoint({ name: p.name, balance: p.balance, icon: p.icon, sort: p.sort, ...pick(req.body ?? {}, POINT_KEYS) });
      db().prepare("UPDATE points SET name = ?, balance = ?, icon = ?, sort = ? WHERE id = ?").run(...vals, p.id);
      res.json(toPoint(findPoint(p.id)));
    });
    app.delete("/api/toss/points/:id", (req, res) => {
      db().prepare("DELETE FROM points WHERE id = ?").run(findPoint(req.params.id).id);
      res.status(204).end();
    });
  }

  return {
    spendTotal,
    spend,
    assets,
    profileFields,
    accountFields,
    homeBlock,
    txFieldsFor,
    txDetailFields,
    keepRecent,
    recentFields,
    mineFields,
    profilePatch,
    accountPatch,
    accountCreated,
    txEdit,
    routes,
  };
}
