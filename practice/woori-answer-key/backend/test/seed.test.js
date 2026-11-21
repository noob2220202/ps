'use strict';
// 시드(순수 데이터) 검사: 시나리오 잔액, 잔액 연결, 영상 행 84건, 영상 목록 순서, 지어낸 행의 시각 규칙.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../db');
const { buildSeed, ensureSeeded, resolveScenario, VISIBLE_FROM } = require('../seed');
const { dateLine, signedWon, won } = require('../util');

const tx = (s) => `tx-${s}`;

// 영상에서 본 목록 (ledger.json lists — 화면 순서 그대로, id = 'tx-YYYYMMDD-HHMMSS')
const VIDEO_ALL_345 = [
  '20261121-110240', '20261120-213957', '20261120-212947', '20261120-201715', '20261120-185606',
  '20261120-184804', '20261120-164924', '20261120-164730', '20261120-131449', '20261120-121952',
  '20261120-121840', '20261120-095245', '20261120-004415', '20261120-001852', '20261120-000710',
  '20261119-222257', '20261119-215358', '20261119-192631', '20261119-185146', '20261118-185925',
  '20261118-175248', '20261118-174945', '20261118-173915', '20261118-162146', '20261118-140222',
  '20261118-140041', '20261118-132442',
].map(tx);
const VIDEO_DEPOSIT = [
  '20261120-212947', '20261120-184804', '20261120-164730', '20261120-121840', '20261120-095245',
  '20261120-001852', '20261120-000710', '20261119-215358', '20261119-185146', '20261118-175248',
  '20261118-174945', '20261118-162146', '20261118-140041', '20261118-132345', '20261117-210525',
  '20261117-135234', '20261116-135851', '20261115-191530', '20261115-152948', '20261114-164053',
  '20261114-150655', '20261114-123038', '20261114-122844', '20261113-003147', '20261112-232336',
  '20261112-232313',
].map(tx);
const VIDEO_WITHDRAW_345 = [
  '20261121-110240', '20261120-213957', '20261120-201715', '20261120-185606', '20261120-164924',
  '20261120-131449', '20261120-121952', '20261120-004415', '20261119-222257', '20261119-192631',
  '20261118-185925', '20261118-173915', '20261118-140222', '20261118-132442', '20261117-224534',
  '20261116-140332', '20261116-133606', '20261115-193213', '20261115-192508', '20261115-192319',
  '20261115-153141', '20261114-164221', '20261114-150855', '20261114-123118', '20261114-122915',
  '20261113-120707', '20261113-113404', '20261113-091802', '20261113-011632', '20261112-232519',
  '20261112-195745', '20261111-225711', '20261111-215835', '20261109-191704', '20261108-075243',
  '20261107-232210', '20261107-232156', '20261107-190713', '20261107-190658', '20261107-190643',
  '20261106-232604', '20261106-184442', '20261019-004415', '20261013-202936', '20261012-173932',
  '20261012-173840', '20261010-184847', '20261010-182937', '20261010-180428', '20261009-233259',
  '20261009-225944', '20261009-144801', '20261009-085039', '20261009-081039', '20261008-224652',
  '20261008-142456',
].map(tx);

const desc = (rows) => [...rows].reverse();

test('시나리오별 잔액·행 수: v1-start 345원 / v2-start 344원 / v2-end 342원', () => {
  const expect = { 'v1-start': [345, 104], 'v2-start': [344, 105], 'v2-end': [342, 106] };
  for (const [name, [balance, n]] of Object.entries(expect)) {
    const s = buildSeed(name);
    assert.equal(s.scenario, name);
    assert.equal(s.account.balance, balance, name);
    assert.equal(s.transactions.length, n, name);
    assert.equal(s.transactions.at(-1).balanceAfter, balance);
  }
  // inventory.json 의 이름도 받는다
  assert.equal(resolveScenario('v1'), 'v1-start');
  assert.equal(resolveScenario('v1-end'), 'v2-start');
  assert.equal(resolveScenario('v2'), 'v2-start');
  assert.equal(resolveScenario('middle'), null);
  assert.throws(() => buildSeed('middle'), /unknown scenario/);
});

test('잔액이 모든 행에서 이어진다 (잔액[i] = 잔액[i-1] + 금액[i], 시간순, 음수 없음)', () => {
  for (const name of ['v1-start', 'v2-start', 'v2-end']) {
    const rows = buildSeed(name).transactions;
    for (let i = 1; i < rows.length; i++) {
      assert.equal(rows[i].balanceAfter, rows[i - 1].balanceAfter + rows[i].amount, `${name} @ ${rows[i].occurredAt}`);
      assert.ok(rows[i].occurredAt > rows[i - 1].occurredAt);
      assert.ok(rows[i].balanceAfter >= 0);
      assert.equal(rows[i].seq, i + 1);
    }
  }
});

