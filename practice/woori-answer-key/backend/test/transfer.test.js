'use strict';
// 이체 흐름: 검사(중복 경고·처음 보내는 계좌) → 계좌 비밀번호 → 실행 → 완료 정보, 영상 이체 재현 = 다음 시나리오, 원자성.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, snapshot, sendMoney, V1_CHECK, V2_CHECK, PIN } = require('./helpers');

const V1_AT = '2026-11-21T11:09:11';
const V2_AT = '2026-11-21T11:17:39';

let srv;
before(async () => {
  srv = await startServer();
});
after(async () => {
  await srv.close();
});
beforeEach(async () => {
  srv.hooks.onTransferStep = null;
  assert.equal((await srv.reset('v1-start', V1_AT)).status, 200);
});

describe('영상 이체 재현', () => {
  test('v1: 최근입금계좌 → 1원 → 중복 경고 "6분 전" → 비밀번호 → 완료 = v2-start 시나리오', async () => {
    const c = await srv.post('/transfers/check', V1_CHECK);
    assert.equal(c.status, 200);
    const k = c.body;
    assert.match(k.ticket, /^tk-\d{6}$/);
    assert.equal(k.state, 'checked');
    assert.deepEqual([k.holderName, k.amount, k.fee, k.recipientLabel, k.myLabel, k.displayName, k.firstTime, k.withdrawable],
      ['정우진', 1, 0, '정우진', '정우진', '농협정우진', false, 345]);
    assert.deepEqual(k.from, { bankCode: 'WOORI', bankName: '우리은행', bankShort: '우리', product: 'WON통장', number: '1002-123-456789', logo: 'bank-woori' });
    assert.deepEqual(k.to, { name: '정우진', bankCode: 'NHLOCAL', bankName: '지역농축협', accountNumber: '12345652789012', logo: 'bank-nh' });
    // 11:02:40 같은 계좌로 1원 → 11:09:11 = 6분 31초 → "6분 전" (내림)
    assert.deepEqual(k.duplicate, { minutesAgo: 6, secondsAgo: 391, at: '2026-11-21T11:02:40', transactionId: 'tx-20261121-110240', text: '6분 전' });
    assert.deepEqual(k.display, {
      amount: '1원',
      confirmTo: '정우진 님에게',
      confirmAmount: '1원을 이체하시겠어요?',
      confirmSub: '지역농축협 12345652789012 계좌로 보냅니다.',
      fee: '면제',
      footnote: '인증서 비밀번호 입력 없이 바로 이체됩니다.',
      duplicateTitle: '오늘 같은 내용으로 보냈어요!\n한 번 더 보낼까요?',
      duplicateAgo: '6분 전',
      firstTimeChip: null,
    });
    assert.deepEqual((await srv.get(`/transfers/check/${k.ticket}`)).body, k);

    const p = await srv.post('/transfers/password', { ticket: k.ticket, pin: PIN });
    assert.deepEqual(p.body, { ok: true, ticket: k.ticket, state: 'verified' });

    const x = await srv.post('/transfers', { ticket: k.ticket });
    assert.equal(x.status, 201);
    assert.equal(x.body.balanceAfter, 344);
    assert.deepEqual(
      [x.body.transaction.id, x.body.transaction.occurredAt, x.body.transaction.displayName, x.body.transaction.amount, x.body.transaction.balanceAfter],
      ['tx-20261121-110911', V1_AT, '농협정우진', -1, 344],
    );
    assert.deepEqual(x.body.transaction.display, { dateLine: '11월 21일 · 11:09:11', amount: '-1원', balance: '잔액 344원', amountColor: 'black', month: '2026년 11월' });
    const done = x.body.done;
    assert.deepEqual([done.holderName, done.amount, done.fee, done.receipt, done.recipientId, done.favorite, done.memo],
      ['정우진', 1, 0, true, 1, false, null]);
    assert.deepEqual(done.display, { title: '정우진 님에게\n이체했어요', account: '지역농축협 12345652789012', amount: '1원' });
    assert.deepEqual((await srv.get('/transfers/tx-20261121-110911')).body, done);
    assert.equal((await srv.get(`/transfers/check/${k.ticket}`)).body.state, 'done');
    assert.equal((await srv.get(`/transfers/check/${k.ticket}`)).body.transactionId, 'tx-20261121-110911');

    // 거래내역 맨 위 + 상세 + 최근입금계좌 날짜
    const top = (await srv.get('/accounts/1/transactions?limit=2')).body.items;
    assert.deepEqual(top.map((t) => t.id), ['tx-20261121-110911', 'tx-20261121-110240']);
    const d = (await srv.get('/transactions/tx-20261121-110911')).body;
    assert.deepEqual([d.kind, d.recipient.bankName, d.recipientLabel, d.code, d.branch], ['withdraw-transfer', '지역농축협', '정우진', '모바일', '디지털영업부']);
    assert.equal((await srv.get('/recipients')).body[0].lastUsedAt, V1_AT);

    const afterTransfer = await snapshot(srv);
    await srv.reset('v2-start', V1_AT);
    assert.deepEqual(await snapshot(srv), afterTransfer);
  });

  test('v2: 카카오뱅크 직접 입력 → 처음 보내는 계좌, 중복 경고 없음 → 2원 → 완료 = v2-end 시나리오', async () => {
    await srv.reset('v2-start', V2_AT);
    assert.deepEqual((await srv.get('/banks/suggest?digits=13')).body.map((c) => c.name), ['우리', '카카오뱅크', '농협']);
    const l = await srv.post('/lookup', { bankCode: 'KAKAO', accountNumber: '3333123456789' });
    assert.deepEqual([l.body.holderName, l.body.firstTime], ['정우진', true]);
    const c = await srv.post('/transfers/check', V2_CHECK);
    assert.equal(c.status, 200);
    assert.deepEqual([c.body.duplicate, c.body.firstTime, c.body.displayName, c.body.withdrawable], [null, true, '카카정우진', 344]);
    assert.equal(c.body.display.firstTimeChip, '처음 보내는 계좌예요. 사기의심조회');
    assert.equal(c.body.display.confirmSub, '카카오뱅크 3333123456789 계좌로 보냅니다.');
    assert.equal(c.body.display.confirmAmount, '2원을 이체하시겠어요?');
    assert.equal((await srv.post('/transfers/password', { ticket: c.body.ticket, pin: PIN })).status, 200);
    const x = await srv.post('/transfers', { ticket: c.body.ticket });
    assert.equal(x.status, 201);
    assert.deepEqual([x.body.transaction.id, x.body.transaction.displayName, x.body.transaction.amount, x.body.balanceAfter],
      ['tx-20261121-111739', '카카정우진', -2, 342]);
    assert.equal(x.body.done.display.account, '카카오뱅크 3333123456789');
    // 최근입금계좌: 카카오뱅크가 맨 위에 생김
    const rec = (await srv.get('/recipients')).body;
    assert.deepEqual(rec.map((r) => [r.id, r.bankName, r.accountNumber, r.date]), [
      [2, '카카오뱅크', '3333123456789', '2026.11.21'],
      [1, '지역농축협', '12345652789012', '2026.11.21'],
    ]);
    // 이제는 처음 보내는 계좌가 아님
    assert.equal((await srv.post('/lookup', { bankCode: 'KAKAO', accountNumber: '3333123456789' })).body.firstTime, false);

    const afterTransfer = await snapshot(srv);
    await srv.reset('v2-end', V2_AT);
    assert.deepEqual(await snapshot(srv), afterTransfer);
  });
});

