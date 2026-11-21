#!/usr/bin/env node
/*
 * 앱 화면 스크린샷 + (선택) 영상 기준 프레임과 비교.
 *
 * 폰 뷰포트 360x880 dp(CSS px) 를 deviceScaleFactor 16/11 로 찍어 524x1280 PNG 를 만든다
 * → 영상 프레임(524x1280 frame px)과 1:1 로 겹친다. 앱 URL 에 ?frame=1 이 있어야 상태바 31.333dp·내비 바 48dp 자리와
 *   가로 보정(앱 셸 transform translate(-0.2925px, 0.333px) scaleX(1.0023956))이 들어가 영상과 같은 자리에 그린다 (D1, woori-units.cjs).
 *
 *   node tools/shot.cjs --url "/home?frame=1&shot=top-banner1" --name home/top-banner1
 *        [--ref tools/ref/home/top-banner1.png] [--wait-ms 400] [--keep-anim] [--t 120] [--scenario v1-start|v2-start|v2-end] [--no-reset]
 *        [--click "<selector>"] [--type "<selector>=<text>"] [--press Enter] [--wait "<selector>"]
 *        [--steps '<JSON 배열>'] [--freeze-after-steps] [--mask x,y,w,h|<이름>] [--no-default-mask] [--no-compare] [--boxes-selector "[data-ref]"]
 *        [--dark] [--base http://localhost:5273] [--out tools/out]
 *
 *   node tools/shot.cjs --full [tools/shots.json] [--only home/,send-a/] [--no-merge] [--no-shots-d] [--dark] [--t 0]
 *        -> 목록의 모든 상태를 찍고 비교, <out>/summary.{json,md} + index.html
 *           --only 면 이번에 안 찍은 상태 줄은 같은 <out> 의 이전 summary.json 값을 그대로 두고 비고에 '이전 실행' (--no-merge 면 찍은 줄만)
 *           (tools/shots.d/*.json 이 있으면 shots.json 위에 병합: 같은 name 은 필드 덮어쓰기, 새 name 은 추가)
 *
 * 주소: URL 이 / 로 시작하면 앞에 base 를 붙인다.
 *   base = --base > http://localhost:$WOORI_WEB_PORT > shots 파일의 base > http://localhost:5273
 * 백엔드: 찍기 전에 POST <origin>/api/dev/reset {scenario} (항목의 "scenario", 기본 'v1-start'). --no-reset 으로 끔.
 *   scenario: v1-start (잔액 345원) · v2-start (v1 끝 = v2 시작, 344원) · v2-end (342원) — tools/shots-lib.cjs, backend/seed.js
 * 준비 대기: networkidle -> document.fonts.ready -> 모든 <img> decode ->
 *   window.__WOORI_READY__ (URL 에 shot= 이 있으면 truthy 가 될 때까지 최대 15초, 없으면 대입된 적이 있을 때만) -> --wait-ms
 * 애니메이션:
 *   기본      Playwright animations:'disabled' (유한 애니메이션/트랜지션은 끝 상태, 무한 애니메이션은 처음 상태).
 *             주의: pause() 로 멈춰 둔 유한 CSS 애니메이션도 끝으로 보낸다. 화면이 shot id 마다 중간 위상을 직접 고른다면
 *             pause() 대신 playbackRate = 0 으로 세우거나 항목에 "t" 를 준다
 *   --t <ms>  (항목 "t") __WOORI_READY__ 가 truthy 가 되는 순간 document.getAnimations() 를 전부 pause + currentTime=t,
 *             찍기 직전에 한 번 더 (그 사이 새로 생긴 애니메이션까지). → CSS 애니메이션/트랜지션·WAAPI 만 멈출 수 있다
 *   --freeze-after-steps (항목 "freezeAfterSteps": true, t 필요) steps 가 끝나는 즉시 t 에 멈추고, 찍을 때까지 매 프레임
 *             새로 생기는 애니메이션도 t 에 세운다. 없으면 steps 뒤 networkidle + settle + waitMs(400) 를 기다린 다음에야 멈추므로
 *             그보다 짧은 전환은 이미 끝나 레이어가 사라진 뒤라 t 를 줄 대상이 없다
 *   --keep-anim 그대로 둠
 * 마스크: 상태바 0,0,524,46 · 내비 바 0,1210,524,70 은 기본 (compare.py). 항목 "noDefaultMask": true 로 끔.
 *   마스크는 "x,y,w,h"(frame px) 또는 이름 (keyboard · imeAppearing · rightColumnIso · edgePanelRawOnly).
 * 출력: <out>/<group>/<state>/shot.png, boxes.json (data-ref 요소: frame px + D1 dp + CSS px), console.txt, (비교 시) compare.py 산출물
 *   --dark 이면 ?theme=dark 로 찍기만 한다 (영상은 라이트 모드뿐이라 비교 없음). 기본 출력 폴더 tools/out/dark
 *
 * steps 형식 (JSON 배열, 순서대로 실행):
 *   {"click":"<selector>"} {"tap":[x,y]}(D1 dp, 화면 기준) {"tapPx":[x,y]}(frame px) {"tapCss":[x,y]}(CSS px)
 *   {"type":["<selector>","텍스트"]} {"fill":[sel,text]} {"press":"Enter"} {"wait":"<selector>"} {"waitMs":300}
 *   {"eval":"…"} {"scroll":["<selector>",dy(CSS px)]} {"goto":"/path"}
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const U = require('./woori-units.cjs');
const { loadShots, matchOnly, DEFAULT_SCENARIO, checkScenario } = require('./shots-lib.cjs');

/** playwright: 루트 package.json 의 devDependency (npm run setup). 없으면 NODE_PATH 의 전역 설치 */
function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
  }
  const dirs = [...(process.env.NODE_PATH || '').split(path.delimiter), '/usr/local/lib/node_modules_global'].filter(Boolean);
  for (const d of dirs) {
    try {
      return require(path.join(d, 'playwright'));
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
  }
  console.error('playwright 를 찾을 수 없습니다. woori-answer-key 폴더에서 `npm run setup` 을 먼저 실행하세요 (npm install + npx playwright install chromium).\n' +
    '전역 설치를 쓰려면 NODE_PATH 에 그 node_modules 폴더를 넣는다.');
  process.exit(1);
}
const { chromium } = loadPlaywright();

