'use strict';
// 개발용 (WOORI_DISABLE_DEV=1 이면 없음)
//   POST /api/dev/reset {scenario: 'v1-start'|'v2-start'|'v2-end' (별칭 v1, v1-end, v2), now?: 'YYYY-MM-DDTHH:mm:ss'|'video'}
//        시나리오 상태로 통째로 다시 채운다 (결정적). now 를 주면 시계를 그 시각에 고정, 'video' 면 그 시나리오의 영상 이체 시각,
//        안 주면 덮어쓰기를 지운다 (WOORI_NOW → 실제 시각)
//   GET  /api/dev/clock, POST /api/dev/clock {now: 'YYYY-MM-DDTHH:mm:ss'|null}
const express = require('express');
const { resetDb, resolveScenario, SCENARIOS, MAIN_ACCOUNT_ID } = require('../seed');
const clock = require('../clock');
const { isValidLocalIso, ApiError } = require('../util');

module.exports = function devRouter(db) {
  const router = express.Router();
  const clockView = () => ({ now: clock.now(db), source: clock.clockSource(db) });

  router.post('/reset', (req, res) => {
    const body = req.body ?? {};
    const name = body.scenario ?? 'v1-start';
    const scenario = typeof name === 'string' ? resolveScenario(name) : null;
    if (!scenario) {
      throw new ApiError(400, "scenario 는 'v1-start' | 'v2-start' | 'v2-end' (또는 v1, v1-end, v2) 입니다", 'INVALID_SCENARIO');
    }
    let now = null;
    if (body.now === 'video') now = SCENARIOS[scenario].clock.transferAt;
    else if (body.now !== undefined && body.now !== null) {
      if (!isValidLocalIso(body.now)) throw new ApiError(400, "now 는 'YYYY-MM-DDTHH:mm:ss' 또는 'video' 입니다", 'INVALID_NOW');
      now = body.now;
    }
    const seed = resetDb(db, scenario, { now });
    const acct = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(MAIN_ACCOUNT_ID);
    res.json({ ok: true, scenario, balance: acct.balance, transactions: seed.transactions.length, clock: seed.clock, ...clockView() });
  });

  router.get('/clock', (req, res) => res.json(clockView()));

  router.post('/clock', (req, res) => {
    const v = req.body ? req.body.now : undefined;
    if (v !== null && !isValidLocalIso(v)) throw new ApiError(400, "now 는 'YYYY-MM-DDTHH:mm:ss' 또는 null 입니다", 'INVALID_NOW');
    clock.setOverride(db, v);
    res.json(clockView());
  });

  return router;
};
