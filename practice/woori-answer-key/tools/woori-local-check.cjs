#!/usr/bin/env node
/**
 * 로컬 모드(서버 없는 APK 용, VITE_WOORI_LOCAL=1) 웹 빌드 확인 — 백엔드 서버 없이 Chromium 으로 연다.
 *
 *   cd frontend && VITE_WOORI_LOCAL=1 npx vite build      # → frontend/dist-apk
 *   node tools/woori-local-check.cjs [--keep]             # 결과 JSON 을 찍고, 하나라도 틀리면 exit 1
 *   WOORI_LOCAL_DIST=<폴더> node tools/woori-local-check.cjs   # 다른 곳에 빌드한 dist-apk 로 (vite build --outDir <폴더>)
 * 포트는 고정하지 않는다 (정적 서버·실제 backend 모두 127.0.0.1 의 빈 포트).
 *
 * 하는 일
 *   1. dist-apk 를 정적 서버(SPA 대체: 모르는 경로 → index.html)로 띄운다. '/api' 로 오는 네트워크 요청은 503 + 횟수 기록 → 0 이어야 한다.
 *   2. 새 브라우저 프로필: 처음 실행 → 시드 v1-start (홈 잔액 345원).
 *   3. fetch 로 이체 흐름 (최근입금계좌 → check → 비밀번호 1234 → 실행 1원) → 201, 잔액 344원.
 *   4. 새로고침, 그리고 브라우저를 닫았다 같은 프로필로 다시 열기 → 잔액 344원·거래 1건 더 (IndexedDB 에 남음).
 *   5. 숨은 메뉴 없음: 화면 맨 위 가운데 5번 탭 → 대화상자 없음. 도구용 /api/dev/reset (v1-start, 영상 시각) → 처음 화면부터 다시 열림 → 345원.
 *   6. 같은 응답인지: 같은 시나리오·같은 시계(now:'video')로 backend/app.js 를 실제 Express(node:sqlite 메모리 DB)로도 띄워
 *      여러 GET 과 이체 흐름의 JSON 을 그대로 비교한다 (로컬 = sql.js + WooriLocalExpress).
 *   7. 저장 실패 흉내 (IndexedDB put 이 던진다 = 기기 저장 공간 부족): 이체 실행 → 507 STORAGE_FAILED(한국어 안내), 메모리 잔액도 그대로
 *      (되돌림) → put 을 되살리면 같은 ticket 으로 다시 이체 201.
 */
'use strict';
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.resolve(process.env.WOORI_LOCAL_DIST || path.join(ROOT, 'frontend', 'dist-apk'));

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    for (const d of [...(process.env.NODE_PATH || '').split(path.delimiter), '/usr/local/lib/node_modules_global'].filter(Boolean)) {
      try {
        return require(path.join(d, 'playwright'));
      } catch {
        /* 다음 */
      }
    }
    throw new Error('playwright 없음 (루트 npm install 또는 NODE_PATH)');
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.webp': 'image/webp',
};

function serveDist() {
  const hits = { api: 0 };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api' || u.pathname.startsWith('/api/')) {
      hits.api++;
      res.writeHead(503, { 'content-type': 'text/plain' });
      return res.end('no server in local mode');
    }
    let file = path.join(DIST, decodeURIComponent(u.pathname));
    if (!file.startsWith(DIST)) file = path.join(DIST, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, hits, base: `http://127.0.0.1:${server.address().port}` })));
}

/** 실제 backend (Express + node:sqlite 메모리 DB) */
async function startRealBackend() {
  const { openDb } = require(path.join(ROOT, 'backend', 'db.js'));
  const { createApp } = require(path.join(ROOT, 'backend', 'app.js'));
  const db = openDb(':memory:');
  const app = createApp({ db, hooks: { silent: true }, enableDev: true });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, p, body) => {
    const res = await fetch(base + p, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { call, close: () => new Promise((r) => server.close(() => { db.close(); r(); })) };
}

/** 페이지 안 fetch (로컬 모드가 가로챈다) */
function pageCall(page) {
  return (method, p, body) =>
    page.evaluate(
      async ({ method, p, body }) => {
        const res = await fetch('/api' + p, {
          method,
          headers: body === undefined ? {} : { 'content-type': 'application/json' },
          body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
        });
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null };
      },
      { method, p, body },
    );
}

