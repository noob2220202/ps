#!/usr/bin/env node
/* 우리WON 글자 맞춤 도구 (woori-textfit)
 *
 * 기준 프레임(PNG, frame px 524x1280)에서 글자 한 줄의 잉크 상자와 문자열을 받아, 같은 글자를 Chromium 으로 렌더해
 * font-size(0.25dp 단위)·font-weight·letter-spacing·위치(left / line-height:1 일 때 top, 기준선)를 찾고
 * fitError 와 함께 JSON 으로 낸다. 사용법·출력 형식·주의는 tools/README-textfit.md.
 *
 *   NODE_PATH=/usr/local/lib/node_modules_global node tools/woori-textfit.cjs \
 *     --ref tools/ref/font/hist.png --box 198,71,126,23 --text 거래내역조회 [--weights 500,600,700]
 *
 * 렌더 경로 (--pipeline)
 *   shot  비교 스크린샷과 똑같이: 뷰포트 360x880, deviceScaleFactor 16/11, 앱 셸 transform
 *         translate(-0.2925px, 0.333px) scaleX(1.0023956) (units.md 6.3, 가로 0.24% 비등방). 결과 CSS 를 그대로 쓰면 스크린샷이 이 렌더와 같다.
 *   video 폰 경로 흉내(design): DSF 3 (1080 기기px)으로 크게 렌더 → 가로 1.45803 / 세로 16/11 px/dp 로 면적 평균 축소. 글꼴 식별(spec/font.md)에 썼다.
 *   both  (기본) video 로 크기·굵기·자간(설계값)을 찾고, 그 값으로 shot 경로에서 위치(place)와 스크린샷 오차를 낸다. shot 최적값도 함께.
 *
 * 측정에서 확인한 Chromium 규칙 (DSF 16/11, 글자): 글자 기준선은 기기 px 정수 행에 붙고(top·translateY 소수는 반올림),
 * 가로 글자 위치는 글자마다 1/4 기기 px 로 양자화되며, 레이아웃 위치(left)는 1/64 px 격자다.
 * 그래서 shot 경로는 원점 위상(1/32 px 간격) x 정수 px 이동으로 가능한 렌더를 거의 다 보고, 셸 안에서 1/64dp 격자로 다시 확인한다.
 *
 * fitError = Σ|Y_ref − Y_render| / Σ|Y_ref − Y_bg|  (비교 영역 = 잉크 상자 + margin, 휘도만; YUV 4:2:0 이라 색차는 쓰지 않는다)
 *   0 이면 완전 일치. 같은 글꼴·같은 값: video 0.05–0.15, shot 0.10–0.32 (영상 압축·축소 차이), 다른 글꼴이면 대개 0.2 이상.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TOOLS = __dirname;
const ROOT = path.dirname(TOOLS);
const OUT_DIR = path.join(TOOLS, 'out', 'textfit');
const DEFAULT_FONT_CSS = path.join(ROOT, 'frontend', 'public', 'fonts', 'woori-font.css');
const DEFAULT_FAMILY = 'Pretendard Variable';

// units.json (D1): 세로 16/11 px/dp, 가로 1.45803 px/dp (가운데 262.02 = 180dp). 앱 셸 transform 으로 맞춘다.
const DSF = 16 / 11;
const SX = 1.0023956; // 1.45803 / (16/11)
const TX = -0.2925; // css px (셸 translateX)
const TY = 0.333; // css px (셸 translateY, 상태바 94기기px − 31dp)
const STATUS_DP = 31; // ?frame=1 위 스페이서 31dp + 0.333 translate = 31.333dp
const XPX_PER_DP = 1.45803;
const XC_PX = 262.02;

// ───────────────────────── PNG ─────────────────────────
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 가 아님');
  let p = 8;
  let w; let h; let bd; let ct; let il;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; } else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || il) throw new Error('PNG: 8bit, interlace 없음만 지원');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  if (!ch) throw new Error('PNG color type ' + ct + ' 미지원');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[dst + x - ch] : 0;
      const b = y ? out[dst - stride + x] : 0;
      const c = x >= ch && y ? out[dst - stride + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c; const pa = Math.abs(pp - a); const pb = Math.abs(pp - b); const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[dst + x] = v & 255;
    }
  }
  const n = w * h;
  const Y = new Float32Array(n);
  const R = new Uint8Array(n); const G = new Uint8Array(n); const B = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (ch >= 3) { R[i] = out[i * ch]; G[i] = out[i * ch + 1]; B[i] = out[i * ch + 2]; } else { R[i] = G[i] = B[i] = out[i * ch]; }
    Y[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
  }
  return { w, h, Y, R, G, B };
}

function encodeGrayPng(w, h, px) {
  const crcTable = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(px[y * w + x])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ───────────────────────── 인자 ─────────────────────────
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error('알 수 없는 인자: ' + a);
    const k = a.slice(2);
    if (['no-place', 'help', 'quiet', 'selftest'].includes(k)) { o[k] = true; continue; }
    o[k] = argv[++i];
  }
  return o;
}
const num = (s) => { const v = Number(s); if (!Number.isFinite(v)) throw new Error('숫자가 아님: ' + s); return v; };
const rect = (s) => { const v = String(s).split(',').map(num); if (v.length !== 4) throw new Error('x,y,w,h 형식이 아님: ' + s); return v; };
function rangeList(s, dflt) {
  if (s === undefined || s === null || s === '') return dflt;
  if (Array.isArray(s)) return s.map(num);
  if (typeof s === 'number') return [s];
  s = String(s);
  if (s.includes(':')) {
    const [a, b, st] = s.split(':').map(num);
    const out = [];
    for (let v = a; v <= b + 1e-9; v += st) out.push(+v.toFixed(6));
    return out;
  }
  return s.split(',').map(num);
}
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function parseColor(s) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim());
  if (!m) throw new Error('색은 #rrggbb: ' + s);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
}
const lumaOf = (rgb) => 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
const r2 = (v, d = 2) => +Number(v).toFixed(d);

function resolvePath(p) {
  if (!p) return p;
  if (path.isAbsolute(p)) return p;
  const c1 = path.resolve(process.cwd(), p);
  if (fs.existsSync(c1)) return c1;
  return path.resolve(ROOT, p);
}

// ───────────────────────── 기준 이미지 ─────────────────────────
const refCache = new Map();
function loadRef(p) {
  if (!refCache.has(p)) refCache.set(p, decodePng(fs.readFileSync(p)));
  return refCache.get(p);
}

/** 비교 영역(잉크 상자 + margin), 마스크, 배경/잉크 색 추정 */
function prepareTarget(s) {
  const ref = loadRef(s.ref);
  const [bx, by, bw, bh] = s.box;
  const m = s.margin;
  const reg = s.region || [bx - m, by - m, bw + 2 * m, bh + 2 * m];
  const [rx, ry, rw, rh] = reg.map(Math.round);
  if (rx < 0 || ry < 0 || rx + rw > ref.w || ry + rh > ref.h) throw new Error('비교 영역이 그림 밖: ' + reg);
  const mask = new Uint8Array(rw * rh).fill(1);
  for (const mk of s.mask || []) {
    const [mx, my, mw, mh] = mk;
    for (let y = Math.max(0, my - ry); y < Math.min(rh, my + mh - ry); y++) for (let x = Math.max(0, mx - rx); x < Math.min(rw, mx + mw - rx); x++) mask[y * rw + x] = 0;
  }
  const Y = new Float32Array(rw * rh);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) Y[y * rw + x] = ref.Y[(ry + y) * ref.w + rx + x];
  // 배경 = 잉크 상자 바깥 고리(영역 안)의 중앙값 RGB
  const ringR = []; const ringG = []; const ringB = [];
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const X = rx + x; const Yy = ry + y;
      if (X >= bx - 1 && X <= bx + bw && Yy >= by - 1 && Yy <= by + bh) continue;
      if (!mask[y * rw + x]) continue;
      const i = Yy * ref.w + X; ringR.push(ref.R[i]); ringG.push(ref.G[i]); ringB.push(ref.B[i]);
    }
  }
  const med = (a) => { if (!a.length) return 255; const b = a.slice().sort((p, q) => p - q); return b[b.length >> 1]; };
  const bgAuto = ringR.length ? [med(ringR), med(ringG), med(ringB)] : [255, 255, 255];
  const bg = s.bg && s.bg !== 'auto' ? parseColor(s.bg) : bgAuto;
  const bgY = lumaOf(bg);
  // 잉크 = 상자 안에서 배경과 가장 먼 4% 화소 평균 (굵은 글자의 '코어'. 얇은 글자는 실제보다 옅다 → --color 권장)
  const px = [];
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) { const i = y * ref.w + x; px.push([Math.abs(ref.Y[i] - bgY), ref.R[i], ref.G[i], ref.B[i]]); }
  px.sort((a, b) => b[0] - a[0]);
  const k = Math.max(3, Math.round(px.length * 0.04));
  const core = [0, 0, 0];
  for (let i = 0; i < k; i++) for (let c = 0; c < 3; c++) core[c] += px[i][c + 1] / k;
  const color = s.color && s.color !== 'auto' ? parseColor(s.color) : core;
  let denom = 0; let cx = 0; let cy = 0; let mass = 0;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (!mask[y * rw + x]) continue;
      const a = Math.abs(Y[y * rw + x] - bgY);
      denom += a;
      const al = Math.max(0, (bgY - Y[y * rw + x]) / (bgY - lumaOf(color) || 1));
      mass += al; cx += al * x; cy += al * y;
    }
  }
  return { ref, reg: [rx, ry, rw, rh], mask, Y, bg, bgY, color, colorAuto: !(s.color && s.color !== 'auto'), core, denom, cx: rx + cx / mass, cy: ry + cy / mass, mass };
}

