'use strict';
// GET /api/accounts, GET /api/accounts/:id, GET /api/accounts/:id/transactions, GET /api/accounts/:id/transactions/:txId
//   PATCH /api/accounts/:id {ownerName} · POST /api/accounts/:id/transactions {merchant,amount} — 🔔 관리 패널
const express = require('express');
const { toAccount, toListItem, toDetail, getAccountRow, getTxRow, transferredOn } = require('../repo');
const { now } = require('../clock');
const { withTransaction } = require('../schema');
const { uniqueTxId } = require('../transfer');
const { DEPOSIT_DETAIL, WITHDRAW_DETAIL } = require('../seed');
const { parseDate, minusMonths, dotDate, won, ApiError, one } = require('../util');

const OWNER_NAME_MAX = 10; // 내 정보 '이름' (DevPanel BasicForm 과 같은 한도)
const MERCHANT_MAX = 20;
const MAX_AMOUNT = 1_000_000_000; // accounts.balance CHECK 와 같은 상한

const PERIODS = { thisMonth: '이번달', '3m': '3개월', '6m': '6개월', '1y': '1년', custom: '직접입력' }; // 조회조건 시트 조회기간
const TYPES = { all: '전체', in: '입금', out: '출금' }; // 거래구분
const ORDERS = { desc: '최신순', asc: '과거순' }; // 영상은 늘 최신순. 과거순은 설계값
const DEFAULT_LIMIT = 30; // 페이지 크기 (inventory 제안 30)
const MAX_LIMIT = 200;

function accountView(db, row) {
  return toAccount(row, transferredOn(db, row.id, now(db).slice(0, 10)));
}

/** 조회기간 → {fromDate, toDate} ('YYYY-MM-DD', 둘 다 포함). 3개월 = 오늘 − 3개월 ~ 오늘 (영상 2026.08.21 ~ 2026.11.21) */
function periodRange(period, fromQ, toQ, today) {
  if (period === 'custom') {
    const fromDate = parseDate(fromQ);
    const toDate = parseDate(toQ);
    if (!fromDate || !toDate) throw new ApiError(400, '직접입력은 from, to 를 YYYY-MM-DD (또는 YYYY.MM.DD) 로 주세요', 'INVALID_QUERY');
    if (fromDate > toDate) throw new ApiError(400, 'from 이 to 보다 늦습니다', 'INVALID_QUERY');
    return { fromDate, toDate };
  }
  const months = { '3m': 3, '6m': 6, '1y': 12 }[period];
  const fromDate = period === 'thisMonth' ? `${today.slice(0, 8)}01` : minusMonths(today, months);
  return { fromDate, toDate: today };
}

function encodeCursor(row, order) {
  return Buffer.from(JSON.stringify({ t: row.occurred_at, s: row.seq, o: order })).toString('base64url');
}

function decodeCursor(cursor, order) {
  try {
    const c = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    if (typeof c.t === 'string' && Number.isSafeInteger(c.s) && c.o === order) return c;
  } catch {
    /* 아래에서 400 */
  }
  throw new ApiError(400, 'cursor 가 올바르지 않습니다 (같은 정렬의 nextCursor 를 그대로 주세요)', 'INVALID_CURSOR');
}

