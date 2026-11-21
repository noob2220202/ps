#!/usr/bin/env node
/*
 * 빌드 CSS 검사 — 압축된 CSS(frontend/dist/assets/*.css)의 애니메이션·트랜지션 뜻이 소스(frontend/src/**.css)와 같은지.
 *
 *   node tools/check-dist.cjs [--src frontend/src] [--dist frontend/dist] [--selftest] [--quiet]
 *   npm run check:dist        (루트 npm run build 가 빌드 끝에 이것을 부른다)
 *
 * 왜: 하나원큐 답지 때 Vite 8 의 CSS 압축(lightningcss 1.33)이 이름 없는 animation 단축 속성(`animation: 10.28s linear infinite both`,
 *   명세상 animation-name: none)을 `animation:none` 으로 줄여 길이·반복·채움까지 지웠다. dev 서버는 압축하지 않아 멀쩡하고 shot 비교도
 *   dev 로 찍어서, 프로덕션 빌드 녹화에서만 모프 아이콘 4장이 0s · 불투명도 0 이 됐다 (고친 법: 그 규칙을 롱핸드로).
 *   lightningcss 는 압축하지 않을 때도 같은 `animation: none` 을 내므로 비교 기준은 lightningcss 가 아니라 이 파일의 파서다.
 *   우리 답지도 같은 스택(Vite 8 + lightningcss)이라 빌드할 때마다 이 검사를 한다.
 *
 * 검사 (하나라도 어긋나면 종료 코드 1):
 *   ① 규칙: (@media/@supports 문맥, 선택자 하나) 마다 animation-* · transition-* 롱핸드 값. 단축 속성은 CSS Animations/Transitions
 *      명세 순서 규칙으로 롱핸드로 풀고(첫 시간 = duration, 둘째 = delay, 다른 속성 키워드가 먼저, 나머지 = 이름/속성),
 *      목록은 같은 길이로 늘려(반복) 비교한다. 시간은 ms, 곡선은 cubic-bezier/steps 정식형(ease = cubic-bezier(0.25,0.1,0.25,1) 등),
 *      숫자는 수치로. var() 가 든 단축 속성은 풀 수 없어 글자(공백·숫자·시간 정규화)로 비교한다.
 *      한 쪽에만 있는 규칙·롱핸드도 어긋남이다 (빌드에서 사라졌거나 생겼다).
 *   ② 빌드의 `animation: none` · `animation-name: none` 은 소스의 같은 문맥·선택자에 글자 그대로 있어야 한다 (위 사고 그 자체).
 *   ③ @keyframes: 이름·오프셋(from = 0%, to = 100%)·속성 이름이 같고 값이 같다 (숫자·0 길이·색 hex/rgb·함수 이름 대소문자,
 *      transform 의 translateX(a) = translate(a), translate 속성 끝 0, SVG stroke-* 의 px 를 맞춘 뒤 — 압축기가 쓰는 같은 뜻 표기만).
 *   ④ @property: 이름과 syntax · inherits · initial-value 가 같다 (등록 변수 애니메이션이 이것에 기댄다).
 *   ⑤ dist 가 소스보다 오래되면 (소스 CSS 를 빌드 뒤에 고쳤으면) 비교하지 않고 실패한다 — 먼저 npm run build.
 *   선택자는 압축기가 바꾸는 표기만 맞춘다 (공백·결합자, [a='b'] → [a=b], *::before → ::before, :before → ::before, 2n+1 → odd).
 * 자체 검사(늘 먼저, --selftest 면 그것만 — npm run check 가 부른다. 빌드가 필요 없다):
 *   (손) 손으로 쓴 '압축 출력'으로: 같은 뜻 압축은 통과, 위 사고의 `…__morph-layer{animation:none}` 은 잡고,
 *        손으로 바꾼 트랜지션 길이·키프레임 값·@property inherits 도 잡아야 한다 — lightningcss 없이 늘 돈다.
 *   (압축기) frontend/node_modules 의 lightningcss 가 있으면(없으면 NODE_PATH) Vite 와 같은 옵션(minify, 기본 cssTarget
 *        baseline-widely-available = chrome/edge 111 · firefox 114 · safari/ios 16.4)으로 돌려: 이름 없는 단축 속성을 압축기가
 *        animation:none 으로 바꾸면 ① ② 가 잡아야 하고 고쳐졌으면 통과해야 한다, 롱핸드로 쓴 규칙은 통과.
 *        lightningcss 를 못 찾으면 이 묶음만 SKIP (frontend 를 setup 하기 전).
 *   하나라도 틀리면 검사기 자체가 고장 (종료 코드 1).
 * frontend/ 가 아직 없으면(package.json 없음) 빌드 검사는 SKIP (종료 코드 0). 있는데 빌드가 없으면 실패.
 * 소스: --src 아래 모든 .css + 그 아래 .ts/.tsx 가 import 하는 패키지 CSS (선택자 짝 맞추기용).
 * 중첩 규칙(&)은 지원하지 않는다 (생기면 여기서 실패하고 알린다).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(name);
const FRONT = path.join(ROOT, 'frontend');
const SRC = path.resolve(opt('--src', path.join(FRONT, 'src')));
const DIST = path.resolve(opt('--dist', path.join(FRONT, 'dist')));
const QUIET = flag('--quiet');

/* ───────────────────────── CSS 파서 (주석·문자열·괄호를 아는 최소한) ───────────────────────── */

