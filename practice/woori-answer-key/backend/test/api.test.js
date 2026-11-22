'use strict';
// 조회 API: health, accounts, transactions(기간·구분·정렬·커서), 상세 2종, recipients, banks, suggest, lookup, dev reset/clock.
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
  srv.hooks.onTransferStep = null;
  const r = await srv.reset('v1-start', VIDEO_NOW);
  assert.equal(r.status, 200);
});

describe('health / accounts', () => {
  test('GET /api/health', async () => {
    const r = await srv.get('/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true, db: 'ok', now: VIDEO_NOW });
  });

  test('GET /api/accounts: WON 통장 345원 (v1-start)', async () => {
    const r = await srv.get('/accounts');
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 1);
    const a = r.body[0];
    assert.deepEqual(
      [a.id, a.bank, a.bankName, a.bankShort, a.product, a.productNoSpace, a.number, a.badge, a.balance, a.withdrawable],
      [1, 'woori', '우리은행', '우리', 'WON 통장', 'WON통장', '1002-123-456789', null, 345, 345],
    );
    assert.deepEqual((await srv.get('/accounts/1')).body, a);
    assert.equal((await srv.get('/accounts/2')).status, 404);
    assert.equal((await srv.get('/accounts/2/transactions')).status, 404);
  });

  test('없는 API 는 404 JSON, 깨진 JSON 은 400', async () => {
    const r = await srv.get('/nope');
    assert.equal(r.status, 404);
    assert.equal(r.body.code, 'NOT_FOUND');
    const bad = await srv.post('/lookup', '{not json');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'INVALID_JSON');
  });
});