// ───────────────────────── 브라우저 ─────────────────────────
let chromium = null;
function needPlaywright() {
  if (!chromium) {
    try { ({ chromium } = require('playwright')); } catch (e) { throw new Error('playwright 를 못 찾음: NODE_PATH=/usr/local/lib/node_modules_global 로 실행하세요'); }
  }
  return chromium;
}

function pageHtml(cssFiles, kind) {
  const links = cssFiles.map((c) => `<link rel="stylesheet" href="${'file://' + c}">`).join('\n');
  const stage = kind === 'frame'
    ? `<div style="height:${STATUS_DP}px"></div><div id="stage" style="position:relative;width:360px;height:800.667px;overflow:hidden;transform-origin:0 0;transform:translate(${TX}px, ${TY}px) scaleX(${SX})"></div>`
    : kind === 'shotbatch'
      ? `<div id="stage" style="position:absolute;left:0;top:0;width:100%;height:100%;transform-origin:0 0;transform:translate(${TX}px, 0px) scaleX(${SX})"></div>`
      : '<div id="stage" style="position:absolute;left:0;top:0;width:100%;height:100%"></div>';
  return `<!doctype html><html><head><meta charset="utf-8">${links}<style>
html,body{margin:0;padding:0;background:#fff;overflow:hidden}
.t{position:absolute;white-space:pre;line-height:1;margin:0;padding:0;font-kerning:normal;-webkit-font-smoothing:antialiased;text-rendering:auto}
.p{display:inline-block;width:0;height:0;vertical-align:baseline}
</style></head><body>${stage}</body></html>`;
}

class Renderer {
  constructor() { this.browser = null; this.pages = new Map(); }
  async start() { if (!this.browser) this.browser = await needPlaywright().launch(); }
  async page(kind, cssFiles, vw, vh, dsf) {
    const key = [kind, cssFiles.join('|'), vw, vh, dsf].join('#');
    if (this.pages.has(key)) return this.pages.get(key);
    await this.start();
    const ctx = await this.browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dsf });
    const pg = await ctx.newPage();
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, `page-${process.pid}-${this.pages.size}.html`);
    fs.writeFileSync(file, pageHtml(cssFiles, kind));
    await pg.goto('file://' + file);
    const rec = { pg, kind, vw, vh, dsf, file };
    this.pages.set(key, rec);
    return rec;
  }
  /** rows: [{text,family,weight,size,ls,numeric,features,color,left,top,ty}] → 레이아웃 + 스크린샷 */
  async render(rec, rows, bg, clip) {
    const info = await rec.pg.evaluate(async ({ rows, bg }) => {
      document.documentElement.style.background = bg;
      document.body.style.background = bg;
      const st = document.getElementById('stage');
      st.innerHTML = '';
      const loads = new Set();
      for (const r of rows) {
        const d = document.createElement('div');
        d.className = 't';
        d.style.left = r.left + 'px';
        d.style.top = r.top + 'px';
        if (r.ty) d.style.transform = `translateY(${r.ty}px)`;
        const fam = /[,"']/.test(r.family) ? r.family : `"${r.family}"`;
        d.style.fontFamily = fam;
        d.style.fontWeight = String(r.weight);
        d.style.fontSize = r.size + 'px';
        d.style.letterSpacing = r.ls + 'em';
        d.style.color = r.color;
        d.style.fontVariantNumeric = r.numeric === 'tabular' ? 'tabular-nums' : 'normal';
        if (r.features) d.style.fontFeatureSettings = r.features;
        d.textContent = r.text;
        const p = document.createElement('span'); p.className = 'p'; d.appendChild(p);
        st.appendChild(d);
        loads.add(`${r.weight} ${r.size}px ${fam}|${r.text}`);
      }
      await Promise.all([...loads].map((k) => { const [f, t] = k.split('|'); return document.fonts.load(f, t).catch(() => null); }));
      await document.fonts.ready;
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const sr = st.getBoundingClientRect();
      return [...st.children].map((d) => {
        const p = d.lastChild.getBoundingClientRect();
        const b = d.getBoundingClientRect();
        // 이 행에 실제로 쓰인 글꼴이 요청한 글꼴인지 (fallback 감지)
        return { width: b.width, height: b.height, baseline: p.top - b.top, relTop: b.top - sr.top, ok: document.fonts.check(`${d.style.fontWeight} ${d.style.fontSize} ${d.style.fontFamily}`, d.textContent) };
      });
    }, { rows, bg });
    const png = decodePng(await rec.pg.screenshot(clip ? { type: 'png', clip } : { type: 'png' }));
    return { info, png };
  }
  async close() { if (this.browser) await this.browser.close(); this.browser = null; this.pages.clear(); }
}

// ───────────────────────── 비교 ─────────────────────────
/** 패치(렌더 화소, 좌상단이 frame 좌표 (ox,oy) 에 놓임)와 기준 영역의 오차 */
function errAt(T, patch, ox, oy) {
  const [rx, ry, rw, rh] = T.reg;
  let e = 0; let sr = 0; let sp = 0; let sx2 = 0; let sxy = 0;
  for (let y = 0; y < rh; y++) {
    const py = ry + y - oy;
    for (let x = 0; x < rw; x++) {
      const i = y * rw + x;
      if (!T.mask[i]) continue;
      const px = rx + x - ox;
      const v = px >= 0 && py >= 0 && px < patch.w && py < patch.h ? patch.Y[py * patch.w + px] : patch.bgY;
      const d = T.Y[i] - v;
      e += d < 0 ? -d : d;
      const ar = T.bgY - T.Y[i]; const ap = T.bgY - v;
      sr += ar; sp += ap; sx2 += ap * ap; sxy += ar * ap;
    }
  }
  return { err: e / T.denom, inkRatio: sp ? sr / sp : 0, inkScale: sx2 ? sxy / sx2 : 0 };
}