const TOOLS = __dirname;
const OUT = path.join(TOOLS, 'out');
const REF = path.join(TOOLS, 'ref');
const WEB_PORT_DEFAULT = 5273;

/** 360x880 @16/11 → 524x1280 */
const VIEW = { width: U.VIEWPORT_DP.w, height: U.VIEWPORT_DP.h, scale: U.DSF };

function parseArgs(argv) {
  const a = { click: [], type: [], press: [], wait: [], mask: [], steps: [] };
  const multi = new Set(['click', 'type', 'press', 'wait', 'mask']);
  const flags = ['keep-anim', 'no-compare', 'dark', 'full', 'headed', 'quiet', 'no-images', 'no-reset',
    'no-default-mask', 'no-shots-d', 'freeze-after-steps', 'no-merge'];
  for (let i = 0; i < argv.length; i++) {
    let k = argv[i];
    if (!k.startsWith('--')) { (a._ = a._ || []).push(k); continue; }
    k = k.slice(2);
    let v;
    const eq = k.indexOf('=');
    if (eq > 0 && !multi.has(k.slice(0, eq))) { v = k.slice(eq + 1); k = k.slice(0, eq); }
    if (flags.includes(k)) {
      a[k] = true;
      // --full 다음 인자가 파일이면 받기
      if (k === 'full' && argv[i + 1] && !argv[i + 1].startsWith('--')) a.fullFile = argv[++i];
      continue;
    }
    if (v === undefined) v = argv[++i];
    if (multi.has(k)) a[k].push(v);
    else if (k === 'steps') a.steps = a.steps.concat(JSON.parse(v));
    else a[k] = v;
  }
  return a;
}

const STEP_TIMEOUT = 8000;