describe('transactions 목록', () => {
  test('기본 = 3개월 · 전체 · 최신순, 30건 페이지, 기간 2026.08.21 ~ 2026.11.21', async () => {
    const r = await srv.get('/accounts/1/transactions');
    assert.equal(r.status, 200);
    const b = r.body;
    assert.deepEqual(b.range, {
      period: '3m', from: '2026.08.21', to: '2026.11.21', fromDate: '2026-08-21', toDate: '2026-11-21', text: '2026.08.21 ~ 2026.11.21',
    });
    assert.deepEqual(b.labels, { period: '3개월', type: '전체', order: '최신순' });
    assert.equal(b.limit, 30);
    assert.equal(b.total, 104);
    assert.equal(b.items.length, 30);
    assert.ok(b.nextCursor);
    const first = b.items[0];
    assert.deepEqual(first, {
      id: 'tx-20261121-110240',
      accountId: 1,
      occurredAt: '2026-11-21T11:02:40',
      displayName: '농협정우진',
      amount: -1,
      balanceAfter: 345,
      type: 'out',
      synthetic: false,
      display: { dateLine: '11월 21일 · 11:02:40', amount: '-1원', balance: '잔액 345원', amountColor: 'black', month: '2026년 11월' },
    });
    const dep = b.items.find((t) => t.id === 'tx-20261120-212947');
    assert.deepEqual([dep.type, dep.display.amount, dep.display.amountColor, dep.display.balance], ['in', '+100,000원', 'blue', '잔액 100,001원']);
    // 기간 내 합계 (설계값): 기간 전체 입금·출금 합
    const all = await allItems(srv);
    const inSum = all.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const outSum = all.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
    assert.deepEqual(b.summary, { inSum, outSum, inCount: 45, outCount: 59, design: true });
  });

  test('커서로 끝까지 넘기면 한 번에 받은 목록과 같다 (중복·누락 없음)', async () => {
    const whole = (await srv.get('/accounts/1/transactions?limit=200')).body;
    assert.equal(whole.items.length, 104);
    assert.equal(whole.nextCursor, null);
    for (const limit of [1, 7, 30]) {
      const seen = [];
      let cursor = '';
      let pages = 0;
      for (;;) {
        const r = await srv.get(`/accounts/1/transactions?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`);
        assert.equal(r.status, 200);
        assert.ok(r.body.items.length <= limit);
        seen.push(...r.body.items);
        pages++;
        if (!r.body.nextCursor) break;
        cursor = r.body.nextCursor;
      }
      assert.equal(pages, Math.ceil(104 / limit));
      assert.deepEqual(seen.map((t) => t.id), whole.items.map((t) => t.id), `limit ${limit}`);
    }
    // 과거순도 같은 방식
    const asc = await allItems(srv, 'order=asc');
    assert.deepEqual(asc.map((t) => t.id), [...whole.items].reverse().map((t) => t.id));
  });

  test('잔액이 목록 전체에서 이어지고, 맨 위 거래후잔액 = 계좌 잔액', async () => {
    const asc = await allItems(srv, 'period=1y&order=asc');
    assert.equal(asc.length, 104);
    for (let i = 1; i < asc.length; i++) assert.equal(asc[i].balanceAfter, asc[i - 1].balanceAfter + asc[i].amount, asc[i].id);
    assert.equal(asc.at(-1).balanceAfter, (await srv.get('/accounts/1')).body.balance);
  });

  test('거래구분 입금/출금: 영상 목록 맨 위가 그대로 + 월 머리글 11월·10월·9월', async () => {
    const inn = await allItems(srv, 'type=in');
    assert.ok(inn.every((t) => t.amount > 0 && t.type === 'in'));
    assert.equal(inn.length, 45); // 영상 입금 26 + 지어낸 입금 19
    assert.equal(inn.filter((t) => !t.synthetic).length, 26);
    assert.deepEqual(inn.slice(0, 2).map((t) => t.displayName), ['한지호', '정우진']);
    assert.equal(inn[25].id, 'tx-20261112-232313');
    assert.equal(inn[26].synthetic, true);
    assert.equal(inn[26].display.dateLine.slice(0, 7), '11월 12일');
    const out = await allItems(srv, 'type=out');
    assert.ok(out.every((t) => t.amount < 0 && t.type === 'out'));
    assert.equal(out.length, 59); // 영상 출금 56 (v1-start, 11:09:11·11:17:39 없음) + 9월 3
    assert.equal(out[55].id, 'tx-20261008-142456');
    const months = [...new Set(out.map((t) => t.display.month))];
    assert.deepEqual(months, ['2026년 11월', '2026년 10월', '2026년 9월']);
    const r = await srv.get('/accounts/1/transactions?type=out');
    assert.equal(r.body.labels.type, '출금');
    assert.equal(r.body.total, 59);
  });

  test('조회기간: 이번달 · 6개월 · 1년 · 직접입력', async () => {
    let r = await srv.get('/accounts/1/transactions?period=thisMonth&limit=200');
    assert.equal(r.body.range.text, '2026.11.01 ~ 2026.11.21');
    assert.equal(r.body.labels.period, '이번달');
    assert.ok(r.body.items.every((t) => t.occurredAt >= '2026-11-01'));
    assert.equal(r.body.items.at(-1).occurredAt, '2026-11-06T18:42:09');
    r = await srv.get('/accounts/1/transactions?period=6m');
    assert.equal(r.body.range.text, '2026.05.21 ~ 2026.11.21');
    r = await srv.get('/accounts/1/transactions?period=1y');
    assert.equal(r.body.range.text, '2025.11.21 ~ 2026.11.21');
    assert.equal(r.body.total, 104);
    r = await srv.get('/accounts/1/transactions?period=custom&from=2026.11.20&to=2026.11.20&order=asc&limit=200');
    assert.equal(r.status, 200);
    assert.equal(r.body.range.text, '2026.11.20 ~ 2026.11.20');
    assert.deepEqual(r.body.items.map((t) => t.occurredAt.slice(11)), [
      '00:07:10', '00:18:52', '00:44:15', '09:52:45', '12:18:40', '12:19:52', '13:14:49', '16:47:30', '16:49:24',
      '18:48:04', '18:56:06', '20:17:15', '21:29:47', '21:39:57',
    ]);
    // from/to 만 주면 직접입력
    r = await srv.get('/accounts/1/transactions?from=2026-10-09&to=2026-10-09');
    assert.equal(r.body.range.period, 'custom');
    assert.equal(r.body.total, 5);
    // 3개월은 시계 날짜를 따른다
    await srv.post('/dev/clock', { now: '2026-12-31T09:00:00' });
    r = await srv.get('/accounts/1/transactions');
    assert.equal(r.body.range.text, '2026.09.30 ~ 2026.12.31');
  });

  test('잘못된 조회 조건 400', async () => {
    for (const q of [
      'period=1m', 'type=deposit', 'order=new', 'limit=0', 'limit=201', 'limit=abc', 'period=custom', 'period=custom&from=2026-11-01',
      'from=2026-13-01&to=2026-12-01', 'from=2026-11-21&to=2026-11-01', 'cursor=@@@',
    ]) {
      const r = await srv.get(`/accounts/1/transactions?${q}`);
      assert.equal(r.status, 400, q);
      assert.ok(r.body.error, q);
    }
    // 다른 정렬의 커서는 받지 않는다
    const c = (await srv.get('/accounts/1/transactions?limit=5')).body.nextCursor;
    const r = await srv.get(`/accounts/1/transactions?order=asc&cursor=${c}`);
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'INVALID_CURSOR');
  });
});

