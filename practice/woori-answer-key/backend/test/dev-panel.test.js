'use strict';
// 🔔 관리 패널(WooriDevPanel) 쓰기 API — bank-app-clone server 와 같은 동작인지:
//   내 정보 · 데이터 리셋 · 계좌(잔액/이름/번호 · 추가 · 삭제) · 거래(추가 · 수정 · 삭제, 거래후 잔액은 계좌 잔액에서 거꾸로) · 받는 분.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, allItems } = require('./helpers');

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

/** 거래후 잔액이 계좌 잔액에서 거꾸로 이어지는지 (최신 = 잔액, 그 앞 = 다음 행 잔액 − 다음 행 금액) */
async function assertChain(accountId = 1) {
  const balance = (await srv.get(`/accounts/${accountId}`)).body.balance;
  const items = await allItems(srv, 'period=custom&from=2000-01-01&to=2099-12-31');
  let running = balance;
  for (const t of items) {
    assert.equal(t.balanceAfter, running, `${t.id} 잔액`);
    running -= t.amount;
  }
}

describe('기본: 내 정보 · 데이터', () => {
  test('PATCH /api/profile 이름 → 계좌 예금주', async () => {
    const r = await srv.patch('/profile', { userName: '홍길동' });
    assert.equal(r.status, 200);
    assert.equal(r.body.userName, '홍길동');
    assert.equal((await srv.get('/accounts/1')).body.ownerName, '홍길동');
    assert.equal((await srv.patch('/profile', { userName: '가'.repeat(11) })).status, 400);
  });

  test('POST /api/reset empty → 통장 0원, 거래·받는 분 없음, 이름은 그대로', async () => {
    await srv.patch('/profile', { userName: '홍길동' });
    assert.equal((await srv.post('/reset', { mode: 'empty' })).status, 200);
    const a = (await srv.get('/accounts/1')).body;
    assert.equal(a.balance, 0);
    assert.equal(a.ownerName, '홍길동');
    assert.equal((await srv.get('/accounts/1/transactions?period=1y')).body.total, 0);
    assert.deepEqual((await srv.get('/payees')).body, []);
    assert.deepEqual((await srv.get('/recipients')).body, []);
  });

  test('POST /api/reset example → v1-start 시드 (345원)', async () => {
    await srv.post('/reset', { mode: 'empty' });
    assert.equal((await srv.post('/reset', { mode: 'example' })).status, 200);
    assert.equal((await srv.get('/accounts/1')).body.balance, 345);
    assert.equal((await srv.post('/reset', { mode: 'nope' })).status, 400);
  });
});

describe('계좌', () => {
  test('잔액을 바꾸면 지난 거래들의 거래후 잔액도 같이 밀린다', async () => {
    const r = await srv.patch('/accounts/1', { balance: 1_000_345 });
    assert.equal(r.status, 200);
    assert.equal(r.body.balance, 1_000_345);
    await assertChain();
  });

  test('계좌 이름 · 번호 (우리은행 13자리)', async () => {
    const r = await srv.patch('/accounts/1', { name: '우리 주거래', number: '1002-999-000111' });
    assert.equal(r.status, 200);
    assert.equal(r.body.product, '우리 주거래');
    assert.equal(r.body.number, '1002-999-000111');
    assert.equal((await srv.patch('/accounts/1', { number: '123' })).status, 400);
    // 내 계좌는 받는 분 목록에 안 나오고, 조회는 새 번호로
    assert.equal((await srv.post('/lookup', { bankCode: 'WOORI', accountNumber: '1002999000111' })).status, 200);
  });

  test('우리은행 계좌 추가 · 삭제 (대표계좌는 못 지움)', async () => {
    const add = await srv.post('/accounts', { name: '저축', number: '1002555666777', balance: 5000 });
    assert.equal(add.status, 201);
    assert.equal(add.body.balance, 5000);
    assert.equal((await srv.get('/accounts')).body.length, 2);
    assert.equal((await srv.post('/accounts', { number: '1002555666777' })).status, 409);
    assert.equal((await srv.post('/accounts', { bankCode: 'KB', number: '1002555666778' })).status, 400);
    assert.equal((await srv.del(`/accounts/${add.body.id}`)).status, 200);
    assert.equal((await srv.get('/accounts')).body.length, 1);
    assert.equal((await srv.del('/accounts/1')).status, 400);
  });
});