async function runSteps(page, steps) {
  for (const s of steps) {
    if (s.click) await page.click(s.click, { timeout: STEP_TIMEOUT });
    else if (s.tap) await page.mouse.click(U.exact.xPx(s.tap[0]) / U.DSF, s.tap[1]); // D1 dp → CSS (?frame=1 셸 기준)
    else if (s.tapPx) await page.mouse.click(s.tapPx[0] / U.DSF, s.tapPx[1] / U.DSF);
    else if (s.tapCss) await page.mouse.click(s.tapCss[0], s.tapCss[1]);
    else if (s.type) { await page.click(s.type[0], { timeout: STEP_TIMEOUT }); await page.keyboard.type(String(s.type[1])); }
    else if (s.fill) await page.fill(s.fill[0], String(s.fill[1]), { timeout: STEP_TIMEOUT });
    else if (s.press) await page.keyboard.press(s.press);
    else if (s.wait) await page.waitForSelector(s.wait, { timeout: STEP_TIMEOUT });
    else if (s.waitMs) await page.waitForTimeout(s.waitMs);
    else if (s.eval) await page.evaluate(s.eval);
    else if (s.scroll) await page.evaluate(([sel, dy]) => { const el = sel ? document.querySelector(sel) : document.scrollingElement; if (el) el.scrollTop += dy; }, s.scroll);
    else if (s.goto) await page.goto(new URL(s.goto, page.url()).href, { waitUntil: 'networkidle' });
    else throw new Error('알 수 없는 step: ' + JSON.stringify(s));
  }
}

/**
 * 페이지 스크립트보다 먼저 실행: __WOORI_SHOT__ 표시 + __WOORI_READY__ 대입을 가로채서
 * (t 가 있으면) truthy 가 되는 순간 모든 애니메이션을 t 에 멈춘다.
 */
function shotInitScript({ t }) {
  window.__WOORI_SHOT__ = true;
  window.__WOORI_SHOT_T__ = t;
  const hook = { assigned: false, t, frozen: -1 };
  hook.freeze = () => {
    if (hook.t == null) return -1;
    let n = 0;
    for (const anim of document.getAnimations()) {
      try { anim.pause(); anim.currentTime = hook.t; n++; } catch { /* 무시 */ }
    }
    hook.frozen = n;
    return n;
  };
  // freezeAfterSteps: 지금 있는 애니메이션을 t 에 멈추고, 찍을 때까지 매 프레임(rAF, 그림 그리기 전) 새로 생긴 것도 t 에 세운다.
  // steps 가 시작시킨 전환은 클릭 뒤 다음 프레임쯤에 생기므로(React 커밋·타이머) 한 번 멈추는 것으로는 놓친다
  hook.hold = () => {
    if (hook.t == null) return -1;
    if (!hook.holding) {
      hook.holding = true;
      const tick = () => { hook.freeze(); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    return hook.freeze();
  };
  window.__WOORI_SHOT_HOOK__ = hook;
  let value;
  Object.defineProperty(window, '__WOORI_READY__', {
    configurable: true,
    enumerable: true,
    get() { return value; },
    set(v) {
      value = v;
      hook.assigned = true;
      if (hook.t == null || !v) return;
      if (typeof v.then === 'function') v.then(() => hook.freeze(), () => {});
      else if (typeof v !== 'function') hook.freeze();
    },
  });
}

async function settle(page, { keepAnim, mustBeReady }) {
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map((im) => (im.complete && im.naturalWidth ? null : im.decode().catch(() => null))));
  }).catch(() => {});
  // window.__WOORI_READY__ : shot= 상태면 반드시, 아니면 대입된 적이 있을 때만 기다림.
  // 판정 함수는 동기 함수여야 한다: async 함수는 Promise(늘 truthy)를 돌려줘 Playwright 가 첫 검사에서 바로 끝낸다
  // (하나 답지에서 옮겨 온 async 판정은 READY 를 기다리지 않았다 — selftest '늦은 READY'). Promise·함수 READY 는 결과를 표에 적어 두고 다음 검사에서 본다
  const ready = await page.waitForFunction((must) => {
    const h = window.__WOORI_SHOT_HOOK__;
    if (h && !h.assigned && !must) return true;
    const seen = (window.__WOORI_READY_SEEN__ = window.__WOORI_READY_SEEN__ || new WeakMap());
    const watch = (key, p) => {
      if (!seen.has(key)) { seen.set(key, false); p.then(() => seen.set(key, true), () => {}); }
      return seen.get(key);
    };
    const r = window.__WOORI_READY__;
    if (r && typeof r.then === 'function') return watch(r, r);
    if (typeof r === 'function') {
      if (seen.has(r)) return seen.get(r);
      const v = r();
      return v && typeof v.then === 'function' ? watch(r, v) : !!v;
    }
    return !!r;
  }, mustBeReady, { timeout: 15000, polling: 50 }).then(() => true, () => false);
  if (!ready) console.warn('  ! __WOORI_READY__ 대기 시간 초과 (15초) — 화면이 준비 표시를 하는지 확인');
  // 안드로이드는 오버레이 스크롤바(정지 상태에서는 안 보임) -> 데스크톱 크롬 스크롤바 숨김
  await page.addStyleTag({ content: '*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}' }).catch(() => {});
  if (!keepAnim) {
    await page.addStyleTag({ content: '*,*::before,*::after{caret-color:transparent!important}' }).catch(() => {});
  }
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  return ready;
}