function regionImg(T, patch, ox, oy) {
  const [rx, ry, rw, rh] = T.reg;
  const out = new Float32Array(rw * rh);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) { const px = rx + x - ox; const py = ry + y - oy; out[y * rw + x] = px >= 0 && py >= 0 && px < patch.w && py < patch.h ? patch.Y[py * patch.w + px] : patch.bgY; }
  return out;
}

function patchCentroid(patch) {
  let m = 0; let cx = 0; let cy = 0;
  for (let y = 0; y < patch.h; y++) for (let x = 0; x < patch.w; x++) { const a = Math.abs(patch.bgY - patch.Y[y * patch.w + x]); m += a; cx += a * x; cy += a * y; }
  return m ? { x: cx / m, y: cy / m, m } : { x: patch.w / 2, y: patch.h / 2, m: 0 };
}

/** 정수 px 이동 탐색 (무게중심에서 시작, 언덕 오르기) */
function alignInt(T, patch) {
  const c = patchCentroid(patch);
  let bx = Math.round(T.cx - c.x); let by = Math.round(T.cy - c.y);
  const seen = new Map();
  const ev = (x, y) => { const k = x + ',' + y; if (!seen.has(k)) seen.set(k, errAt(T, patch, x, y)); return seen.get(k); };
  let best = ev(bx, by);
  for (let it = 0; it < 12; it++) {
    let moved = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const r = ev(bx + dx, by + dy);
        if (r.err < best.err - 1e-9) { best = r; bx += dx; by += dy; moved = true; }
      }
    }
    if (!moved) break;
  }
  return { ...best, ox: bx, oy: by };
}

function cutPatch(png, x0, y0, w, h, bgY) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  const Y = new Float32Array(w * h).fill(bgY);
  for (let y = 0; y < h; y++) {
    const yy = y0 + y; if (yy < 0 || yy >= png.h) continue;
    for (let x = 0; x < w; x++) { const xx = x0 + x; if (xx < 0 || xx >= png.w) continue; Y[y * w + x] = png.Y[yy * png.w + xx]; }
  }
  return { Y, w, h, x0, y0, bgY };
}

// video 경로: DSF 3 렌더 조각을 (frame 좌표 원점 fx0,fy0 에서) 면적 평균 축소
function weights1d(n0, outLen, scale, off) {
  // 출력 칸 k 는 입력 [off + k*scale, off + (k+1)*scale) 를 덮는다 (scale = 입력 px / 출력 px)
  const ws = [];
  for (let k = 0; k < outLen; k++) {
    const a = off + k * scale; const b = a + scale; const list = [];
    for (let u = Math.max(0, Math.floor(a)); u < Math.min(n0, Math.ceil(b)); u++) { const ov = Math.min(b, u + 1) - Math.max(a, u); if (ov > 0) list.push([u, ov / scale]); }
    ws.push(list);
  }
  return ws;
}
function vpass(hi, outH, sy, offY, bgY) {
  const wy = weights1d(hi.h, outH, sy, offY);
  const tmp = new Float32Array(outH * hi.w);
  for (let k = 0; k < outH; k++) {
    const lst = wy[k]; let cov = 0;
    for (let q = 0; q < lst.length; q++) cov += lst[q][1];
    const base = (1 - cov) * bgY;
    for (let u = 0; u < hi.w; u++) tmp[k * hi.w + u] = base;
    for (let q = 0; q < lst.length; q++) { const v = lst[q][0]; const w = lst[q][1]; const o = v * hi.w; for (let u = 0; u < hi.w; u++) tmp[k * hi.w + u] += w * hi.Y[o + u]; }
  }
  return tmp;
}
function hpass(tmp, hw, outW, outH, sx, offX, bgY) {
  const wx = weights1d(hw, outW, sx, offX);
  const out = new Float32Array(outW * outH);
  for (let j = 0; j < outW; j++) {
    const lst = wx[j]; let cov = 0;
    for (let q = 0; q < lst.length; q++) cov += lst[q][1];
    for (let k = 0; k < outH; k++) { let s = (1 - cov) * bgY; for (let q = 0; q < lst.length; q++) s += lst[q][1] * tmp[k * hw + lst[q][0]]; out[k * outW + j] = s; }
  }
  return out;
}

// ───────────────────────── 맞춤 ─────────────────────────
function defaults(s) {
  return {
    weights: [400, 500, 600, 700],
    family: DEFAULT_FAMILY,
    fontCss: DEFAULT_FONT_CSS,
    numeric: 'proportional',
    pipeline: 'both',
    margin: 4,
    ls: null,
    size: null,
    top: 6,
    place: true,
    ...s,
  };
}

function normSample(raw) {
  const s = defaults({});
  const map = { 'font-css': 'fontCss', 'no-place': 'noPlace', 'debug-png': 'debugPng' };
  for (const [k0, v] of Object.entries(raw)) { const k = map[k0] || k0; s[k] = v; }
  if (!s.ref || !s.box || s.text === undefined) throw new Error('ref, box, text 는 꼭 줘야 한다');
  s.ref = resolvePath(s.ref);
  s.box = Array.isArray(s.box) ? s.box.map(num) : rect(s.box);
  if (s.region && !Array.isArray(s.region)) s.region = rect(s.region);
  if (s.mask && !Array.isArray(s.mask)) s.mask = String(s.mask).split(';').filter(Boolean).map(rect);
  s.weights = rangeList(s.weights, [400, 500, 600, 700]);
  s.margin = num(s.margin);
  s.fontCss = (Array.isArray(s.fontCss) ? s.fontCss : String(s.fontCss).split(',')).map(resolvePath);
  for (const c of s.fontCss) if (!fs.existsSync(c)) throw new Error('글꼴 CSS 없음: ' + c);
  if (s.noPlace) s.place = false;
  s.text = String(s.text);
  if (!['shot', 'video', 'both'].includes(s.pipeline)) throw new Error('--pipeline both|shot|video');
  if (!['proportional', 'tabular', 'both'].includes(s.numeric)) throw new Error('--numeric proportional|tabular|both');
  return s;
}