describe('거래', () => {
  test('입금/출금 추가 → 잔액이 바뀌고 거래후 잔액이 이어진다', async () => {
    const r = await srv.post('/accounts/1/transactions', { merchant: '편의점', amount: -100, code: '체크카드' });
    assert.equal(r.status, 201);
    assert.equal(r.body.balanceAfter, 245);
    assert.equal((await srv.get(`/transactions/${r.body.id}`)).body.code, '체크카드');
    assert.equal((await srv.post('/accounts/1/transactions', { merchant: '월급', amount: 5000 })).body.balanceAfter, 5245);
    await assertChain();
  });

  test('과거 시각으로 넣어도 거래후 잔액이 다시 이어진다', async () => {
    const r = await srv.post('/accounts/1/transactions', { merchant: '용돈', amount: 1000, at: '2026-10-01T09:00' });
    assert.equal(r.status, 201);
    assert.equal((await srv.get('/accounts/1')).body.balance, 1345);
    await assertChain();
  });

  test('잔액 부족 · 잘못된 값', async () => {
    assert.equal((await srv.post('/accounts/1/transactions', { merchant: '마트', amount: -1000 })).body.code, 'INSUFFICIENT_BALANCE');
    assert.equal((await srv.post('/accounts/1/transactions', { merchant: '', amount: 1 })).status, 400);
    assert.equal((await srv.post('/accounts/1/transactions', { merchant: '마트', amount: 0 })).status, 400);
    assert.equal((await srv.post('/accounts/1/transactions', { merchant: '마트', amount: 1, at: '2026-13-01T00:00' })).status, 400);
  });

  test('영상 거래 수정: 이름 · 금액 · 시각 · 거래구분 · 관리점 → 잔액 · 순서가 다시 맞는다', async () => {
    const id = 'tx-20261120-212947'; // 한지호 +100,000 (영상 상세 ①)
    const r = await srv.patch(`/transactions/${id}`, {
      merchant: '김민지', amount: 150_000, at: '2026-11-21T10:00:00', code: 'CMS', branch: '본점', requester: '김민지', chequeAmount: 0,
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.displayName, '김민지');
    assert.equal(r.body.amount, 150_000);
    assert.equal(r.body.occurredAt, '2026-11-21T10:00:00');
    assert.equal(r.body.code, 'CMS');
    assert.equal(r.body.branch, '본점');
    assert.equal(r.body.requester, '김민지');
    assert.equal(r.body.kind, 'deposit');
    assert.equal((await srv.get('/accounts/1')).body.balance, 50_345);
    await assertChain();
  });

  test('출금에 받는 분 셋을 채우면 이체, 비우면 그 밖의 출금', async () => {
    const id = 'tx-20261120-213957'; // 카카오페이 -99,655 (출금)
    const detail = await srv.get(`/transactions/${id}`);
    assert.equal(detail.status, 200, '시드에 있는 출금');
    const t = await srv.patch(`/transactions/${id}`, { counterBank: 'KB', counterNumber: '56780101876543', counterHolder: '오민재' });
    assert.equal(t.body.kind, 'withdraw-transfer');
    assert.equal(t.body.recipient.name, '오민재');
    const w = await srv.patch(`/transactions/${id}`, { counterBank: '', counterNumber: '', counterHolder: '' });
    assert.equal(w.body.kind, 'withdraw');
  });

  test('금액을 바꿔 잔액이 모자라면 거절', async () => {
    const r = await srv.patch('/transactions/tx-20261120-212947', { amount: 50_000 }); // +100,000 → +50,000 → 잔액 345 − 50,000 < 0
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'INSUFFICIENT_BALANCE');
  });

  test('어느 거래든 지우면 잔액이 되돌아가고 거래후 잔액이 이어진다', async () => {
    const r = await srv.del('/transactions/tx-20261121-110240'); // 농협정우진 -1원 (영상 이체)
    assert.equal(r.status, 200);
    assert.equal((await srv.get('/accounts/1')).body.balance, 346);
    assert.equal((await srv.get('/transactions/tx-20261121-110240')).status, 404);
    await assertChain();
    assert.equal((await srv.del('/transactions/tx-00000000-000000')).status, 404);
  });

  test('지운 뒤에도 앱 이체가 그대로 된다', async () => {
    await srv.del('/transactions/tx-20261121-110240');
    const c = await srv.post('/transfers/check', { fromAccountId: 1, recipientId: 1, amount: 1 });
    assert.equal(c.status, 200);
    await srv.post('/transfers/password', { ticket: c.body.ticket, pin: '1234' });
    const x = await srv.post('/transfers', { ticket: c.body.ticket });
    assert.equal(x.status, 201);
    assert.equal(x.body.balanceAfter, 345);
    await assertChain();
  });
});