function compare(shotPath, refPath, outDir, masks, { quiet, noImages, noDefaultMask }) {
  // python3 -I 는 쓰지 않는다: -I 는 사용자 site-packages 를 끄므로 `pip install --user` 로 깐 cv2/numpy 를 못 찾는다
  const args = [path.join(TOOLS, 'compare.py'), shotPath, refPath, outDir];
  const boxes = path.join(outDir, 'boxes.json');
  if (fs.existsSync(boxes)) args.push('--boxes', boxes);
  for (const m of masks || []) args.push('--mask', U.resolveMask(m));
  if (noDefaultMask) args.push('--no-default-mask');
  if (noImages) args.push('--no-images');
  if (quiet) args.push('--quiet');
  const r = spawnSync('python3', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) { console.error('  ! compare.py 실패 (exit ' + r.status + ')'); return null; }
  try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return null; }
}

const resetWarned = new Set();

/** POST <origin>/api/dev/reset {scenario} */
async function resetBackend(origin, scenario) {
  try {
    const res = await fetch(origin + '/api/dev/reset', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario }), signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return null;
  } catch (e) {
    const msg = `${origin}/api/dev/reset {scenario:'${scenario}'} 실패: ${e.message}`;
    if (!resetWarned.has(origin)) {
      console.warn(`  ! ${msg}  (백엔드가 떠 있는지, WOORI_DISABLE_DEV 가 아닌지 확인. --no-reset 으로 끔)`);
      resetWarned.add(origin);
    }
    return msg;
  }
}