/** 후보 여러 개를 한 장(또는 여러 장)에 렌더하고 각 후보의 최적 정렬·오차를 낸다 */
async function evalCandidates(R, s, T, cands, keepImg = false) {
  const video = s.pipeline === 'video';
  const dsf = video ? 3 : DSF;
  // 격자: 칸 폭은 글자 폭에 맞춰 좁게, 스크린샷은 쓴 영역만 (clip) — 큰 PNG 인코드/디코드가 가장 비싸다
  const colW = Math.ceil(T.reg[2] / XPX_PER_DP * 1.3) + 24;
  const vw = video ? 800 : 1400;
  const vh = video ? 700 : 1400;
  const rec = await R.page(video ? 'video' : 'shotbatch', s.fontCss, vw, vh, dsf);
  const maxSize = Math.max(...cands.map((c) => c.size));
  // 줄 간격: 한 줄을 잘라 볼 때(위아래 padY) 이웃 줄 글자가 섞이면 안 된다.
  // video 경로는 padY 가 dp 단위(ceil(0.6·size)+6)라 예전 간격(ceil(1.35·size)+6)이면 15dp 에서 3dp 겹쳐
  // 무게중심 출발점이 틀어지고 둥근 값(15/0)이 1.19 같은 엉뚱한 오차를 받았다(critic-launch). 두 경로 모두 이 간격을 쓴다.
  const pitch = Math.ceil(maxSize + Math.ceil(maxSize * 0.6) + 6) + 4;
  const perCol = Math.max(1, Math.floor((vh - 20) / pitch));
  const cols = Math.max(1, Math.floor((vw - 10) / colW));
  const per = perCol * cols;
  const colorHex = hex(T.color); const bgHex = hex(T.bg);
  const results = [];
  for (let i0 = 0; i0 < cands.length; i0 += per) {
    const chunk = cands.slice(i0, i0 + per);
    const rows = chunk.map((c, j) => {
      const col = Math.floor(j / perCol); const rowi = j % perCol;
      const top = 10 + rowi * pitch;
      let left = col * colW + 10;
      if (!video) {
        // 가로 위상: 글자 원점을 기기 px 정수 + phase(0–1 소수) 에 놓는다. 글자마다 1/4 px 로 양자화되므로
        // 원점의 소수 위치가 바뀌면 (같은 1/4 칸 안이라도) 뒤쪽 글자가 다른 칸으로 넘어갈 수 있다 → 다듬기에서 1/32 px 간격으로 본다
        const xdev = DSF * (TX + SX * left);
        const target = Math.floor(xdev) + (c.phase === undefined ? 0.125 : c.phase);
        // Blink 레이아웃은 위치를 1/64 px(LayoutUnit)로 저장한다 → 그 격자 위의 값만 쓴다(렌더와 계산이 정확히 같게)
        left = Math.round(((target / DSF - TX) / SX) * 64) / 64;
      }
      return { text: s.text, family: s.family, weight: c.weight, size: c.size, ls: c.ls, numeric: c.numeric, features: s.features, color: colorHex, left, top, ty: 0 };
    });
    const usedCols = Math.ceil(chunk.length / perCol);
    const clip = { x: 0, y: 0, width: Math.min(vw, usedCols * colW + 20), height: Math.min(vh, (chunk.length >= perCol ? perCol : chunk.length) * pitch + pitch + 20) };
    const { info, png } = await R.render(rec, rows, bgHex, clip);
    rows.forEach((row, j) => {
      const c = chunk[j]; const inf = info[j];
      const padX = 6; const padY = Math.ceil(row.size * 0.6) + 6;
      let r;
      if (!video) {
        const x0 = Math.floor(DSF * (TX + SX * row.left)) - padX; const y0 = Math.floor(DSF * row.top) - padY;
        const w = Math.ceil(DSF * SX * inf.width) + 2 * padX; const h = Math.ceil(DSF * row.size) + 2 * padY;
        const patch = cutPatch(png, x0, y0, w, h, T.bgY);
        const a = alignInt(T, patch);
        // 프레임에서 이 행의 글자 상자 왼쪽/위 (frame px, 소수) = 행 위치 + 정렬 이동
        const fx = DSF * (TX + SX * row.left) - x0 + a.ox; const fy = DSF * row.top - y0 + a.oy;
        r = { ...c, pipe: 'shot', err: a.err, inkScale: a.inkScale, inkRatio: a.inkRatio, frameLeftPx: fx, frameTopPx: fy, width: inf.width, baseline: inf.baseline, fontOk: inf.ok };
        if (keepImg) r.img = regionImg(T, patch, a.ox, a.oy);
      } else {
        // 고해상 조각 → 기준 영역 크기로 축소. 가로 0.25 기기px, 세로 1 기기px 격자에서 원점 탐색
        const hx0 = Math.floor(3 * row.left) - 18; const hy0 = Math.floor(3 * row.top) - 3 * padY;
        const hw = Math.ceil(3 * inf.width) + 36; const hh = Math.ceil(3 * row.size) + 6 * padY;
        const hi = cutPatch(png, hx0, hy0, hw, hh, T.bgY);
        const [rx, ry, rw, rh] = T.reg;
        const sx = 3 / XPX_PER_DP; const sy = 3 / DSF;
        // 무게중심으로 첫 원점: 고해상 무게중심(기기 px) ↔ 기준 무게중심(frame px)
        const hc = patchCentroid(hi);
        // frame 좌표 X 에 대응하는 hi 좌표 = (X - fx0)*sx  (fx0 = hi 의 원점 x0 가 놓이는 frame 좌표)
        const fx0c = T.cx - hc.x / sx; const fy0c = T.cy - hc.y / sy;
        const stepX = 0.25 / sx; const stepY = 1 / sy; // 가로 1/4 기기px, 세로 1 기기px 격자
        const fyBase = Math.round(fy0c / stepY) * stepY; const fxBase = Math.round(fx0c / stepX) * stepX;
        const vcache = new Map(); const ecache = new Map();
        const ev = (ix, iy) => {
          const key = ix + ',' + iy;
          if (ecache.has(key)) return ecache.get(key);
          const fx0 = fxBase + ix * stepX; const fy0 = fyBase + iy * stepY;
          if (!vcache.has(iy)) vcache.set(iy, vpass(hi, rh, sy, (ry - fy0) * sy, T.bgY));
          const out = hpass(vcache.get(iy), hi.w, rw, rh, sx, (rx - fx0) * sx, T.bgY);
          const e = { ...errAt(T, { Y: out, w: rw, h: rh, bgY: T.bgY }, rx, ry), fx0, fy0, ix, iy };
          ecache.set(key, e);
          return e;
        };
        let best = ev(0, 0);
        // 성긴 격자(약 1px)에서 언덕 오르기 → 고운 격자
        for (const [gx, gy, lim] of [[8, 2, 12], [2, 1, 6], [1, 1, 6]]) {
          for (let it = 0; it < lim; it++) {
            let moved = false;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
              const rr = ev(best.ix + dx * gx, best.iy + dy * gy);
              if (rr.err < best.err - 1e-9) { best = rr; moved = true; }
            }
            if (!moved) break;
          }
        }
        r = { ...c, pipe: 'video', err: best.err, inkScale: best.inkScale, inkRatio: best.inkRatio, frameLeftPx: best.fx0 + (3 * row.left - hx0) / sx, frameTopPx: best.fy0 + (3 * row.top - hy0) / sy, width: inf.width, baseline: inf.baseline, fontOk: inf.ok };
        if (keepImg) { const vt = vpass(hi, rh, sy, (ry - best.fy0) * sy, T.bgY); r.img = hpass(vt, hi.w, rw, rh, sx, (rx - best.fx0) * sx, T.bgY); }
      }
      results.push(r);
    });
  }
  return results;
}

function uniqCands(list) {
  const seen = new Set(); const out = [];
  for (const c of list) { const k = [c.weight, c.size, c.ls, c.numeric, c.phase || 0].join('|'); if (!seen.has(k)) { seen.add(k); out.push(c); } }
  return out;
}