describe('받는 분 (계좌번호 조회 디렉터리)', () => {
  test('목록: 내 계좌는 빠지고, 최근입금계좌 · ☆ 표시', async () => {
    const list = (await srv.get('/payees')).body;
    assert.ok(!list.some((p) => p.bank.code === 'WOORI'), '내 계좌 없음');
    const nh = list.find((p) => p.id === 'NHLOCAL-12345652789012');
    assert.equal(nh.holder, '정우진');
    assert.equal(nh.showRecent, true);
    assert.equal(nh.favorite, false);
  });

  test('등록하면 이체 계좌번호 조회에서 찾는다 · 중복 · 내 계좌', async () => {
    assert.equal((await srv.post('/lookup', { bankCode: 'SC', accountNumber: '12345678901' })).status, 404);
    const r = await srv.post('/payees', { bankCode: 'SC', number: '123-45678-901', holder: '김민지' });
    assert.equal(r.status, 201);
    assert.equal(r.body.showRecent, false);
    assert.equal((await srv.post('/lookup', { bankCode: 'SC', accountNumber: '12345678901' })).body.holderName, '김민지');
    assert.equal((await srv.post('/payees', { bankCode: 'SC', number: '12345678901', holder: '다른' })).status, 409);
    assert.equal((await srv.post('/payees', { bankCode: 'WOORI', number: '1002123456789', holder: '나' })).status, 409);
  });

  test('수정: 이름 · 번호 · 최근입금계좌 · ☆ (추천/자주 탭과 같이 움직임)', async () => {
    const id = 'KB-56780101876543';
    let r = await srv.patch(`/payees/${id}`, { showRecent: true, favorite: true });
    assert.equal(r.status, 200);
    assert.ok((await srv.get('/recipients?tab=frequent')).body.some((x) => x.name === '오민재'));
    r = await srv.patch(`/payees/${id}`, { holder: '오민수', number: '56780101876544' });
    assert.equal(r.body.id, 'KB-56780101876544');
    assert.ok((await srv.get('/recipients')).body.some((x) => x.name === '오민수'));
    r = await srv.patch(`/payees/${r.body.id}`, { showRecent: false, favorite: false });
    assert.ok(!(await srv.get('/recipients')).body.some((x) => x.name === '오민수'));
  });

  test('삭제하면 조회에서도 · 최근입금계좌에서도 사라진다', async () => {
    assert.equal((await srv.del('/payees/NHLOCAL-12345652789012')).status, 200);
    assert.equal((await srv.get('/recipients')).body.length, 0);
    assert.equal((await srv.post('/lookup', { bankCode: 'NHLOCAL', accountNumber: '12345652789012' })).status, 404);
    assert.equal((await srv.del('/payees/NHLOCAL-12345652789012')).status, 404);
  });
});
