'use strict';
// GET /api/transactions/:id — 거래내역 상세 (입금 · 이체 · 그 밖의 출금)
//   🔔 관리 패널: PATCH /api/transactions/:id (상세에 보이는 값 전부) · DELETE /api/transactions/:id (backend/panel.js)
const express = require('express');
const { toDetail, getTxRow } = require('../repo');
const panel = require('../panel');
const { ApiError } = require('../util');

module.exports = function transactionsRouter(db) {
  const router = express.Router();
  router.get('/:id', (req, res) => {
    const row = getTxRow(db, req.params.id);
    if (!row) throw new ApiError(404, '거래내역을 찾을 수 없습니다', 'TRANSACTION_NOT_FOUND');
    res.json(toDetail(row));
  });
  router.patch('/:id', (req, res) => res.json(panel.patchTransaction(db, req.params.id, req.body)));
  router.delete('/:id', (req, res) => {
    panel.deleteTransaction(db, req.params.id);
    res.json({ ok: true });
  });
  return router;
};