/** 한 렌더 경로로 크기·굵기·자간을 찾는다 (3단계: 굵기x크기 → 자간 → 다듬기) */
async function search(R, s, T, pipeline) {
  const sp = { ...s, pipeline };
  const numerics = s.numeric === 'both' ? ['proportional', 'tabular'] : [s.numeric];
  const video = pipeline === 'video';
  // 0) 크기 ∝ 잉크 높이: 40dp 시험 렌더의 잉크 높이(frame px)와 기준 잉크 상자 높이의 비
  const wMid = s.weights[Math.floor(s.weights.length / 2)];
  const probeSize = 40;
  const inkH = await measureInkHeight(R, s, T, wMid, probeSize, numerics[0]);
  let S0 = probeSize * (s.box[3] / inkH);
  const sizeList = s.size ? rangeList(s.size) : null;
  if (sizeList) S0 = sizeList.length === 1 ? sizeList[0] : (sizeList[0] + sizeList[sizeList.length - 1]) / 2;
  const q = (v) => Math.round(v * 4) / 4;
  // 1) 굵기 x 크기 (자간 0 또는 주어진 값의 가운데)
  let sizes;
  if (sizeList && sizeList.length > 1) sizes = sizeList.map(q);
  else if (sizeList) sizes = [q(S0)];
  else { sizes = []; for (let v = q(S0 * 0.9); v <= q(S0 * 1.1) + 1e-9; v += 0.25) sizes.push(+v.toFixed(2)); }
  const lsList = s.ls !== null && s.ls !== undefined ? rangeList(s.ls) : null;
  const ls0 = lsList ? lsList[Math.floor(lsList.length / 2)] : 0;
  const c1 = [];
  for (const w of s.weights) for (const sz of sizes) for (const nm of numerics) c1.push({ weight: w, size: sz, ls: ls0, numeric: nm });
  const r1 = await evalCandidates(R, sp, T, c1);
  // 2) 굵기마다 상위 크기 둘레(±0.5) x 자간
  const lsCoarse = lsList || rangeList('-0.06:0.04:0.01');
  const sizeFixed = sizeList && sizeList.length === 1;
  let c2 = [];
  for (const w of s.weights) {
    for (const nm of numerics) {
      const mine = r1.filter((r) => r.weight === w && r.numeric === nm).sort((x, y) => x.err - y.err).slice(0, 2);
      for (const m of mine) for (let d = sizeFixed ? 0 : -0.5; d <= (sizeFixed ? 0 : 0.5) + 1e-9; d += 0.25) for (const l of lsCoarse) c2.push({ weight: w, size: q(m.size + d), ls: l, numeric: nm });
    }
  }
  c2 = uniqCands(c2.filter((c) => c.size > 4));
  const r2r = await evalCandidates(R, sp, T, c2);
  // 3) 다듬기: 굵기마다 최선 + 전체 상위 → 크기 ±0.25, 자간 ±0.005(0.0025 단위), shot 은 가로 위상 4개
  const pick = [];
  for (const w of s.weights) for (const nm of numerics) { const bb = r2r.filter((r) => r.weight === w && r.numeric === nm).sort((x, y) => x.err - y.err)[0]; if (bb) pick.push(bb); }
  for (const bb of r2r.slice().sort((x, y) => x.err - y.err).slice(0, s.top)) pick.push(bb);
  let c3 = [];
  const lsFine = lsList && lsList.length === 1 ? [0] : [-0.005, -0.0025, 0, 0.0025, 0.005];
  const dSizes = sizeFixed ? [0] : [-0.25, 0, 0.25];
  for (const bb of pick) {
    for (const d of dSizes) {
      for (const dl of lsFine) {
        for (const ph of video ? [0] : [0.125, 0.375, 0.625, 0.875]) c3.push({ weight: bb.weight, size: q(bb.size + d), ls: +(bb.ls + dl).toFixed(4), numeric: bb.numeric, phase: ph });
      }
    }
  }
  c3 = uniqCands(c3);
  const r3 = await evalCandidates(R, sp, T, c3);
  let r4 = [];
  let c4 = [];
  if (!video) {
    // 4) shot: 상위 3개를 원점 위상 1/32 px 간격 x 자간 ±0.0025 로 다시 (가능한 렌더를 거의 다 본다)
    const top3 = []; for (const r of r3.slice().sort((x, y) => x.err - y.err)) { if (top3.length >= 3) break; if (!top3.some((t) => t.weight === r.weight && t.size === r.size && t.ls === r.ls && t.numeric === r.numeric)) top3.push(r); }
    for (const bb of top3) for (const dl of lsList && lsList.length === 1 ? [0] : [-0.0025, 0, 0.0025]) for (let k = 0; k < 32; k++) c4.push({ weight: bb.weight, size: bb.size, ls: +(bb.ls + dl).toFixed(4), numeric: bb.numeric, phase: (k + 0.5) / 32 });
    c4 = uniqCands(c4);
    r4 = await evalCandidates(R, sp, T, c4);
  }
  let all = r4.concat(r3, r2r).sort((x, y) => x.err - y.err);
  // 5) 둥근 값 이웃을 직접 렌더: 최적과 같은 굵기·숫자 정렬에서 크기 0.5dp 위/아래 x 자간 0.01em 위/아래·0.
  //    (전에는 이미 본 후보 중에서만 골라, 최적이 500/15/+0.0025 인데 rounded 가 굵기가 다른 400/15/0 으로 나온 일이 있다 — critic-font)
  const isRound = (r) => Math.abs(r.size * 2 - Math.round(r.size * 2)) < 1e-6 && Math.abs(r.ls * 100 - Math.round(r.ls * 100)) < 1e-6;
  const b0 = all[0];
  let c5 = [];
  if (video && b0) {
    const keyOf = (c) => [c.weight, (+c.size).toFixed(4), (+c.ls).toFixed(4), c.numeric].join('|');
    const seen = new Set(all.map(keyOf));
    const rs = [...new Set([Math.floor(b0.size * 2 + 1e-9) / 2, Math.ceil(b0.size * 2 - 1e-9) / 2])];
    const rl = [...new Set([Math.floor(b0.ls * 100 + 1e-9) / 100, Math.ceil(b0.ls * 100 - 1e-9) / 100, 0].map((v) => +v.toFixed(2)))];
    for (const sz of rs) for (const l of rl) { const c = { weight: b0.weight, size: sz, ls: l, numeric: b0.numeric, phase: 0 }; if (!seen.has(keyOf(c))) { seen.add(keyOf(c)); c5.push(c); } }
    if (c5.length) all = all.concat(await evalCandidates(R, sp, T, c5)).sort((x, y) => x.err - y.err);
  }
  const byWeight = {};
  for (const w of s.weights) {
    for (const nm of numerics) {
      const bb = all.find((r) => r.weight === w && r.numeric === nm);
      if (bb) byWeight[w + (numerics.length > 1 ? '/' + nm : '')] = summary(bb, sp);
    }
  }
  const alts = [];
  for (const r of all) { if (alts.length >= 6) break; if (!alts.some((x) => x.weight === r.weight && x.fontSizeDp === r.size && x.numeric === r.numeric && Math.abs(x.letterSpacingEm - r.ls) < 1e-6)) alts.push(summary(r, sp)); }
  // 둥근 값(크기 0.5dp, 자간 0.01em 단위) 중 최선 — 최적과 같은 굵기·숫자 정렬에서만 (굵기가 바뀌면 다른 답이다)
  const round = all.find((r) => isRound(r) && r.weight === b0.weight && r.numeric === b0.numeric);
  return { best: all[0], round, byWeight, alts, evaluated: c1.length + c2.length + c3.length + c4.length + c5.length };
}

/** 주어진 값(굵기·크기·자간·숫자)을 shot 경로로 가로 위상 4개 렌더해 정렬·오차를 얻는다 */
async function shotOf(R, s, T, v) {
  const phases = []; for (let k = 0; k < 32; k++) phases.push((k + 0.5) / 32);
  const rs = await evalCandidates(R, { ...s, pipeline: 'shot' }, T, phases.map((ph) => ({ weight: v.weight, size: v.size, ls: v.ls, numeric: v.numeric, phase: ph })));
  return rs.sort((x, y) => x.err - y.err)[0];
}

