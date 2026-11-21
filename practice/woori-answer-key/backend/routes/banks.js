'use strict';
// GET /api/banks?type=bank|securities[&all=1] — 금융회사 선택 그리드 (21곳, 영상 순서)
// GET /api/banks/suggest?digits=<입력 자리수>&seq=v2 — 추천 은행 칩 (영상 순서표 재생, banks.js SUGGEST_SEQUENCES)
const express = require('express');
const { suggestBanks, SUGGEST_SEQUENCES } = require('../banks');
const { digitsOnly, ApiError, one } = require('../util');

function toBank(r) {
  return {
    code: r.code,
    name: r.name,
    short: r.short,
    logo: r.logo,
    order: r.sort_order,
    kftc: r.kftc,
    inGrid: !!r.in_grid,
    prefix: r.prefix,
    prefixSrc: r.prefix_src,
  };
}

module.exports = function banksRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const type = one(req.query.type) ?? 'bank';
    if (type === 'securities') return res.json([]); // [증권사] 탭은 영상에서 누르지 않았다 — 지어내지 않음
    if (type !== 'bank') throw new ApiError(400, 'type 은 bank|securities 중 하나입니다', 'INVALID_QUERY');
    const all = one(req.query.all) === '1';
    const rows = db.prepare(`SELECT * FROM banks ${all ? '' : 'WHERE in_grid = 1'} ORDER BY sort_order`).all();
    res.json(rows.map(toBank));
  });

  router.get('/suggest', (req, res) => {
    const seq = one(req.query.seq) ?? 'v2';
    if (!Object.hasOwn(SUGGEST_SEQUENCES, seq)) throw new ApiError(400, `seq 는 ${Object.keys(SUGGEST_SEQUENCES).join('|')} 중 하나입니다`, 'INVALID_QUERY');
    let digits;
    if (one(req.query.digits) !== undefined) {
      const s = String(one(req.query.digits));
      if (!/^\d{1,2}$/.test(s)) throw new ApiError(400, 'digits 는 0 이상의 정수입니다', 'INVALID_QUERY');
      digits = Number(s);
    } else if (one(req.query.accountNumber) !== undefined) {
      digits = digitsOnly(one(req.query.accountNumber)).length; // 입력값을 주면 자리수만 센다 (숫자 규칙은 쓰지 않음)
    } else {
      throw new ApiError(400, 'digits (또는 accountNumber) 가 필요합니다', 'INVALID_QUERY');
    }
    res.json(suggestBanks(seq, digits));
  });

  return router;
};
