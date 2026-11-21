#!/usr/bin/env node
/*
 * spec/<화면>.json (frame px, 화면 절대 좌표) → spec/dp/<화면>.json (dp, D1 식)
 *
 *   node tools/spec-to-dp.cjs                 # 변환해서 쓰고 자체 검사
 *   node tools/spec-to-dp.cjs --check         # 쓰지 않고 검사만 (spec/dp 가 최신인지 + 변환·설계 dp 검사). 실패하면 exit 1
 *   node tools/spec-to-dp.cjs --only home     # 그 파일만 (쉼표로 여러 개)
 *   node tools/spec-to-dp.cjs --root DIR      # 다른 트리 (DIR/spec/*.json → DIR/spec/dp/). selftest 가 쓴다
 *
 * 대상: spec/*.json 중 "states" 배열이 있는 화면 스펙 (*.assets.json, tokens.json, banks.json 처럼 states 가 없는 것은 건너뜀).
 *   spec 이 하나도 없으면 할 일 없음 (exit 0).
 *
 * D1 단위 (tools/woori-units.cjs): 가로와 세로가 다르므로 숫자마다 '어느 축의 위치/길이' 인지 키 이름으로 정한다.
 *   가로 위치  x_dp = 180 + (x_px − 262.02) / 1.45803     (x, left, right, x0, x1, cx, centerX, columnsX …)
 *   가로 길이  w_dp = w_px / 1.45803                      (w, width, dx, translateX, paddingX, gapX …)
 *   세로 위치·길이  y_dp = y_px × 0.6875 (화면 위끝 기준)  (y, top, y0, cy, baselineY, h, height, dy, scrollTop …)
 *   방향 없는 길이  px × 0.6875                            (r, radius, strokeWidth, borderWidth, fontSizePx …)
 *   배열 [x,y,w,h] (box, inkBox, frameBox …) · [x0,y0,x1,y1] (inkExt, bbox …) · [[x,y],…] (points …) 은 자리마다 축이 정해져 있다.
 *   그대로: 시간·프레임 번호(i0, i1, t0, t1 …)·개수·굵기·em 자간·불투명도·비율·각도·측정 오차, 모든 문자열 (mask "x,y,w,h" 는 frame px 그대로),
 *          그리고 "dp" · "keep" 아래 전부 (이미 dp 인 설계값).
 *   표에 없는 숫자 키가 나오면 변환을 멈추고 경로를 알려 준다 (스펙에 새 키를 쓰면 여기 표에 축과 함께 넣는다).
 *   결과 y 는 화면 위끝 기준 dp 다 (앱 안 y = y − 31.333).
 *
 * 설계 dp 검사: 요소에 "box"(frame px) 와 "dp"(설계 dp {x, y, w, h}, y 는 앱 뷰포트 기준 = CSS top) 가 같이 있으면
 *   D1 로 바꾼 box 와 dp 의 차이를 잰다. 0.5 dp 넘게 다르면 실패 (해석이 틀렸거나 오타). 의도한 차이면 그 요소에 "dpLoose": true.
 *   스펙(또는 요소)에 "dpOrigin": "screen" 이면 dp.y 를 화면 기준으로 본다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const U = require('./woori-units.cjs');

const argv = process.argv.slice(2);
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const ROOT = path.resolve(argOf('--root') || path.dirname(__dirname));
const SPEC = path.join(ROOT, 'spec');
const OUT = path.join(SPEC, 'dp');
const CHECK_ONLY = argv.includes('--check');
const ONLY = (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const DP_TOL = 0.5;

/* ── 키 분류 ───────────────────────────────────────────── */

const X_POS = new Set(['x', 'left', 'right', 'x0', 'x1', 'cx', 'centerX', 'xCenter', 'inkX', 'lineLeft', 'textLeft', 'startX', 'endX',
  'fromX', 'toX', 'pageLeftX', 'leftEdgeX', 'rightEdgeX', 'columnsX', 'keyColumnsX', 'xs']);
const Y_POS = new Set(['y', 'top', 'bottom', 'y0', 'y1', 'cy', 'centerY', 'yCenter', 'baselineY', 'baseline', 'lineTop', 'textTop',
  'startY', 'endY', 'fromY', 'toY', 'pageTopY', 'sheetTopY', 'topY', 'bottomY', 'rowsY', 'keyRowsY', 'ys', 'headerBottom', 'stickyTop', 'listTop']);