describe('거래내역 상세 2종', () => {
  test('입금 상세 (영상 ①: 한지호 +100,000원)', async () => {
    const r = await srv.get('/transactions/tx-20261120-212947');
    assert.equal(r.status, 200);
    const d = r.body;
    assert.deepEqual([d.kind, d.code, d.requester, d.branch, d.chequeAmount, d.balanceAfter, d.detailSrc, d.recipient, d.receipt],
      ['deposit', '0543', '한지호', '플랫폼사업부', 0, 100001, 'video', null, false]);
    assert.deepEqual(d.display.fields.map((f) => [f.label, f.value]), [
      ['메모입력', '메모를 입력해 보세요'],
      ['거래일시', '2026.11.20 21:29:47'],
      ['거래구분', '0543'],
      ['거래후 잔액', '100,001원'],
      ['의뢰인', '한지호'],
      ['수표금액', '0원'],
      ['관리점', '플랫폼사업부'],
    ]);
    assert.deepEqual([d.display.pageTitle, d.display.title, d.display.amount, d.display.search, d.display.buttons],
      ['거래내역 상세', '한지호', '+100,000원', "'한지호' 검색하기", ['공유', '확인']]);
    assert.equal(d.display.fields[0].placeholder, true);
  });

  test('이체 상세 (영상 ②: 농협정우진 -1원)', async () => {
    const r = await srv.get('/transactions/tx-20261121-110240');
    assert.equal(r.status, 200);
    const d = r.body;
    assert.equal(d.kind, 'withdraw-transfer');
    assert.deepEqual(d.recipient, { name: '정우진', bankCode: 'NHLOCAL', bankName: '지역농축협', accountNumber: '12345652789012', logo: 'bank-nh' });
    assert.deepEqual([d.code, d.recipientLabel, d.myLabel, d.receipt, d.branch, d.detailSrc], ['모바일', '정우진', '정우진', true, '디지털영업부', 'video']);
    assert.deepEqual(d.display.fields.map((f) => [f.label, f.value, f.sub ?? null]), [
      ['메모입력', '메모를 입력해 보세요', null],
      ['거래일시', '2026.11.21 11:02:40', null],
      ['받는 분', '정우진', '지역농축협 12345652789012'],
      ['받는 분 통장표기', '정우진', null],
      ['이체확인증', '보기', null],
      ['거래구분', '모바일', null],
      ['거래후 잔액', '345원', null],
      ['수표금액', '0원', null],
      ['관리점', '디지털영업부', null],
    ]);
    assert.equal(d.display.search, "'농협정우진' 검색하기");
    // 계좌 경로로도 같다
    assert.deepEqual((await srv.get('/accounts/1/transactions/tx-20261121-110240')).body, d);
  });

  test('상세가 영상에 없는 행은 설계값 (detailSrc rule), 없는 id 404', async () => {
    const dep = (await srv.get('/transactions/tx-20261118-140041')).body; // 기프티콘다사요 +16,000
    assert.deepEqual([dep.kind, dep.requester, dep.code, dep.detailSrc], ['deposit', '기프티콘다사요', '0543', 'rule']);
    const wd = (await srv.get('/transactions/tx-20261120-213957')).body; // 카카오페이 -99,655
    assert.equal(wd.kind, 'withdraw');
    assert.equal(wd.recipient, null);
    assert.deepEqual(wd.display.fields.map((f) => f.label), ['메모입력', '거래일시', '거래구분', '거래후 잔액', '수표금액', '관리점']);
    const syn = (await srv.get('/transactions/tx-20261112-214726')).body;
    assert.equal(syn.synthetic, true);
    assert.equal((await srv.get('/transactions/tx-29991231-000000')).status, 404);
    assert.equal((await srv.get('/accounts/1/transactions/tx-29991231-000000')).status, 404);
  });
});