async function shootOne(browser, job, opt) {
  const name = job.name;
  if (!name || name.includes('..')) throw new Error(`이상한 name: ${name}`);
  const outDir = path.join(opt.out, name);
  fs.mkdirSync(outDir, { recursive: true });
  let url = job.url.startsWith('/') ? opt.base + job.url : job.url;
  if (opt.dark) { const u = new URL(url); u.searchParams.set('theme', 'dark'); url = u.href; }
  const t = job.t ?? opt.t;
  const tMs = t == null || t === '' ? null : Number(t);
  const keepAnim = !!(job.keepAnim || opt.keepAnim);
  const scenario = checkScenario(job.scenario || opt.scenario || DEFAULT_SCENARIO, `${name}: `);
  const frameMode = /[?&]frame=1(&|$|#)/.test(url);
  const t0 = Date.now();

  const resetError = job.noReset || opt.noReset ? null : await resetBackend(new URL(url).origin, scenario);

  const ctx = await browser.newContext({
    viewport: { width: VIEW.width, height: VIEW.height }, deviceScaleFactor: VIEW.scale, isMobile: false, hasTouch: true,
    colorScheme: opt.dark ? 'dark' : 'light', locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  });
  await ctx.addInitScript(shotInitScript, { t: tMs });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  // AbortController 로 끊은 요청(화면이 닫히거나 StrictMode 의 두 번째 effect)은 오류가 아니다 → [requestaborted]
  page.on('requestfailed', (r) => {
    const why = (r.failure() && r.failure().errorText) || '';
    logs.push(`[${/ERR_ABORTED/.test(why) ? 'requestaborted' : 'requestfailed'}] ${r.url()} ${why}`);
  });
  if (resetError) logs.push('[reset] ' + resetError);
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    logs.push('[goto] ' + e.message);
    console.error(`  ! ${name}: 페이지 로드 실패 ${url}\n    ${e.message.split('\n')[0]}`);
    fs.writeFileSync(path.join(outDir, 'console.txt'), logs.join('\n') + '\n');
    await ctx.close();
    return { name, url, error: 'goto failed' };
  }
  const mustBeReady = /[?&]shot=/.test(url);
  let ready = await settle(page, { keepAnim, mustBeReady });
  const hasSteps = !!(job.steps && job.steps.length);
  const freezeAfterSteps = !!(job.freezeAfterSteps ?? opt.freezeAfterSteps);
  // steps 가 없는 항목은 조용히 넘어간다 (--full 에 --freeze-after-steps 를 주면 steps 있는 항목에만 적용)
  if (freezeAfterSteps && hasSteps && tMs == null) console.warn(`  ! ${name}: freezeAfterSteps 는 t 가 있어야 한다 — 무시`);
  let held = null;
  if (hasSteps) {
    await runSteps(page, job.steps);
    // steps 직후 바로 t 에 멈춘다 (아래 networkidle·settle·waitMs 동안 전환이 끝나 버리지 않게)
    if (freezeAfterSteps && tMs != null) held = await page.evaluate(() => window.__WOORI_SHOT_HOOK__.hold()).catch(() => null);
    await page.waitForLoadState('networkidle').catch(() => {});
    ready = (await settle(page, { keepAnim, mustBeReady: false })) && ready;
  }
  await page.waitForTimeout(Number(job.waitMs ?? opt.waitMs ?? 400));
  let frozen = null;
  if (tMs != null) frozen = await page.evaluate(() => window.__WOORI_SHOT_HOOK__.freeze()).catch(() => null);
  const shotPath = path.join(outDir, 'shot.png');
  await page.screenshot({ path: shotPath, animations: keepAnim || tMs != null ? 'allow' : 'disabled', caret: 'hide', scale: 'device' });
  // 요소 박스 (data-ref / data-box 속성, 또는 --boxes-selector).
  //   getBoundingClientRect 는 transform 까지 반영한 CSS px → frame px = CSS px × 16/11 (x, y 둘 다: 스크린샷 배율)
  //   dp = 그 frame px 를 D1 식으로 (영상에서 잰 dp 와 같은 눈금. ?frame=1 이면 앱 레이아웃 dp 와 같다)
  const sel = job.boxesSelector || opt.boxesSelector || '[data-ref],[data-box]';
  const raw = await page.evaluate((sel) => {
    return Array.from(document.querySelectorAll(sel)).map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute('data-ref') || el.getAttribute('data-box') || el.id || `${el.tagName.toLowerCase()}#${i}`,
        x: r.left, y: r.top, w: r.width, h: r.height };
    }).filter((b) => b.w > 0 && b.h > 0);
  }, sel).catch(() => []);
  const s = VIEW.scale;
  const boxes = raw.map((b) => {
    const fx = b.x * s, fy = b.y * s, fw = b.w * s, fh = b.h * s;
    return { id: b.id, x: U.round3(fx), y: U.round3(fy), w: U.round3(fw), h: U.round3(fh),
      dp: { x: U.xDp(fx), y: U.yDp(fy), w: U.wDp(fw), h: U.hDp(fh) },
      css: { x: U.round3(b.x), y: U.round3(b.y), w: U.round3(b.w), h: U.round3(b.h) } };
  });
  fs.writeFileSync(path.join(outDir, 'boxes.json'), JSON.stringify({
    url, viewport: { width: VIEW.width, height: VIEW.height }, deviceScaleFactor: U.DSF_TEXT, frameMode, scenario, t: tMs,
    note: 'x/y/w/h = frame px (CSS px × 16/11), dp = 그 frame px 의 D1 dp (x_dp = 180 + (x_px − 262.02)/1.45803, y_dp = y_px × 0.6875, 화면 기준), css = getBoundingClientRect CSS px',
    boxes }, null, 1));
  fs.writeFileSync(path.join(outDir, 'console.txt'), logs.join('\n') + (logs.length ? '\n' : ''));
  await ctx.close();
  const errs = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]') || l.startsWith('[requestfailed]'));
  const extra = [scenario !== DEFAULT_SCENARIO ? `scenario ${scenario}` : '',
    tMs != null ? `t=${tMs}ms (애니메이션 ${frozen ?? '?'}개 정지${held != null ? ', steps 직후부터' : ''})` : '',
    ready ? '' : 'READY 없음', errs.length ? `콘솔 오류 ${errs.length}건 -> console.txt` : ''].filter(Boolean).join(', ');
  console.log(`[shot] ${name}  ${url}  (${Date.now() - t0}ms)${extra ? '  ' + extra : ''}`);
  console.log(`       ${shotPath}`);

  let ref = job.ref || opt.ref;
  if (!ref) { const auto = path.join(REF, name + '.png'); if (fs.existsSync(auto)) ref = auto; }
  let metrics = null;
  if (ref && !(job.noCompare || opt.noCompare)) {
    if (!frameMode) console.warn(`  ! ${name}: URL 에 frame=1 이 없다 — 상태바·내비 바 자리와 가로 보정이 없어 영상 프레임과 1:1 이 아니다`);
    if (!fs.existsSync(ref)) console.error(`  ! ref 없음: ${ref}  (python3 tools/ref.py --name ${name} --video v1 --i0 '#..' --i1 '#..' 로 생성)`);
    else metrics = compare(shotPath, ref, outDir, [].concat(job.mask || [], opt.mask || []),
      { quiet: opt.quiet, noImages: opt.noImages, noDefaultMask: !!(job.noDefaultMask || opt.noDefaultMask) });
  }
  return { name, url, ref: ref || null, metrics, consoleErrors: errs.length, scenario, t: tMs, ready, resetError, frameMode };
}