async function fitOne(R, raw) {
  const t0 = Date.now();
  const s = normSample(raw);
  const T = prepareTarget(s);
  const out = {
    id: s.id,
    ref: path.relative(ROOT, s.ref),
    box: s.box,
    text: s.text,
    pipeline: s.pipeline,
    font: { family: s.family, css: s.fontCss.map((c) => path.relative(ROOT, c)), numeric: s.numeric },
    color: { text: hex(T.color), textSource: T.colorAuto ? 'auto(core 4%)' : 'given', core: hex(T.core), bg: hex(T.bg) },
    region: T.reg,
  };
  let rec; // 권장 결과 (best 로 낸다)
  let evaluated = 0;
  if (s.pipeline === 'video' || s.pipeline === 'both') {
    const v = await search(R, s, T, 'video');
    evaluated += v.evaluated;
    out.design = { ...summary(v.best, { pipeline: 'video' }), byWeight: v.byWeight, alternatives: v.alts };
    if (v.round) out.design.rounded = summary(v.round, { pipeline: 'video' });
    rec = v.best;
    if (s.pipeline === 'both') {
      // 설계값을 실제 스크린샷 경로(DSF 16/11)로 렌더했을 때의 오차·위치
      const ds = await shotOf(R, s, T, v.best);
      out.design.shotFitError = r2(ds.err, 4);
      rec = ds;
      if (v.round && (v.round.size !== v.best.size || v.round.ls !== v.best.ls || v.round.weight !== v.best.weight)) {
        const rs = await shotOf(R, s, T, v.round);
        out.design.rounded.shotFitError = r2(rs.err, 4);
      }
    }
  }
  if (s.pipeline === 'shot' || s.pipeline === 'both') {
    const sh = await search(R, s, T, 'shot');
    evaluated += sh.evaluated;
    out.shot = { ...summary(sh.best, { pipeline: 'shot' }), byWeight: sh.byWeight, alternatives: sh.alts };
    if (s.pipeline === 'shot') rec = sh.best;
  }
  out.best = summary(rec, { pipeline: rec.pipe });
  out.best.source = s.pipeline === 'both' ? 'design (video 경로로 찾은 값, fitError 는 shot 렌더 오차)' : s.pipeline;
  if (rec.fontOk === false) out.warning = '요청한 글꼴로 렌더되지 않았을 수 있다 (document.fonts.check 실패) — --font-css / --family 확인';
  if (T.colorAuto && rec.inkScale > 1.08) out.note = `영상 잉크가 렌더보다 ${r2((rec.inkScale - 1) * 100, 0)}% 진하다: 얇은 글자라 코어 색이 옅게 잡혔을 수 있다 → --color 로 실제 글자색을 주고 다시 맞춰 보라`;
  if (rec.pipe === 'shot' && s.place) out.place = await place(R, s, T, rec);
  if (s.debugPng) await debugPng(R, { ...s, pipeline: rec.pipe }, T, rec, out);
  out.evaluated = evaluated;
  out.ms = Date.now() - t0;
  return out;
}

function summary(r, s) {
  const o = {
    weight: r.weight,
    fontSizeDp: r.size,
    letterSpacingEm: r.ls,
    letterSpacingDp: r2(r.ls * r.size, 3),
    numeric: r.numeric,
    fitError: r2(r.err, 4),
    inkScale: r2(r.inkScale, 3),
    advanceDp: r2(r.width / (s.pipeline === 'video' ? 1 : SX), 2),
  };
  // 글자 상자(왼쪽 위) 위치: frame px → 앱 dp
  const xApp = s.pipeline === 'video' ? 180 + (r.frameLeftPx - XC_PX) / XPX_PER_DP : (r.frameLeftPx / DSF - TX) / SX;
  o.boxLeftFramePx = r2(r.frameLeftPx, 2);
  o.boxTopFramePx = r2(r.frameTopPx, 2);
  o.leftDp = r2(xApp, 2);
  o.topDpApprox = r2(r.frameTopPx / DSF - STATUS_DP - TY, 2);
  o.baselineOffsetDp = r2(r.baseline, 3);
  if (r.phase !== undefined) o.phase = r.phase;
  return o;
}

async function measureInkHeight(R, s, T, w, size, numeric) {
  const rec = await R.page('shotbatch', s.fontCss, 600, 300, DSF);
  const row = { text: s.text, family: s.family, weight: w, size, ls: 0, numeric, color: '#000000', left: 10, top: 40, ty: 0 };
  const { png } = await R.render(rec, [row], '#ffffff');
  let y0 = 1e9; let y1 = -1;
  for (let y = 0; y < png.h; y++) for (let x = 0; x < png.w; x++) if (png.Y[y * png.w + x] < 255 * (1 - 0.15)) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (y1 < 0) throw new Error('시험 렌더에 잉크가 없다 (글꼴/문자열 확인)');
  return y1 - y0 + 1;
}

/** 실제 ?frame=1 구조(31dp 스페이서 + 셸 transform)에서 CSS 값(left, top 정수 dp, translateY)을 찾아 같은 렌더가 나오는지 확인 */
async function place(R, s, T, best) {
  const rec = await R.page('frame', s.fontCss, 360, 880, DSF);
  const colorHex = hex(T.color); const bgHex = hex(T.bg);
  // 목표 가로: 탐색에서 찾은 글자 원점(frame px) → 앱 dp, Blink 위치 격자(1/64 dp)로. 원점 소수 위치가 글자별 1/4 px 양자화를 정하므로 정수 dp 로 반올림하지 않는다
  const L0 = Math.round(((best.frameLeftPx / DSF - TX) / SX) * 64) / 64;
  const yApp = best.frameTopPx / DSF - STATUS_DP - TY;
  const T0 = Math.round(yApp);
  const tops = [];
  for (let d = -2; d <= 2; d++) for (const ty of [0, 0.25, -0.25, 0.5, -0.5]) tops.push({ top: T0 + d, ty });
  // 11dp 주기(= 16 frame px)로 사본을 쌓아 한 장에 여러 후보를 본다
  const span = Math.ceil((best.size * 1.6) / 11) + 1;
  const res = [];
  const [, ry, , rh] = T.reg;
  const kMin = Math.ceil((10 - yApp) / 11); const kMax = Math.floor((790 - best.size * 1.3 - yApp) / 11);
  const ks = []; for (let k = kMin; k <= kMax; k += span) ks.push(k);
  if (!ks.length) throw new Error('place: 높이가 모자람');
  const runCopies = async (list) => {
    const out = [];
    for (let i0 = 0; i0 < list.length; i0 += ks.length) {
      const chunk = list.slice(i0, i0 + ks.length);
      const rows = chunk.map((c, j) => ({ text: s.text, family: s.family, weight: best.weight, size: best.size, ls: best.ls, numeric: best.numeric, features: s.features, color: colorHex, left: c.left, top: c.top + 11 * ks[j], ty: c.ty }));
      const { info, png } = await R.render(rec, rows, bgHex);
      chunk.forEach((c, j) => {
        // 사본 k 는 16k px 아래: 그림을 16k px 올려 기준과 비교
        const k = ks[j];
        const patch = cutPatch(png, 0, 16 * k, png.w, png.h - 16 * k, T.bgY);
        if (ry + rh > patch.h) return;
        const e = errAt(T, { ...patch, x0: 0, y0: 0 }, 0, 0);
        out.push({ ...c, err: e.err, baseline: info[j].baseline });
      });
    }
    return out;
  };
  // (1) 세로: top 정수 dp x translateY (left = L0)
  res.push(...await runCopies(tops.map((t) => ({ ...t, left: L0 }))));
  res.sort((a, b) => a.err - b.err || Math.abs(a.ty) - Math.abs(b.ty));
  const sameY = res.filter((r) => Math.abs(r.err - res[0].err) < 1e-6);
  const yPick = sameY.find((r) => r.ty === 0) || sameY.sort((a, c) => Math.abs(a.ty) - Math.abs(c.ty))[0];
  // (2) 가로: left 를 1/64 dp 격자에서 ±6칸 (Blink 위치 격자 때문에 탐색 원점과 조금 다를 수 있다)
  const xs = []; for (let j = -6; j <= 6; j++) if (j) xs.push({ top: yPick.top, ty: yPick.ty, left: L0 + j / 64 });
  const resX = [yPick, ...await runCopies(xs)].sort((a, b) => a.err - b.err || Math.abs(a.left - L0) - Math.abs(b.left - L0));
  const pickR = resX[0];
  const L = pickR.left;
  const baselineDpApp = pickR.top + pickR.ty + pickR.baseline;
  return {
    css: { position: 'absolute', left: L, top: pickR.top, transform: pickR.ty ? `translateY(${pickR.ty}px)` : 'none', fontSize: best.size, fontWeight: best.weight, letterSpacing: `${best.ls}em`, lineHeight: 1, fontVariantNumeric: best.numeric === 'tabular' ? 'tabular-nums' : 'normal', color: hex(T.color) },
    fitError: r2(pickR.err, 4),
    searchError: r2(best.err, 4),
    baselineDpApp: r2(baselineDpApp, 3),
    baselineDpScreen: r2(baselineDpApp + STATUS_DP + TY, 3),
    baselineFramePx: r2((baselineDpApp + STATUS_DP + TY) * DSF, 2),
    note: pickR.err > best.err + 0.002 ? '셸 안 렌더가 탐색 렌더보다 나쁘다 (top/translateY 로 같은 행을 못 만듦) — fitError 는 이 값이 진짜'
      : pickR.err < best.err - 0.002 ? '셸 안에서 top/translateY·left 를 다시 고르니 탐색 렌더보다 맞았다 (fitError 는 이 값)' : undefined,
  };
}