const X_LEN = new Set(['w', 'width', 'dx', 'translateX', 'advanceW', 'letterSpacingPx', 'paddingX', 'paddingLeft', 'paddingRight',
  'marginX', 'marginLeft', 'marginRight', 'gapX', 'columnGap', 'pitchX', 'columnPitch', 'keyWidth', 'tileWidth', 'cardWidth',
  'contentWidth', 'sideMargin', 'sidePadding', 'widthPx']);
const Y_LEN = new Set(['h', 'height', 'dy', 'translateY', 'scrollTop', 'scrollY', 'scrollMax', 'maxScrollTop', 'contentHeight',
  'lineHeightPx', 'capHeightPx', 'xHeightPx', 'ascentPx', 'descentPx', 'paddingY', 'paddingTop', 'paddingBottom', 'marginY', 'marginTop',
  'marginBottom', 'gapY', 'rowGap', 'pitchY', 'rowPitch', 'keyHeight', 'tileHeight', 'headerHeight', 'heightPx', 'pullOffset']);
/** 방향 없는 길이 (세로 배율 = DSF 로 그려지는 것) */
const LEN = new Set(['r', 'radius', 'radiusTop', 'radiusBottom', 'cornerRadius', 'strokeWidth', 'borderWidth', 'lineWidth',
  'fontSizePx', 'sizePx', 'size', 'blur', 'blurPx', 'shadowBlur', 'shadowSpread', 'spread']);
const KEEP = new Set([
  // 시간 (초 / ms)
  't', 't0', 't1', 't2', 'tMs', 'ms', 'startT', 'endT', 'duration', 'durationMs', 'delay', 'delayMs', 'period', 'periodMs', 'holdMs', 'fps',
  // 프레임 번호·인덱스·개수
  'i', 'i0', 'i1', 'index', 'frame', 'frames', 'frameCount', 'n', 'count', 'row', 'col', 'order', 'page',
  // 글꼴 (굵기, em 자간·줄 높이 비율)
  'weight', 'fontWeight', 'letterSpacingEm', 'lineHeightEm',
  // 색·비율·불투명도·각도·곡선
  'opacity', 'alpha', 'scale', 'ratio', 'deg', 'angle', 'rotate', 'bezier', 'easing', 'cubicBezier', 'rgb', 'rgba', 'gray', 'luma', 'bg', 'level', 'zIndex',
  // 측정 지표 (frame px 기준으로 잰 값 그대로)
  'rms', 'rmsPx', 'err', 'errPx', 'maxErrPx', 'fitError', 'score', 'ncc', 'mad', 'meanAbsDiff', 'pct', 'pctOver24', 'version',
]);
/** [x,y,w,h] */
const BOX4 = new Set(['box', 'inkBox', 'frameBox', 'slotBox', 'circleBox', 'iconBox', 'iconInkBox', 'rect', 'bounds', 'crop', 'lineBox', 'clip']);
/** [x0,y0,x1,y1] */
const EXT4 = new Set(['inkExt', 'ext', 'bbox', 'extent']);
/** [[x,y], …] 또는 [x,y] */
const POINTS = new Set(['points', 'path', 'poly', 'polygon', 'checkPoints']);
/** [t, x] · [t, y] 쌍 (시간 + 위치) */
const T_X_PAIRS = new Set(['samplesX']);
const T_Y_PAIRS = new Set(['samplesY', 'scrollSamples', 'scrollCurve']);
/** 이 이름의 객체 아래 숫자는 이름과 상관없이 방향 없는 길이 (radius: { card: 12, … }) */
const LEN_CONTAINERS = new Set(['radius', 'radii']);
/** 이 이름 아래는 통째로 그대로 (이미 dp 인 설계값, 손으로 고정한 값) */
const KEEP_SUBTREE = new Set(['dp', 'keep', 'designDp', 'css']);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const CONV = {
  xpos: { f: U.exact.xDp, inv: U.exact.xPx },
  ypos: { f: U.exact.yDp, inv: U.exact.yPx },
  xlen: { f: U.exact.wDp, inv: U.exact.wPx },
  ylen: { f: U.exact.hDp, inv: U.exact.hPx },
  len: { f: U.exact.lenDp, inv: U.exact.lenPx },
};
const BY_SET = [[X_POS, 'xpos'], [Y_POS, 'ypos'], [X_LEN, 'xlen'], [Y_LEN, 'ylen'], [LEN, 'len']];