/* ── 요약 ─────────────────────────────────────────────── */

const sign = (v, d) => (v > 0 ? '+' : '') + (Math.round(v * 10 ** d) / 10 ** d).toFixed(d);
/** 오프셋 → { px:'(+3.0,+5.0)', dp:'(+2.06,+3.44)' } (믿을 수 없으면 '?'). dp 는 compare.py 의 dxDp(÷1.45803)·dyDp(×0.6875) */
function offStr(o) {
  if (!o) return { px: '', dp: '' };
  if (o.dx == null || o.reliable === false) return { px: '?', dp: '?' };
  return { px: `(${sign(o.dx, 1)},${sign(o.dy, 1)})`, dp: `(${sign(o.dxDp, 2)},${sign(o.dyDp, 2)})` };
}

function summaryRows(results) {
  return results.map((r) => {
    const m = r.metrics || {};
    const wb = (m.worstBands || [])[0];
    const g = offStr(m.globalOffset);
    const w = wb ? offStr(wb.offset) : { px: '', dp: '' };
    return {
      name: r.name, url: r.url, error: r.error || null, consoleErrors: r.consoleErrors || 0,
      scenario: r.scenario || null, t: r.t ?? null, ready: r.ready ?? null, frameMode: r.frameMode ?? null,
      meanAbsDiff: m.meanAbsDiff ?? null, pctPixelsOver24: m.pctPixelsOver24 ?? null,
      globalOffsetPx: g.px, globalOffsetDp: g.dp,
      worstBandY: wb ? { px: wb.y0, dp: wb.y0Dp } : null, worstBandOffsetPx: w.px, worstBandOffsetDp: w.dp,
    };
  });
}

