'use strict';
// 개인정보 검사: 실제 이름·계좌 목록(저장소 밖 privacy.json 의 grep 목록)이 backend 의 어느 파일·시드 데이터에도 없어야 한다.
// 목록 자체는 저장소에 두지 않는다 → WOORI_PRIVACY_JSON=<privacy.json 경로> 를 줄 때만 돈다 (없으면 건너뜀).
//   WOORI_PRIVACY_JSON=/path/to/privacy.json npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildSeed } = require('../seed');

const ROOT = path.join(__dirname, '..');
const LIST = process.env.WOORI_PRIVACY_JSON;

function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p));
    else if (!/\.db(-journal|-wal|-shm)?$/.test(e.name)) out.push(p);
  }
  return out;
}

test('backend 파일·시드에 privacy.json grep 목록 문자열이 0건', { skip: LIST ? false : 'WOORI_PRIVACY_JSON 없음 (README 개인정보 절)' }, () => {
  const banned = JSON.parse(fs.readFileSync(LIST, 'utf8')).grep;
  assert.ok(Array.isArray(banned) && banned.length > 0);
  const hits = [];
  const texts = files(ROOT).map((f) => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8')]);
  for (const s of ['v1-start', 'v2-start', 'v2-end']) texts.push([`buildSeed(${s})`, JSON.stringify(buildSeed(s))]);
  for (const [name, text] of texts) for (const b of banned) if (text.includes(b)) hits.push(`${name}: ${b.length}자 문자열`);
  assert.deepEqual(hits, []);
});
