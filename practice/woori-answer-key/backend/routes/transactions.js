'use strict';
// GET /api/transactions/:id — 거래내역 상세 (입금 · 이체 · 그 밖의 출금)
const express = require('express');
const { toDetail, getTxRow } = require('../repo');
const { ApiError } = require('../util');

module.exports = function transactionsRouter(db) {
  const router = express.Router();
  router.get('/:id', (req, res) => {
    const row = getTxRow(db, req.params.id);
    if (!row) throw new ApiError(404, '거래내역을 찾을 수 없습니다', 'TRANSACTION_NOT_FOUND');
    res.json(toDetail(row));
  });
  return router;
};