/** 배열 자리 → 종류 (배열 키일 때). null 이면 배열 규칙 없음 */
function arrayKinds(key, arr) {
  if (!arr.every(isNum)) {
    if (POINTS.has(key) && arr.every((p) => Array.isArray(p) && p.length === 2 && p.every(isNum))) return arr.map(() => ['xpos', 'ypos']);
    return null;
  }
  if (BOX4.has(key) && arr.length === 4) return ['xpos', 'ypos', 'xlen', 'ylen'];
  if (EXT4.has(key) && arr.length === 4) return ['xpos', 'ypos', 'xpos', 'ypos'];
  if (POINTS.has(key) && arr.length === 2) return ['xpos', 'ypos'];
  if (key === 'size' && arr.length === 2) return ['xlen', 'ylen'];
  if (T_X_PAIRS.has(key) && arr.length === 2) return ['keep', 'xpos'];
  if (T_Y_PAIRS.has(key) && arr.length === 2) return ['keep', 'ypos'];
  return null;
}

/** 숫자 하나의 종류. ctx = { key, inLen } → 'xpos'|'ypos'|'xlen'|'ylen'|'len'|'keep'. 모르는 키면 throw */
function classify(ctx, where) {
  const { key, inLen } = ctx;
  if (KEEP.has(key)) return 'keep';
  for (const [set, kind] of BY_SET) if (set.has(key)) return kind;
  if (inLen) return 'len';
  throw new Error(`[spec-to-dp] 분류 안 된 숫자 키 '${key}' at ${where} — tools/spec-to-dp.cjs 의 X_POS/Y_POS/X_LEN/Y_LEN/LEN/KEEP 표에 축과 함께 넣는다`);
}

/**
 * 원본(src) 을 걸으며 숫자마다 visit(kind, value, where) 를 부르고 새 값을 받아 같은 모양의 트리를 만든다.
 * (변환과 자체 검사가 같은 걸음을 쓴다 — 분류가 한 곳에만 있도록)
 */
function mapTree(node, visit, where = '$', ctx = { key: null, inLen: false, keep: false }) {
  if (Array.isArray(node)) {
    const kinds = ctx.keep ? null : arrayKinds(ctx.key, node);
    return node.map((v, i) => {
      const w = `${where}[${i}]`;
      if (kinds && Array.isArray(kinds[i])) return v.map((q, j) => visit(kinds[i][j], q, `${w}[${j}]`));
      if (kinds) return visit(kinds[i], v, w);
      return mapTree(v, visit, w, ctx);
    });
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const keep = ctx.keep || KEEP_SUBTREE.has(k);
      const inLen = ctx.inLen || (LEN_CONTAINERS.has(k) && v && typeof v === 'object' && !Array.isArray(v));
      out[k] = mapTree(v, visit, `${where}.${k}`, { key: k, inLen, keep });
    }
    return out;
  }
  if (isNum(node)) return visit(ctx.keep ? 'keep' : classify(ctx, where), node, where);
  return node; // 문자열·불리언·null 은 그대로
}

const convert = (src) => mapTree(src, (kind, v) => (kind === 'keep' ? v : U.round3(CONV[kind].f(v))));

/* ── 자체 검사 ─────────────────────────────────────────── */