test('영상 행 84건: 입금 26 · 출금 58, 표시 문자열이 ledger 와 같다', () => {
  const rows = buildSeed('v2-end').transactions;
  const video = rows.filter((t) => t.source === 'video');
  assert.equal(video.length, 84);
  assert.equal(video.filter((t) => t.amount > 0).length, 26);
  assert.equal(video.filter((t) => t.amount < 0).length, 58);
  const byId = new Map(rows.map((t) => [t.id, t]));
  // ledger.json display 표본 (dateLine · amount · balance)
  const samples = [
    ['tx-20261121-111739', '카카정우진', '11월 21일 · 11:17:39', '-2원', '잔액 342원'],
    ['tx-20261121-110911', '농협정우진', '11월 21일 · 11:09:11', '-1원', '잔액 344원'],
    ['tx-20261121-110240', '농협정우진', '11월 21일 · 11:02:40', '-1원', '잔액 345원'],
    ['tx-20261120-213957', '카카오페이', '11월 20일 · 21:39:57', '-99,655원', '잔액 346원'],
    ['tx-20261120-212947', '한지호', '11월 20일 · 21:29:47', '+100,000원', '잔액 100,001원'],
    ['tx-20261120-095245', 'KYC1344', '11월 20일 · 09:52:45', '+1원', '잔액 1원'],
    ['tx-20261116-133606', '토스 유하은(', '11월 16일 · 13:36:06', '-4,800원', '잔액 641원'],
    ['tx-20261115-191530', '실시간 이체', '11월 15일 · 19:15:30', '+256,000원', '잔액 256,041원'],
    ['tx-20261107-232156', '토스 정우진_', '11월 7일 · 23:21:56', '-30,000원', '잔액 41원'],
    ['tx-20261106-184442', '토스 (주)앤', '11월 6일 · 18:44:42', '-10,000원', '잔액 41원'],
    ['tx-20261009-081039', '카카오페이', '10월 9일 · 08:10:39', '-1,000,000원', '잔액 3,243,579원'],
    ['tx-20261008-224652', '토뱅 정우진', '10월 8일 · 22:46:52', '-1원', '잔액 4,243,579원'],
    ['tx-20261008-142456', '토뱅 정우진', '10월 8일 · 14:24:56', '-1원', '잔액 17원'],
  ];
  for (const [id, name, line, amount, balance] of samples) {
    const t = byId.get(id);
    assert.ok(t, id);
    assert.equal(t.source, 'video', id);
    assert.deepEqual(
      [t.displayName, dateLine(t.occurredAt), signedWon(t.amount), `잔액 ${won(t.balanceAfter)}`],
      [name, line, amount, balance],
      id,
    );
  }
});

test('영상에서 본 목록이 순서 그대로 맨 위에 온다 (지어낸 행이 끼어들지 않음)', () => {
  const v1 = desc(buildSeed('v1-start').transactions);
  assert.deepEqual(v1.slice(0, 27).map((t) => t.id), VIDEO_ALL_345);
  assert.deepEqual(v1.filter((t) => t.amount > 0).slice(0, 26).map((t) => t.id), VIDEO_DEPOSIT);
  assert.deepEqual(v1.filter((t) => t.amount < 0).slice(0, 56).map((t) => t.id), VIDEO_WITHDRAW_345);
  // v2-start: 맨 위에 11:09:11 한 건이 더해질 뿐
  const v2 = desc(buildSeed('v2-start').transactions);
  assert.deepEqual(v2.slice(0, 28).map((t) => t.id), ['tx-20261121-110911', ...VIDEO_ALL_345]);
  assert.deepEqual(v2.filter((t) => t.amount < 0).slice(0, 57).map((t) => t.id), ['tx-20261121-110911', ...VIDEO_WITHDRAW_345]);
  assert.deepEqual(v2.filter((t) => t.amount > 0).slice(0, 26).map((t) => t.id), VIDEO_DEPOSIT);
  const end = desc(buildSeed('v2-end').transactions);
  assert.deepEqual(end.slice(0, 2).map((t) => t.id), ['tx-20261121-111739', 'tx-20261121-110911']);
});