module.exports = function accountsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM accounts ORDER BY sort_order, id').all();
    res.json(rows.map((r) => accountView(db, r)));
  });

  router.get('/:id', (req, res) => {
    const row = getAccountRow(db, req.params.id);
    if (!row) throw new ApiError(404, '계좌를 찾을 수 없습니다', 'ACCOUNT_NOT_FOUND');
    res.json(accountView(db, row));
  });

  // 🔔 관리 패널 '내 정보' — 이름만 (계좌번호·상품명은 시나리오 고정값이라 안 둔다)
  router.patch('/:id', (req, res) => {
    const row = getAccountRow(db, req.params.id);
    if (!row) throw new ApiError(404, '계좌를 찾을 수 없습니다', 'ACCOUNT_NOT_FOUND');
    const { ownerName } = req.body ?? {};
    if (typeof ownerName !== 'string' || !ownerName.trim()) throw new ApiError(400, '이름을 입력해 주세요', 'INVALID_OWNER_NAME');
    const name = ownerName.trim();
    if ([...name].length > OWNER_NAME_MAX) throw new ApiError(400, `이름은 ${OWNER_NAME_MAX}자 이하로 입력해 주세요`, 'INVALID_OWNER_NAME');
    db.prepare('UPDATE accounts SET owner_name = ? WHERE id = ?').run(name, row.id);
    res.json(accountView(db, getAccountRow(db, row.id)));
  });

  // 🔔 관리 패널 '거래' 입금하기/출금하기 — 늘 맨 뒤에 덧붙인다(occurred_at 이 마지막 거래보다 이르면 맞춘다, transfer.execute 와 같은 규칙).
  // 과거 거래(영상 · 지어낸 행)의 시각·금액은 고치지 않는다 — 답지 정확도 보호. 되돌리기는 DELETE /api/transactions/:id (방금 추가한 것만).
  router.post('/:id/transactions', (req, res) => {
    const acct = getAccountRow(db, req.params.id);
    if (!acct) throw new ApiError(404, '계좌를 찾을 수 없습니다', 'ACCOUNT_NOT_FOUND');
    const { merchant, amount } = req.body ?? {};
    if (typeof merchant !== 'string' || !merchant.trim()) throw new ApiError(400, '거래처를 입력해 주세요', 'INVALID_MERCHANT');
    const name = merchant.trim();
    if ([...name].length > MERCHANT_MAX) throw new ApiError(400, `거래처는 ${MERCHANT_MAX}자 이하로 입력해 주세요`, 'INVALID_MERCHANT');
    if (!Number.isSafeInteger(amount) || amount === 0) throw new ApiError(400, '0이 아닌 정수 금액을 입력해 주세요', 'INVALID_AMOUNT');
    if (Math.abs(amount) > MAX_AMOUNT) throw new ApiError(400, `거래 금액은 ${won(MAX_AMOUNT)}까지예요`, 'INVALID_AMOUNT');
    if (acct.balance + amount < 0) throw new ApiError(422, `잔액이 부족해요 (현재 ${won(acct.balance)})`, 'INSUFFICIENT_BALANCE');
    if (acct.balance + amount > MAX_AMOUNT) throw new ApiError(422, `잔액은 ${won(MAX_AMOUNT)}까지예요`, 'INVALID_AMOUNT');

    const row = withTransaction(db, () => {
      const lastTx = db.prepare('SELECT MAX(occurred_at) AS t FROM transactions WHERE account_id = ?').get(acct.id).t;
      const clockAt = now(db);
      const at = lastTx && clockAt < lastTx ? lastTx : clockAt;
      const balanceAfter = acct.balance + amount;
      const id = uniqueTxId(db, at);
      const tmpl = amount > 0 ? DEPOSIT_DETAIL : WITHDRAW_DETAIL;
      db.prepare(`INSERT INTO transactions
        (id, account_id, occurred_at, display_name, amount, balance_after, kind, code, branch, requester,
         counterparty_name, counterparty_bank, counterparty_account, recipient_label, my_label, fee, cheque_amount, detail_src, source, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 'rule', 'app', '관리 패널에서 추가')`)
        .run(id, acct.id, at, name, amount, balanceAfter, amount > 0 ? 'deposit' : 'withdraw', tmpl.code, tmpl.branch);
      db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(balanceAfter, acct.id);
      return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    });
    res.status(201).json(toListItem(row));
  });

  // ?period=thisMonth|3m|6m|1y|custom &from=&to= &type=all|in|out &order=desc|asc &cursor= &limit=
  router.get('/:id/transactions', (req, res) => {
    const acct = getAccountRow(db, req.params.id);
    if (!acct) throw new ApiError(404, '계좌를 찾을 수 없습니다', 'ACCOUNT_NOT_FOUND');
    const q = (k) => one(req.query[k]);
    const fromQ = q('from');
    const toQ = q('to');
    // 기간을 안 주고 from/to 만 주면 직접입력, 아무것도 없으면 3개월 (영상의 조회조건)
    const period = q('period') ?? (fromQ || toQ ? 'custom' : '3m');
    const type = q('type') ?? 'all';
    const order = q('order') ?? 'desc';
    if (!Object.hasOwn(PERIODS, period)) throw new ApiError(400, 'period 는 thisMonth|3m|6m|1y|custom 중 하나입니다', 'INVALID_QUERY');
    if (!Object.hasOwn(TYPES, type)) throw new ApiError(400, 'type 은 all|in|out 중 하나입니다', 'INVALID_QUERY');
    if (!Object.hasOwn(ORDERS, order)) throw new ApiError(400, 'order 는 desc|asc 중 하나입니다', 'INVALID_QUERY');
    let limit = DEFAULT_LIMIT;
    if (q('limit') !== undefined) {
      limit = Number(q('limit'));
      if (!/^\d+$/.test(String(q('limit'))) || limit < 1 || limit > MAX_LIMIT) {
        throw new ApiError(400, `limit 은 1~${MAX_LIMIT} 정수입니다`, 'INVALID_QUERY');
      }
    }
    const { fromDate, toDate } = periodRange(period, fromQ, toQ, now(db).slice(0, 10));

    const where = ['account_id = ?', 'occurred_at >= ?', 'occurred_at <= ?'];
    const params = [acct.id, `${fromDate}T00:00:00`, `${toDate}T23:59:59`];
    const rangeWhere = [...where];
    const rangeParams = [...params];
    if (type === 'in') where.push('amount > 0');
    if (type === 'out') where.push('amount < 0');
    const total = db.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE ${where.join(' AND ')}`).get(...params).n;
    const cursor = q('cursor');
    if (cursor !== undefined && cursor !== '') {
      const c = decodeCursor(cursor, order);
      where.push(order === 'desc' ? '(occurred_at < ? OR (occurred_at = ? AND seq < ?))' : '(occurred_at > ? OR (occurred_at = ? AND seq > ?))');
      params.push(c.t, c.t, c.s);
    }
    const dir = order === 'asc' ? 'ASC' : 'DESC';
    const rows = db
      .prepare(`SELECT * FROM transactions WHERE ${where.join(' AND ')} ORDER BY occurred_at ${dir}, seq ${dir} LIMIT ?`)
      .all(...params, limit + 1);
    const more = rows.length > limit;
    const page = more ? rows.slice(0, limit) : rows;

    // 기간 내 합계 (설계값 — 영상은 늘 접힌 채 '기간 내 합계 ⌄'). 거래구분과 상관없이 기간 전체
    const s = db
      .prepare(`SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) AS inSum,
                       COALESCE(SUM(CASE WHEN amount < 0 THEN -amount END), 0) AS outSum,
                       COUNT(CASE WHEN amount > 0 THEN 1 END) AS inCount,
                       COUNT(CASE WHEN amount < 0 THEN 1 END) AS outCount
                FROM transactions WHERE ${rangeWhere.join(' AND ')}`)
      .get(...rangeParams);

    res.json({
      range: {
        period,
        from: dotDate(fromDate), // '2026.08.21'
        to: dotDate(toDate), // '2026.11.21'
        fromDate,
        toDate,
        text: `${dotDate(fromDate)} ~ ${dotDate(toDate)}`, // 기간 줄
      },
      type,
      order,
      labels: { period: PERIODS[period], type: TYPES[type], order: ORDERS[order] }, // 필터 줄 '3개월 · 전체 · 최신순'
      limit,
      total,
      items: page.map(toListItem),
      nextCursor: more ? encodeCursor(page[page.length - 1], order) : null,
      summary: { inSum: s.inSum, outSum: s.outSum, inCount: s.inCount, outCount: s.outCount, design: true },
    });
  });

  router.get('/:id/transactions/:txId', (req, res) => {
    const acct = getAccountRow(db, req.params.id);
    if (!acct) throw new ApiError(404, '계좌를 찾을 수 없습니다', 'ACCOUNT_NOT_FOUND');
    const row = getTxRow(db, req.params.txId);
    if (!row || row.account_id !== acct.id) throw new ApiError(404, '거래내역을 찾을 수 없습니다', 'TRANSACTION_NOT_FOUND');
    res.json(toDetail(row));
  });

  return router;
};

module.exports.periodRange = periodRange;
