'use strict';
// 파일 DB 와 실제 서버 프로세스 (server.js): WOORI_DB_PATH · WOORI_API_PORT · WOORI_NOW 환경 변수. 임시 폴더에 만들고 지운다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { openDb, DEFAULT_DB_PATH } = require('../db');
const { resetDb, ensureSeeded } = require('../seed');

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'woori-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** 비어 있는 포트 하나 (4100 이 아닌 것) */
async function freePort() {
  for (;;) {
    const port = await new Promise((resolve, reject) => {
      const s = net.createServer();
      s.once('error', reject);
      s.listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    });
    if (port !== 4100) return port;
  }
}

test('기본 DB 경로는 backend/woori.db', () => {
  assert.equal(DEFAULT_DB_PATH, path.join(__dirname, '..', 'woori.db'));
});

test('파일 DB: 처음 열면 v1-start 로 채우고, 다시 열어도 그대로 (이미 있으면 다시 시드하지 않음)', (t) => {
  const file = path.join(tempDir(t), 'woori.db');
  let db = openDb(file);
  assert.equal(ensureSeeded(db), true);
  resetDb(db, 'v2-end');
  db.close();
  db = openDb(file);
  assert.equal(ensureSeeded(db), false);
  assert.equal(db.prepare('SELECT balance FROM accounts WHERE id = 1').get().balance, 342);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 106);
  db.close();
});

test('server.js: WOORI_API_PORT 로 열고, WOORI_DB_PATH 파일을 쓰고, WOORI_NOW 로 시계 고정', async (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, 'server.db');
  const port = await freePort();
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, WOORI_API_PORT: String(port), WOORI_DB_PATH: file, WOORI_NOW: '2026-11-21T11:09:11', WOORI_SCENARIO: '', WOORI_NO_STATEMENT: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill('SIGTERM'));
  let out = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start: ${out}`)), 10_000);
    child.stdout.on('data', (b) => {
      out += b;
      if (out.includes(`http://localhost:${port}/api`)) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on('data', (b) => (out += b));
    child.on('exit', (code) => reject(new Error(`server exited ${code}: ${out}`)));
  });
  const base = `http://127.0.0.1:${port}/api`;
  const health = await (await fetch(`${base}/health`)).json();
  assert.deepEqual(health, { ok: true, db: 'ok', now: '2026-11-21T11:09:11' });
  const accounts = await (await fetch(`${base}/accounts`)).json();
  assert.equal(accounts[0].balance, 345);
  const list = await (await fetch(`${base}/accounts/1/transactions?limit=1`)).json();
  assert.equal(list.range.text, '2026.08.21 ~ 2026.11.21');
  assert.ok(fs.existsSync(file));
  // SIGTERM 으로 깔끔하게 끝난다
  const code = await new Promise((resolve) => {
    child.removeAllListeners('exit');
    child.on('exit', (c) => resolve(c));
    child.kill('SIGTERM');
  });
  assert.equal(code, 0);
});