test('지어낸 행 22건: 영상 범위 밖 시각, 끊김 19곳을 정확히 메움, 9월 출금 3건', () => {
  const rows = buildSeed('v1-start').transactions;
  const syn = rows.filter((t) => t.source === 'synthetic');
  assert.equal(syn.length, 22);
  for (const t of syn) {
    assert.ok(t.note, `${t.id} note`);
    assert.ok(t.occurredAt < VISIBLE_FROM.all, t.id);
    if (t.amount > 0) assert.ok(t.occurredAt < VISIBLE_FROM.deposit, `${t.id} 입금 목록 범위 밖`);
    else assert.ok(t.occurredAt < VISIBLE_FROM.withdraw, `${t.id} 출금 목록 범위 밖`);
  }
  // (c) 9월 출금 3건 — 출금 목록에서 10/8 14:24:56 바로 아래 ('2026년 9월' 머리글 아래)
  const sepOut = syn.filter((t) => t.amount < 0);
  assert.equal(sepOut.length, 3);
  assert.ok(sepOut.every((t) => t.occurredAt.startsWith('2026-09-')));
  const outDesc = desc(rows).filter((t) => t.amount < 0);
  assert.deepEqual(outDesc.slice(56).map((t) => t.id), desc(sepOut).map((t) => t.id));
  // (b) 입금 목록에서 11/12 23:23:13 바로 아래 행 = 11월 12일 +20,000원 (날짜 줄 윗부분만 보인 행)
  const inDesc = desc(rows).filter((t) => t.amount > 0);
  const partial = inDesc[26];
  assert.equal(partial.source, 'synthetic');
  assert.equal(partial.occurredAt.slice(0, 10), '2026-11-12');
  assert.equal(partial.amount, 20_000);
  // (a)+(b) 지어낸 입금을 빼면 영상 행 사이 잔액이 정확히 19곳 끊긴다 — 모두 11/12 23:23:13 이전, 모두 '보이지 않은 입금'(+)
  const visible = rows.filter((t) => t.source !== 'synthetic' || t.amount < 0);
  const breaks = [];
  for (let i = 1; i < visible.length; i++) {
    const gap = visible[i].balanceAfter - visible[i].amount - visible[i - 1].balanceAfter;
    if (gap !== 0) breaks.push({ at: visible[i].occurredAt, gap });
  }
  assert.equal(breaks.length, 19);
  assert.ok(breaks.every((b) => b.gap > 0 && b.at <= VISIBLE_FROM.deposit));
  assert.equal(breaks.reduce((s, b) => s + b.gap, 0), syn.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0));
});

test('상세가 영상에 나온 행은 2건 (입금 한지호 · 이체 농협정우진), 나머지는 설계값', () => {
  const rows = buildSeed('v2-end').transactions;
  assert.deepEqual(rows.filter((t) => t.detailSrc === 'video').map((t) => t.id).sort(), ['tx-20261120-212947', 'tx-20261121-110240']);
  const transfers = rows.filter((t) => t.kind === 'transfer');
  assert.deepEqual(transfers.map((t) => [t.id, t.displayName, t.counterpartyBank, t.counterpartyAccount]), [
    ['tx-20261121-110240', '농협정우진', 'NHLOCAL', '12345652789012'],
    ['tx-20261121-110911', '농협정우진', 'NHLOCAL', '12345652789012'],
    ['tx-20261121-111739', '카카정우진', 'KAKAO', '3333123456789'],
  ]);
});

test('최근입금계좌: v1-start·v2-start 는 정우진 · 지역농축협 1행, v2-end 는 카카오뱅크가 더해짐', () => {
  const pick = (s) => buildSeed(s).recipients.map((r) => [r.id, r.name, r.bankCode, r.digits, r.lastUsedAt]);
  assert.deepEqual(pick('v1-start'), [[1, '정우진', 'NHLOCAL', '12345652789012', '2026-11-21T11:02:40']]);
  assert.deepEqual(pick('v2-start'), [[1, '정우진', 'NHLOCAL', '12345652789012', '2026-11-21T11:09:11']]);
  assert.deepEqual(pick('v2-end'), [
    [1, '정우진', 'NHLOCAL', '12345652789012', '2026-11-21T11:09:11'],
    [2, '정우진', 'KAKAO', '3333123456789', '2026-11-21T11:17:39'],
  ]);
});

test('빈 DB 는 자동으로 v1-start (WOORI_SCENARIO 로 바꿀 수 있음)', () => {
  let db = openDb(':memory:');
  assert.equal(ensureSeeded(db), true);
  assert.equal(db.prepare('SELECT balance FROM accounts WHERE id = 1').get().balance, 345);
  assert.equal(ensureSeeded(db), false); // 이미 있으면 건드리지 않음
  db.close();
  const prev = process.env.WOORI_SCENARIO;
  process.env.WOORI_SCENARIO = 'v2-end';
  try {
    db = openDb(':memory:');
    ensureSeeded(db);
    assert.equal(db.prepare('SELECT balance FROM accounts WHERE id = 1').get().balance, 342);
    db.close();
  } finally {
    if (prev === undefined) delete process.env.WOORI_SCENARIO;
    else process.env.WOORI_SCENARIO = prev;
  }
});