/** 이체 1원 (최근입금계좌 첫 행) */
async function transferOne(call) {
  const recips = await call('GET', '/recipients');
  const check = await call('POST', '/transfers/check', { fromAccountId: 1, recipientId: recips.body[0].id, amount: 1 });
  const pin = await call('POST', '/transfers/password', { ticket: check.body.ticket, pin: '1234' });
  const exec = await call('POST', '/transfers', { ticket: check.body.ticket });
  return { check, pin, exec };
}

const PARITY_GETS = [
  '/health',
  '/accounts',
  '/accounts/1',
  '/accounts/1/transactions',
  '/accounts/1/transactions?type=in&limit=5',
  '/accounts/1/transactions?type=out&period=6m&limit=200',
  '/accounts/1/transactions?order=asc&limit=3',
  '/accounts/1/transactions?period=custom&from=2026.10.01&to=2026-10-31',
  '/accounts/1/transactions?type=bogus',
  '/accounts/1/transactions?cursor=zzz',
  '/accounts/9',
  '/transactions/tx-20261121-110240',
  '/transactions/nope',
  '/recipients',
  '/recipients?tab=frequent',
  '/recipients?tab=mine',
  '/recipients?tab=x',
  '/banks',
  '/banks?all=1',
  '/banks?type=securities',
  '/banks/suggest?digits=4',
  '/banks/suggest?accountNumber=3333-1234-56789',
  '/banks/suggest?digits=abc',
  '/dev/clock',
  '/nope?x=1',
];