describe('중복 이체 경고', () => {
  test('같은 받는 계좌·같은 금액·오늘이어야 경고, 가장 최근 것 기준', async () => {
    // 금액이 다르면 없음
    assert.equal((await srv.post('/transfers/check', { ...V1_CHECK, amount: 2 })).body.duplicate, null);
    // 직접 입력(농협은행 선택 + 지역농축협 계좌)도 같은 계좌로 본다
    const viaNh = (await srv.post('/transfers/check', { fromAccountId: 1, bankCode: 'NH', accountNumber: '12345652789012', amount: 1 })).body;
    assert.equal(viaNh.duplicate.text, '6분 전');
    // 다음 날이면 없음
    await srv.post('/dev/clock', { now: '2026-11-22T09:00:00' });
    assert.equal((await srv.post('/transfers/check', V1_CHECK)).body.duplicate, null);
    // v2-start 에서 다시 지역농축협 1원 → 가장 최근(11:09:11) 기준
    await srv.reset('v2-start', '2026-11-21T11:17:20');
    const d = (await srv.post('/transfers/check', V1_CHECK)).body.duplicate;
    assert.deepEqual([d.transactionId, d.minutesAgo, d.text], ['tx-20261121-110911', 8, '8분 전']);
    // 1분 미만 '방금 전', 1시간 이상 'N시간 전' (설계값)
    await srv.post('/dev/clock', { now: '2026-11-21T11:09:40' });
    assert.equal((await srv.post('/transfers/check', V1_CHECK)).body.duplicate.text, '방금 전');
    await srv.post('/dev/clock', { now: '2026-11-21T13:30:00' });
    assert.equal((await srv.post('/transfers/check', V1_CHECK)).body.duplicate.text, '2시간 전');
  });
});

