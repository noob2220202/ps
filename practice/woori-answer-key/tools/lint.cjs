#!/usr/bin/env node
/*
 * npm run lint (루트) 의 본체:
 *   1) 프론트엔드: frontend/package.json 의 "lint" 스크립트 (없으면 "typecheck")
 *   2) 백엔드: backend/ 의 모든 .js 를 node --check (문법 검사)
 *   3) 도구: tools/*.cjs node --check, tools/*.py 문법 검사 (python 이 없으면 SKIP — 비교 도구 전용이라), tools/*.sh bash -n
 *   4) JSON: tools/shots.json · tools/shots.d/*.json · spec/**.json 이 읽히는지
 * 하나라도 실패하면 exit 1. frontend/ · backend/ 가 아직 없으면(package.json 없음) 그 단계는 SKIP.
 *
 * OS 무관 (dev-woori.cjs 와 같은 방식): 프론트 lint 는 npm·셸 없이 `node <패키지 bin>.js` 로 직접 돌린다.
 * Windows 의 npm 은 npm.cmd 라서 shell 없이 spawn 하면 ENOENT/EINVAL 이 나기 때문이다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.dirname(__dirname);
const TOOLS = path.join(ROOT, 'tools');
const WIN = process.platform === 'win32';
let failed = 0;

function step(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
}
const skip = (label, why) => console.log(`SKIP  ${label}  (${why})`);

/** 실패 이유 한 줄 (프로세스를 못 띄웠으면 error.code, 아니면 종료 코드) */
const why = (r) => (r.error ? `(${r.error.code || r.error.message})` : r.status === 0 ? '' : `(exit ${r.status ?? r.signal})`);

/** dir 아래 ext 파일 (node_modules · 점 폴더 · skipDirs 이름 제외) */
function files(dir, ext, skipDirs = []) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!skipDirs.includes(path.relative(dir, p).split(path.sep)[0])) walk(p); }
      else if (ext.some((x) => e.name.endsWith(x))) out.push(p);
    }
  })(dir);
  return out.sort();
}

