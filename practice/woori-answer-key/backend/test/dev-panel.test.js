'use strict';
// 🔔 관리 패널(WooriDevPanel)이 쓰는 쓰기 API: 계좌 이름 고치기 · 거래 추가/되돌리기 · 받는 분 등록/수정.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

const VIDEO_NOW = '2026-11-21T11:09:11';

let srv;
before(async () => {
  srv = await startServer();
});
after(async () => {
  await srv.close();
});
beforeEach(async () => {
  const r = await srv.reset('v1-start', VIDEO_NOW);
  assert.equal(r.status, 200);
});

describe('PATCH /api/accounts/:id — 내 정보', () => {
  test('이름을 바꾼다', async () => {
    const r = await srv.patch('/accounts/1', { ownerName: '홍길동' });
    assert.equal(r.status, 200);
    assert.equal(r.body.ownerName, '홍길동');
    assert.equal((await srv.get('/accounts/1')).body.ownerName, '홍길동');
  });

  test('빈 이름 → 400', async () => {
    assert.equal((await srv.patch('/accounts/1', { ownerName: '  ' })).status, 400);
  });

  test('11자 → 400 (10자 한도)', async () => {
    assert.equal((await srv.patch('/accounts/1', { ownerName: '가'.repeat(11) })).status, 400);
  });

  test('없는 계좌 → 404', async () => {
    assert.equal((await srv.patch('/accounts/2', { ownerName: '홍길동' })).status, 404);
  });
});

describe('POST /api/accounts/:id/transactions — 거래 추가 (입금/출금)', () => {
  test('입금: 거래가 생기고 잔액이 늘어난다', async () => {
    const r = await srv.post('/accounts/1/transactions', { merchant: '관리자 입금', amount: 5000 });
    assert.equal(r.status, 201);
    assert.equal(r.body.amount, 5000);
    assert.equal(r.body.type, 'in');
    assert.equal(r.body.balanceAfter, 5345);
    assert.equal((await srv.get('/accounts/1')).body.balance, 5345);
    assert.equal((await srv.get(`/transactions/${r.body.id}`)).body.kind, 'deposit');
  });

  test('출금: 거래가 생기고 잔액이 줄어든다', async () => {
    const r = await srv.post('/accounts/1/transactions', { merchant: '관리자 출금', amount: -100 });
    assert.equal(r.status, 201);
    assert.equal(r.body.balanceAfter, 245);
    assert.equal((await srv.get(`/transactions/${r.body.id}`)).body.kind, 'withdraw');
  });

  test('잔액 부족 → 422', async () => {
    const r = await srv.post('/accounts/1/transactions', { merchant: '관리자 출금', amount: -1_000_000 });
    assert.equal(r.status, 422);
    assert.equal(r.body.code, 'INSUFFICIENT_BALANCE');
    assert.equal((await srv.get('/accounts/1')).body.balance, 345); // 안 바뀜
  });

  test('거래처 없음 → 400, 금액 0 → 400', async () => {
    assert.equal((await srv.post('/accounts/1/transactions', { merchant: '', amount: 1 })).status, 400);
    assert.equal((await srv.post('/accounts/1/transactions', { merchant: '가게', amount: 0 })).status, 400);
  });

  test('없는 계좌 → 404', async () => {
    assert.equal((await srv.post('/accounts/2/transactions', { merchant: '가게', amount: 1 })).status, 404);
  });
});

describe('DELETE /api/transactions/:id — 되돌리기 (방금 추가한 거래만)', () => {
  test('방금 추가한 거래는 지우면 잔액이 되돌아온다', async () => {
    const add = await srv.post('/accounts/1/transactions', { merchant: '관리자 입금', amount: 5000 });
    assert.equal((await srv.get('/accounts/1')).body.balance, 5345);
    const del = await srv.del(`/transactions/${add.body.id}`);
    assert.equal(del.status, 200);
    assert.equal((await srv.get('/accounts/1')).body.balance, 345);
    assert.equal((await srv.get(`/transactions/${add.body.id}`)).status, 404);
  });

  test('영상·지어낸 행은 지울 수 없다 → 403', async () => {
    const r = await srv.del('/transactions/tx-20261121-110240');
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'NOT_DELETABLE');
  });

  test('방금 추가한 것보다 먼저 추가한 것은 지울 수 없다 → 409', async () => {
    const first = await srv.post('/accounts/1/transactions', { merchant: '첫 거래', amount: 100 });
    await srv.post('/accounts/1/transactions', { merchant: '두번째 거래', amount: 200 });
    const r = await srv.del(`/transactions/${first.body.id}`);
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'NOT_LAST');
  });

  test('없는 거래 → 404', async () => {
    assert.equal((await srv.del('/transactions/tx-00000000-000000')).status, 404);
  });
});

describe('POST /api/recipients · PATCH /api/recipients/:id — 받는 분 등록 · 수정', () => {
  test('등록하면 추천 탭 목록에 나온다', async () => {
    const r = await srv.post('/recipients', { bankCode: 'KB', accountNumber: '123-456-78901234', holder: '김테스트' });
    assert.equal(r.status, 201);
    assert.equal(r.body.name, '김테스트');
    assert.equal(r.body.bankCode, 'KB');
    const list = (await srv.get('/recipients?tab=recommend')).body;
    assert.ok(list.some((x) => x.id === r.body.id));
  });

  test('같은 은행·계좌번호를 또 등록하면 409', async () => {
    await srv.post('/recipients', { bankCode: 'KB', accountNumber: '12345678901234', holder: '김테스트' });
    const r = await srv.post('/recipients', { bankCode: 'KB', accountNumber: '1234-5678-901234', holder: '다른이름' });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'RECIPIENT_EXISTS');
  });

  test('모르는 은행 코드 → 400', async () => {
    const r = await srv.post('/recipients', { bankCode: 'ZZZ', accountNumber: '12345678901234', holder: '김테스트' });
    assert.equal(r.status, 400);
  });

  test('이름·계좌번호를 고친다', async () => {
    const add = await srv.post('/recipients', { bankCode: 'KB', accountNumber: '12345678901234', holder: '김테스트' });
    const r = await srv.patch(`/recipients/${add.body.id}`, { holder: '고친이름', accountNumber: '98765432109876' });
    assert.equal(r.status, 200);
    assert.equal(r.body.name, '고친이름');
    assert.equal(r.body.accountNumber, '98765432109876');
  });

  test('없는 받는 분 수정 → 404', async () => {
    assert.equal((await srv.patch('/recipients/9999', { holder: '이름' })).status, 404);
  });
});