async function debugPng(R, s, T, best, out) {
  // 기준 | 렌더 | 차이(128 = 같음) 를 4배로. place 결과가 있으면 실제 셸 렌더, 없으면 탐색 렌더
  const [rx, ry, rw, rh] = T.reg;
  const sc = 4;
  let rend;
  if (out.place) {
    const rec = await R.page('frame', s.fontCss, 360, 880, DSF);
    const c = out.place.css;
    const { png } = await R.render(rec, [{ text: s.text, family: s.family, weight: c.fontWeight, size: c.fontSize, ls: best.ls, numeric: best.numeric, features: s.features, color: hex(T.color), left: c.left, top: c.top, ty: c.transform === 'none' ? 0 : parseFloat(c.transform.slice(11)) }], hex(T.bg));
    rend = new Float32Array(rw * rh);
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) rend[y * rw + x] = png.Y[(ry + y) * png.w + rx + x];
  } else {
    const [r] = await evalCandidates(R, s, T, [{ weight: best.weight, size: best.size, ls: best.ls, numeric: best.numeric, phase: best.phase }], true);
    rend = r.img;
  }
  const W = rw * sc * 3 + 2 * sc; const H = rh * sc;
  const px = new Float32Array(W * H).fill(128);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < rw * sc; x++) {
      const i = Math.floor(y / sc) * rw + Math.floor(x / sc);
      px[y * W + x] = T.Y[i];
      px[y * W + x + rw * sc + sc] = rend[i];
      px[y * W + x + 2 * (rw * sc + sc)] = 128 + (T.Y[i] - rend[i]);
    }
  }
  fs.mkdirSync(path.dirname(path.resolve(s.debugPng)), { recursive: true });
  fs.writeFileSync(path.resolve(s.debugPng), encodeGrayPng(W, H, px));
  out.debugPng = path.resolve(s.debugPng);
}

// ───────────────────────── main ─────────────────────────
// ───────────────────────── 자체 검증 (--selftest) ─────────────────────────
// 기준 프레임은 tools/ref/font/<이름>.png (git 제외). 없으면 woori_video.py ref 로 만든다 (clean 영상 중앙값, D2 규칙).
const SELF_REFS = {
  hist: ['v1', 1612, 1627], hist2: ['v2', 205, 211], where1: ['v1', 6952, 6960], where2: ['v2', 2588, 2594],
  keypad1: ['v1', 7031, 7033], keypad2: ['v2', 2879, 2882], dup: ['v1', 7116, 7132], bank: ['v2', 2772, 2773],
  detail: ['v1', 6038, 6048], done1: ['v1', 7458, 7483], home: ['v1', 365, 388],
};
// expect: 영상 경로(design)에서 나와야 할 굵기·크기(±0.25dp). pair: 같은 요소를 다른 영상에서 잰 표본 (값이 같아야 한다)
const SELF_SAMPLES = [
  { id: 'title-v1', ref: 'hist', box: [198, 71, 126, 23], text: '거래내역조회', expect: { weight: 600, size: 17 } },
  { id: 'title-v2', ref: 'hist2', box: [198, 71, 126, 23], text: '거래내역조회', expect: { weight: 600, size: 17 }, pair: 'title-v1' },
  { id: 'where-v1', ref: 'where1', box: [30, 152, 300, 29], text: '어디로 이체하시겠어요?', expect: { weight: 700, size: 22 } },
  { id: 'where-v2', ref: 'where2', box: [30, 152, 300, 29], text: '어디로 이체하시겠어요?', expect: { weight: 700, size: 22 }, pair: 'where-v1' },
  { id: 'bank-title', ref: 'bank', box: [29, 152, 319, 29], text: '금융회사를 선택해 주세요', expect: { weight: 700, size: 22 } },
  { id: 'dup-title', ref: 'dup', box: [80, 821, 363, 29], text: '오늘 같은 내용으로 보냈어요!', expect: { weight: 600, size: 22 } },
  { id: 'key4-v2', ref: 'keypad2', box: [77, 883, 20, 26], text: '4', expect: { weight: 500, size: 25 } },
  { id: 'key4-v1', ref: 'keypad1', box: [77, 883, 20, 26], text: '4', expect: { weight: 500, size: 25 }, pair: 'key4-v2' },
  { id: 'balance', ref: 'hist', box: [395, 308, 98, 33], text: '345원', expect: { weight: 700, size: 25 } },
  { id: 'period', ref: 'hist', box: [30, 668, 242, 16], text: '2026.08.21 ~ 2026.11.21', expect: { weight: 600, size: 15 } },
  { id: 'recent-date', ref: 'where1', box: [197, 496, 93, 15], text: '2026.11.21', expect: { weight: 500, size: 14 } },
  { id: 'btn-white', ref: 'hist', box: [361, 449, 41, 23], text: '이체', expect: { weight: 600, size: 17 } },
  { id: 'ad-title', ref: 'done1', box: [65, 890, 275, 24], text: '빌려준 돈, 차용증은 쓰셨나요?', expect: { weight: 600, size: 16 } },
  { id: 'detail-date', ref: 'detail', box: [290, 389, 112, 17], margin: 2, text: '2026.11.20', numeric: 'both', expect: { numeric: 'tabular' } },
];
// 합성 표본: 알려진 CSS 로 ?frame=1 구조에 그려 찍은 그림 → shot 경로로 맞추면 값이 그대로 나와야 한다 (도구 자체 검사)
const SYNTH = [
  { id: 'synth-title', text: '거래내역조회', weight: 600, size: 17, ls: 0, left: 135.75, top: 18, color: '#353536' },
  { id: 'synth-amount', text: '345원', weight: 700, size: 25, ls: -0.01, left: 220.5, top: 260, color: '#333336' },
  { id: 'synth-date', text: '2026.11.21', weight: 500, size: 14, ls: 0, left: 113, top: 455, color: '#848587', numeric: 'tabular' },
];