/** 변환본이 원본과 같은 모양이고, 숫자마다 D1 식(소수 셋째 자리)과 역변환이 맞는지 */
function selfCheck(src, dp) {
  const fails = [];
  const counts = { xpos: 0, ypos: 0, xlen: 0, ylen: 0, len: 0, keep: 0 };
  const get = (obj, where) => {
    // where '$.a[1].b' 를 따라간다
    const parts = where.slice(1).match(/\.[^.[\]]+|\[\d+\]/g) || [];
    return parts.reduce((o, p) => (o == null ? undefined : p[0] === '[' ? o[Number(p.slice(1, -1))] : o[p.slice(1)]), obj);
  };
  try {
    mapTree(src, (kind, a, where) => {
      const b = get(dp, where);
      counts[kind]++;
      if (kind === 'keep') {
        if (b !== a) fails.push(`${where}: 바뀌면 안 되는 값 ${a} → ${b}`);
      } else {
        const want = CONV[kind].f(a);
        if (!isNum(b) || Math.abs(b - want) > 0.0005 + 1e-9) fails.push(`${where}: ${a}px → ${b} (기대 ${U.round3(want)} dp, ${kind})`);
        else if (Math.abs(CONV[kind].inv(b) - a) > 0.002) fails.push(`${where}: 역변환 ${CONV[kind].inv(b)} ≠ ${a}`);
      }
      return a;
    });
  } catch (e) {
    fails.push(e.message);
  }
  // 모양 (키 목록·배열 길이·문자열)
  (function walk(a, b, where) {
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return fails.push(`${where}: 배열 모양이 다름`);
      return a.forEach((v, i) => walk(v, b[i], `${where}[${i}]`));
    }
    if (a && typeof a === 'object') {
      if (!b || typeof b !== 'object') return fails.push(`${where}: 객체가 아님`);
      const kb = Object.keys(b).filter((k) => !(where === '$' && k === '_units'));
      if (Object.keys(a).join('\u0000') !== kb.join('\u0000')) return fails.push(`${where}: 키 목록이 다름`);
      return Object.keys(a).forEach((k) => walk(a[k], b[k], `${where}.${k}`));
    }
    if (!isNum(a) && a !== b) fails.push(`${where}: 문자열/불리언 값이 바뀜`);
    return undefined;
  })(src, dp, '$');
  return { fails, counts };
}

/** D1 기준값 (woori-units.cjs 상수가 units.json 과 맞는지) */
function anchorFails() {
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const list = [
    ['x 28.735px = 20dp (좌우 여백 20)', near(U.exact.xDp(28.735), 20, 0.001)],
    ['x 495.305px = 340dp', near(U.exact.xDp(495.305), 340, 0.001)],
    ['x 262.02px = 180dp (가운데)', near(U.exact.xDp(262.02), 180, 1e-9)],
    ['폭 466.57px = 320dp', near(U.exact.wDp(466.5696), 320, 0.001)],
    ['y 45.576px = 31.333dp (상태바)', near(U.exact.yDp(45.576), 31.333, 0.001)],
    ['y 1210.182px = 832dp (내비 위끝)', near(U.exact.yDp(1210.182), 832, 0.001)],
    ['높이 69.818px = 48dp (내비)', near(U.exact.hDp(69.818), 48, 0.001)],
  ];
  return list.filter(([, ok]) => !ok).map(([label]) => `D1 기준값 틀림: ${label}`);
}

