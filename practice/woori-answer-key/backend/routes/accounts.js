'use strict';
// GET /api/accounts, GET /api/accounts/:id, GET /api/accounts/:id/transactions, GET /api/accounts/:id/transactions/:txId
//   🔔 관리 패널: POST /api/accounts · PATCH/DELETE /api/accounts/:id · POST /api/accounts/:id/transactions (backend/panel.js)
const express = require('express');
const { toAccount, toListItem, toDetail, getAccountRow, getTxRow, transferredOn } = require('../repo');
const { now } = require('../clock');
const panel = require('../panel');
const { parseDate, minusMonths, dotDate, ApiError, one } = require('../util');

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

  // 🔔 관리 패널 (backend/panel.js — bank-app-clone 과 같은 동작)
  router.post('/', (req, res) => res.status(201).json(panel.addAccount(db, req.body)));
  router.patch('/:id', (req, res) => res.json(panel.patchAccount(db, req.params.id, req.body)));
  router.delete('/:id', (req, res) => {
    panel.deleteAccount(db, req.params.id);
    res.json({ ok: true });
  });
  router.post('/:id/transactions', (req, res) => res.status(201).json(panel.addTransaction(db, req.params.id, req.body)));

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