describe('recipients', () => {
  test('추천 탭 = 최근입금계좌 1행 (정우진 · 지역농축협 · 2026.11.21)', async () => {
    const r = await srv.get('/recipients?tab=recommend');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, [{
      id: 1, name: '정우진', bankCode: 'NHLOCAL', bankName: '지역농축협', accountNumber: '12345652789012', logo: 'bank-nh',
      date: '2026.11.21', lastUsedAt: '2026-11-21T11:02:40', favorite: false,
    }]);
    assert.deepEqual((await srv.get('/recipients')).body, r.body); // 기본 탭 = recommend
  });

  test('즐겨찾기(☆) 토글/지정 → 자주 탭', async () => {
    assert.deepEqual((await srv.get('/recipients?tab=frequent')).body, []);
    let r = await srv.post('/recipients/1/favorite', {});
    assert.equal(r.status, 200);
    assert.equal(r.body.favorite, true);
    assert.deepEqual((await srv.get('/recipients?tab=frequent')).body.map((x) => x.id), [1]);
    r = await srv.post('/recipients/1/favorite');
    assert.equal(r.body.favorite, false);
    r = await srv.post('/recipients/1/favorite', { favorite: true });
    assert.equal(r.body.favorite, true);
    r = await srv.post('/recipients/1/favorite', { favorite: true });
    assert.equal(r.body.favorite, true);
    assert.equal((await srv.post('/recipients/1/favorite', { favorite: 'yes' })).status, 400);
    assert.equal((await srv.post('/recipients/9/favorite', {})).status, 404);
  });

  test('내계좌 탭, 잘못된 탭 400, 삭제', async () => {
    const mine = (await srv.get('/recipients?tab=mine')).body;
    assert.deepEqual(mine.map((x) => [x.id, x.name, x.bankName, x.accountNumber, x.balance]), [['account-1', 'WON 통장', '우리', '1002-123-456789', 345]]);
    assert.equal((await srv.get('/recipients?tab=recent')).status, 400);
    assert.deepEqual((await srv.del('/recipients/1')).body, { ok: true });
    assert.deepEqual((await srv.get('/recipients')).body, []);
    assert.equal((await srv.del('/recipients/1')).status, 404);
  });
});