const GROUP_AT = new Set(['media', 'supports', 'layer', 'container', 'document', 'scope', 'starting-style']);

/** text → { rules: [{ctx, selectors, decls, line}], keyframes: [{ctx, name, frames, line}], properties: [{ctx, name, decls, line}] } */
function parseCss(text, file) {
  const out = { file, rules: [], keyframes: [], properties: [] };
  const n = text.length;
  let i = 0;
  const lineStarts = [0];
  for (let k = 0; k < n; k++) if (text[k] === '\n') lineStarts.push(k + 1);
  const lineAt = (pos) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const skipWs = () => {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++;
      if (text.startsWith('/*', i)) {
        const e = text.indexOf('*/', i + 2);
        i = e < 0 ? n : e + 2;
      } else return;
    }
  };
  /** stops 의 한 글자(괄호 바깥)까지 읽는다 → [읽은 글, 멈춘 글자 | ''] (멈춘 글자는 먹지 않는다) */
  const readUntil = (stops) => {
    let s = '';
    let depth = 0;
    while (i < n) {
      const c = text[i];
      if (c === '/' && text[i + 1] === '*') {
        const e = text.indexOf('*/', i + 2);
        i = e < 0 ? n : e + 2;
        s += ' ';
        continue;
      }
      if (c === '"' || c === "'") {
        const st = i++;
        while (i < n && text[i] !== c) i += text[i] === '\\' ? 2 : 1;
        i++;
        s += text.slice(st, i);
        continue;
      }
      if (c === '\\') {
        s += text.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (depth <= 0 && stops.includes(c)) return [s, c];
      s += c;
      i++;
    }
    return [s, ''];
  };
  const parseDecls = () => {
    const decls = [];
    for (;;) {
      skipWs();
      if (i >= n) return decls;
      if (text[i] === '}') {
        i++;
        return decls;
      }
      if (text[i] === ';') {
        i++;
        continue;
      }
      const start = i;
      const [d, stop] = readUntil(';{}');
      if (stop === '{') throw new Error(`${file}:${lineAt(start)} 중첩 규칙은 check-dist 가 지원하지 않음: ${d.trim().slice(0, 60)}`);
      if (stop === ';') i++;
      const k = d.indexOf(':');
      if (k < 0) continue;
      const rawProp = d.slice(0, k).trim();
      let value = d.slice(k + 1).trim();
      let important = false;
      const im = /!\s*important\s*$/i.exec(value);
      if (im) {
        important = true;
        value = value.slice(0, im.index).trim();
      }
      decls.push({ prop: rawProp.startsWith('--') ? rawProp : rawProp.toLowerCase(), value, important, line: lineAt(start) });
    }
  };
  const parseKeyframes = (ctx, name, line) => {
    const frames = [];
    for (;;) {
      skipWs();
      if (i >= n) break;
      if (text[i] === '}') {
        i++;
        break;
      }
      const [pre, stop] = readUntil('{}');
      if (stop !== '{') continue;
      i++;
      frames.push({ offsets: splitTop(pre, ',').map(normOffset), decls: parseDecls() });
    }
    out.keyframes.push({ ctx, name: unquote(name.trim()), frames, line });
  };
  const parseGroup = (ctx) => {
    for (;;) {
      skipWs();
      if (i >= n) return;
      if (text[i] === '}') {
        i++;
        return;
      }
      const start = i;
      const [prelude, stop] = readUntil('{;}');
      if (stop === ';') {
        i++;
        continue;
      }
      if (stop !== '{') continue;
      i++;
      const pre = prelude.trim();
      const line = lineAt(start);
      if (pre.startsWith('@')) {
        const m = /^@([-\w]+)\s*([\s\S]*)$/.exec(pre);
        const at = m[1].toLowerCase();
        if (/^(-\w+-)?keyframes$/.test(at)) parseKeyframes(ctx, (at === 'keyframes' ? '' : `@${at} `) + m[2], line);
        else if (GROUP_AT.has(at)) parseGroup([...ctx, `@${at} ${normParams(m[2])}`]);
        else if (at === 'property') out.properties.push({ ctx, name: m[2].trim(), decls: parseDecls(), line });
        else parseDecls(); // @font-face 등: 애니메이션과 무관
      } else {
        out.rules.push({ ctx, selectors: splitTop(pre, ',').map(normSelector), decls: parseDecls(), line });
      }
    }
  };
  parseGroup([]);
  return out;
}