function summaryTable(rows) {
  const head = ['| 상태 | meanAbsDiff | %>24 | 전역 오프셋 px | dp | 최악 띠 y px (dp) | 띠 오프셋 px | dp | 비고 |',
    '|---|---:|---:|---|---|---|---|---|---|'];
  return head.concat(rows.map((r) => {
    const note = [r.error, r.scenario && r.scenario !== DEFAULT_SCENARIO ? r.scenario : '', r.t != null ? `t=${r.t}` : '',
      r.ready === false ? 'READY 없음' : '', r.frameMode === false ? 'frame=1 없음' : '', r.consoleErrors ? `콘솔 오류 ${r.consoleErrors}` : '',
      r.previous ? '이전 실행' : ''].filter(Boolean).join(' ');
    const band = r.worstBandY ? `${r.worstBandY.px} (${r.worstBandY.dp})` : '';
    return `| ${r.name} | ${r.meanAbsDiff ?? '-'} | ${r.pctPixelsOver24 ?? '-'} | ${r.globalOffsetPx} | ${r.globalOffsetDp} | ${band} | ${r.worstBandOffsetPx} | ${r.worstBandOffsetDp} | ${note} |`;
  }));
}

/**
 * --only 로 일부만 찍었을 때: 이번에 안 찍은 상태는 같은 out 의 이전 summary.json 줄을 그대로 둔다 (previous: true).
 * 그래야 tools/out/summary.md 가 한 줄짜리 표로 바뀌지 않는다. 순서는 등록 순서, 등록에서 빠진 이름은 버린다.
 */
