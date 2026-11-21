'use strict';
// 테스트 공용: 메모리 DB + 임의 포트(0)로 앱을 띄운다. 개발 서버 포트 4100 은 절대 쓰지 않는다.
const { openDb } = require('../db');
const { createApp } = require('../app');

/** @param {import('node:sqlite').DatabaseSync} [db] 기본: 메모리 DB. close() 가 db 도 닫는다 */
async function startServer(db = openDb(':memory:'), { enableDev = true } = {}) {
  const hooks = { silent: true, onTransferStep: null };
  const app = createApp({ db, hooks, enableDev });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  if (port === 4100) throw new Error('tests must not use port 4100');
  const base = `http://127.0.0.1:${port}/api`;

  async function call(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  return {
    db,
    hooks,
    base,
    port,
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    del: (p) => call('DELETE', p),
    reset: (scenario, now) => call('POST', '/dev/reset', now === undefined ? { scenario } : { scenario, now }),
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          db.close();
          resolve();
        });
      }),
  };
}

/** 모든 페이지를 따라가 거래 목록 전부 (cursor 사용) */
async function allItems(srv, query = '') {
  const out = [];
  let cursor = '';
  for (let guard = 0; guard < 100; guard++) {
    const sep = query ? '&' : '';
    const r = await srv.get(`/accounts/1/transactions?${query}${sep}limit=200${cursor ? `&cursor=${cursor}` : ''}`);
    if (r.status !== 200) throw new Error(`list ${r.status} ${JSON.stringify(r.body)}`);
    out.push(...r.body.items);
    if (!r.body.nextCursor) return out;
    cursor = r.body.nextCursor;
  }
  throw new Error('too many pages');
}

/** 계좌 + 거래(전체·상세 일부) + 받는 분 전체 스냅샷 — 시나리오 비교용 */
async function snapshot(srv) {
  const accounts = (await srv.get('/accounts')).body;
  const items = await allItems(srv, 'period=1y');
  const details = [];
  for (const t of items.slice(0, 4)) details.push((await srv.get(`/transactions/${t.id}`)).body);
  const recommend = (await srv.get('/recipients?tab=recommend')).body;
  const frequent = (await srv.get('/recipients?tab=frequent')).body;
  const mine = (await srv.get('/recipients?tab=mine')).body;
  return { accounts, items, details, recommend, frequent, mine };
}

/** v1 영상 속 이체: 최근입금계좌 1행(정우진 · 지역농축협)에 1원 */
const V1_CHECK = Object.freeze({ fromAccountId: 1, recipientId: 1, amount: 1 });
/** v2 영상 속 이체: 카카오뱅크 3333123456789 직접 입력, 2원 */
const V2_CHECK = Object.freeze({ fromAccountId: 1, bankCode: 'KAKAO', accountNumber: '3333123456789', amount: 2 });
const PIN = '1234';

/** 검사 → 비밀번호 → 실행. 실행 응답을 돌려준다 */
async function sendMoney(srv, checkBody, extra = {}) {
  const c = await srv.post('/transfers/check', checkBody);
  if (c.status !== 200) return { check: c };
  const p = await srv.post('/transfers/password', { ticket: c.body.ticket, pin: PIN });
  const x = await srv.post('/transfers', { ticket: c.body.ticket, ...extra });
  return { check: c, password: p, transfer: x };
}

module.exports = { startServer, allItems, snapshot, sendMoney, V1_CHECK, V2_CHECK, PIN };