describe('banks / suggest', () => {
  test('금융회사 그리드 21곳 (영상 순서)', async () => {
    const r = await srv.get('/banks');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.map((b) => b.name), [
      '우리은행', '농협은행', '국민은행', '카카오뱅크', '신한은행', '하나은행', '기업은행', '토스뱅크', '새마을금고', '케이뱅크',
      'iM뱅크(대구)', '부산은행', 'SC제일은행', '경남은행', '광주은행', '도이치은행', '산림조합', '산업은행', '수협은행', '수협중앙회', '신협',
    ]);
    assert.deepEqual(r.body.map((b) => b.order), Array.from({ length: 21 }, (_, i) => i + 1));
    assert.ok(r.body.every((b) => b.inGrid && b.logo));
    assert.deepEqual(r.body[3], {
      code: 'KAKAO', name: '카카오뱅크', short: '카카오뱅크', logo: 'bank-kakao', order: 4, kftc: '090', inGrid: true, prefix: '카카', prefixSrc: 'video',
    });
    assert.deepEqual((await srv.get('/banks?type=bank')).body, r.body);
    assert.deepEqual((await srv.get('/banks?type=securities')).body, []);
    const all = (await srv.get('/banks?all=1')).body;
    assert.deepEqual(all.slice(21).map((b) => [b.code, b.short, b.inGrid]), [['NHLOCAL', '지역농축협', false], ['CITI', '한국씨티', false]]);
    assert.deepEqual(all.filter((b) => !b.logo).map((b) => b.code), []); // 한국씨티도 로고 = 추천 칩 그림 bank-citi
    assert.equal((await srv.get('/banks?type=card')).status, 400);
  });

  test('추천 은행 칩: 입력 자리수 → 영상 순서표', async () => {
    const names = async (q) => (await srv.get(`/banks/suggest?${q}`)).body.map((c) => c.name);
    const expected = [
      [], [], [], [],
      ['카카오뱅크', '한국씨티'],
      ['카카오뱅크', '수협', '농협'],
      ['카카오뱅크', '국민', '수협'],
      ['카카오뱅크', '국민', '수협'],
      ['카카오뱅크', '국민', '수협'],
      ['카카오뱅크', '국민', '수협'],
      ['우리', '카카오뱅크', '한국씨티'],
      ['우리', '카카오뱅크', '수협'],
      ['우리', '카카오뱅크', '국민'],
      ['우리', '카카오뱅크', '농협'],
    ];
    for (let d = 0; d < expected.length; d++) assert.deepEqual(await names(`digits=${d}&seq=v2`), expected[d], `digits ${d}`);
    assert.deepEqual(await names('digits=16'), expected[13]); // 14자리 이상은 13자리 목록 (설계값)
    assert.deepEqual(await names('accountNumber=3333-12'), expected[6]); // 입력값을 주면 자리수만 센다
    const r = await srv.get('/banks/suggest?digits=13');
    assert.deepEqual(r.body[1], { code: 'KAKAO', name: '카카오뱅크', logo: 'bank-kakao' });
    assert.deepEqual(r.body.map((c) => c.code), ['WOORI', 'KAKAO', 'NH']);
    assert.deepEqual((await srv.get('/banks/suggest?digits=4')).body[1], { code: 'CITI', name: '한국씨티', logo: 'bank-citi' });
    for (const q of ['', 'digits=-1', 'digits=abc', 'digits=4&seq=v1']) assert.equal((await srv.get(`/banks/suggest?${q}`)).status, 400, q);
  });
});

