// 상태 레지스트리 읽기: tools/shots.json (생성물) + tools/shots.d/*.json (화면 담당자가 고치는 덧붙임) 병합.
//
//   shots.d/<group>.json = 항목 배열 (또는 {"shots":[…]})
//     - 같은 name 이 shots.json 에 있으면 그 항목의 필드를 덮어쓴다 (얕은 병합. "mask" 도 통째로 바뀐다)
//       "maskAdd": [...] 는 기존 mask 뒤에 덧붙인다
//     - 없는 name 이면 새 항목으로 뒤에 붙는다 (url 필수)
//   파일은 이름순으로 적용된다. "_comment" 같은 '_' 로 시작하는 필드는 무시한다.
//   tools/ref.py 의 load_shots 가 같은 규칙을 파이썬으로 따른다 (selftest 가 두 결과가 같은지 검사).
//
// 백엔드 시나리오 (shot 전에 POST /api/dev/reset {scenario}, backend/seed.js 와 같은 이름). 영상 데이터가 이어진다:
//   v1-start  v1 녹화 시작: 잔액 345원 (기본)
//   v2-start  v1 의 1원 이체 뒤 = v2 녹화 시작: 잔액 344원
//   v2-end    v2 의 2원 이체 뒤: 잔액 342원
//   별칭(백엔드도 받는다): v1 → v1-start, v1-end · v2 → v2-start. 레지스트리에는 정식 이름을 쓴다.
'use strict';
const fs = require('fs');
const path = require('path');

const SCENARIOS = Object.freeze({
  'v1-start': 'v1 녹화 시작 — 잔액 345원 (v1 의 1원 이체 전)',
  'v2-start': 'v1 끝 = v2 녹화 시작 — 잔액 344원',
  'v2-end': 'v2 끝 — 잔액 342원 (v2 의 2원 이체 뒤)',
});
const SCENARIO_ALIASES = Object.freeze({ v1: 'v1-start', 'v1-end': 'v2-start', v2: 'v2-start' });
const DEFAULT_SCENARIO = 'v1-start';
/** 영상 속 이체가 화면에 반영되는 시각 (완료 화면 첫 프레임: v1 #7429 193.407s, v2 #3291 86.237s). 이 시각부터 다음 시나리오 */
const SCENARIO_SWITCH = Object.freeze({
  v1: { t: 193.407, before: 'v1-start', after: 'v2-start' },
  v2: { t: 86.237, before: 'v2-start', after: 'v2-end' },
});

/** 상태의 기준 구간(영상, 시작 시각 초) → 기본 시나리오 */
function scenarioFor(video, t0) {
  const s = SCENARIO_SWITCH[video];
  if (!s || typeof t0 !== 'number') return DEFAULT_SCENARIO;
  return t0 >= s.t ? s.after : s.before;
}

/** 시나리오 이름 검사 → 정식 이름 (별칭은 바꿔 준다. 모르면 throw) */
function checkScenario(name, where = '') {
  const s = Object.hasOwn(SCENARIO_ALIASES, name) ? SCENARIO_ALIASES[name] : name;
  if (!Object.hasOwn(SCENARIOS, s)) {
    throw new Error(`${where}scenario '${name}' 는 모른다 — ${Object.keys(SCENARIOS).join(' | ')} (별칭 ${Object.keys(SCENARIO_ALIASES).join(', ')}; tools/shots-lib.cjs)`);
  }
  return s;
}

function readEntries(file) {
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(j) ? j : j.shots;
  if (!Array.isArray(list)) throw new Error(`${file}: 배열(또는 {"shots":[…]})이어야 한다`);
  return list;
}

const clean = (e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('_')));

/**
 * @param {string} file shots.json 경로 (없으면 빈 목록 + shots.d 만)
 * @param {{dir?: string|false}} [opt] dir: 덧붙임 폴더 (기본 <file 폴더>/shots.d, false 면 안 읽음)
 * @returns {{ shots: object[], base?: string, overlays: {file:string, overridden:number, added:number}[], missing: boolean }}
 */
function loadShots(file, opt = {}) {
  const missing = !fs.existsSync(file);
  const raw = missing ? { shots: [] } : JSON.parse(fs.readFileSync(file, 'utf8'));
  const shots = (Array.isArray(raw) ? raw : raw.shots || []).map(clean);
  const base = Array.isArray(raw) ? undefined : raw.base;
  const dir = opt.dir === false ? null : opt.dir || path.join(path.dirname(file), 'shots.d');
  const overlays = [];
  if (dir && fs.existsSync(dir)) {
    const byName = new Map(shots.map((s, i) => [s.name, i]));
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
      const p = path.join(dir, f);
      let overridden = 0;
      let added = 0;
      for (const e0 of readEntries(p)) {
        const e = clean(e0);
        if (!e.name) throw new Error(`${p}: name 없는 항목`);
        const { maskAdd, ...fields } = e;
        if (byName.has(e.name)) {
          const cur = shots[byName.get(e.name)];
          Object.assign(cur, fields);
          if (maskAdd) cur.mask = [...(cur.mask || []), ...maskAdd];
          overridden++;
        } else {
          if (!fields.url) throw new Error(`${p}: 새 항목 ${e.name} 에 url 이 없다`);
          if (maskAdd) fields.mask = [...(fields.mask || []), ...maskAdd];
          byName.set(e.name, shots.length);
          shots.push(fields);
          added++;
        }
      }
      overlays.push({ file: p, overridden, added });
    }
  }
  return { shots, base, overlays, missing };
}

/** --only 필터: 쉼표로 여러 개, 각각 이름 앞부분(prefix). 끝에 $ 를 붙이면 정확히 그 이름만 (home/idle$) */
function matchOnly(name, only) {
  if (!only) return true;
  return String(only).split(',').map((s) => s.trim()).filter(Boolean)
    .some((p) => (p.endsWith('$') ? name === p.slice(0, -1) : name.startsWith(p)));
}

module.exports = { loadShots, matchOnly, SCENARIOS, SCENARIO_ALIASES, DEFAULT_SCENARIO, SCENARIO_SWITCH, scenarioFor, checkScenario };