describe('계좌 비밀번호', () => {
  test('비밀번호 없이 실행 403, 틀리면 422 (n/5), 5번 틀리면 잠김 423', async () => {
    const { ticket } = (await srv.post('/transfers/check', V1_CHECK)).body;
    let r = await srv.post('/transfers', { ticket });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'PIN_REQUIRED');
    for (const pin of ['123', '12345', 1234, 'abcd', '']) {
      r = await srv.post('/transfers/password', { ticket, pin });
      assert.equal(r.status, 400, String(pin));
      assert.equal(r.body.code, 'INVALID_PIN');
    }
    for (let i = 1; i <= 4; i++) {
      r = await srv.post('/transfers/password', { ticket, pin: '0000' });
      assert.equal(r.status, 422);
      assert.deepEqual([r.body.code, r.body.failCount, r.body.maxFailures], ['WRONG_PIN', i, 5]);
    }
    r = await srv.post('/transfers/password', { ticket, pin: '0000' });
    assert.equal(r.status, 423);
    assert.equal(r.body.code, 'PIN_LOCKED');
    assert.equal((await srv.post('/transfers/password', { ticket, pin: PIN })).status, 423);
    assert.equal((await srv.post('/transfers', { ticket })).status, 423);
    assert.equal((await srv.get('/accounts/1')).body.balance, 345);
  });

  test('틀린 뒤 맞으면 통과, 한 번 쓴 ticket 은 409, 없는 ticket 404', async () => {
    const { ticket } = (await srv.post('/transfers/check', V1_CHECK)).body;
    assert.equal((await srv.post('/transfers/password', { ticket, pin: '9999' })).status, 422);
    assert.equal((await srv.post('/transfers/password', { ticket, pin: PIN })).status, 200);
    assert.equal((await srv.post('/transfers', { ticket })).status, 201);
    let r = await srv.post('/transfers', { ticket });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'TICKET_USED');
    assert.equal((await srv.post('/transfers/password', { ticket, pin: PIN })).status, 409);
    assert.equal((await srv.post('/transfers', { ticket: 'tk-999999' })).status, 404);
    assert.equal((await srv.get('/transfers/check/tk-999999')).status, 404);
    r = await srv.post('/transfers', {});
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'INVALID_TICKET');
    // 리셋하면 ticket 도 지워진다
    await srv.reset('v1-start', V1_AT);
    assert.equal((await srv.get(`/transfers/check/${ticket}`)).status, 404);
  });
});