function ensureRef(name) {
  const file = path.join(TOOLS, 'ref', 'font', name + '.png');
  if (!fs.existsSync(file)) {
    const [v, i0, i1] = SELF_REFS[name];
    const r = require('child_process').spawnSync('python3', [path.join(TOOLS, 'woori_video.py'), 'ref', '--video', v, '--i0', '#' + i0, '--i1', '#' + i1, '--out', file], { stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status !== 0) throw new Error('기준 프레임을 못 만듦: ' + name);
  }
  return file;
}

async function selftest(R, cli) {
  const rows = [];
  // 1) 합성
  const rec = await R.page('frame', [resolvePath(cli['font-css'] || DEFAULT_FONT_CSS)], 360, 880, DSF);
  const synthRows = SYNTH.map((t) => ({ text: t.text, family: cli.family || DEFAULT_FAMILY, weight: t.weight, size: t.size, ls: t.ls, numeric: t.numeric || 'proportional', color: t.color, left: t.left, top: t.top, ty: 0 }));
  await R.render(rec, synthRows, '#ffffff');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const synthPng = path.join(OUT_DIR, 'selftest-synth.png');
  fs.writeFileSync(synthPng, await rec.pg.screenshot({ type: 'png' }));
  const sp = decodePng(fs.readFileSync(synthPng));
  for (const t of SYNTH) {
    // 잉크 상자: 해당 띠에서 배경과 다른 화소
    const y0 = Math.floor(DSF * (STATUS_DP + TY + t.top)) - 4; const y1 = Math.ceil(DSF * (STATUS_DP + TY + t.top + t.size * 1.3)) + 4;
    let bx0 = 1e9; let bx1 = -1; let by0 = 1e9; let by1 = -1;
    for (let y = y0; y < y1; y++) for (let x = 0; x < sp.w; x++) if (sp.Y[y * sp.w + x] < 255 - 255 * 0.15 * (255 - lumaOf(parseColor(t.color))) / 255) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
    const r = await fitOne(R, { ...cli, ref: synthPng, box: [bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1], text: t.text, pipeline: 'shot', numeric: t.numeric ? 'both' : 'proportional', color: t.color, bg: '#ffffff', id: t.id });
    const b = r.shot; const pc = r.place.css;
    const ok = b.weight === t.weight && b.fontSizeDp === t.size && Math.abs(b.letterSpacingEm - t.ls) < 0.0026 && r.place.fitError < 0.01 && pc.top === t.top && Math.abs(pc.left - t.left) < 0.2 && (!t.numeric || b.numeric === t.numeric);
    rows.push({ id: t.id, kind: 'synth', ok, want: `w${t.weight} ${t.size}dp ls${t.ls} top${t.top} left${t.left}${t.numeric ? ' ' + t.numeric : ''}`, got: `w${b.weight} ${b.fontSizeDp}dp ls${b.letterSpacingEm} top${pc.top} left${pc.left} ${b.numeric} err ${r.place.fitError}` });
  }
  // 2) 영상 표본
  const res = {};
  for (const smp of SELF_SAMPLES) {
    const ref = ensureRef(smp.ref);
    const r = await fitOne(R, { ...cli, ...smp, ref, expect: undefined, pair: undefined });
    res[smp.id] = r;
    const d = r.design; const e = smp.expect;
    const checks = [];
    if (e.weight) checks.push(d.weight === e.weight);
    if (e.size) checks.push(Math.abs(d.fontSizeDp - e.size) <= 0.25);
    if (e.numeric) checks.push(d.numeric === e.numeric);
    checks.push(Math.abs(r.place.fitError - r.place.searchError) < 0.002); // 셸 안 렌더 = 탐색 렌더
    checks.push(d.fitError < 0.2);
    let pairNote = '';
    if (smp.pair) {
      const o = res[smp.pair];
      const same = o.design.weight === d.weight && Math.abs(o.design.fontSizeDp - d.fontSizeDp) <= 0.25 && o.place.css.top === r.place.css.top && Math.abs(o.place.css.left - r.place.css.left) <= 0.25;
      checks.push(same);
      pairNote = ` · ${smp.pair} 와 ${same ? '같음' : '다름'} (top ${o.place.css.top}/${r.place.css.top}, left ${o.place.css.left}/${r.place.css.left})`;
    }
    rows.push({ id: smp.id, kind: 'video', ok: checks.every(Boolean), want: JSON.stringify(e), got: `design w${d.weight} ${d.fontSizeDp}dp ls${d.letterSpacingEm} ${d.numeric} err ${d.fitError} · shot err ${r.place.fitError} (shot 최적 w${r.shot.weight} ${r.shot.fontSizeDp}dp ls${r.shot.letterSpacingEm} err ${r.shot.fitError}) · top ${r.place.css.top} left ${r.place.css.left}${pairNote}` });
  }
  return { ok: rows.every((x) => x.ok), rows };
}

const HELP = `우리WON 글자 맞춤 도구 — 자세한 설명은 tools/README-textfit.md
  --ref PNG --box x,y,w,h --text 문자열            (필수, box = 잉크 상자 frame px)
  [--weights 400,500,600,700 | 300:800:50] [--size 17.25 | 16:19:0.25] [--ls -0.03:0.01:0.005]
  [--numeric proportional|tabular|both] [--color #rrggbb|auto] [--bg #rrggbb|auto] [--margin 4]
  [--mask x,y,w,h;...] [--region x,y,w,h] [--family 'Pretendard Variable'] [--font-css a.css,b.css]
  [--pipeline both|shot|video] [--no-place] [--debug-png out.png] [--out result.json] [--quiet]
  --batch samples.json  (배열 또는 {"defaults":{...},"samples":[{id,ref,box,text,...}]})
  --selftest            (합성 3 + 영상 표본 14 자체 검증, 결과 tools/out/textfit/selftest.json)`;

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || (!a.batch && !a.ref && !a.selftest)) { console.log(HELP); process.exit(a.help ? 0 : 1); }
  if (a.selftest) {
    const R0 = new Renderer();
    let st;
    try { const cli = { ...a }; delete cli.selftest; delete cli.out; delete cli.quiet; st = await selftest(R0, cli); } finally { await R0.close(); }
    for (const r of st.rows) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.kind.padEnd(5)} ${r.id.padEnd(12)} 기대 ${r.want}\n                        결과 ${r.got}`);
    console.log(st.ok ? `selftest 통과 (${st.rows.length}개)` : 'selftest 실패');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'selftest.json'), JSON.stringify(st, null, 2) + '\n');
    process.exit(st.ok ? 0 : 1);
  }
  const R = new Renderer();
  let out;
  try {
    if (a.batch) {
      const j = JSON.parse(fs.readFileSync(resolvePath(a.batch), 'utf8'));
      const dflt = Array.isArray(j) ? {} : j.defaults || {};
      const samples = Array.isArray(j) ? j : j.samples;
      const cli = { ...a }; delete cli.batch; delete cli.out; delete cli.quiet;
      out = [];
      for (const smp of samples) {
        const r = await fitOne(R, { ...dflt, ...cli, ...smp });
        out.push(r);
        if (!a.quiet) process.stderr.write(`${r.id || r.text}: w${r.best.weight} ${r.best.fontSizeDp}dp ls ${r.best.letterSpacingEm}em err ${r.best.fitError}${r.place ? ' place ' + r.place.fitError : ''} (${r.ms}ms)\n`);
      }
    } else {
      const smp = { ...a }; delete smp.out; delete smp.quiet;
      out = await fitOne(R, smp);
    }
  } finally {
    await R.close();
  }
  const txt = JSON.stringify(out, null, 2);
  if (a.out) { fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true }); fs.writeFileSync(path.resolve(a.out), txt + '\n'); }
  if (!a.quiet || !a.out) console.log(txt);
}

if (require.main === module) main().catch((e) => { console.error('woori-textfit: ' + (e && e.stack ? e.stack : e)); process.exit(1); });

module.exports = { decodePng, encodeGrayPng, fitOne, Renderer, prepareTarget, normSample };
