'use strict';
// 거래 명세(statement.json) 기본 데이터: 시드 변환 · 처음 실행 · 예시 데이터로 · 옛 저장본 한 번 바꾸기.
// 실제 명세는 개인 정보라 저장소에 없다 → 여기서는 작은 가짜 명세를 setStatement 로 넣는다.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { openDb } = require('../db');
const { setStatement } = require('../statement');
const { buildStatementSeed, resetDb, resetMode, ensureSeeded } = require('../seed');

// 최신순. bal = 그 거래 뒤 잔액. 시작 잔액(맨 아래 거래 앞) = 100,000
const FAKE = {
  account: { ownerName: '홍길동', digits: '1002111222333', product: 'WON 통장' },
  balance: 130_000,
  rows: [
    { date: '2026-11-19', kind: '체크우리', text: '카카오페이(택시', out: 5_000, in: null, bal: 130_000, branch: '시너지추진부' },
    { date: '2026-11-19', kind: '타행이체', text: '김민지(친구', out: null, in: 40_000, bal: 135_000, branch: '003019' },
    { date: '2026-11-17', kind: '체크우리', text: '씨유(CU) 그', out: 3_000, in: null, bal: 95_000, branch: '시너지추진부' },
    { date: '2026-11-17', kind: '', text: '월급', out: null, in: 8_000, bal: 98_000, branch: '' },
    { date: '2026-11-16', kind: '타행이체', text: '쿠팡', out: 10_000, in: null, bal: 90_000, branch: '수유동금융센터' },
  ],
};

before(() => setStatement(FAKE));
after(() => setStatement(null));

describe('buildStatementSeed', () => {
  test('계좌 · 거래 · 잔액', () => {
    const s = buildStatementSeed(FAKE);
    assert.equal(s.account.ownerName, '홍길동');
    assert.equal(s.account.digits, '1002111222333');
    assert.equal(s.account.balance, 130_000);
    assert.equal(s.account.badge, null);
    assert.equal(s.account.dailyLimit, null);
    assert.equal(s.transactions.length, 5);
    assert.deepEqual(s.recipients, []);
    // 연결: 과거 → 최신으로 잔액이 이어진다
    let bal = 100_000;
    for (const t of s.transactions) {
      bal += t.amount;
      assert.equal(t.balanceAfter, bal);
    }
  });

  test('같은 날 거래는 PDF 순서(최신 → 과거) 그대로 시각이 이어지고 id 가 겹치지 않는다', () => {
    const s = buildStatementSeed(FAKE);
    const ts = s.transactions.map((t) => t.occurredAt);
    assert.deepEqual([...ts].sort(), ts, '과거 → 최신 순');
    assert.equal(new Set(s.transactions.map((t) => t.id)).size, 5);
    const nov19 = s.transactions.filter((t) => t.occurredAt.startsWith('2026-11-19'));
    assert.equal(nov19[0].displayName, '김민지(친구)'); // 입금이 먼저(더 이른 시각), 택시가 마지막
    assert.equal(nov19[1].displayName, '카카오페이(택시)');
    for (const t of s.transactions) assert.match(t.occurredAt.slice(11), /^(0[89]|1\d|2[01]):/);
  });

  test('종류 · 거래구분 · 관리점 · 잘린 이름 다듬기', () => {
    const s = buildStatementSeed(FAKE);
    const by = (name) => s.transactions.find((t) => t.displayName === name);
    assert.equal(by('쿠팡').kind, 'withdraw');
    assert.equal(by('쿠팡').code, '타행이체');
    assert.equal(by('쿠팡').branch, '수유동금융센터');
    assert.equal(by('김민지(친구)').kind, 'deposit');
    assert.equal(by('김민지(친구)').requester, '김민지(친구)');
    assert.ok(by('씨유(CU)'), "'씨유(CU) 그' → '씨유(CU)'");
    assert.equal(by('월급').code, '지급'); // 적요가 비었으면
    assert.equal(by('월급').branch, '플랫폼사업부'); // 취급점이 비었으면 입금 기본값
  });

  test('잔액이 안 이어지는 명세는 거부', () => {
    const bad = structuredClone(FAKE);
    bad.rows[2].bal = 96_000;
    assert.throws(() => buildStatementSeed(bad), /이어지지 않는다/);
  });
});

describe('처음 실행 · 예시 데이터로 · 옛 저장본', () => {
  let db;
  beforeEach(() => {
    db?.close();
    db = openDb(':memory:');
  });
  after(() => db?.close());

  test('빈 DB → 명세로 채운다', () => {
    assert.equal(ensureSeeded(db), true);
    assert.equal(db.prepare('SELECT balance FROM accounts').get().balance, 130_000);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 5);
    assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'seed_source'").get().value, 'statement');
    assert.equal(ensureSeeded(db), false, '두 번째부터는 건드리지 않는다');
  });

  test('명세 없으면 영상 시드 (잔액 345원)', () => {
    setStatement(null);
    try {
      assert.equal(ensureSeeded(db), true);
      assert.equal(db.prepare('SELECT balance FROM accounts').get().balance, 345);
      assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'seed_source'").get().value, 'video');
    } finally {
      setStatement(FAKE);
    }
  });

  test('명세 기능 전에 저장된 옛 DB(출처 없음)는 한 번 명세로 바꾼다', () => {
    setStatement(null);
    ensureSeeded(db);
    db.prepare("DELETE FROM meta WHERE key = 'seed_source'").run(); // 옛 저장본 흉내
    setStatement(FAKE);
    assert.equal(ensureSeeded(db), true);
    assert.equal(db.prepare('SELECT balance FROM accounts').get().balance, 130_000);
    assert.equal(ensureSeeded(db), false);
  });

  test('영상 시나리오로 리셋하면 출처가 video 로 남아 다시 명세로 안 바뀐다', () => {
    ensureSeeded(db);
    resetDb(db, 'v1-start');
    assert.equal(ensureSeeded(db), false);
    assert.equal(db.prepare('SELECT balance FROM accounts').get().balance, 345);
  });

  test("관리 패널 '예시 데이터로' = 명세, 이름은 지금 이름 유지 · '빈 상태로'는 0원", () => {
    ensureSeeded(db);
    db.prepare('UPDATE accounts SET owner_name = ?').run('바꾼이름');
    resetMode(db, 'empty');
    assert.equal(db.prepare('SELECT balance FROM accounts').get().balance, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 0);
    resetMode(db, 'example');
    const a = db.prepare('SELECT balance, owner_name FROM accounts').get();
    assert.equal(a.balance, 130_000);
    assert.equal(a.owner_name, '바꾼이름');
  });
});
