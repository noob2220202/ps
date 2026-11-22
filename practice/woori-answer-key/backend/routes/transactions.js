'use strict';
// GET /api/transactions/:id — 거래내역 상세 (입금 · 이체 · 그 밖의 출금)
// DELETE /api/transactions/:id — 🔔 관리 패널 '거래' 되돌리기: 그 계좌에서 가장 최근 거래이면서 관리 패널로 추가한 것(source 'app')만.
//   영상·지어낸 행(source 'video'|'synthetic')이나 중간 거래는 지울 수 없다 (답지 정확도 보호 — 잔액 재계산이 필요 없게).
const express = require('express');
const { toDetail, getTxRow } = require('../repo');
const { withTransaction } = require('../schema');
const { ApiError } = require('../util');

module.exports = function transactionsRouter(db) {
  const router = express.Router();
  router.get('/:id', (req, res) => {
    const row = getTxRow(db, req.params.id);
    if (!row) throw new ApiError(404, '거래내역을 찾을 수 없습니다', 'TRANSACTION_NOT_FOUND');
    res.json(toDetail(row));
  });
  router.delete('/:id', (req, res) => {
    const row = getTxRow(db, req.params.id);
    if (!row) throw new ApiError(404, '거래내역을 찾을 수 없습니다', 'TRANSACTION_NOT_FOUND');
    if (row.source !== 'app') throw new ApiError(403, '관리 패널에서 추가한 거래만 지울 수 있어요', 'NOT_DELETABLE');
    const last = db
      .prepare('SELECT id FROM transactions WHERE account_id = ? ORDER BY occurred_at DESC, seq DESC LIMIT 1')
      .get(row.account_id);
    if (!last || last.id !== row.id) throw new ApiError(409, '가장 최근에 추가한 거래만 지울 수 있어요 (되돌리기 순서)', 'NOT_LAST');
    withTransaction(db, () => {
      db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(row.amount, row.account_id);
      db.prepare('DELETE FROM transactions WHERE id = ?').run(row.id);
    });
    res.json({ ok: true });
  });
  return router;
};