function mergePrevious(rows, out, names) {
  let prev;
  try { prev = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8')); } catch { return rows; }
  if (!Array.isArray(prev)) return rows;
  const fresh = new Map(rows.map((r) => [r.name, r]));
  const old = new Map(prev.filter((r) => r && r.name && !fresh.has(r.name)).map((r) => [r.name, { ...r, previous: true }]));
  return names.map((n) => fresh.get(n) || old.get(n)).filter(Boolean);
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function writeSummary(results, opt) {
  const out = opt.out;
  fs.mkdirSync(out, { recursive: true });
  const shotRows = summaryRows(results);
  const rows = opt.mergeNames ? mergePrevious(shotRows, out, opt.mergeNames) : shotRows;
  const kept = rows.filter((r) => r.previous).length;
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(rows, null, 1));
  const md = summaryTable(rows);
  const head = '오프셋 = 앱 위치 − 영상 위치. px = 영상 frame px, dp = 가로 px ÷ 1.45803 · 세로 px × 0.6875 (D1)\n' +
    (kept ? `--only 실행: 이번에 찍은 ${rows.length - kept}개 + 이전 실행 값 ${kept}개 (비고 '이전 실행')\n` : '');
  fs.writeFileSync(path.join(out, 'summary.md'), head + '\n' + md.join('\n') + '\n');
  // 갤러리
  const cards = rows.map((r) => {
    const d = encodeURI(r.name);
    const img = (f) => `<a href="${d}/${f}"><img loading="lazy" src="${d}/${f}" alt="${f}"></a>`;
    const has = (f) => fs.existsSync(path.join(out, r.name, f));
    return `<section><h2>${esc(r.name)} <small>${r.meanAbsDiff ?? '-'} / ${r.pctPixelsOver24 ?? '-'}% · 전역 ${esc(r.globalOffsetPx)}px ${esc(r.globalOffsetDp)}dp</small></h2>
<div class="row">${['shot.png', 'onion.png', 'edges.png', 'diff.png', 'elements.png'].filter(has).map(img).join('')}</div></section>`;
  }).join('\n');
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Woori shots</title>
<style>body{font:14px system-ui;background:#181a1f;color:#ddd;margin:16px}h2{font-size:15px;margin:18px 0 6px}small{color:#9ab;font-weight:400}
.row{display:flex;gap:8px;overflow-x:auto}.row img{width:262px;height:640px;object-fit:contain;background:#000}</style>
<h1>Woori answer-key shots</h1>${cards || '<p>상태 없음</p>'}`);
  console.log('\n' + summaryTable(shotRows).join('\n'));
  if (kept) console.log(`\n[summary] --only: 이전 실행 값 ${kept}개를 그대로 두고 합침 (--no-merge 면 찍은 줄만)`);
  console.log(`\n[summary] ${path.join(out, 'summary.md')}  /  ${path.join(out, 'index.html')}`);
}

/* ── 실행 ─────────────────────────────────────────────── */

(async () => {
  const a = parseArgs(process.argv.slice(2));
  const envBase = process.env.WOORI_WEB_PORT ? `http://localhost:${process.env.WOORI_WEB_PORT}` : null;
  const opt = {
    base: a.base || envBase, out: path.resolve(a.out || (a.dark ? path.join(OUT, 'dark') : OUT)), waitMs: a['wait-ms'],
    keepAnim: !!a['keep-anim'], dark: !!a.dark, t: a.t,
    freezeAfterSteps: a['freeze-after-steps'] ? true : undefined,
    scenario: a.scenario, noReset: !!a['no-reset'], noDefaultMask: !!a['no-default-mask'],
    noCompare: !!a['no-compare'] || !!a.dark, quiet: !!a.quiet, noImages: !!a['no-images'], mask: a.mask,
    boxesSelector: a['boxes-selector'], ref: a.ref,
  };
  try {
    if (opt.scenario) checkScenario(opt.scenario, '--');
    for (const m of opt.mask) U.resolveMask(m);
  } catch (e) { console.error(e.message); process.exit(1); }
  let jobs;
  if (a.full) {
    const file = a.fullFile || a.shots || path.join(TOOLS, 'shots.json');
    const { shots, base, overlays, missing } = loadShots(file, { dir: a['no-shots-d'] ? false : a['shots-d'] });
    if (missing) console.log(`[shots] ${path.relative(process.cwd(), file) || file} 없음 (node tools/gen-from-spec.cjs --shots 로 만든다) — shots.d 만 읽음`);
    for (const o of overlays) console.log(`[shots.d] ${path.relative(process.cwd(), o.file)}: 덮어쓰기 ${o.overridden}, 추가 ${o.added}`);
    jobs = shots.filter((j) => matchOnly(j.name, a.only));
    if (a.only && !a['no-merge']) opt.mergeNames = shots.map((j) => j.name);
    if (!opt.base) opt.base = base;
    opt.ref = undefined; // 배치에서는 job 별 ref 또는 자동 ref
    if (!jobs.length) {
      // 화면이 아직 없을 때: 오류가 아니라 빈 요약
      console.log(a.only ? `찍을 상태가 없음 (--only ${a.only})` : '찍을 상태가 없음 (shots.json · shots.d 가 비어 있다)');
      if (!a.only) writeSummary([], opt);
      process.exit(a.only ? 1 : 0);
    }
  } else {
    if (!a.url || !a.name) {
      console.error('사용법: node tools/shot.cjs --url <URL 또는 /경로> --name <group>/<state> [--ref ref.png] [--t ms] [--scenario v1-start|v2-start|v2-end]\n' +
        '        node tools/shot.cjs --full [tools/shots.json] [--only <prefix,prefix>] [--no-merge] [--dark]');
      process.exit(1);
    }
    const steps = [].concat(a.steps || [],
      a.click.map((c) => ({ click: c })),
      // "<selector>=<text>" : selector 안에도 = 가 있을 수 있으므로 마지막 = 기준 ("::" 로 나눠도 됨)
      a.type.map((t) => { const j = t.indexOf('::'); const i = j >= 0 ? j : t.lastIndexOf('=');
        return { type: [t.slice(0, i), t.slice(i + (j >= 0 ? 2 : 1))] }; }),
      a.press.map((p) => ({ press: p })),
      a.wait.map((w) => ({ wait: w })));
    jobs = [{ name: a.name, url: a.url, steps }];
  }
  opt.base = (opt.base || `http://localhost:${WEB_PORT_DEFAULT}`).replace(/\/+$/, '');
  const browser = await chromium.launch({ headless: !a.headed });
  const results = [];
  try {
    for (const j of jobs) {
      try { results.push(await shootOne(browser, j, opt)); }
      catch (e) { console.error(`  ! ${j.name}: ${e.message.split('\n')[0]}`); results.push({ name: j.name, url: j.url, error: e.message.split('\n')[0] }); }
    }
  } finally { await browser.close(); }
  if (a.full) writeSummary(results, opt);
  else if (results[0] && results[0].metrics) console.log(summaryTable(summaryRows(results)).join('\n'));
  process.exit(results.some((r) => r.error) ? 1 : 0);
})();