// 1) 프론트엔드
const fe = path.join(ROOT, 'frontend');
if (!fs.existsSync(path.join(fe, 'package.json'))) {
  skip('frontend lint', 'frontend/package.json 없음 — 아직 만들지 않음');
} else {
  const scripts = JSON.parse(fs.readFileSync(path.join(fe, 'package.json'), 'utf8')).scripts || {};
  const feScript = scripts.lint ? 'lint' : scripts.typecheck ? 'typecheck' : null;
  if (!feScript) {
    skip('frontend lint', 'package.json 에 lint/typecheck 스크립트 없음');
  } else if (!fs.existsSync(path.join(fe, 'node_modules'))) {
    step(`frontend npm run ${feScript}`, false, '(frontend/node_modules 없음 → 루트에서 npm run setup)');
  } else {
    console.log(`[lint] frontend: npm run ${feScript} (${scripts[feScript]})`);
    /** 명령 이름 → 그 bin 이 든 패키지 (tsc 는 typescript 패키지) */
    const BIN_PACKAGE = { eslint: 'eslint', tsc: 'typescript' };
    /** "eslint ." 같은 단순 스크립트면 [bin.js 경로, ...인자], 아니면 null (&& · | 등이 있거나 모르는 명령) */
    const directBin = (cmd) => {
      if (!cmd || /[&|;<>$`"']/.test(cmd)) return null;
      const [name, ...args] = cmd.trim().split(/\s+/);
      const pkg = BIN_PACKAGE[name];
      if (!pkg) return null;
      const pj = path.join(fe, 'node_modules', pkg, 'package.json');
      if (!fs.existsSync(pj)) return null;
      const bin = JSON.parse(fs.readFileSync(pj, 'utf8')).bin;
      const rel = typeof bin === 'string' ? bin : bin && bin[name];
      return rel ? [path.join(fe, 'node_modules', pkg, rel), ...args] : null;
    };
    const direct = directBin(scripts[feScript]);
    let r;
    if (direct) r = spawnSync(process.execPath, direct, { cwd: fe, stdio: 'inherit' });
    else if (process.env.npm_execpath && /\.c?js$/.test(process.env.npm_execpath)) {
      // npm run lint 로 불렸으면 그 npm 의 js 를 node 로 직접
      r = spawnSync(process.execPath, [process.env.npm_execpath, 'run', feScript], { cwd: fe, stdio: 'inherit' });
    } else r = spawnSync(WIN ? 'npm.cmd' : 'npm', ['run', feScript], { cwd: fe, stdio: 'inherit', shell: WIN });
    step(`frontend npm run ${feScript}`, r.status === 0, why(r));
  }
}

// 2) 백엔드 + 3) 도구
const checkNode = (list, label) => {
  const bad = list.filter((f) => spawnSync(process.execPath, ['--check', f], { stdio: ['ignore', 'ignore', 'inherit'] }).status !== 0);
  step(`${label} node --check (${list.length}개)`, bad.length === 0, bad.map((f) => path.relative(ROOT, f)).join(' '));
};
const be = path.join(ROOT, 'backend');
if (!fs.existsSync(path.join(be, 'package.json'))) skip('backend node --check', 'backend/package.json 없음 — 아직 만들지 않음');
else checkNode(files(be, ['.js', '.cjs', '.mjs']), 'backend');
checkNode(files(TOOLS, ['.cjs'], ['out', 'ref']), 'tools');

// python 3 찾기: python3 → python → py -3 (Windows). 종료 코드 0 이어야 한다 (Windows 스토어 가짜 python 은 9009)
const py = fs.readdirSync(TOOLS).filter((f) => f.endsWith('.py')).map((f) => path.join(TOOLS, f));
const PY_CANDIDATES = [['python3'], ['python'], ...(WIN ? [['py', '-3']] : [])];
const pyCmd = PY_CANDIDATES.find(([c, ...a]) =>
  spawnSync(c, [...a, '-c', 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)'], { stdio: 'ignore' }).status === 0);
if (!pyCmd) {
  skip(`tools python 문법 (${py.length}개)`, 'python 3 없음 — 비교 도구(ref.py/compare.py) 전용, 앱·백엔드와 무관');
} else {
  const pr = spawnSync(pyCmd[0], [...pyCmd.slice(1), '-I', '-c', 'import ast,sys\nfor f in sys.argv[1:]: ast.parse(open(f, encoding="utf-8").read(), f)', ...py],
    { stdio: 'inherit' });
  step(`tools python 문법 (${py.length}개, ${pyCmd.join(' ')})`, pr.status === 0, why(pr));
}

// 셸 스크립트 (bash 가 있을 때)
const sh = fs.readdirSync(TOOLS).filter((f) => f.endsWith('.sh')).map((f) => path.join(TOOLS, f));
if (spawnSync('bash', ['-c', 'exit 0'], { stdio: 'ignore' }).status !== 0) skip(`tools 셸 문법 (${sh.length}개)`, 'bash 없음');
else {
  const bad = sh.filter((f) => spawnSync('bash', ['-n', f], { stdio: ['ignore', 'ignore', 'inherit'] }).status !== 0);
  step(`tools 셸 문법 bash -n (${sh.length}개)`, bad.length === 0, bad.map((f) => path.relative(ROOT, f)).join(' '));
}

// 4) JSON
const jsonFiles = [path.join(TOOLS, 'shots.json'), ...files(path.join(TOOLS, 'shots.d'), ['.json']), ...files(path.join(ROOT, 'spec'), ['.json'])]
  .filter((f) => fs.existsSync(f));
const badJson = jsonFiles.filter((f) => { try { JSON.parse(fs.readFileSync(f, 'utf8')); return false; } catch (e) { console.error(`  ${path.relative(ROOT, f)}: ${e.message}`); return true; } });
step(`JSON 읽기 (${jsonFiles.length}개: tools/shots*.json, spec/)`, badJson.length === 0, badJson.map((f) => path.relative(ROOT, f)).join(' '));

console.log(failed ? `\nlint: 실패 ${failed}건` : '\nlint OK');
process.exit(failed ? 1 : 0);