async function main() {
  const keep = process.argv.includes('--keep');
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`없음: ${DIST} (cd frontend && VITE_WOORI_LOCAL=1 npx vite build)`);
  const { chromium } = loadPlaywright();
  const { server, hits, base } = await serveDist();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'woori-local-'));
  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, ok: !!cond, detail });
  const consoleErrors = [];
  let ctx = null;
  const open = async () => {
    ctx = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 360, height: 800 }, hasTouch: false });
    const page = ctx.pages()[0] || (await ctx.newPage());
    // 7) 저장 실패 흉내에서 WooriLocal 이 남기는 오류 줄은 기대한 것
    page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('[woori-local] 저장 실패') && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(String(e)));
    return page;
  };
  try {
    // 1) 처음 실행
    let page = await open();
    await page.goto(base + '/home', { waitUntil: 'load' });
    let call = pageCall(page);
    const acc0 = await call('GET', '/accounts');
    ok('처음 실행 → 시드 v1-start 잔액 345원', acc0.status === 200 && acc0.body[0].balance === 345, acc0.body?.[0]?.balance);
    const t0 = (await call('GET', '/accounts/1/transactions?limit=1')).body.total;
    await page.waitForFunction(() => /345\s*원/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
    const homeText = await page.evaluate(() => document.body.innerText);
    ok('홈 화면에 345원 (화면 작업 진행 중이면 참고값)', /345\s*원/.test(homeText), (homeText.match(/.{0,20}345.{0,10}/s) || [homeText.slice(0, 80)])[0].replace(/\s+/g, ' '));
    ok('로컬 표시 <html data-woori-local="1">', (await page.evaluate(() => document.documentElement.dataset.wooriLocal)) === '1');

    // 2) 이체 1원 — 처음 실행은 실제 시계라 시드의 1원 이체(2026-11-21)는 그날에만 '오늘 같은 이체'다
    const clock0 = (await call('GET', '/dev/clock')).body;
    const seedDay = clock0.now.slice(0, 10) === '2026-11-21';
    const tr = await transferOne(call);
    ok(
      `이체 check 200 · 중복 경고 ${seedDay ? '있음 (오늘 = 시드 1원 날)' : '없음 (시드 1원은 다른 날)'}`,
      tr.check.status === 200 && !!tr.check.body.duplicate === seedDay,
      `${clock0.now} ${tr.check.body?.display?.duplicateAgo ?? '-'}`,
    );
    ok('비밀번호 1234 → verified', tr.pin.status === 200 && tr.pin.body.state === 'verified');
    ok('이체 실행 201 · 잔액 344원', tr.exec.status === 201 && tr.exec.body.balanceAfter === 344, tr.exec.body?.transaction?.displayName);
    const recips1 = await call('GET', '/recipients');
    const again = await call('POST', '/transfers/check', { fromAccountId: 1, recipientId: recips1.body[0].id, amount: 1 });
    ok('방금 보낸 1원을 또 → 중복 경고 (방금 전)', again.status === 200 && !!again.body.duplicate, again.body?.display?.duplicateAgo);
    const wrong = await call('POST', '/transfers/password', { ticket: tr.check.body.ticket, pin: '0000' });
    ok('이미 끝난 ticket 비밀번호 → backend 와 같은 오류 모양', wrong.status >= 400 && typeof wrong.body.code === 'string', `${wrong.status} ${wrong.body.code}`);
    const badJson = await call('POST', '/transfers/check', '{"x":');
    ok('JSON 깨짐 → 400 INVALID_JSON', badJson.status === 400 && badJson.body.code === 'INVALID_JSON');

    // 3) 새로고침 뒤
    await page.reload({ waitUntil: 'load' });
    call = pageCall(page);
    const acc1 = await call('GET', '/accounts');
    const t1 = (await call('GET', '/accounts/1/transactions?limit=1')).body.total;
    ok('새로고침 뒤 잔액 344원', acc1.body[0].balance === 344, acc1.body[0].balance);
    ok('새로고침 뒤 거래내역 1건 더', t1 === t0 + 1, `${t0} → ${t1}`);

    // 4) 브라우저를 닫았다 다시 열기 (앱 껐다 켜기)
    await ctx.close();
    page = await open();
    await page.goto(base + '/home', { waitUntil: 'load' });
    call = pageCall(page);
    const acc2 = await call('GET', '/accounts');
    const top = (await call('GET', '/accounts/1/transactions?limit=1')).body;
    ok('다시 연 뒤 잔액 344원 (IndexedDB)', acc2.body[0].balance === 344, acc2.body[0].balance);
    ok('다시 연 뒤 맨 위 거래 = 방금 이체 -1원', top.items[0].amount === -1 && top.total === t0 + 1, top.items[0].id);
    const page2 = await call('GET', `/accounts/1/transactions?limit=30`);
    const next = await call('GET', `/accounts/1/transactions?limit=30&cursor=${encodeURIComponent(page2.body.nextCursor)}`);
    ok('커서 다음 쪽 (Buffer base64url 껍데기)', next.status === 200 && next.body.items.length > 0 && next.body.items[0].id !== page2.body.items[0].id, next.body.items?.[0]?.id);

    // 5) 숨은 메뉴는 없다: 맨 위 가운데(예전 메뉴 자리, 앱 x 130–230dp · y 0–44dp) 5번 탭 → 대화상자 없음.
    //    처음 상태로 되돌리기는 도구용 /api/dev/reset (앱 데이터 삭제와 같은 결과) → 처음 화면부터 다시 연다
    const sb = await page.locator('.woori-shell').boundingBox();
    const k = sb.width / 360;
    for (let i = 0; i < 5; i++) await page.mouse.click(sb.x + 180 * k, sb.y + 20 * k, { delay: 20 });
    await page.waitForTimeout(600);
    ok('맨 위 가운데 5번 탭 → 숨은 메뉴 없음', (await page.locator('.woori-local-menu').count()) === 0 && (await page.getByText('시나리오 되돌리기').count()) === 0);
    const rs = await call('POST', '/dev/reset', { scenario: 'v1-start', now: 'video' });
    ok('도구용 되돌리기 POST /dev/reset → 200', rs.status === 200, rs.status);
    await page.evaluate(() => {
      window.__wooriBeforeReset = true;
      for (const store of [sessionStorage, localStorage]) {
        for (const key of Object.keys(store)) if (key.startsWith('woori.')) store.removeItem(key);
      }
      window.location.replace('/');
    });
    await page.waitForFunction(() => !window.__wooriBeforeReset && document.readyState === 'complete', null, { timeout: 10000 });
    call = pageCall(page);
    const acc3 = await call('GET', '/accounts');
    const t3 = (await call('GET', '/accounts/1/transactions?limit=1')).body.total;
    const clk = await call('GET', '/dev/clock');
    ok('되돌리기 뒤 잔액 345원', acc3.body[0].balance === 345, acc3.body[0].balance);
    ok('되돌리기 뒤 거래 수 처음과 같음', t3 === t0, `${t3} (처음 ${t0})`);
    ok('되돌리기 뒤 앱을 처음부터 다시 엶 (새 문서)', await page.evaluate(() => !window.__wooriBeforeReset), page.url());
    ok('영상 시각 고정 (now:video → 11:09:11)', clk.body.now === '2026-11-21T11:09:11' && clk.body.source === 'override', clk.body.now);

    // 6) 실제 backend 와 같은 응답
    const real = await startRealBackend();
    try {
      const pairs = [];
      for (const scenario of ['v1-start', 'v2-end']) {
        const a = await call('POST', '/dev/reset', { scenario, now: 'video' });
        const b = await real.call('POST', '/dev/reset', { scenario, now: 'video' });
        pairs.push([`POST /dev/reset ${scenario}`, a, b]);
        for (const p of PARITY_GETS) pairs.push([`GET ${p}`, await call('GET', p), await real.call('GET', p)]);
        const la = await call('POST', '/lookup', { bankCode: 'KAKAO', accountNumber: '3333123456789' });
        const lb = await real.call('POST', '/lookup', { bankCode: 'KAKAO', accountNumber: '3333123456789' });
        pairs.push(['POST /lookup', la, lb]);
        const fa = await transferOne(call);
        const fb = await transferOne(real.call);
        pairs.push([`이체 check ${scenario}`, fa.check, fb.check], ['이체 password', fa.pin, fb.pin], ['이체 실행', fa.exec, fb.exec]);
        for (const p of ['/accounts', '/accounts/1/transactions?limit=3', '/recipients', `/transfers/${fa.exec.body.transaction.id}`]) {
          pairs.push([`이체 뒤 GET ${p}`, await call('GET', p), await real.call('GET', p)]);
        }
      }
      const diffs = pairs.filter(([, a, b]) => JSON.stringify(a) !== JSON.stringify(b)).map(([n, a, b]) => ({ n, local: JSON.stringify(a).slice(0, 200), real: JSON.stringify(b).slice(0, 200) }));
      ok(`실제 backend(Express+node:sqlite)와 응답 같음 (${pairs.length}쌍)`, diffs.length === 0, diffs.slice(0, 3));
    } finally {
      await real.close();
    }

    // 7) 저장 실패 흉내: 이체 실행 직전에 IndexedDB put 이 던지게 → 507 · 메모리도 되돌림 → 되살린 뒤 같은 ticket 으로 201
    const recips7 = await call('GET', '/recipients');
    const chk7 = await call('POST', '/transfers/check', { fromAccountId: 1, recipientId: recips7.body[0].id, amount: 1 });
    await call('POST', '/transfers/password', { ticket: chk7.body.ticket, pin: '1234' });
    const bal7 = (await call('GET', '/accounts')).body[0].balance;
    await page.evaluate(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      };
      window.__wooriRestorePut = () => {
        IDBObjectStore.prototype.put = put;
      };
    });
    const fail7 = await call('POST', '/transfers', { ticket: chk7.body.ticket });
    const balFail7 = (await call('GET', '/accounts')).body[0].balance;
    await page.evaluate(() => window.__wooriRestorePut());
    ok(
      '저장 실패 → 507 STORAGE_FAILED (한국어 안내) · 메모리 잔액 그대로',
      fail7.status === 507 && fail7.body.code === 'STORAGE_FAILED' && /저장/.test(fail7.body.error) && balFail7 === bal7,
      `${fail7.status} ${fail7.body?.code} ${bal7} → ${balFail7}`,
    );
    const retry7 = await call('POST', '/transfers', { ticket: chk7.body.ticket });
    ok('저장이 되살아나면 같은 ticket 으로 이체 201', retry7.status === 201 && retry7.body.balanceAfter === bal7 - 1, `${retry7.status} ${retry7.body?.balanceAfter}`);
    ok("네트워크로 나간 '/api' 요청 0", hits.api === 0, hits.api);
  } catch (e) {
    ok('예외 없이 끝까지', false, String(e).split('\n')[0]);
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    server.close();
    if (!keep) fs.rmSync(profile, { recursive: true, force: true });
  }
  ok('페이지 오류(pageerror/console.error) 없음', consoleErrors.length === 0, consoleErrors.slice(0, 3));
  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 1));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