describe('lookup (예금주 · 처음 보내는 계좌)', () => {
  test('카카오뱅크 3333123456789 → 정우진, 처음 보내는 계좌', async () => {
    const r = await srv.post('/lookup', { bankCode: 'KAKAO', accountNumber: '3333123456789' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, {
      holderName: '정우진', bankCode: 'KAKAO', bankName: '카카오뱅크', accountNumber: '3333123456789', logo: 'bank-kakao', firstTime: true,
    });
  });

  test('지역농축협 계좌는 보낸 적 있음, 농협은행을 골라도 지역농축협으로', async () => {
    let r = await srv.post('/lookup', { bankCode: 'NHLOCAL', accountNumber: '12345652789012' });
    assert.deepEqual([r.body.holderName, r.body.bankCode, r.body.bankName, r.body.firstTime], ['정우진', 'NHLOCAL', '지역농축협', false]);
    r = await srv.post('/lookup', { bankCode: 'NH', accountNumber: '1234-5652-789012' });
    assert.deepEqual([r.body.bankCode, r.body.bankName], ['NHLOCAL', '지역농축협']);
    r = await srv.post('/lookup', { bankCode: 'NH', accountNumber: '3021987654321' });
    assert.deepEqual([r.body.holderName, r.body.bankCode, r.body.bankName, r.body.firstTime], ['남궁솔', 'NH', '농협', true]);
  });

  test('없는 계좌 404, 잘못된 입력 400', async () => {
    assert.equal((await srv.post('/lookup', { bankCode: 'KAKAO', accountNumber: '3333000000000' })).status, 404);
    assert.equal((await srv.post('/lookup', { bankCode: 'KB', accountNumber: '3333123456789' })).status, 404);
    for (const b of [
      {}, { bankCode: 'KAKAO' }, { accountNumber: '3333123456789' }, { bankCode: 'XX', accountNumber: '3333123456789' },
      { bankCode: 'KAKAO', accountNumber: '3333abc' }, { bankCode: 'KAKAO', accountNumber: '123' },
      { bankCode: 'KAKAO', accountNumber: '12345678901234567' }, { bankCode: 7, accountNumber: '3333123456789' },
    ]) {
      const r = await srv.post('/lookup', b);
      assert.equal(r.status, 400, JSON.stringify(b));
      assert.ok(r.body.code);
    }
  });
});

describe('dev reset / clock', () => {
  test('시나리오 리셋 v1-start / v2-start / v2-end (+ 별칭), 잘못된 이름 400', async () => {
    const expect = [
      ['v1-start', 'v1-start', 345, 104, 'tx-20261121-110240'],
      ['v2-start', 'v2-start', 344, 105, 'tx-20261121-110911'],
      ['v2-end', 'v2-end', 342, 106, 'tx-20261121-111739'],
      ['v1', 'v1-start', 345, 104, 'tx-20261121-110240'],
      ['v1-end', 'v2-start', 344, 105, 'tx-20261121-110911'],
      ['v2', 'v2-start', 344, 105, 'tx-20261121-110911'],
    ];
    for (const [name, canonical, balance, n, top] of expect) {
      const r = await srv.reset(name);
      assert.equal(r.status, 200, name);
      assert.deepEqual([r.body.ok, r.body.scenario, r.body.balance, r.body.transactions], [true, canonical, balance, n], name);
      assert.equal((await srv.get('/accounts/1')).body.balance, balance);
      assert.equal((await srv.get('/accounts/1/transactions?limit=1&period=1y')).body.items[0].id, top);
    }
    assert.equal((await srv.post('/dev/reset', { scenario: 'middle' })).status, 400);
    assert.equal((await srv.post('/dev/reset', { scenario: 'v1-start', now: 'yesterday' })).status, 400);
  });

  test("now: 'video' = 시나리오의 영상 이체 시각, now 없으면 덮어쓰기 해제", async () => {
    let r = await srv.reset('v1-start', 'video');
    assert.deepEqual([r.body.now, r.body.source], ['2026-11-21T11:09:11', 'override']);
    assert.deepEqual(r.body.clock, { recordStart: '2026-11-21T11:05:58', transferAt: '2026-11-21T11:09:11' });
    r = await srv.reset('v2-start', 'video');
    assert.equal(r.body.now, '2026-11-21T11:17:39');
    r = await srv.reset('v2-start');
    assert.notEqual(r.body.source, 'override');
    r = await srv.post('/dev/clock', { now: '2026-11-21T11:16:14' });
    assert.deepEqual(r.body, { now: '2026-11-21T11:16:14', source: 'override' });
    assert.equal((await srv.get('/health')).body.now, '2026-11-21T11:16:14');
    assert.equal((await srv.get('/dev/clock')).body.now, '2026-11-21T11:16:14');
    assert.equal((await srv.post('/dev/clock', { now: '11:16' })).status, 400);
    r = await srv.post('/dev/clock', { now: null });
    assert.notEqual(r.body.source, 'override');
  });

  test('리셋은 결정적이며 변경(이체·즐겨찾기·삭제)을 모두 되돌린다', async () => {
    const before = (await srv.get('/accounts/1/transactions?limit=200&period=1y')).body;
    await srv.post('/recipients/1/favorite', {});
    await srv.del('/recipients/1');
    srv.db.prepare('UPDATE accounts SET balance = 1').run();
    await srv.reset('v1-start', VIDEO_NOW);
    assert.deepEqual((await srv.get('/accounts/1/transactions?limit=200&period=1y')).body, before);
    assert.equal((await srv.get('/accounts/1')).body.balance, 345);
    assert.equal((await srv.get('/recipients')).body.length, 1);
    assert.deepEqual((await srv.get('/recipients?tab=frequent')).body, []);
  });

  test('WOORI_DISABLE_DEV (enableDev:false) 면 /api/dev 없음', async () => {
    const { startServer: start } = require('./helpers');
    const s = await start(undefined, { enableDev: false });
    try {
      assert.equal((await s.post('/dev/reset', { scenario: 'v2-end' })).status, 404);
      assert.equal((await s.get('/health')).status, 200);
    } finally {
      await s.close();
    }
  });
});
