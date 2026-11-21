#!/usr/bin/env node
/*
 * 개발 서버 한 번에: 백엔드(Express) + 프론트엔드(Vite) 를 이 터미널에서 같이 띄운다.
 *   npm run dev:woori                         # 루트(woori-answer-key/)에서
 *   WOORI_WEB_PORT=5280 WOORI_API_PORT=4110 npm run dev:woori
 *   node tools/dev-woori.cjs --install        # npm run setup 의 한 단계: backend/·frontend/ 에 npm install (없는 쪽은 건너뜀)
 *
 * 로그는 줄마다 [api] / [web] 를 붙여 섞어서 보여 준다. Ctrl+C 한 번이면 둘 다 끈다.
 * 하나가 죽으면 나머지도 끄고 같은 종료 코드로 끝난다. backend/ · frontend/ 가 아직 없으면(package.json 없음) 그 쪽은 건너뛴다.
 *
 * 환경 변수: WOORI_WEB_PORT (기본 5273), WOORI_API_PORT (기본 4100), WOORI_DB_PATH (기본 backend/woori.db),
 *           WOORI_NOW, WOORI_DISABLE_DEV 는 백엔드에 그대로 전달된다.
 * OS 무관: npm·셸 없이 node 로 직접 띄운다 (Windows 의 npm 은 npm.cmd 라 shell 없이 spawn 하면 실패한다).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.dirname(__dirname);
const WEB_PORT = process.env.WOORI_WEB_PORT || '5273';
const API_PORT = process.env.WOORI_API_PORT || '4100';
const WIN = process.platform === 'win32';
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);

const PARTS = [
  { name: 'backend', tag: paint(36, '[api]'), dir: path.join(ROOT, 'backend') },
  { name: 'frontend', tag: paint(35, '[web]'), dir: path.join(ROOT, 'frontend') },
];
const present = (p) => fs.existsSync(path.join(p.dir, 'package.json'));

/* ── --install: backend/ · frontend/ npm install ─────────── */
if (process.argv.includes('--install')) {
  let bad = 0;
  for (const p of PARTS) {
    if (!present(p)) { console.log(`[setup] ${p.name}/package.json 없음 — 아직 만들지 않았으므로 건너뜀`); continue; }
    console.log(`[setup] npm install (${p.name}/)`);
    const npmJs = process.env.npm_execpath && /\.c?js$/.test(process.env.npm_execpath) ? process.env.npm_execpath : null;
    const r = npmJs
      ? spawnSync(process.execPath, [npmJs, 'install', '--no-audit', '--no-fund'], { cwd: p.dir, stdio: 'inherit' })
      : spawnSync(WIN ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: p.dir, stdio: 'inherit', shell: WIN });
    if (r.status !== 0) { console.error(`[setup] ${p.name}: npm install 실패 (${r.error ? r.error.code : 'exit ' + r.status})`); bad++; }
  }
  process.exit(bad ? 1 : 0);
}

/* ── 개발 서버 ───────────────────────────────────────── */
const procs = [];
for (const p of PARTS) {
  if (!present(p)) { console.log(`${p.tag} ${p.name}/package.json 없음 — 아직 만들지 않았으므로 건너뜀`); continue; }
  if (!fs.existsSync(path.join(p.dir, 'node_modules'))) {
    console.error(`${p.tag} ${p.name}/node_modules 가 없다 → 먼저 npm run setup (또는 npm --prefix ${p.name} install)`);
    process.exit(1);
  }
  if (p.name === 'backend') {
    procs.push({ ...p, cmd: process.execPath, args: ['--disable-warning=ExperimentalWarning', 'server.js'], env: { PORT: API_PORT } });
  } else {
    const vite = path.join(p.dir, 'node_modules', 'vite', 'bin', 'vite.js');
    if (!fs.existsSync(vite)) { console.error(`${p.tag} ${path.relative(ROOT, vite)} 가 없다 → npm --prefix frontend install`); process.exit(1); }
    procs.push({ ...p, cmd: process.execPath, args: [vite, '--port', WEB_PORT, '--strictPort'], env: {} });
  }
}
if (!procs.length) {
  console.log('[dev:woori] 띄울 것이 없다 (backend/ · frontend/ 가 아직 없음)');
  process.exit(0);
}

console.log(`${paint(1, 'dev:woori')}  web http://localhost:${WEB_PORT}  ·  api http://localhost:${API_PORT}/api  ·  DB ${process.env.WOORI_DB_PATH || 'backend/woori.db'}`);
console.log('           Ctrl+C 로 둘 다 종료');

let stopping = false;
let exitCode = 0;

/** 자식 출력 → 줄 단위로 태그 붙여 출력 */
function pipe(stream, tag, out) {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buf += chunk;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) out.write(`${tag} ${line}\n`);
  });
  stream.on('end', () => { if (buf) out.write(`${tag} ${buf}\n`); });
}

for (const p of procs) {
  p.child = spawn(p.cmd, p.args, {
    cwd: p.dir,
    env: { ...process.env, WOORI_WEB_PORT: WEB_PORT, WOORI_API_PORT: API_PORT, FORCE_COLOR: color ? '1' : '0', ...p.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipe(p.child.stdout, p.tag, process.stdout);
  pipe(p.child.stderr, p.tag, process.stderr);
  p.child.on('exit', (code, signal) => {
    p.exited = true;
    if (!stopping) {
      console.error(`${p.tag} 종료됨 (${signal || 'code ' + code}) → 나머지도 끈다`);
      exitCode = code || 1;
      stopAll();
    }
    if (procs.every((q) => q.exited)) process.exit(exitCode);
  });
}

function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (!p.exited) p.child.kill('SIGTERM');
  // 3초 안에 안 꺼지면 강제 종료
  setTimeout(() => {
    for (const p of procs) if (!p.exited) p.child.kill('SIGKILL');
    process.exit(exitCode);
  }, 3000).unref();
}

process.on('SIGINT', () => { console.log('\n[dev:woori] 종료 중…'); stopAll(); });
process.on('SIGTERM', stopAll);
process.on('SIGHUP', stopAll);
