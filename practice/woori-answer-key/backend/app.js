'use strict';
// Express 앱 조립. server.js 가 포트를 열고, 테스트는 createApp 으로 임의 포트(0)에 띄운다.
const express = require('express');
const cors = require('cors');
const { ensureSeeded } = require('./seed');
const { lookup } = require('./transfer');
const panel = require('./panel');
const { now } = require('./clock');
const { ApiError } = require('./util');

/**
 * @param {object} opts
 * @param {import('node:sqlite').DatabaseSync} opts.db
 * @param {object} [opts.hooks]  테스트용 훅 (hooks.onTransferStep(step) 에서 throw → 이체 롤백, hooks.silent → 500 로그 끔)
 * @param {boolean} [opts.enableDev]  /api/dev/* 활성화 (기본: WOORI_DISABLE_DEV=1 이 아니면 켬)
 */
function createApp({ db, hooks = {}, enableDev = process.env.WOORI_DISABLE_DEV !== '1' } = {}) {
  if (!db) throw new Error('createApp: db is required');
  ensureSeeded(db);

  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  const api = express.Router();

  api.get('/health', (req, res) => {
    const n = db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n;
    res.json({ ok: true, db: n > 0 ? 'ok' : 'empty', now: now(db) });
  });

  api.use('/accounts', require('./routes/accounts')(db));
  api.use('/transactions', require('./routes/transactions')(db));
  api.use('/recipients', require('./routes/recipients')(db));
  api.use('/banks', require('./routes/banks')(db));
  api.post('/lookup', (req, res) => res.json(lookup(db, req.body)));
  api.use('/transfers', require('./routes/transfers')(db, hooks));

  // 🔔 관리 패널 (backend/panel.js — bank-app-clone 과 같은 API): 내 정보 · 데이터 리셋 · 받는 분
  api.get('/profile', (req, res) => res.json(panel.getProfile(db)));
  api.patch('/profile', (req, res) => res.json(panel.patchProfile(db, req.body)));
  api.post('/reset', (req, res) => {
    panel.reset(db, req.body);
    res.json({ ok: true });
  });
  api.get('/payees', (req, res) => res.json(panel.listPayees(db)));
  api.post('/payees', (req, res) => res.status(201).json(panel.addPayee(db, req.body)));
  api.patch('/payees/:id', (req, res) => res.json(panel.patchPayee(db, req.params.id, req.body)));
  api.delete('/payees/:id', (req, res) => {
    panel.deletePayee(db, req.params.id);
    res.json({ ok: true });
  });

  if (enableDev) api.use('/dev', require('./routes/dev')(db));

  api.use((req, res) => res.status(404).json({ error: `없는 API 입니다: ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' }));

  app.use('/api', api);

  // 오류 → {error, code, …extra}
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) return res.status(err.status).json({ error: err.message, code: err.code, ...(err.extra || {}) });
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON 형식이 올바르지 않습니다', code: 'INVALID_JSON' });
    }
    if (err && err.status && err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: err.message, code: 'BAD_REQUEST' });
    }
    if (!hooks.silent) console.error('[woori-backend]', err);
    res.status(500).json({ error: '일시적인 오류가 발생했습니다', code: 'INTERNAL' });
  });

  return app;
}

module.exports = { createApp };