/** 설계 dp 검사: box(frame px) + dp(설계 dp) 쌍 */
function designCheck(src) {
  const rows = [];
  const specOrigin = src.dpOrigin === 'screen' ? 'screen' : 'app';
  (function walk(o, where) {
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${where}[${i}]`));
    if (!o || typeof o !== 'object') return;
    if (o.box && o.dp && typeof o.dp === 'object') {
      const b = Array.isArray(o.box) ? { x: o.box[0], y: o.box[1], w: o.box[2], h: o.box[3] } : o.box;
      const origin = o.dpOrigin === 'screen' || o.dpOrigin === 'app' ? o.dpOrigin : specOrigin;
      const calc = {
        x: isNum(b.x) ? U.exact.xDp(b.x) : null,
        y: isNum(b.y) ? U.exact.yDp(b.y) - (origin === 'app' ? U.STATUS_BAR_DP : 0) : null,
        w: isNum(b.w) ? U.exact.wDp(b.w) : null,
        h: isNum(b.h) ? U.exact.hDp(b.h) : null,
      };
      for (const k of ['x', 'y', 'w', 'h']) {
        if (!isNum(o.dp[k]) || calc[k] == null) continue;
        const d = calc[k] - o.dp[k];
        rows.push({ where: `${where}${o.name ? ` (${o.name})` : o.id ? ` (${o.id})` : ''}.${k}`, calc: calc[k], design: o.dp[k], d, loose: !!o.dpLoose });
      }
    }
    for (const [k, v] of Object.entries(o)) if (!KEEP_SUBTREE.has(k)) walk(v, `${where}.${k}`);
  })(src, '$');
  return rows;
}

/* ── 실행 ─────────────────────────────────────────────── */

function specFiles() {
  if (!fs.existsSync(SPEC)) return [];
  return fs.readdirSync(SPEC).filter((f) => f.endsWith('.json') && !f.endsWith('.assets.json')).sort()
    .map((f) => ({ name: f.slice(0, -5), file: path.join(SPEC, f) }))
    .filter((s) => !ONLY.length || ONLY.includes(s.name));
}

let bad = 0;
const fail = (msg) => { console.log(`FAIL  ${msg}`); bad++; };
for (const f of anchorFails()) fail(f);
const done = [];
for (const { name, file } of specFiles()) {
  let src;
  try { src = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail(`spec/${name}.json 읽기: ${e.message}`); continue; }
  if (!src || typeof src !== 'object' || !Array.isArray(src.states)) {
    console.log(`SKIP  spec/${name}.json — states 배열이 없어 화면 스펙이 아님`);
    continue;
  }
  let body;
  try { body = convert(src); } catch (e) { fail(`spec/${name}.json: ${e.message}`); continue; }
  const dp = {
    _units: {
      unit: 'dp',
      source: `spec/${name}.json`,
      generatedBy: 'tools/spec-to-dp.cjs',
      xMap: 'x_dp = 180 + (x_px − 262.02) / 1.45803 · 폭 = px / 1.45803',
      yMap: 'y_dp = y_px × 0.6875 (화면 위끝 기준, 앱 안 y = y_dp − 31.333) · 높이·방향 없는 길이 = px × 0.6875',
      note: '길이·위치 숫자만 D1 식으로 (소수 셋째 자리). 문자열 안의 숫자(mask 등)·시간·프레임 번호·오차값과 "dp"·"keep" 아래는 그대로.',
    },
    ...body,
  };
  const text = JSON.stringify(dp, null, 1) + '\n';
  const outFile = path.join(OUT, `${name}.json`);
  done.push(`${name}.json`);
  if (CHECK_ONLY) {
    const cur = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null;
    if (cur !== text) fail(`spec/dp/${name}.json 이 최신이 아님 → node tools/spec-to-dp.cjs`);
  } else {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(outFile, text);
  }
  const r = selfCheck(src, JSON.parse(text));
  const design = designCheck(src);
  const over = design.filter((x) => Math.abs(x.d) > DP_TOL);
  const hard = over.filter((x) => !x.loose);
  const maxD = design.reduce((m, x) => Math.max(m, Math.abs(x.d)), 0);
  const ok = r.fails.length === 0 && hard.length === 0;
  if (!ok) bad++;
  const c = r.counts;
  console.log(`${ok ? 'PASS' : 'FAIL'}  spec/dp/${name}.json  가로 위치 ${c.xpos} · 폭 ${c.xlen} · 세로 ${c.ypos + c.ylen} · 방향 없는 길이 ${c.len} · 유지 ${c.keep}` +
    `  | 설계 dp ${design.length}개, 최대 차이 ${U.round3(maxD)} dp${over.length ? ` (>${DP_TOL}: ${over.length}개${over.length > hard.length ? `, dpLoose ${over.length - hard.length}` : ''})` : ''}`);
  for (const f of r.fails.slice(0, 20)) console.log('      ' + f);
  if (r.fails.length > 20) console.log(`      … 외 ${r.fails.length - 20}건`);
  for (const x of over.slice(0, 20)) console.log(`      설계 dp ${x.where}: frame→D1 ${U.round3(x.calc)} vs dp ${x.design} (차이 ${U.round3(x.d)})${x.loose ? ' — dpLoose' : ''}`);
}
// --check: 원본이 없는 spec/dp 파일
if (CHECK_ONLY && !ONLY.length && fs.existsSync(OUT)) {
  for (const f of fs.readdirSync(OUT).filter((x) => x.endsWith('.json'))) if (!done.includes(f)) fail(`spec/dp/${f}: 원본 spec/${f} 가 없거나 화면 스펙이 아님 (지운다)`);
}
if (!done.length) console.log(`spec-to-dp: 화면 스펙 없음 (${path.relative(process.cwd(), SPEC) || SPEC}/*.json 에 states 가 있는 파일) — 할 일 없음`);
console.log(bad ? `\nspec-to-dp: 실패 ${bad}건` : `\nspec-to-dp OK (${done.length}개, ${CHECK_ONLY ? '검사만' : 'spec/dp/ 갱신'})`);
process.exit(bad ? 1 : 0);