describe('검사·실행 검증', () => {
  test('금액·계좌·통장표기 검증', async () => {
    for (const amount of [0, -1, 1.5, '1', null, undefined, true, Number.MAX_SAFE_INTEGER + 2]) {
      const body = { ...V1_CHECK, amount };
      if (amount === undefined) delete body.amount;
      const r = await srv.post('/transfers/check', body);
      assert.equal(r.status, 400, String(amount));
      assert.equal(r.body.code, 'INVALID_AMOUNT');
    }
    const insufficient = await srv.post('/transfers/check', { ...V1_CHECK, amount: 346 });
    assert.equal(insufficient.status, 422);
    assert.equal(insufficient.body.code, 'INSUFFICIENT_BALANCE');
    assert.equal((await srv.post('/transfers/check', { ...V1_CHECK, amount: 345 })).status, 200); // 전액은 됨
    const codes = async (body) => {
      const r = await srv.post('/transfers/check', body);
      return [r.status, r.body.code];
    };
    assert.deepEqual(await codes({ ...V1_CHECK, fromAccountId: 'x' }), [400, 'INVALID_FROM_ACCOUNT']);
    assert.deepEqual(await codes({ ...V1_CHECK, fromAccountId: 9 }), [404, 'FROM_ACCOUNT_NOT_FOUND']);
    assert.deepEqual(await codes({ ...V1_CHECK, recipientId: 9 }), [404, 'RECIPIENT_NOT_FOUND']);
    assert.deepEqual(await codes({ ...V1_CHECK, recipientId: 'a' }), [400, 'INVALID_RECIPIENT']);
    assert.deepEqual(await codes({ ...V2_CHECK, accountNumber: '3333000000000' }), [404, 'ACCOUNT_NOT_FOUND']);
    assert.deepEqual(await codes({ ...V2_CHECK, bankCode: 'ZZ' }), [400, 'INVALID_BANK']);
    assert.deepEqual(await codes({ fromAccountId: 1, bankCode: 'WOORI', accountNumber: '1002-123-456789', amount: 1 }), [400, 'SAME_ACCOUNT']);
    assert.deepEqual(await codes({ ...V1_CHECK, myLabel: 'ㄱ'.repeat(21) }), [400, 'INVALID_LABEL']);
    assert.deepEqual(await codes({ ...V1_CHECK, recipientLabel: 3 }), [400, 'INVALID_LABEL']);
    assert.deepEqual(await codes([]), [400, 'INVALID_BODY']);
    assert.equal((await srv.get('/accounts/1')).body.balance, 345);
  });

  test('통장표기를 바꾸면: 내 통장표기 = 거래내역 이름(앞말 없이), 받는 분 통장표기 = 상세', async () => {
    const r = await sendMoney(srv, { ...V1_CHECK, recipientLabel: '용돈' }, { myLabel: '생활비' });
    assert.equal(r.transfer.status, 201);
    assert.equal(r.transfer.body.transaction.displayName, '생활비');
    const d = (await srv.get(`/transactions/${r.transfer.body.transaction.id}`)).body;
    assert.deepEqual([d.recipientLabel, d.myLabel, d.recipient.name], ['용돈', '생활비', '정우진']);
    assert.equal(r.transfer.body.done.display.title, '정우진 님에게\n이체했어요');
    // 실행 때 통장표기 길이 검증
    const c = (await srv.post('/transfers/check', V1_CHECK)).body;
    await srv.post('/transfers/password', { ticket: c.ticket, pin: PIN });
    assert.equal((await srv.post('/transfers', { ticket: c.ticket, myLabel: 'ㄱ'.repeat(21) })).status, 400);
  });

  test('실행 직전 잔액이 모자라면 422 (검사 뒤 다른 이체)', async () => {
    const a = (await srv.post('/transfers/check', { ...V1_CHECK, amount: 300 })).body;
    const b = (await srv.post('/transfers/check', { ...V1_CHECK, amount: 100 })).body;
    for (const t of [a, b]) await srv.post('/transfers/password', { ticket: t.ticket, pin: PIN });
    assert.equal((await srv.post('/transfers', { ticket: a.ticket })).status, 201);
    const r = await srv.post('/transfers', { ticket: b.ticket });
    assert.equal(r.status, 422);
    assert.equal(r.body.code, 'INSUFFICIENT_BALANCE');
    assert.equal((await srv.get('/accounts/1')).body.balance, 45);
  });

  test('한도제한 계좌 1일 이체한도 1,000,000원 (설계값, 이 앱의 이체만)', async () => {
    srv.db.prepare('UPDATE accounts SET balance = 5000000').run();
    assert.equal((await sendMoney(srv, { ...V1_CHECK, amount: 999_999 })).transfer.status, 201); // 11:02:40 의 1원 + 999,999 = 1,000,000
    const over = await srv.post('/transfers/check', V1_CHECK);
    assert.equal(over.status, 422);
    assert.equal(over.body.code, 'DAILY_LIMIT_EXCEEDED');
    assert.equal((await srv.get('/accounts/1')).body.remainingDailyLimit, 0);
    await srv.post('/dev/clock', { now: '2026-11-22T09:00:00' }); // 다음 날은 다시
    assert.equal((await sendMoney(srv, { ...V1_CHECK, amount: 1_000_000 })).transfer.status, 201);
  });

  test('거래시각: 시계가 마지막 거래보다 이르면 마지막 시각으로, 같은 초 두 번은 id 뒤에 -2', async () => {
    await srv.post('/dev/clock', { now: '2026-11-21T11:00:00' }); // 11:02:40 보다 이름
    let r = await sendMoney(srv, V1_CHECK);
    assert.equal(r.transfer.body.transaction.occurredAt, '2026-11-21T11:02:40');
    assert.equal(r.transfer.body.transaction.id, 'tx-20261121-110240-2');
    r = await sendMoney(srv, V1_CHECK);
    assert.equal(r.transfer.body.transaction.id, 'tx-20261121-110240-3');
    const top = (await srv.get('/accounts/1/transactions?limit=3')).body.items;
    assert.deepEqual(top.map((t) => [t.id, t.balanceAfter]), [
      ['tx-20261121-110240-3', 343], ['tx-20261121-110240-2', 344], ['tx-20261121-110240', 345],
    ]);
    // 본문 occurredAt (개발용): 형식·순서 검사
    const c = (await srv.post('/transfers/check', V1_CHECK)).body;
    await srv.post('/transfers/password', { ticket: c.ticket, pin: PIN });
    assert.equal((await srv.post('/transfers', { ticket: c.ticket, occurredAt: '2026-11-21 11:30' })).status, 400);
    assert.equal((await srv.post('/transfers', { ticket: c.ticket, occurredAt: '2026-11-21T10:00:00' })).status, 400);
    r = await srv.post('/transfers', { ticket: c.ticket, occurredAt: '2026-11-21T11:30:00' });
    assert.equal(r.status, 201);
    assert.equal(r.body.transaction.id, 'tx-20261121-113000');
  });

  test('완료 정보는 이 앱의 이체만 (다른 거래 404)', async () => {
    assert.equal((await srv.get('/transfers/tx-20261121-110240')).status, 200);
    assert.equal((await srv.get('/transfers/tx-20261120-213957')).status, 404);
    assert.equal((await srv.get('/transfers/tx-29991231-000000')).status, 404);
  });
});

describe('원자성', () => {
  for (const failAt of ['debited', 'inserted', 'recipientUpserted', 'beforeCommit']) {
    test(`'${failAt}' 단계에서 강제 실패 → 전부 롤백, ticket 은 그대로라 다시 실행 가능`, async () => {
      const c = (await srv.post('/transfers/check', V1_CHECK)).body;
      await srv.post('/transfers/password', { ticket: c.ticket, pin: PIN });
      const snap = await snapshot(srv);
      let reached = false;
      srv.hooks.onTransferStep = (step) => {
        if (step === failAt) {
          reached = true;
          throw new Error(`forced failure at ${step}`);
        }
      };
      const r = await srv.post('/transfers', { ticket: c.ticket });
      assert.equal(reached, true);
      assert.equal(r.status, 500);
      assert.equal(r.body.code, 'INTERNAL');
      srv.hooks.onTransferStep = null;
      assert.deepEqual(await snapshot(srv), snap);
      assert.equal((await srv.get(`/transfers/check/${c.ticket}`)).body.state, 'verified');
      const ok = await srv.post('/transfers', { ticket: c.ticket });
      assert.equal(ok.status, 201);
      assert.equal(ok.body.balanceAfter, 344);
    });
  }
});