/** 괄호·문자열 바깥의 sep 로 나눈다 */
function splitTop(s, sep) {
  const parts = [];
  let depth = 0;
  let cur = '';
  let q = '';
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (q) {
      cur += c;
      if (c === '\\') cur += s[++k] ?? '';
      else if (c === q) q = '';
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      cur += c;
      continue;
    }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (depth === 0 && (sep === ' ' ? /\s/.test(c) : c === sep)) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  parts.push(cur.trim());
  // 공백으로 나눌 때는 빈 조각(연속 공백)을 버린다. 쉼표는 그대로 (빈 항목도 항목)
  return sep === ' ' ? parts.filter((p) => p !== '') : parts;
}
const unquote = (s) => (/^(['"]).*\1$/.test(s) ? s.slice(1, -1) : s);
function normOffset(s) {
  const t = s.trim().toLowerCase();
  if (t === 'from') return 0;
  if (t === 'to') return 100;
  const m = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)%$/.exec(t);
  return m ? Number(m[1]) : t;
}
function normParams(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*([():,])\s*/g, '$1').replace(/\)and\(/g, ') and (');
}
/** 선택자 정규화: 공백·결합자·따옴표·의사 요소 콜론 수 (압축기가 바꾸는 것만) */
function normSelector(s) {
  let t = s.trim().replace(/\s+/g, ' ');
  t = t.replace(/\s*([>+~,])\s*/g, '$1').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  t = t.replace(/\[\s*([-\w]+)\s*([~|^$*]?=)\s*(['"])(.*?)\3\s*(i|s)?\s*\]/g, (m0, a, op, q, v, f) => `[${a}${op}${/^-?[_a-zA-Z][-\w]*$/.test(v) ? v : JSON.stringify(v)}${f ? ` ${f}` : ''}]`);
  t = t.replace(/(^|[^:]):(before|after|first-line|first-letter)\b/g, '$1::$2');
  t = t.replace(/(^|[\s>+~(,])\*(?=[.:#[])/g, '$1'); // *::before → ::before, *.a → .a (압축기가 지운다)
  t = t.replace(/:nth-(child|last-child|of-type|last-of-type)\(2n\+1\)/g, ':nth-$1(odd)').replace(/:nth-(child|last-child|of-type|last-of-type)\(2n(\+0)?\)/g, ':nth-$1(even)');
  return t;
}

/* ───────────────────────── 값 정규화 ───────────────────────── */

const NUM = '[+-]?(?:\\d*\\.)?\\d+(?:e[+-]?\\d+)?';
const num = (v) => String(Number(Number(v).toFixed(6)));
function normTime(t) {
  const m = new RegExp(`^(${NUM})(ms|s)$`, 'i').exec(t.trim());
  if (!m) return null;
  return `${num(m[2].toLowerCase() === 's' ? Number(m[1]) * 1000 : Number(m[1]))}ms`;
}
const isTime = (t) => normTime(t) != null;
const EASE_KW = {
  ease: 'cubic-bezier(0.25,0.1,0.25,1)', 'ease-in': 'cubic-bezier(0.42,0,1,1)', 'ease-out': 'cubic-bezier(0,0,0.58,1)',
  'ease-in-out': 'cubic-bezier(0.42,0,0.58,1)', linear: 'linear', 'step-start': 'steps(1,jump-start)', 'step-end': 'steps(1,jump-end)',
};
const isEasing = (t) => Object.hasOwn(EASE_KW, t.toLowerCase()) || /^(cubic-bezier|steps|linear)\(/i.test(t);
function normEasing(t) {
  const lc = t.trim().toLowerCase().replace(/\s+/g, '');
  if (Object.hasOwn(EASE_KW, lc)) return EASE_KW[lc];
  let m = /^cubic-bezier\(([^)]*)\)$/.exec(lc);
  if (m) {
    const v = m[1].split(',').map(num).join(',');
    if (v === '0,0,1,1') return 'linear';
    const kw = Object.entries(EASE_KW).find(([, f]) => f === `cubic-bezier(${v})`);
    return kw ? kw[1] : `cubic-bezier(${v})`;
  }
  m = /^steps\((\d+)(?:,([-\w]+))?\)$/.exec(lc);
  if (m) {
    const pos = { start: 'jump-start', end: 'jump-end', undefined: 'jump-end' }[m[2]] || m[2];
    return `steps(${Number(m[1])},${pos})`;
  }
  m = /^linear\((.*)\)$/.exec(lc);
  if (m) {
    const v = normGeneric(m[1]);
    return v === '0,1' ? 'linear' : `linear(${v})`;
  }
  return lc;
}
const isCount = (t) => t.toLowerCase() === 'infinite' || new RegExp(`^${NUM}$`).test(t);
const normCount = (t) => (t.toLowerCase() === 'infinite' ? 'infinite' : num(t));

const NAMED = { transparent: [0, 0, 0, 0], white: [255, 255, 255, 1], black: [0, 0, 0, 1], red: [255, 0, 0, 1] };
function color(tok) {
  const t = tok.toLowerCase();
  if (Object.hasOwn(NAMED, t)) return NAMED[t];
  let m = /^#([0-9a-f]{3,8})$/.exec(t);
  if (m && [3, 4, 6, 8].includes(m[1].length)) {
    const h = m[1].length <= 4 ? [...m[1]].map((c) => c + c).join('') : m[1];
    const v = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
    return [...v, h.length === 8 ? Math.round((parseInt(h.slice(6, 8), 16) / 255) * 1000) / 1000 : 1];
  }
  m = /^rgba?\((.*)\)$/.exec(t);
  if (m) {
    const p = m[1].replace(/\//g, ' / ').split(/[\s,]+/).filter((x) => x && x !== '/');
    if (p.length < 3 || p.length > 4) return null;
    const ch = p.slice(0, 3).map((x) => (x.endsWith('%') ? Math.round((parseFloat(x) * 255) / 100) : Number(x)));
    const a = p[3] == null ? 1 : p[3].endsWith('%') ? parseFloat(p[3]) / 100 : Number(p[3]);
    if ([...ch, a].some((x) => !Number.isFinite(x))) return null;
    return [...ch, Math.round(a * 1000) / 1000];
  }
  return null;
}
/** 일반 값: 소문자, 공백·쉼표·괄호 정리, 숫자 수치화, 0 길이 → 0, 시간 → ms, 색 → rgba() (압축기가 바꾸는 표기만 맞춘다) */
function normGeneric(v) {
  let t = v.trim().replace(/\s+/g, ' ').replace(/\s*([(),/])\s*/g, '$1').replace(/\(\s+/g, '(');
  t = t.replace(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^()]*\)|\b(transparent|white|black)\b/gi, (c) => {
    const k = color(c);
    return k ? `rgba(${k.join(',')})` : c;
  });
  t = t.replace(new RegExp(`(^|[^\\w#.-])(${NUM})(ms|s|px|em|rem|deg|turn|rad|vh|vw|%|[a-z]+)?(?![\\w-])`, 'gi'), (m0, pre, n, u) => {
    const unit = (u || '').toLowerCase();
    if (unit === 's' || unit === 'ms') return pre + normTime(n + unit);
    const x = num(n);
    if (x === '0' && /^(px|em|rem|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc|q|dvh|svh|lvh)$/.test(unit)) return `${pre}0`;
    if (x === '0' && /^(deg|turn|rad|grad)$/.test(unit)) return `${pre}0`;
    return pre + x + unit;
  });
  return t.replace(/(^|[^\w-])([a-zA-Z][-\w]*)\(/g, (m0, pre, f) => `${pre}${f.toLowerCase()}(`); // 함수 이름은 대소문자 무관 (translateX = translatex)
}

/**
 * 키프레임 선언 값: normGeneric + 속성별로 압축기가 쓰는 같은 뜻 표기
 *   transform 의 translateX(a) / translateY(b) / translate(a) → translate(a,0) / translate(0,b) / translate(a,0)
 *   translate 속성 'x y z' 의 끝 0 (0 0 → 0) · SVG stroke-dasharray/-dashoffset/-width 의 px (단위 없음 = px)
 */
function normDecl(prop, value) {
  let t = normGeneric(value);
  if (prop === 'transform') {
    t = t.replace(/\btranslatex\(([^(),]+)\)/g, 'translate($1,0)').replace(/\btranslatey\(([^(),]+)\)/g, 'translate(0,$1)').replace(/\btranslate\(([^(),]+)\)/g, 'translate($1,0)');
  } else if (prop === 'translate') {
    const parts = t.split(' ');
    while (parts.length > 1 && parts[parts.length - 1] === '0') parts.pop();
    t = parts.join(' ');
  } else if (/^stroke-(dasharray|dashoffset|width)$/.test(prop)) {
    t = t.replace(new RegExp(`(${NUM})px\\b`, 'g'), '$1');
  }
  return t;
}

/* ───────────────────────── animation / transition → 롱핸드 ───────────────────────── */

const ANIM_LONG = ['name', 'duration', 'timing-function', 'delay', 'iteration-count', 'direction', 'fill-mode', 'play-state'];
const ANIM_RESET = { composition: 'replace', timeline: 'auto', 'range-start': 'normal', 'range-end': 'normal' };
const ANIM_INIT = {
  name: 'none', duration: '0ms', 'timing-function': EASE_KW.ease, delay: '0ms', 'iteration-count': '1', direction: 'normal', 'fill-mode': 'none', 'play-state': 'running',
};
const TR_LONG = ['property', 'duration', 'timing-function', 'delay', 'behavior'];
const TR_INIT = { property: 'all', duration: '0ms', 'timing-function': EASE_KW.ease, delay: '0ms', behavior: 'normal' };
const DIRS = new Set(['normal', 'reverse', 'alternate', 'alternate-reverse']);
const FILLS = new Set(['none', 'forwards', 'backwards', 'both']);
const PLAYS = new Set(['running', 'paused']);
const WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

function parseSingleAnimation(s) {
  const r = {};
  for (const tok of splitTop(s, ' ')) {
    const lc = tok.toLowerCase();
    if (isTime(tok)) {
      if (r.duration == null) r.duration = normTime(tok);
      else if (r.delay == null) r.delay = normTime(tok);
      else return null;
    } else if (r['timing-function'] == null && isEasing(tok)) r['timing-function'] = normEasing(tok);
    else if (r['iteration-count'] == null && isCount(tok)) r['iteration-count'] = normCount(tok);
    else if (r.direction == null && DIRS.has(lc)) r.direction = lc;
    else if (r['fill-mode'] == null && FILLS.has(lc)) r['fill-mode'] = lc;
    else if (r['play-state'] == null && PLAYS.has(lc)) r['play-state'] = lc;
    else if (r.name == null) r.name = lc === 'none' ? 'none' : unquote(tok);
    else return null;
  }
  return Object.fromEntries(ANIM_LONG.map((k) => [k, r[k] ?? ANIM_INIT[k]]));
}
function parseSingleTransition(s) {
  const r = {};
  for (const tok of splitTop(s, ' ')) {
    const lc = tok.toLowerCase();
    if (isTime(tok)) {
      if (r.duration == null) r.duration = normTime(tok);
      else if (r.delay == null) r.delay = normTime(tok);
      else return null;
    } else if (r['timing-function'] == null && isEasing(tok)) r['timing-function'] = normEasing(tok);
    else if (r.behavior == null && (lc === 'allow-discrete' || lc === 'normal')) r.behavior = lc;
    else if (r.property == null) r.property = tok.startsWith('--') ? tok : lc;
    else return null;
  }
  return Object.fromEntries(TR_LONG.map((k) => [k, r[k] ?? TR_INIT[k]]));
}
function normLonghand(group, key, item) {
  const lc = item.trim().toLowerCase();
  if (key === 'duration' || key === 'delay') return normTime(item) ?? lc;
  if (key === 'timing-function') return normEasing(item);
  if (key === 'iteration-count') return isCount(item) ? normCount(item) : lc;
  if (key === 'name') return lc === 'none' ? 'none' : unquote(item.trim());
  if (key === 'property') return item.trim().startsWith('--') ? item.trim() : lc;
  return normGeneric(item);
}

/**
 * 선언 하나 → [[롱핸드 이름, 값 목록(정규화)] …]. 관련 없는 속성이면 null.
 * 롱핸드 이름은 접두사를 지운다 (-webkit-animation-name → animation-name; 접두사 판은 prefix 를 붙여 따로 센다).
 */
function expand(prop, value) {
  const m = /^(-webkit-|-moz-|-o-)?(animation|transition)(?:-([-a-z]+))?$/.exec(prop);
  if (!m) return null;
  const [, prefix = '', group, sub] = m;
  const P = `${prefix}${group}`;
  const v = value.trim();
  if (WIDE.has(v.toLowerCase())) {
    const keys = sub ? [sub] : group === 'animation' ? [...ANIM_LONG, ...Object.keys(ANIM_RESET)] : TR_LONG;
    return keys.map((k) => [`${P}-${k}`, [v.toLowerCase()]]);
  }
  if (/var\(|env\(|attr\(/i.test(v)) return [[sub ? `${P}-${sub}` : `${P}(var)`, [normGeneric(v)]]];
  const items = splitTop(v, ',');
  if (sub) return [[`${P}-${sub}`, items.map((it) => normLonghand(group, sub, it))]];
  const parsed = items.map(group === 'animation' ? parseSingleAnimation : parseSingleTransition);
  if (parsed.some((p) => !p)) return [[`${P}(invalid)`, [normGeneric(v)]]];
  const keys = group === 'animation' ? ANIM_LONG : TR_LONG;
  const res = keys.map((k) => [`${P}-${k}`, parsed.map((p) => p[k])]);
  if (group === 'animation') for (const [k, init] of Object.entries(ANIM_RESET)) res.push([`${P}-${k}`, parsed.map(() => init)]);
  // 단축 속성은 var() 판(P(var))도 지운다
  res.push([`${P}(var)`, null]);
  return res;
}

/* ───────────────────────── 시트 → 뜻 ───────────────────────── */

const ctxKey = (ctx) => ctx.join(' ');
/**
 * sheets (같은 순서로 이어 붙인 것으로 본다) →
 *   rules:  Map 'ctx\u0000selector' → Map longhand → {v, imp, where}
 *   nones:  [{key, prop, where}]  (animation: none / animation-name: none 이 글자 그대로 있는 곳)
 *   frames: Map 'ctx\u0000name' → Map offset → Map prop → {v, where}
 *   props:  Map name → {syntax, inherits, initial, where}
 */
function meaning(sheets) {
  const rules = new Map();
  const nones = [];
  const frames = new Map();
  const props = new Map();
  for (const sh of sheets) {
    for (const r of sh.rules) {
      for (const d of r.decls) {
        const ex = expand(d.prop, d.value);
        if (!ex) continue;
        const where = `${path.basename(sh.file)}:${d.line}`;
        for (const sel of r.selectors) {
          const key = `${ctxKey(r.ctx)}\u0000${sel}`;
          if (/^(animation|animation-name)$/.test(d.prop) && splitTop(d.value, ',').some((x) => x.trim().toLowerCase() === 'none')) nones.push({ key, prop: d.prop, value: d.value, where });
          if (!rules.has(key)) rules.set(key, new Map());
          const m = rules.get(key);
          for (const [lh, v] of ex) {
            const old = m.get(lh);
            if (old && old.imp && !d.important) continue;
            if (v == null) m.delete(lh);
            else m.set(lh, { v, imp: d.important, where });
          }
        }
      }
    }
    for (const k of sh.keyframes) {
      const key = `${ctxKey(k.ctx)}\u0000${k.name}`;
      const m = new Map(); // 같은 이름이 또 나오면 뒤의 것이 통째로 이긴다 (CSS 규칙)
      for (const f of k.frames) {
        for (const off of f.offsets) {
          if (!m.has(off)) m.set(off, new Map());
          for (const d of f.decls) m.get(off).set(d.prop, { v: normDecl(d.prop, d.value), where: `${path.basename(sh.file)}:${d.line}` });
        }
      }
      frames.set(key, m);
    }
    for (const p of sh.properties) {
      const get = (n) => p.decls.find((d) => d.prop === n)?.value;
      props.set(p.name, {
        syntax: unquote((get('syntax') || '').trim()).replace(/\s+/g, ''), inherits: (get('inherits') || '').trim().toLowerCase(),
        initial: get('initial-value') == null ? null : normGeneric(get('initial-value')), where: `${path.basename(sh.file)}:${p.line}`,
      });
    }
  }
  return { rules, nones, frames, props };
}

const showKey = (key) => {
  const [ctx, sel] = key.split('\u0000');
  return ctx ? `${ctx} { ${sel} }` : sel;
};
const cyc = (a, n) => Array.from({ length: n }, (_, k) => a[k % a.length]);
const same = (a, b) => {
  const n = Math.max(a.length, b.length);
  return cyc(a, n).join(', ') === cyc(b, n).join(', ');
};

/** 소스 뜻 vs 빌드 뜻 → 어긋남 문자열 목록 */
function compare(src, dist) {
  const bad = [];
  // ① 규칙
  for (const key of new Set([...src.rules.keys(), ...dist.rules.keys()])) {
    const a = src.rules.get(key);
    const b = dist.rules.get(key);
    if (!a) {
      bad.push(`빌드에만 있는 애니메이션/트랜지션 규칙: ${showKey(key)} { ${[...b].map(([k, x]) => `${k}: ${x.v.join(', ')}`).join('; ')} }`);
      continue;
    }
    if (!b) {
      bad.push(`빌드에서 사라진 애니메이션/트랜지션 규칙: ${showKey(key)} (${[...a.values()][0].where}) { ${[...a].map(([k, x]) => `${k}: ${x.v.join(', ')}`).join('; ')} }`);
      continue;
    }
    for (const lh of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(lh);
      const y = b.get(lh);
      if (x && y && same(x.v, y.v) && x.imp === y.imp) continue;
      bad.push(
        `${showKey(key)}  ${lh}: 소스 ${x ? `${x.v.join(', ')}${x.imp ? ' !important' : ''} (${x.where})` : '(없음)'} ≠ 빌드 ${y ? `${y.v.join(', ')}${y.imp ? ' !important' : ''}` : '(없음)'}`,
      );
    }
  }
  // ② 빌드의 animation:none 은 소스에 글자 그대로
  for (const nn of dist.nones) {
    if (!src.nones.some((s) => s.key === nn.key && s.prop === nn.prop)) {
      bad.push(`빌드 CSS 의 \`${nn.prop}:${nn.value}\` 가 소스의 같은 규칙에 글자 그대로 없다: ${showKey(nn.key)} — 압축기가 이름 없는 단축 속성을 animation:none 으로 바꾼 것 (길이·반복·채움이 지워진다)`);
    }
  }
  // ③ 키프레임
  for (const key of new Set([...src.frames.keys(), ...dist.frames.keys()])) {
    const a = src.frames.get(key);
    const b = dist.frames.get(key);
    if (!a || !b) {
      bad.push(`@keyframes ${showKey(key)}: ${a ? '빌드에 없음' : '소스에 없음'}`);
      continue;
    }
    for (const off of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(off);
      const y = b.get(off);
      if (!x || !y) {
        bad.push(`@keyframes ${showKey(key)} ${off}%: ${x ? '빌드에 없음' : '소스에 없음'}`);
        continue;
      }
      for (const p of new Set([...x.keys(), ...y.keys()])) {
        if (x.get(p)?.v === y.get(p)?.v) continue;
        bad.push(`@keyframes ${showKey(key)} ${off}% ${p}: 소스 ${x.get(p) ? `${x.get(p).v} (${x.get(p).where})` : '(없음)'} ≠ 빌드 ${y.get(p)?.v ?? '(없음)'}`);
      }
    }
  }
  // ④ @property
  for (const name of new Set([...src.props.keys(), ...dist.props.keys()])) {
    const a = src.props.get(name);
    const b = dist.props.get(name);
    if (!a || !b) {
      bad.push(`@property ${name}: ${a ? '빌드에 없음' : '소스에 없음'}`);
      continue;
    }
    for (const f of ['syntax', 'inherits', 'initial']) if (a[f] !== b[f]) bad.push(`@property ${name} ${f}: 소스 ${a[f]} (${a.where}) ≠ 빌드 ${b[f]}`);
  }
  return bad;
}

/* ───────────────────────── 파일 모으기 ───────────────────────── */

/** 보여 줄 경로: woori-answer-key 안이면 상대, 밖이면 절대 */
const show = (f) => (path.relative(ROOT, f).startsWith('..') ? f : path.relative(ROOT, f) || '.');
function walk(dir, pred, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') walk(p, pred, out);
    } else if (pred(e.name)) out.push(p);
  }
  return out;
}
function sourceCss(srcDir) {
  const files = walk(srcDir, (f) => f.endsWith('.css')).sort();
  // 패키지 CSS (import 'pkg/x.css') — 선택자 짝 맞추기용
  const nm = path.join(path.dirname(srcDir), 'node_modules');
  for (const f of walk(srcDir, (x) => /\.(tsx?|jsx?)$/.test(x))) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/import\s+['"]([^'".][^'"]*\.css)['"]/g)) {
      const p = path.join(nm, m[1]);
      if (fs.existsSync(p) && !files.includes(p)) files.push(p);
    }
  }
  return files;
}

/* ───────────────────────── 자체 검사 ───────────────────────── */

/** lightningcss: frontend/node_modules → NODE_PATH. 없으면 null */
function findLightning() {
  const dirs = [path.join(FRONT, 'node_modules'), ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)];
  for (const d of dirs) {
    const p = path.join(d, 'lightningcss');
    if (!fs.existsSync(path.join(p, 'package.json'))) continue;
    try {
      return { mod: require(p), version: require(path.join(p, 'package.json')).version, where: show(p) };
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

const ST_COMMON = `
    .woori-home__morph-scan { animation-name: woori-home-morph-scan; }
    @keyframes woori-home-morph-scan { from { opacity: 1; transform: translateY(0px) } 50.5% { opacity: 0.5 } to { opacity: 0; color: #ffffff } }
    @property --x { syntax: '<length>'; inherits: false; initial-value: 0px; }
    .a { transition: transform 150ms ease-out, opacity 0.2s cubic-bezier(0.25, 0.1, 0.25, 1) 40ms; }
    .b:not(.c) > .d::before, :root[data-theme='dark'] .e { animation: spin 1.2s linear 0.1s infinite; }
    .f { animation: woori-tr x var(--d, 440ms) both; transition: --x 150ms linear; }
    @media (prefers-reduced-motion: reduce) { .g { animation: none; } }`;
/** 위 ST_COMMON 을 압축기가 낼 법한 꼴로 손으로 옮긴 것 (같은 뜻: ease 생략, .15s, :before, [a=b], 0 길이 단위 생략, #fff …) */
const ST_COMMON_MIN = '.woori-home__morph-scan{animation-name:woori-home-morph-scan}' +
  '@keyframes woori-home-morph-scan{0%{opacity:1;transform:translateY(0)}50.5%{opacity:.5}to{opacity:0;color:#fff}}' +
  '@property --x{syntax:"<length>";inherits:false;initial-value:0}' +
  '.a{transition:transform .15s ease-out,opacity .2s 40ms}' +
  '.b:not(.c)>.d:before,:root[data-theme=dark] .e{animation:1.2s linear .1s infinite spin}' +
  '.f{animation:woori-tr x var(--d,440ms) both;transition:--x .15s linear}' +
  '@media (prefers-reduced-motion:reduce){.g{animation:none}}';
const ST_MORPH = '.woori-home:not(.woori-home--static) .woori-home__morph-layer';
const ST_BUG = `${ST_MORPH} { animation: 10.28s linear infinite both; }${ST_COMMON}`;
const ST_BUG_EXPECT = [/animation-duration: 소스 10280ms .* ≠ 빌드 0ms/, /animation-iteration-count: 소스 infinite/, /`animation:none` 가 소스의 같은 규칙에 글자 그대로 없다/];

function runCases(cases) {
  const lines = [];
  let ok = true;
  for (const c of cases) {
    const bad = compare(meaning([parseCss(c.css, 'selftest-src.css')]), meaning([parseCss(c.dist, 'selftest-dist.css')]));
    const pass = c.expectBad.length ? c.expectBad.every((re) => bad.some((x) => re.test(x))) : bad.length === 0;
    if (!pass) ok = false;
    lines.push(`  ${pass ? 'ok ' : 'FAIL'} ${c.name}: 어긋남 ${bad.length}건${c.expectBad.length ? ' (잡아야 함)' : ' (없어야 함)'}${pass ? '' : `\n       빌드 쪽: ${c.dist.slice(0, 400)}\n       ${bad.join('\n       ') || '(어긋남 없음)'}`}`);
  }
  return { ok, lines };
}

function selftest() {
  // (손) lightningcss 없이 늘
  const hand = runCases([
    { name: '손으로 압축한 같은 뜻 CSS', css: ST_COMMON, dist: ST_COMMON_MIN, expectBad: [] },
    { name: '이름 없는 animation 단축 속성 → 빌드 `animation:none` (하나 답지 사고의 실제 규칙)', css: ST_BUG, dist: `${ST_COMMON_MIN}${ST_MORPH}{animation:none}`, expectBad: ST_BUG_EXPECT },
    {
      name: '손으로 바꾼 빌드 (트랜지션 길이 · 키프레임 · @property)',
      css: ST_COMMON,
      dist: ST_COMMON_MIN.replace('.15s', '.2s').replace('opacity:.5', 'opacity:.6').replace('inherits:false', 'inherits:true'),
      expectBad: [/transition-duration: 소스 150ms, 200ms .* ≠ 빌드 200ms, 200ms/, /@keyframes woori-home-morph-scan 50\.5% opacity/, /@property --x inherits/],
    },
    { name: '빌드에서 사라진 트랜지션 규칙', css: `${ST_COMMON} .h { transition: opacity 90ms linear; }`, dist: ST_COMMON_MIN, expectBad: [/빌드에서 사라진 애니메이션\/트랜지션 규칙: \.h/] },
  ]);
  const out = [`자체 검사 (손으로 쓴 압축 출력):`, ...hand.lines];
  let ok = hand.ok;
  // (압축기) lightningcss 가 있으면
  const L = findLightning();
  if (!L) {
    out.push('  SKIP 압축기 묶음: lightningcss 를 찾을 수 없음 (frontend/node_modules 또는 NODE_PATH — npm run setup 뒤에 돈다)');
  } else {
    const v = (maj, min = 0) => (maj << 16) | (min << 8);
    const targets = { chrome: v(111), edge: v(111), firefox: v(114), safari: v(16, 4), ios_saf: v(16, 4) }; // Vite 8 기본 cssTarget
    const minify = (code) => L.mod.transform({ filename: 'selftest.css', code: Buffer.from(code), minify: true, targets }).code.toString();
    const bugOut = minify(ST_BUG);
    // 압축기가 아직 이 버그를 가지면(1.33) 그 출력을 잡아야 하고, 고쳐졌으면 같은 뜻이라 통과해야 한다
    const buggy = /\.woori-home__morph-layer\{animation:none\}/.test(bugOut);
    const comp = runCases([
      { name: `이름 없는 단축 속성 → lightningcss ${buggy ? '`animation:none` (버그 있음)' : '같은 뜻 (버그 없음)'}`, css: ST_BUG, dist: bugOut,
        expectBad: buggy ? [/animation-duration: 소스 10280ms .* ≠ 빌드 0ms/, /animation-fill-mode: 소스 both/, /`animation:none` 가 소스의 같은 규칙에 글자 그대로 없다/] : [] },
      { name: '롱핸드로 쓴 같은 규칙 → lightningcss', css: `${ST_MORPH} { animation-duration: 10.28s; animation-timing-function: linear; animation-iteration-count: infinite; animation-fill-mode: both; }${ST_COMMON}`,
        dist: minify(`${ST_MORPH} { animation-duration: 10.28s; animation-timing-function: linear; animation-iteration-count: infinite; animation-fill-mode: both; }${ST_COMMON}`), expectBad: [] },
      { name: '평범한 규칙 → lightningcss', css: ST_COMMON, dist: minify(ST_COMMON), expectBad: [] },
    ]);
    ok = ok && comp.ok;
    out.push(`자체 검사 (lightningcss ${L.version}, ${L.where}, Vite 기본 타깃):`, ...comp.lines);
  }
  return { ok, msg: out.join('\n') };
}

/* ───────────────────────── 실행 ───────────────────────── */

function main() {
  const st = selftest();
  if (!QUIET || !st.ok) console.log(`[check-dist] ${st.msg}`);
  if (!st.ok) {
    console.error('[check-dist] 자체 검사 실패 — 검사기 자체가 압축기의 바뀐 출력을 못 읽는다. tools/check-dist.cjs 를 고친다.');
    return 1;
  }
  if (flag('--selftest')) return 0;
  if (!opt('--dist', null) && !fs.existsSync(path.join(FRONT, 'package.json'))) {
    console.log('[check-dist] SKIP — frontend/package.json 없음 (아직 만들지 않음). 검사할 빌드가 없다');
    return 0;
  }

  const assets = path.join(DIST, 'assets');
  const distFiles = fs.existsSync(assets) ? fs.readdirSync(assets).filter((f) => f.endsWith('.css')).map((f) => path.join(assets, f)) : [];
  if (!distFiles.length) {
    console.error(`[check-dist] 빌드 CSS 가 없다: ${assets}/*.css — 먼저 npm run build`);
    return 1;
  }
  const srcFiles = fs.existsSync(SRC) ? sourceCss(SRC) : [];
  if (!srcFiles.length) {
    console.error(`[check-dist] 소스 CSS 가 없다: ${show(SRC)}/**/*.css`);
    return 1;
  }
  const newestSrc = Math.max(...srcFiles.map((f) => fs.statSync(f).mtimeMs));
  const oldestDist = Math.min(...distFiles.map((f) => fs.statSync(f).mtimeMs));
  if (newestSrc > oldestDist) {
    const f = srcFiles.find((x) => fs.statSync(x).mtimeMs === newestSrc);
    console.error(`[check-dist] 빌드가 소스보다 오래됐다 (${show(f)} 가 ${new Date(newestSrc).toISOString()} 에 바뀜, 빌드 CSS ${new Date(oldestDist).toISOString()}) — 먼저 npm run build`);
    return 1;
  }
  let src;
  let dist;
  try {
    src = meaning(srcFiles.map((f) => parseCss(fs.readFileSync(f, 'utf8'), f)));
    dist = meaning(distFiles.map((f) => parseCss(fs.readFileSync(f, 'utf8'), f)));
  } catch (e) {
    console.error(`[check-dist] ${e.message}`);
    return 1;
  }
  const bad = compare(src, dist);
  const summary =
    `소스 ${srcFiles.length}개 파일 (${show(SRC)}) ↔ 빌드 ${distFiles.map(show).join(', ')}: ` +
    `애니메이션/트랜지션 규칙 ${src.rules.size} ↔ ${dist.rules.size} · @keyframes ${src.frames.size} ↔ ${dist.frames.size} · @property ${src.props.size} ↔ ${dist.props.size} · ` +
    `animation:none ${src.nones.length} ↔ ${dist.nones.length}`;
  if (bad.length) {
    console.error(`[check-dist] ${summary}\n[check-dist] 빌드 CSS 의 애니메이션·트랜지션이 소스와 다르다 (${bad.length}건):\n  ${bad.join('\n  ')}`);
    console.error('[check-dist] 소스를 압축기가 같은 뜻으로 옮기는 꼴로 바꾼다 (예: 이름 없는 animation 단축 속성 → 롱핸드). 이 빌드로 녹화하지 않는다.');
    return 1;
  }
  console.log(`[check-dist] OK — ${summary}`);
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { parseCss, meaning, compare, expand, normSelector };
