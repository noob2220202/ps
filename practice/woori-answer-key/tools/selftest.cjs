#!/usr/bin/env node
/*
 * 하네스 자체 검증 (실제 앱·스펙 없이, 고정 표본으로).
 *   node tools/selftest.cjs [--no-browser] [--no-video] [--keep]
 *
 *  1) 단위 (D1): woori-units.cjs 기준값·왕복·?frame=1 보정 값, compare.py/ref.py/scan.py/woori_video.py 상수가 같은지,
 *     시나리오 이름(shots-lib.cjs ↔ backend/seed.js)
 *  2) 비교: 합성 이미지(524x1280, 고정 난수)로 compare.py — 차이 0, (3,5)px = (2.06,3.44)dp, 띠별 오프셋, 기본·이름 마스크, 요소
 *  3) 레지스트리 병합: shots-lib.cjs loadShots 와 ref.py --list 가 같은 결과 (덮어쓰기·maskAdd·추가·'_' 필드·url 없음 오류)
 *  4) 생성기: 가짜 스펙 1개(spec/fake.json + fake.assets.json + 합성 PNG/SVG)로 spec-to-dp(D1 축별 변환·설계 dp 검사·모르는 키)와
 *     gen-from-spec(WooriArt.ts·WooriArtbox.ts·shots.json·timeline 표·캐릭터 마스크·scenario 규칙·손으로 넣은 필드 유지, --check),
 *     빈 트리, 생성 TS 타입 검사(전역 typescript 가 있으면), check-dist (--selftest + 손으로 만든 src/dist)
 *  5) 브라우저 (--no-browser 로 끔): 포트 5299(사용 중이면 빈 포트, SELFTEST_PORT)에 정적 시험 페이지를 띄워 shot.cjs 로 찍는다
 *       /frame.html   ?frame=1 구성(31dp 스페이서 + 앱 셸 보정 transform + 48dp 스페이서) → 524x1280, 상태바·내비 경계와
 *                     1dp 선·상자 가장자리가 units.md 실험값(D1 식) ±0.1px (상자 ±0.15px), data-ref 박스 dp = 레이아웃 dp
 *       /exact.html   합성 기준 이미지 1:1 → 차이 0
 *       /shift.html   transform 으로 (3,5) frame px 밀기 → 전역·요소 오프셋 (3,5)px = (2.06,3.44)dp
 *       /anim.html    CSS 애니메이션 + WAAPI (--t 위상), /steps.html 클릭 뒤 전환 (--freeze-after-steps)
 *       /late.html    READY 를 1.2초 뒤에 켜는 페이지 (shot= 이면 READY 까지 기다리는지 — 판정 함수가 async 면 안 기다린다)
 *       POST /api/dev/reset  받은 scenario 기록 (리셋 순서·별칭 정규화)
 *     + --full · shots.d 병합 · maskAdd · 이름 마스크 · noDefaultMask · --only · 요약 합치기 · 빈 레지스트리
 *  6) 영상 (tools/ref/video/v1-clean.mp4 가 있을 때, --no-video 로 끔): ref.py 가 woori_video.median_ref 와 같은 그림인지,
 *     median_ref_stack = median_ref, iter_frames = read_frames, ref.py --all/--info, scan.py 짧은 구간
 * 결과: tools/out/_selftest/ (합성 그림만), 영상 확인 그림은 tools/ref/_selftest/ (끝나면 지움, --keep 이면 남김)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const { spawnSync, spawn } = require('child_process');
const U = require('./woori-units.cjs');
const SL = require('./shots-lib.cjs');

const TOOLS = __dirname;
const ROOT = path.dirname(TOOLS);
const OUT = path.join(TOOLS, 'out', '_selftest');
const REF_ST = path.join(TOOLS, 'ref', '_selftest');
const args = process.argv.slice(2);
const NO_BROWSER = args.includes('--no-browser');
const NO_VIDEO = args.includes('--no-video');
const KEEP = args.includes('--keep');
let PORT = Number(process.env.SELFTEST_PORT || 5299);
const resets = [];
let failed = 0;
let passed = 0;

/** msg 가 tail(...) 이면 실패했을 때만 보여 준다 */
function check(name, cond, msg = '') {
  if (msg && typeof msg === 'object') msg = cond ? '' : msg.onlyOnFail;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${msg ? ': ' + msg : ''}`);
  if (cond) passed++; else failed++;
  return cond;
}
const skip = (name, why) => console.log(`SKIP  ${name}: ${why}`);
const section = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(4, 60 - t.length))}`);
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;
const nearOff = (o, dx, dy, tol = 0.6) => !!o && o.dx != null && Math.abs(o.dx - dx) <= tol && Math.abs(o.dy - dy) <= tol;
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, v) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 1)); };

/** 동기 실행 → { status, out, err } (출력은 보여 주지 않는다. 실패 확인용으로 돌려준다) */
function run(cmd, argv, opt = {}) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 256 << 20, ...opt });
  return { status: r.status, out: r.stdout || '', err: r.stderr || '', error: r.error };
}
const node = (script, argv, opt) => run(process.execPath, [path.join(TOOLS, script), ...argv], opt);
const py = (argv, opt) => run('python3', argv, opt);
/** 도구 출력 끝 n 줄 — check() 에 넘기면 실패했을 때만 보인다 */
const tail = (r, n = 12) => ({ onlyOnFail: `\n${((r.out || '') + (r.err || '')).trim().split('\n').slice(-n).join('\n')}` });

/** 서버가 같은 프로세스에 있으므로 비동기 실행 (spawnSync 는 이벤트 루프를 막음) */
function runAsync(cmd, argv, env = {}) {
  return new Promise((ok) => {
    const c = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    let out = '';
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { out += d; });
    c.on('exit', (code) => ok({ status: code, out }));
  });
}

/* ── 작은 PNG 만들기 (가짜 에셋용, RGBA) ───────────────── */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function pngRGBA(w, h, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgba, y * (w * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function pngSize(file) {
  const b = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r'); fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

/* ── 파이썬 조각 ─────────────────────────────────────────── */

// 합성 기준 이미지 (524x1280, 고정 난수) + 비교용 변형: exact / shift(3,5) / pieces / osui(상태바·내비만 다름)
const PY_SYNTH = String.raw`
import sys, os, numpy as np, cv2
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
H, W = 1280, 524
rng = np.random.default_rng(20261121)
yy, xx = np.mgrid[0:H, 0:W]
img = np.zeros((H, W, 3), np.uint8)
img[..., 0] = (205 + 35 * np.sin(xx / 31.0)).astype(np.uint8)
img[..., 1] = (215 + 30 * np.cos(yy / 47.0)).astype(np.uint8)
img[..., 2] = 236
for _ in range(1500):
    x, y = int(rng.integers(-20, W)), int(rng.integers(-20, H))
    w, h = int(rng.integers(3, 70)), int(rng.integers(2, 44))
    c = tuple(int(v) for v in rng.integers(0, 256, 3))
    cv2.rectangle(img, (x, y), (x + w, y + h), c, -1 if rng.random() < 0.7 else 1)
for k in range(0, H, 23):
    cv2.putText(img, "WOORI %04d 0123 abc" % k, (6 + (k * 7) % 90, k + 17), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (int(k % 200), 30, 90), 1, cv2.LINE_AA)
cv2.imwrite(os.path.join(out, "ref.png"), img)
cv2.imwrite(os.path.join(out, "exact.png"), img)
sh = np.full_like(img, 255); sh[5:, 3:] = img[:-5, :-3]
cv2.imwrite(os.path.join(out, "shift.png"), sh)
pc = img.copy()
pc[144:304, :W - 2] = img[144:304, 2:]; pc[144:304, W - 2:] = 255     # 내용이 왼쪽으로 2px  → (-2, 0)
pc[484:640] = img[480:636]; pc[480:484] = 255                          # 내용이 아래로 4px    → (0, +4)
cv2.imwrite(os.path.join(out, "pieces.png"), pc)
os_ = img.copy()
os_[0:46] = rng.integers(0, 256, (46, W, 3), dtype=np.uint8); os_[1210:] = rng.integers(0, 256, (70, W, 3), dtype=np.uint8)
cv2.imwrite(os.path.join(out, "osui.png"), os_)
print("ok")
`;

// ?frame=1 시험 페이지 스크린샷 측정: 면적법 가장자리(두 평탄 수준 사이 비율의 합), 1dp 선은 잉크 가중 중심
const PY_MEASURE = String.raw`
import sys, json, numpy as np, cv2
img = cv2.imread(sys.argv[1], cv2.IMREAD_GRAYSCALE).astype(np.float64)
spec = json.loads(sys.argv[2])
H, W = img.shape
def edge(p, start):
    a, b = p[0], p[-1]
    return float(start + np.sum((p - b) / (a - b))) if a != b else None
def rows(y0, y1): return slice(int(np.floor(y0)), int(np.ceil(y1)))
def cols(x0, x1): return slice(int(np.floor(x0)), int(np.ceil(x1)))
res = {"size": [W, H]}
# 상태바(회색) → 앱(흰색), 앱 → 내비(회색): 가운데 열들 평균
c = cols(spec["midX"][0], spec["midX"][1])
y0 = int(spec["sb"]) - 6; res["sb"] = edge(img[y0:y0 + 12, c].mean(1), y0)
y0 = int(spec["nav"]) - 6; res["nav"] = edge(img[y0:y0 + 12, c].mean(1), y0)
res["h"] = []
for L in spec["h"]:
    y0 = int(L["c"]) - 6; d = 255 - img[y0:y0 + 13, cols(*L["xr"])].mean(1)
    res["h"].append(float(((np.arange(len(d)) + y0 + 0.5) * d).sum() / d.sum()))
res["v"] = []
for L in spec["v"]:
    x0 = int(np.floor(L["c"] - 2.5)); x1 = int(np.ceil(L["c"] + 2.5))
    d = 255 - img[rows(*L["yr"]), x0:x1].mean(0)
    res["v"].append(float(((np.arange(len(d)) + x0 + 0.5) * d).sum() / d.sum()))
res["box"] = []
for B in spec["box"]:
    l, r, t, b = B["l"], B["r"], B["t"], B["b"]
    rr = rows(t + 0.25 * (b - t), b - 0.25 * (b - t)); cc = cols(l + 0.25 * (r - l), r - 0.25 * (r - l))
    xl = int(l) - 4; xr = int(r) - 4; yt = int(t) - 4; yb = int(b) - 4
    res["box"].append({"l": edge(img[rr, xl:xl + 9].mean(0), xl), "r": edge(img[rr, xr:xr + 9].mean(0), xr),
                       "t": edge(img[yt:yt + 9, cc].mean(1), yt), "b": edge(img[yb:yb + 9, cc].mean(1), yb)})
print(json.dumps(res))
`;

/* ── 1) 단위 ────────────────────────────────────────────── */

function testUnits() {
  section('1) 단위 (D1)');
  const sz = { w: Math.ceil(U.VIEWPORT_DP.w * U.DSF - 1e-9), h: Math.ceil(U.VIEWPORT_DP.h * U.DSF - 1e-9) };
  check('뷰포트 360x880 × DSF 16/11 = 524x1280 (ceil)', sz.w === U.FRAME.w && sz.h === U.FRAME.h && near(U.DSF, 16 / 11, 1e-12), `${sz.w}x${sz.h}`);
  // units.md 2절 표 (영상 실측) 과 D1 식
  const anchors = [
    ['x 20dp', U.xPx(20), 28.71, 0.03], ['x 340dp', U.xPx(340), 495.32, 0.03], ['x 16dp', U.xPx(16), 22.89, 0.03], ['x 344dp', U.xPx(344), 501.15, 0.03],
    ['x 180dp = 262.02', U.xPx(180), 262.02, 1e-9], ['상태바 31.333dp', U.yPx(U.STATUS_BAR_DP), 45.576, 0.001], ['내비 위끝 832dp', U.yPx(832), 1210.182, 0.001],
    ['내비 48dp', U.hPx(48), 69.818, 0.001], ['키보드 위끝 508dp (실측 738.95)', U.yPx(508), 738.95, 0.05], ['폭 320dp (실측 466.6)', U.wPx(320), 466.61, 0.05],
    ['하단 큰 버튼 56dp (실측 81.43)', U.hPx(56), 81.43, 0.05],
  ];
  const bad = anchors.filter(([, v, want, tol]) => !near(v, want, tol));
  check('D1 식 = units.md 실측값 (11개)', bad.length === 0, bad.map(([n, v, w]) => `${n}: ${v} ≠ ${w}`).join('; ') || anchors.map(([n, v]) => `${n} ${v}`).slice(0, 4).join(', ') + ' …');
  let worst = 0;
  for (let k = 0; k <= 200; k++) {
    const v = -10 + k * 1.987;
    worst = Math.max(worst, Math.abs(U.exact.xDp(U.exact.xPx(v)) - v), Math.abs(U.exact.yDp(U.exact.yPx(v)) - v),
      Math.abs(U.exact.wDp(U.exact.wPx(v)) - v), Math.abs(U.exact.hDp(U.exact.hPx(v)) - v));
  }
  check('왕복 xDp(xPx(v)) · yDp(yPx(v)) · wDp(wPx(v)) · hDp(hPx(v)) = v', worst < 1e-9, `최대 ${worst.toExponential(1)}`);
  check('x 와 y 는 다른 배율 (가로 0.24% 큼)', near(U.PX_PER_DP_X / U.PX_PER_DP_Y, 1.0024, 0.0002) && U.wDp(100) !== U.hDp(100), `wDp(100)=${U.wDp(100)} hDp(100)=${U.hDp(100)}`);
  const FM = U.FRAME_MODE;
  check('?frame=1 보정: kx = 1.45803 ÷ (16/11)', near(FM.kx, U.PX_PER_DP_X / U.DSF, 1e-6), `${FM.kx}`);
  check('?frame=1 보정: translateX = xPx(0) ÷ (16/11) = −0.2925', near(FM.txDp, U.exact.xPx(0) / U.DSF, 0.0005), `${U.round3(U.exact.xPx(0) / U.DSF)}`);
  check('?frame=1 보정: translateY = 31.333 − 31 스페이서', near(FM.tyDp, U.STATUS_BAR_DP - FM.topSpacerDp, 0.001) && FM.topSpacerDp + FM.appHeightDp + FM.bottomSpacerDp <= 880 + 1e-9,
    `${FM.tyDp}, 31 + ${U.round3(FM.appHeightDp)} + 48`);
  check('transform 글자 = 값', FM.transform === `translate(${FM.txDp}px, ${FM.tyDp}px) scaleX(${FM.kx})`, FM.transform);
  let threw = false;
  try { U.resolveMask('1,2,3'); } catch { threw = true; }
  check('마스크 이름 → 값, 틀린 꼴은 오류', U.resolveMask('keyboard') === '0,738,524,542' && U.resolveMask(' 1.4, 2.6,3,4 ') === '1,3,3,4' && threw);
  // 파이썬 도구 상수
  const pu = py([path.join(TOOLS, 'compare.py'), '--print-units']);
  let cu = null;
  try { cu = JSON.parse(pu.out); } catch { /* 아래에서 실패 */ }
  check('compare.py 상수 = woori-units.cjs', !!cu && cu.frame.w === U.FRAME.w && cu.frame.h === U.FRAME.h && cu.pxPerDpX === U.PX_PER_DP_X &&
    cu.xCenterPx === U.X_CENTER_PX && cu.xCenterDp === U.X_CENTER_DP && cu.dpPerPxY === U.DP_PER_PX_Y && near(cu.statusBarDp, U.STATUS_BAR_DP, 1e-9) &&
    JSON.stringify(cu.defaultMasks) === JSON.stringify(U.DEFAULT_MASKS) && JSON.stringify(cu.optionalMasks) === JSON.stringify(U.OPTIONAL_MASKS), cu ? '' : tail(pu));
  const pm = py(['-c', `import sys, json; sys.path.insert(0, ${JSON.stringify(TOOLS)}); sys.dont_write_bytecode = True
import ref, scan, woori_video as wv
print(json.dumps({"ref": ref.NAMED_MASKS, "scan": scan.NAMED_MASKS, "refY": [ref.APP_Y0, ref.APP_Y1], "scanY": [scan.APP_Y0, scan.APP_Y1], "wh": [wv.W, wv.H]}))`]);
  let pmj = null;
  try { pmj = JSON.parse(pm.out); } catch { /* */ }
  const allMasks = { ...U.DEFAULT_MASKS, ...U.OPTIONAL_MASKS };
  check('ref.py · scan.py · woori_video.py 상수 = woori-units.cjs', !!pmj &&
    Object.entries(pmj.ref).every(([k, v]) => allMasks[k] === v) && Object.entries(pmj.scan).every(([k, v]) => allMasks[k] === v) &&
    pmj.refY.join() === '46,1210' && pmj.scanY.join() === '46,1210' && pmj.wh.join() === '524,1280', pmj ? '' : tail(pm));
  // 시나리오
  check('시나리오 규칙: v1 이체 전/후 · v2 이체 전/후 · 별칭', SL.scenarioFor('v1', 193.0) === 'v1-start' && SL.scenarioFor('v1', 193.407) === 'v2-start' &&
    SL.scenarioFor('v2', 0) === 'v2-start' && SL.scenarioFor('v2', 86.3) === 'v2-end' && SL.checkScenario('v1') === 'v1-start' && SL.checkScenario('v2') === 'v2-start' &&
    (() => { try { SL.checkScenario('middle'); return false; } catch { return true; } })());
  const seed = path.join(ROOT, 'backend', 'seed.js');
  if (!fs.existsSync(seed)) skip('시나리오 이름 = backend/seed.js', 'backend/seed.js 없음');
  else {
    const txt = fs.readFileSync(seed, 'utf8');
    const block = (/const SCENARIOS = \{([\s\S]*?)\n\};/.exec(txt) || [])[1] || '';
    const names = [...block.matchAll(/^\s*'([\w-]+)':\s*\{/gm)].map((m) => m[1]);
    const alias = (/const SCENARIO_ALIASES = (\{[^}]*\})/.exec(txt) || [])[1] || '';
    const aliasNames = [...alias.matchAll(/'?([\w-]+)'?:\s*'([\w-]+)'/g)].map((m) => `${m[1]}>${m[2]}`).sort();
    const ours = Object.entries(SL.SCENARIO_ALIASES).map(([k, v]) => `${k}>${v}`).sort();
    check('시나리오 이름 = backend/seed.js (정식 이름·별칭)', names.sort().join() === Object.keys(SL.SCENARIOS).sort().join() && aliasNames.join() === ours.join(),
      `seed ${names.join(',')} / 별칭 ${aliasNames.join(',')}`);
  }
}

/* ── 2) 비교 (합성 이미지) ─────────────────────────────── */

function testCompare(syn) {
  section('2) 비교 compare.py (합성 이미지)');
  const ref = path.join(syn, 'ref.png');
  const cmp = (shot, out, extra = []) => {
    const r = py([path.join(TOOLS, 'compare.py'), path.join(syn, shot), ref, path.join(OUT, 'cmp', out), '--quiet', '--no-images', ...extra]);
    if (r.status !== 0) { check(`compare.py ${out}`, false, tail(r)); return null; }
    return readJson(path.join(OUT, 'cmp', out, 'metrics.json'));
  };
  const e = cmp('exact.png', 'exact');
  if (e) {
    const masked = 524 * 46 + 524 * 70;
    check('같은 그림 → 차이 0, 기본 마스크(상태바·내비)', e.meanAbsDiff === 0 && e.pctPixelsOver24 === 0 && e.masks.statusbar && e.masks.navbar &&
      e.comparedPixels === 524 * 1280 - masked, `mad ${e.meanAbsDiff}, 비교 ${e.comparedPixels}px`);
  }
  // 요소 박스 (shot 좌표 = 기준 + (3,5))
  const els = [['title', 28, 140, 232, 38], ['input', 27, 193, 432, 75], ['row1', 27, 423, 330, 75]];
  writeJson(path.join(syn, 'boxes-shift.json'), { boxes: els.map(([id, x, y, w, h]) => ({ id, x, y, w, h, dp: U.boxDp([x, y, w, h]) })) });
  const s = cmp('shift.png', 'shift', ['--boxes', path.join(syn, 'boxes-shift.json')]);
  if (s) {
    const g = s.globalOffset || {};
    check('(3,5)px 밀기 → 전역 오프셋 (3,5)px = (2.06,3.44)dp', nearOff(g, 3, 5, 0.3) && near(g.dxDp, U.wDp(3), 0.05) && near(g.dyDp, U.hDp(5), 0.05),
      `(${g.dx},${g.dy})px = (${g.dxDp},${g.dyDp})dp (기대 ${U.wDp(3)}, ${U.hDp(5)})`);
    const wb = s.worstBands.filter((b) => b.offset && b.offset.dx != null);
    check('띠 오프셋 모두 (3,5)', wb.length >= 3 && wb.every((b) => nearOff(b.offset, 3, 5, 0.3)), wb.map((b) => `y${b.y0}:(${b.offset.dx},${b.offset.dy})`).join(' '));
    check('요소 오프셋 (3,5) + boxDp (D1)', s.elements.length === 3 && s.elements.every((x) => nearOff(x.offset, 3, 5, 0.3)) &&
      JSON.stringify(s.elements[0].boxDp) === JSON.stringify(Object.values(U.boxDp([28, 140, 232, 38]))),
    s.elements.map((x) => `${x.id}:(${x.offset && x.offset.dx},${x.offset && x.offset.dy})`).join(' ') + ` dp ${s.elements[0].boxDp}`);
  }
  const p = cmp('pieces.png', 'pieces', ['--worst', '10']);
  if (p) {
    const inRange = (lo, hi) => p.worstBands.filter((b) => b.y0 >= lo && b.y0 < hi && b.offset && b.offset.dx != null);
    const a = inRange(144, 288), b = inRange(480, 624);
    check('띠마다 다른 밀기: y144–304 (−2,0) · y480–640 (0,+4)', a.length >= 2 && a.every((x) => nearOff(x.offset, -2, 0, 0.3)) && b.length >= 2 && b.every((x) => nearOff(x.offset, 0, 4, 0.3)),
      [...a, ...b].map((x) => `y${x.y0}:(${x.offset.dx},${x.offset.dy})`).join(' '));
    const band = p.bands.find((x) => x.y0 === 768);
    check('안 민 띠 y768 은 차이 0', band && band.meanAbsDiff === 0, `mad ${band && band.meanAbsDiff}`);
  }
  const o1 = cmp('osui.png', 'osui');
  const o2 = cmp('osui.png', 'osui-nomask', ['--no-default-mask']);
  if (o1 && o2) {
    check('상태바·내비 바만 다름 → 기본 마스크로 차이 0, --no-default-mask 면 전부 비교', o1.meanAbsDiff === 0 && o2.meanAbsDiff > 1 &&
      !o2.masks.statusbar && !o2.masks.navbar && o2.comparedPixels === 524 * 1280, `${o1.meanAbsDiff} / ${o2.meanAbsDiff}, ${o2.comparedPixels}px`);
  }
  const k = cmp('exact.png', 'named', ['--mask', 'keyboard']);
  if (k) {
    check('이름 마스크 --mask keyboard = 0,738,524,542', k.masks.extra.join() === '0,738,524,542' && k.comparedPixels === 524 * (738 - 46), `${k.masks.extra} · ${k.comparedPixels}px`);
  }
}

/* ── 3) 레지스트리 병합 ──────────────────────────────────── */

function testRegistry() {
  section('3) 레지스트리 병합 (shots-lib.cjs ↔ ref.py)');
  const dir = path.join(OUT, 'registry');
  fs.rmSync(dir, { recursive: true, force: true });
  writeJson(path.join(dir, 'shots.json'), { _comment: 'x', base: 'http://127.0.0.1:1', shots: [
    { name: 'home/a', url: '/home?frame=1&shot=a', video: 'v1', i0: 365, i1: 388, mask: ['1,2,3,4'], scenario: 'v1-start', _private: 1 },
    { name: 'home/b', url: '/home?frame=1&shot=b', video: 'v1', i0: 406, i1: 423 },
    { name: 'send-a/c', url: '/send?frame=1&shot=c', video: 'v2', i0: 2700, i1: 2735, mask: ['keyboard'] },
  ] });
  writeJson(path.join(dir, 'shots.d', 'a-home.json'), [
    { name: 'home/a', scenario: 'v2-start', maskAdd: ['5,6,7,8'], _comment: '덮어쓰기' },
    { name: 'home/new', url: '/home?frame=1&shot=new', t: 300, maskAdd: ['9,9,9,9'] },
  ]);
  writeJson(path.join(dir, 'shots.d', 'b-send.json'), { shots: [{ name: 'send-a/c', mask: ['0,0,10,10'] }, { name: 'home/a', waitMs: 50 }] });
  const nodeRes = SL.loadShots(path.join(dir, 'shots.json'));
  const pr = py([path.join(TOOLS, 'ref.py'), '--list', '--shots', path.join(dir, 'shots.json')]);
  let pyRes = null;
  try { pyRes = JSON.parse(pr.out); } catch { /* */ }
  check('node loadShots = python ref.py --list', !!pyRes && JSON.stringify(pyRes) === JSON.stringify(nodeRes.shots), pyRes ? '' : tail(pr));
  const a = nodeRes.shots.find((x) => x.name === 'home/a');
  check('덮어쓰기·maskAdd·파일 이름순·_ 필드 무시', a.scenario === 'v2-start' && a.mask.join(';') === '1,2,3,4;5,6,7,8' && a.waitMs === 50 && !('_private' in a) &&
    nodeRes.shots.find((x) => x.name === 'send-a/c').mask.join() === '0,0,10,10', JSON.stringify(a));
  check('새 항목은 뒤에 (maskAdd → mask)', nodeRes.shots.map((x) => x.name).join() === 'home/a,home/b,send-a/c,home/new' &&
    nodeRes.shots[3].mask.join() === '9,9,9,9' && nodeRes.overlays.map((o) => `${o.overridden}/${o.added}`).join() === '1/1,2/0' && nodeRes.base === 'http://127.0.0.1:1');
  writeJson(path.join(dir, 'shots.d', 'c-bad.json'), [{ name: 'x/no-url', t: 1 }]);
  let nodeThrew = false;
  try { SL.loadShots(path.join(dir, 'shots.json')); } catch (e) { nodeThrew = /url 이 없다/.test(e.message); }
  const pb = py([path.join(TOOLS, 'ref.py'), '--list', '--shots', path.join(dir, 'shots.json')]);
  check('url 없는 새 항목은 둘 다 오류', nodeThrew && pb.status !== 0 && /url 이 없다/.test(pb.err), pb.err.trim().split('\n').pop());
  check('--only 규칙 (앞부분·쉼표·끝 $)', SL.matchOnly('home/a', 'home/') && SL.matchOnly('home/a', 'send-a/,home/a$') && !SL.matchOnly('home/ab', 'home/a$') && SL.matchOnly('x', ''));
  const missing = SL.loadShots(path.join(dir, 'none.json'), { dir: false });
  check('shots.json 이 없어도 빈 목록', missing.missing && missing.shots.length === 0);
}

/* ── 4) 생성기 (가짜 스펙) ───────────────────────────────── */

const FAKE_SPEC = {
  group: 'fake',
  route: '/fake',
  source: '가짜 스펙 (selftest)',
  coords: '요소 좌표는 frame px (화면 절대), dp 는 설계 dp (y 는 앱 뷰포트 기준)',
  states: [
    { id: 'idle', video: 'v1', i0: 365, i1: 388, t0: 13.139, t1: 13.614, mask: ['228,594,68,68'], refFrame: 'tools/ref/fake/idle.png', scrollTop: 0, summary: '가짜 정지 화면',
      elements: [
        { name: 'btn', box: { x: 28.735, y: 1102.55, w: 466.57, h: 81.43 }, dp: { x: 20, y: 726.667, w: 320, h: 56 }, radius: 17.45,
          font: { family: 'X', sizePx: 21.8, weight: 600, letterSpacingEm: -0.02 }, fill: '#2387F3' },
        { name: 'rule', box: [22.9, 500, 478.24, 1.4545], inkExt: [22.9, 500, 501.14, 501.45], points: [[100, 200], [300, 400]], dp: { x: 16, w: 328 } },
        { name: 'anim', samplesY: [[0.1, 300], [0.2, 320]], durationMs: 300, keep: { x: 5 }, tokens: { radius: { card: 17.45 } } },
      ] },
    { id: 'done', video: 'v1', i0: 7458, i1: 7483, t0: 194.201, t1: 195.73, refFrame: 'tools/ref/fake/done.png', route: '/fake/x?tab=1' },
    { id: 'v2-before', video: 'v2', i0: 100, i1: 114, t0: 4.204, t1: 4.974, refFrame: 'tools/ref/fake/v2-before.png' },
    { id: 'v2-after', video: 'v2', i0: 3327, i1: 3330, t0: 87.065, t1: 87.214, refFrame: 'tools/ref/fake/v2-after.png', mask: ['keyboard'] },
    { id: 'alias', video: 'v2', i0: 20, i1: 21, t0: 1.0, t1: 1.05, scenario: 'v1', refFrame: 'tools/ref/fake/alias.png' },
    { id: 'reuse', video: 'v1', i0: 1, i1: 2, refFrame: 'tools/ref/fake/idle.png' },
    { id: 'no-range', refFrame: 'tools/ref/fake/no-range.png' },
  ],
};
const FAKE_ASSETS = [
  { name: 'icon', file: 'woori/fake/icon.png', frameBox: { x: 28.735, y: 100, w: 60, h: 40 }, state: 'idle', scale: 3, notes: '시험 아이콘. 둘째 문장' },
  { name: 'mascot', file: '/woori/fake/mascot.svg', frameBox: [181.2, 532.4, 163.1, 118.3], state: 'idle', character: true,
    usedIn: [{ state: 'done', element: 'm', frameBox: [181, 600, 163, 118] }], notes: '캐릭터 자리 대체 그림' },
  { name: 'ref-only', file: 'woori/fake/ref-only.png', frameBox: [0, 0, 10, 10], state: 'idle', referenceOnly: '대조용' },
];

function makeFakeRoot(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  writeJson(path.join(dir, 'spec', 'fake.json'), FAKE_SPEC);
  writeJson(path.join(dir, 'spec', 'fake.assets.json'), FAKE_ASSETS);
  writeJson(path.join(dir, 'spec', 'tokens.json'), { color: { blue: '#2387F3' }, note: 'states 가 없는 파일은 건너뛴다' });
  fs.writeFileSync(path.join(dir, 'spec', 'timeline.md'), '# 타임라인 (가짜)\n\n<!-- gen-from-spec:shots-table -->\n(옛 표)\n<!-- /gen-from-spec:shots-table -->\n\n끝\n');
  const pub = path.join(dir, 'frontend', 'public', 'woori', 'fake');
  fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, 'icon.png'), pngRGBA(180, 120, [35, 135, 243, 200]));
  fs.writeFileSync(path.join(pub, 'ref-only.png'), pngRGBA(30, 30, [0, 0, 0, 255]));
  fs.writeFileSync(path.join(pub, 'mascot.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 163 118"><circle cx="81" cy="59" r="40" fill="#5ab"/></svg>\n');
  fs.mkdirSync(path.join(dir, 'frontend', 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'frontend', 'src', 'WooriFake.tsx'), "export const names = ['fake.icon', \"fake.mascot\"]\n");
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
}

/** 전역/프론트 typescript 로 생성 TS 를 프론트와 같은 엄격함으로 검사 (없으면 null) */
function tscCheck(srcDir) {
  const cands = [path.join(ROOT, 'frontend', 'node_modules', 'typescript'), ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean).map((d) => path.join(d, 'typescript'))];
  const ts = cands.find((p) => fs.existsSync(path.join(p, 'bin', 'tsc')));
  if (!ts) return null;
  fs.writeFileSync(path.join(srcDir, 'react-stub.d.ts'), "declare module 'react' { export type CSSProperties = { [k: string]: string | number | undefined } }\n");
  const r = run(process.execPath, [path.join(ts, 'bin', 'tsc'), '--noEmit', '--strict', '--target', 'es2023', '--lib', 'ES2023,DOM', '--module', 'esnext',
    '--moduleResolution', 'bundler', '--allowImportingTsExtensions', '--skipLibCheck', '--verbatimModuleSyntax', '--isolatedModules', '--noUnusedLocals',
    '--noUnusedParameters', '--erasableSyntaxOnly', '--moduleDetection', 'force', 'WooriArt.ts', 'WooriArtbox.ts', 'react-stub.d.ts'], { cwd: srcDir });
  fs.rmSync(path.join(srcDir, 'react-stub.d.ts'), { force: true });
  return r;
}

function testGenerators() {
  section('4) 생성기 spec-to-dp · gen-from-spec · check-dist (가짜 스펙)');
  const fake = path.join(OUT, 'fake-root');
  makeFakeRoot(fake);
  // spec-to-dp
  let r = node('spec-to-dp.cjs', ['--root', fake]);
  check('spec-to-dp 가짜 스펙 변환 + 자체 검사', r.status === 0 && /PASS {2}spec\/dp\/fake\.json/.test(r.out) && /SKIP {2}spec\/tokens\.json/.test(r.out), tail(r, 4));
  const dp = fs.existsSync(path.join(fake, 'spec', 'dp', 'fake.json')) ? readJson(path.join(fake, 'spec', 'dp', 'fake.json')) : null;
  if (dp) {
    const [btn, rule, anim] = dp.states[0].elements;
    const want = [
      ['btn.box.x 가로 위치', btn.box.x, U.xDp(28.735)], ['btn.box.w 폭 ÷1.45803', btn.box.w, U.wDp(466.57)], ['btn.box.y ×0.6875', btn.box.y, U.yDp(1102.55)],
      ['btn.box.h', btn.box.h, U.hDp(81.43)], ['radius 방향 없음', btn.radius, U.lenDp(17.45)], ['font.sizePx', btn.font.sizePx, U.lenDp(21.8)],
      ['rule.box[0] x', rule.box[0], U.xDp(22.9)], ['rule.box[2] 폭', rule.box[2], U.wDp(478.24)], ['rule.box[3] 높이', rule.box[3], U.hDp(1.4545)],
      ['inkExt[2] x1 위치', rule.inkExt[2], U.xDp(501.14)], ['points[1][0] x', rule.points[1][0], U.xDp(300)], ['points[1][1] y', rule.points[1][1], U.yDp(400)],
      ['samplesY [t, y] 의 y', anim.samplesY[1][1], U.yDp(320)], ['radius 묶음 아래', anim.tokens.radius.card, U.lenDp(17.45)],
    ];
    const kept = [['font.weight', btn.font.weight, 600], ['letterSpacingEm', btn.font.letterSpacingEm, -0.02], ['samplesY [t] 시간', anim.samplesY[1][0], 0.2],
      ['durationMs', anim.durationMs, 300], ['keep 아래', anim.keep.x, 5], ['설계 dp 그대로', btn.dp.y, 726.667], ['i0', dp.states[0].i0, 365], ['t0', dp.states[0].t0, 13.139],
      ['mask 글자', dp.states[0].mask[0], '228,594,68,68'], ['fill', btn.fill, '#2387F3']];
    const badW = want.filter(([, got, w]) => got !== w);
    const badK = kept.filter(([, got, w]) => got !== w);
    check('축별 D1 변환 (14개) + 그대로 둘 값 (10개)', badW.length === 0 && badK.length === 0 && dp._units && dp._units.unit === 'dp',
      [...badW, ...badK].map(([n, g, w]) => `${n}: ${g} ≠ ${w}`).join('; ') || `btn.box ${JSON.stringify(btn.box)}`);
  }
  r = node('spec-to-dp.cjs', ['--root', fake, '--check']);
  check('spec-to-dp --check (최신)', r.status === 0, tail(r, 3));
  const dpFile = path.join(fake, 'spec', 'dp', 'fake.json');
  const dpText = fs.readFileSync(dpFile, 'utf8');
  fs.writeFileSync(dpFile, dpText.replace('"x": 20,', '"x": 20.5,'));
  r = node('spec-to-dp.cjs', ['--root', fake, '--check']);
  check('spec-to-dp --check: 손으로 고친 spec/dp 는 실패', r.status === 1 && /최신이 아님/.test(r.out), tail(r, 3));
  fs.writeFileSync(dpFile, dpText);
  const bad = path.join(OUT, 'fake-bad');
  const variant = (mut) => {
    fs.rmSync(bad, { recursive: true, force: true });
    const s = JSON.parse(JSON.stringify(FAKE_SPEC));
    mut(s);
    writeJson(path.join(bad, 'spec', 'fake.json'), s);
    return node('spec-to-dp.cjs', ['--root', bad]);
  };
  r = variant((s) => { s.states[0].elements[0].foo = 3; });
  check('모르는 숫자 키는 경로와 함께 실패', r.status === 1 && /분류 안 된 숫자 키 'foo' at \$\.states\[0\]\.elements\[0\]\.foo/.test(r.out), tail(r, 3));
  r = variant((s) => { s.states[0].elements[0].dp.w = 321; });
  check('설계 dp 가 D1 과 0.5dp 넘게 다르면 실패', r.status === 1 && /설계 dp .*btn.*\.w: frame→D1 320 vs dp 321/.test(r.out), tail(r, 3));
  r = variant((s) => { s.states[0].elements[0].dp.w = 321; s.states[0].elements[0].dpLoose = true; });
  check('dpLoose 면 알리기만', r.status === 0 && /dpLoose/.test(r.out), tail(r, 3));
  r = variant((s) => { s.dpOrigin = 'screen'; });
  check('dpOrigin screen 이면 dp.y 를 화면 기준으로 (31.333 차이 → 실패)', r.status === 1 && /btn.*\.y/.test(r.out), tail(r, 3));

  // gen-from-spec
  writeJson(path.join(fake, 'tools', 'shots.json'), { shots: [{ name: 'fake/idle', url: '/x', steps: [{ waitMs: 10 }], t: 120, note: '손으로 쓴 설명', keepNote: true }] });
  r = node('gen-from-spec.cjs', ['--root', fake, '--shots']);
  check('gen-from-spec --shots (가짜 스펙)', r.status === 0, tail(r, 6));
  const shots = readJson(path.join(fake, 'tools', 'shots.json')).shots;
  const S = (n) => shots.find((x) => x.name === `fake/${n}`) || {};
  check('shots: 이름·url·video·i0·i1·t0·spec', shots.map((x) => x.name).join() === 'fake/idle,fake/done,fake/v2-before,fake/v2-after,fake/alias' &&
    S('idle').url === '/fake?frame=1&shot=idle' && S('idle').video === 'v1' && S('idle').i0 === 365 && S('idle').i1 === 388 && S('idle').t0 === 13.139 &&
    S('done').url === '/fake/x?tab=1&frame=1&shot=done' && S('idle').spec === 'spec/fake.md', shots.map((x) => `${x.name} ${x.url}`).join(' · '));
  check('shots: scenario 규칙 (v1 완료 뒤 v2-start, v2 완료 뒤 v2-end, 별칭 v1 → v1-start)', S('idle').scenario === 'v1-start' && S('done').scenario === 'v2-start' &&
    S('v2-before').scenario === 'v2-start' && S('v2-after').scenario === 'v2-end' && S('alias').scenario === 'v1-start', shots.map((x) => x.scenario).join());
  check('shots: 캐릭터 대체 그림 박스 → 마스크 (바깥으로 둥근), 이름 마스크 → 값', S('idle').mask.join(';') === '228,594,68,68;181,532,164,119' &&
    S('done').mask.join() === '181,600,163,118' && S('v2-after').mask.join() === '0,738,524,542', `${S('idle').mask} / ${S('done').mask}`);
  check('shots: 손으로 넣은 steps·t·note(keepNote) 유지, url 은 규칙대로', JSON.stringify(S('idle').steps) === '[{"waitMs":10}]' && S('idle').t === 120 &&
    S('idle').note === '손으로 쓴 설명' && S('idle').url === '/fake?frame=1&shot=idle');
  check('shots: 다른 상태 ref 재사용·구간 없는 상태는 빠짐 (경고)', !S('reuse').name && !S('no-range').name && /no-range: video·i0·i1 이 없어/.test(r.out));
  const art = fs.readFileSync(path.join(fake, 'frontend', 'src', 'WooriArt.ts'), 'utf8');
  const box = fs.readFileSync(path.join(fake, 'frontend', 'src', 'WooriArtbox.ts'), 'utf8');
  const ib = U.boxDp({ x: 28.735, y: 100, w: 60, h: 40 });
  check('WooriArt.ts: 이름·파일·크기·캐릭터·참고용', art.includes('"fake.icon": { file: "woori/fake/icon.png", kind: "png", scale: 3, transparent: true, intrinsic: [180, 120]') &&
    /"fake.mascot": \{ file: "woori\/fake\/mascot.svg", kind: "svg".*character: true/.test(art) && /"fake.ref-only".*referenceOnly: true/.test(art));
  check('WooriArtbox.ts: 박스 dp = D1(frame px)', box.includes(`"fake.icon": { x: ${ib.x}, y: ${ib.y}, w: ${ib.w}, h: ${ib.h}, frame: [28.735, 100, 60, 40]`) &&
    box.includes(`CONTENT_ORIGIN = { x: 0, y: ${U.round3(U.STATUS_BAR_DP)} }`), `기대 x ${ib.x} y ${ib.y} w ${ib.w} h ${ib.h}`);
  const tl = fs.readFileSync(path.join(fake, 'spec', 'timeline.md'), 'utf8');
  check('timeline.md 표 = shots.json', tl.includes('| `fake/idle` | v1 | #365–#388 | 13.139–13.614 | v1-start |') && tl.includes('| `fake/v2-after` | v2 | #3327–#3330 |') && !tl.includes('(옛 표)') && tl.endsWith('끝\n'));
  r = node('gen-from-spec.cjs', ['--root', fake, '--check']);
  check('gen-from-spec --check (최신)', r.status === 0 && /--check OK \(에셋 3개, 상태 5개\)/.test(r.out), tail(r, 4));
  const artFile = path.join(fake, 'frontend', 'src', 'WooriArt.ts');
  fs.writeFileSync(artFile, art + '\n// 손으로 고침\n');
  fs.writeFileSync(path.join(fake, 'frontend', 'src', 'WooriFake.tsx'), "export const names = ['fake.icon', 'fake.mascot', 'fake.ref-only']\n");
  fs.writeFileSync(path.join(fake, 'frontend', 'public', 'woori', 'fake', 'stray.png'), pngRGBA(2, 2, [0, 0, 0, 0]));
  r = node('gen-from-spec.cjs', ['--root', fake, '--check']);
  check('gen-from-spec --check: 손으로 고친 TS · 남는 public 파일 · 참고용 사용은 실패', r.status === 1 && /FAIL {2}frontend\/src\/WooriArt\.ts 최신/.test(r.out) &&
    /FAIL {2}spec 에 없는 public\/woori 파일 0/.test(r.out) && /FAIL {2}참고용/.test(r.out), tail(r, 6));
  fs.rmSync(path.join(fake, 'frontend', 'public', 'woori', 'fake', 'stray.png'));
  fs.writeFileSync(path.join(fake, 'frontend', 'src', 'WooriFake.tsx'), "export const names = ['fake.icon', \"fake.mascot\"]\n");
  node('gen-from-spec.cjs', ['--root', fake]);
  const t1 = tscCheck(path.join(fake, 'frontend', 'src'));
  // 빈 트리 (화면이 아직 없을 때)
  const empty = path.join(OUT, 'empty-root');
  fs.rmSync(empty, { recursive: true, force: true });
  fs.mkdirSync(path.join(empty, 'frontend', 'src'), { recursive: true });
  const e1 = node('gen-from-spec.cjs', ['--root', empty, '--shots']);
  const e2 = node('gen-from-spec.cjs', ['--root', empty, '--check']);
  const e3 = node('spec-to-dp.cjs', ['--root', empty, '--check']);
  check('빈 트리: gen --shots · --check · spec-to-dp --check 모두 통과', e1.status === 0 && e2.status === 0 && e3.status === 0 &&
    readJson(path.join(empty, 'tools', 'shots.json')).shots.length === 0 && /할 일 없음/.test(e3.out), tail(e2, 3));
  const t2 = tscCheck(path.join(empty, 'frontend', 'src'));
  if (!t1) skip('생성 TS 타입 검사', 'typescript 를 찾을 수 없음 (frontend/node_modules 또는 NODE_PATH)');
  else check('생성 TS 타입 검사 (프론트 tsconfig 와 같은 엄격함, 에셋 있음·빈 표)', t1.status === 0 && t2.status === 0, tail(t1.status ? t1 : t2, 6));

  // check-dist
  r = node('check-dist.cjs', ['--selftest']);
  check('check-dist --selftest', r.status === 0, tail(r, 6));
  const cd = path.join(OUT, 'dist-case');
  fs.rmSync(cd, { recursive: true, force: true });
  fs.mkdirSync(path.join(cd, 'src'), { recursive: true });
  fs.mkdirSync(path.join(cd, 'dist', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(cd, 'src', 'woori-x.css'), '.woori-x__dot { animation: woori-x-pulse 1.2s ease-in-out infinite; }\n@keyframes woori-x-pulse { from { opacity: 1 } to { opacity: 0.4 } }\n');
  fs.writeFileSync(path.join(cd, 'dist', 'assets', 'index.css'), '.woori-x__dot{animation:1.2s ease-in-out infinite woori-x-pulse}@keyframes woori-x-pulse{0%{opacity:1}to{opacity:.4}}');
  const good = node('check-dist.cjs', ['--src', path.join(cd, 'src'), '--dist', path.join(cd, 'dist'), '--quiet']);
  fs.writeFileSync(path.join(cd, 'dist', 'assets', 'index.css'), '.woori-x__dot{animation:none}@keyframes woori-x-pulse{0%{opacity:1}to{opacity:.4}}');
  const badd = node('check-dist.cjs', ['--src', path.join(cd, 'src'), '--dist', path.join(cd, 'dist'), '--quiet']);
  check('check-dist: 같은 뜻 빌드 통과 · animation:none 빌드 실패', good.status === 0 && badd.status === 1 && /animation:none/.test(badd.err), tail(good.status ? good : badd, 4));
}

/* ── 5) 브라우저 (shot.cjs) ─────────────────────────────── */

function pages() {
  const FM = U.FRAME_MODE;
  const head = (extra = '') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;width:360px;height:880px;overflow:hidden;background:#fff}${extra}</style></head><body>`;
  const ready = '<script>requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__WOORI_READY__=true}))</script></body></html>';
  const cssPx = (px) => +(px * U.DP_PER_PX_Y).toFixed(5); // frame px → CSS px (스크린샷 배율)
  // 합성 기준 이미지를 1:1 (CSS 524×11/16 = 360.25 폭 → 524 기기 px)
  const img = (tx = 0, ty = 0) => `<img src="/ref.png" alt="" style="position:absolute;left:0;top:0;width:${cssPx(524)}px;height:${cssPx(1280)}px;image-rendering:pixelated;` +
    `${tx || ty ? `transform:translate(${cssPx(tx)}px,${cssPx(ty)}px)` : ''}">`;
  const box = (id, x, y, w, h) => `<div data-ref="${id}" style="position:absolute;left:${cssPx(x)}px;top:${cssPx(y)}px;width:${cssPx(w)}px;height:${cssPx(h)}px"></div>`;
  const imgReady = "<script>const i=document.querySelector('img');(i.complete?Promise.resolve():new Promise(r=>i.onload=r)).then(()=>requestAnimationFrame(()=>{window.__WOORI_READY__=true}))</script></body></html>";
  const hl = [100, 400, 700].map((y) => `<div class="h" style="top:${y}px"></div>`).join('');
  const vl = [16, 20, 100, 260, 340, 344].map((x) => `<div class="v" style="left:${x}px"></div>`).join('');
  return {
    '/frame.html': head(`html,body{background:#f1f1f1}#sb{height:${FM.topSpacerDp}px;background:#f1f1f1}
#app{position:relative;width:360px;height:${U.round3(FM.appHeightDp)}px;overflow:hidden;background:#fff;transform-origin:${FM.origin};transform:${FM.transform}}
#nav{position:relative;z-index:1;height:${FM.bottomSpacerDp}px;background:#f1f1f1}
.h{position:absolute;left:120px;width:120px;height:1px;background:#000}.v{position:absolute;top:450px;width:1px;height:200px;background:#000}.b{position:absolute;background:#000}`) +
      `<div id="sb"></div><div id="app">${hl}${vl}<div class="b" data-ref="box20" style="left:20px;top:200px;width:320px;height:48px"></div>` +
      '<div class="b" data-ref="box16" style="left:16px;top:300px;width:328px;height:56px"></div></div><div id="nav"></div>' + ready,
    '/exact.html': head() + img() + box('title', 25, 135, 232, 38) + imgReady,
    '/shift.html': head() + img(3, 5) + box('title', 28, 140, 232, 38) + box('input', 27, 193, 432, 75) + box('row1', 27, 423, 330, 75) + imgReady,
    '/anim.html': head(`@keyframes mv{from{transform:translateX(0)}to{transform:translateX(200px)}}
#css{position:absolute;left:10px;top:100px;width:20px;height:20px;background:#2387f3;animation:mv 1000ms linear both}
#waapi{position:absolute;left:10px;top:200px;width:20px;height:20px;background:#333}`) + '<div id="css" data-ref="css"></div><div id="waapi" data-ref="waapi"></div>' +
      "<script>document.getElementById('waapi').animate([{transform:'translateX(0)'},{transform:'translateX(200px)'}],{duration:1000,fill:'both'});requestAnimationFrame(()=>{window.__WOORI_READY__=true})</script></body></html>",
    // 처음엔 빨강, 1.2초 뒤 초록으로 칠하고 그다음 프레임에 READY (네트워크 요청이 없어 networkidle·기본 대기 400ms 로는 빨강이 찍힌다)
    '/late.html': head('#late{position:absolute;left:0;top:0;width:360px;height:880px;background:#ff0000}') +
      '<div id="late" data-ref="late"></div>' +
      "<script>setTimeout(()=>{document.getElementById('late').style.background='#00ff00';requestAnimationFrame(()=>{window.__WOORI_READY__=true})},1200)</script></body></html>",
    '/steps.html': head(`@keyframes go{from{transform:translateX(0)}to{transform:translateX(200px)}}
#mv{position:absolute;left:10px;top:300px;width:20px;height:20px;background:#c00}#mv.on{animation:go 300ms linear both}#btn{position:absolute;left:10px;top:400px;width:80px;height:40px}`) +
      '<div id="mv" data-ref="mv"></div><button id="btn">go</button>' +
      "<script>document.getElementById('btn').addEventListener('click',()=>setTimeout(()=>{const m=document.getElementById('mv');m.addEventListener('animationend',()=>m.remove());m.classList.add('on')},30));requestAnimationFrame(()=>{window.__WOORI_READY__=true})</script></body></html>",
  };
}

function serve(refPng) {
  const P = pages();
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (u === '/ref.png') { res.writeHead(200, { 'content-type': 'image/png' }); fs.createReadStream(refPng).pipe(res); return; }
    if (u === '/api/dev/reset' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try { resets.push(JSON.parse(body).scenario); } catch { resets.push('?'); }
        res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}');
      });
      return;
    }
    if (P[u]) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(P[u]); return; }
    res.writeHead(404); res.end('nf');
  });
  return new Promise((ok, fail) => {
    srv.once('error', (e) => {
      if (e.code !== 'EADDRINUSE') return fail(e);
      console.log(`포트 ${PORT} 사용 중 -> 빈 포트 사용`);
      srv.listen(0, '127.0.0.1', () => { PORT = srv.address().port; ok(srv); });
    });
    srv.listen(PORT, '127.0.0.1', () => ok(srv));
  });
}

async function testBrowser(syn) {
  section('5) 브라우저 shot.cjs (정적 시험 페이지)');
  const refPng = path.join(syn, 'ref.png');
  const srv = await serve(refPng);
  const base = `http://127.0.0.1:${PORT}`;
  const shotOut = path.join(OUT, 'shots');
  const shot = async (argv) => {
    const r = await runAsync(process.execPath, [path.join(TOOLS, 'shot.cjs'), '--out', shotOut, ...argv], { WOORI_WEB_PORT: '' });
    if (r.status !== 0) console.log(`  shot.cjs ${argv.slice(0, 4).join(' ')} → exit ${r.status}${tail(r, 8).onlyOnFail}`);
    return r;
  };
  const M = (p, o = shotOut) => readJson(path.join(o, p, 'metrics.json'));
  const B = (p, o = shotOut) => readJson(path.join(o, p, 'boxes.json'));
  try {
    // ?frame=1 구성
    const fr = await shot(['--url', `${base}/frame.html?frame=1&shot=geometry`, '--name', 'st/frame', '--no-compare', '--wait-ms', '100']);
    const fpng = path.join(shotOut, 'st', 'frame', 'shot.png');
    if (fr.status !== 0 || !fs.existsSync(fpng)) check('?frame=1 시험 페이지 찍기', false, fr.out.slice(-400));
    else {
      const sz = pngSize(fpng);
      check('뷰포트 360x880 @16/11 → PNG 524x1280', sz.join('x') === '524x1280', sz.join('x'));
      const SB = U.STATUS_BAR_DP;
      const spec = {
        midX: [U.xPx(150), U.xPx(210)], sb: U.STATUS_BAR_PX, nav: U.APP_BOTTOM_PX,
        h: [100, 400, 700].map((y) => ({ y, c: U.exact.yPx(SB + y + 0.5), xr: [U.xPx(140), U.xPx(220)] })),
        v: [16, 20, 100, 260, 340, 344].map((x) => ({ x, c: U.exact.xPx(x + 0.5), yr: [U.yPx(SB + 470), U.yPx(SB + 630)] })),
        box: [[20, 340, 200, 248], [16, 344, 300, 356]].map(([l, r, t, b]) => ({ l: U.exact.xPx(l), r: U.exact.xPx(r), t: U.exact.yPx(SB + t), b: U.exact.yPx(SB + b) })),
      };
      const pm = py(['-c', PY_MEASURE, fpng, JSON.stringify(spec)]);
      let m = null;
      try { m = JSON.parse(pm.out); } catch { check('?frame=1 측정', false, tail(pm)); }
      if (m) {
        const e = (a, b) => U.round3(a - b);
        check('상태바 → 앱 경계 45.576px · 앱 → 내비 경계 1210.182px (±0.1)', near(m.sb, spec.sb, 0.1) && near(m.nav, spec.nav, 0.1),
          `${U.round3(m.sb)} (${e(m.sb, spec.sb)}) · ${U.round3(m.nav)} (${e(m.nav, spec.nav)})`);
        const he = spec.h.map((L, i) => e(m.h[i], L.c));
        check('1dp 가로선 y=100/400/700 중심 = (31.333+y+0.5)·16/11 (±0.1px)', he.every((d) => Math.abs(d) <= 0.1), `오차 ${he.join(' / ')} px`);
        const ve = spec.v.map((L, i) => e(m.v[i], L.c));
        check('1dp 세로선 x=16/20/100/260/340/344 중심 = 262.02+1.45803(x+0.5−180) (±0.1px)', ve.every((d) => Math.abs(d) <= 0.1), `오차 ${ve.join(' / ')} px`);
        const be = spec.box.map((B0, i) => ['l', 'r', 't', 'b'].map((k) => e(m.box[i][k], B0[k])));
        check('상자 20–340dp·16–344dp 가장자리 = D1 (±0.15px)', be.flat().every((d) => Math.abs(d) <= 0.15), be.map((x) => x.join('/')).join(' · ') + ' px (왼/오/위/아래)');
      }
      const fb = B('st/frame');
      const b20 = fb.boxes.find((b) => b.id === 'box20');
      check('?frame=1 이면 boxes.json dp = 레이아웃 dp (20, 231.333, 320, 48)', fb.frameMode === true && b20 && near(b20.dp.x, 20, 0.02) &&
        near(b20.dp.y, U.STATUS_BAR_DP + 200, 0.02) && near(b20.dp.w, 320, 0.02) && near(b20.dp.h, 48, 0.02), b20 && JSON.stringify(b20.dp));
    }
    // 합성 이미지 1:1 / (3,5) 밀기
    await shot(['--url', `${base}/exact.html?shot=exact`, '--name', 'st/exact', '--ref', refPng, '--mask', 'rightColumnIso', '--wait-ms', '100', '--quiet']);
    await shot(['--url', `${base}/shift.html?shot=shift`, '--name', 'st/shift', '--ref', refPng, '--mask', 'rightColumnIso', '--wait-ms', '100', '--quiet']);
    const e = M('st/exact');
    check('합성 기준 이미지 1:1 → 차이 0 (기본 마스크 + rightColumnIso)', e.meanAbsDiff < 0.5 && e.pctPixelsOver24 < 0.05 && e.masks.statusbar && e.masks.navbar &&
      e.masks.extra.join() === '523,0,1,1280', `mad ${e.meanAbsDiff} · %>24 ${e.pctPixelsOver24}`);
    const s = M('st/shift');
    const g = s.globalOffset || {};
    check('transform (3,5)px 밀기 → 전역 (3,5)px = (2.06,3.44)dp', nearOff(g, 3, 5) && near(g.dxDp, U.wDp(3), 0.45) && near(g.dyDp, U.hDp(5), 0.45),
      `(${g.dx},${g.dy})px = (${g.dxDp},${g.dyDp})dp score ${g.score}`);
    const sb = B('st/shift').boxes.find((b) => b.id === 'title');
    check('data-ref 박스: frame px = CSS × 16/11, dp = D1 · 요소 오프셋 (3,5)', !!sb && near(sb.x, 28, 0.05) && near(sb.y, 140, 0.05) && near(sb.w, 232, 0.05) &&
      near(sb.dp.x, U.xDp(28), 0.03) && near(sb.dp.w, U.wDp(232), 0.03) && near(sb.dp.y, U.yDp(140), 0.03) && s.elements.length === 3 && s.elements.every((x) => nearOff(x.offset, 3, 5)),
    sb && `${sb.x},${sb.y},${sb.w},${sb.h} → dp ${JSON.stringify(sb.dp)} · ${s.elements.map((x) => `${x.id}(${x.offset && x.offset.dx},${x.offset && x.offset.dy})`).join(' ')}`);
    // 애니메이션 위상 · steps
    await shot(['--url', `${base}/anim.html`, '--name', 'st/anim-t500', '--t', '500', '--wait-ms', '300', '--no-compare']);
    await shot(['--url', `${base}/anim.html`, '--name', 'st/anim-end', '--wait-ms', '100', '--no-compare']);
    const clickBtn = JSON.stringify([{ click: '#btn' }]);
    await shot(['--url', `${base}/steps.html`, '--name', 'st/steps-hold', '--steps', clickBtn, '--t', '150', '--freeze-after-steps', '--wait-ms', '400', '--no-compare']);
    await shot(['--url', `${base}/steps.html`, '--name', 'st/steps-late', '--steps', clickBtn, '--t', '150', '--wait-ms', '400', '--no-compare']);
    const at = (p, id) => (B(p).boxes.find((b) => b.id === id) || {}).css;
    const a5c = at('st/anim-t500', 'css'), a5w = at('st/anim-t500', 'waapi'), aec = at('st/anim-end', 'css');
    check('--t 500: CSS 애니메이션·WAAPI 를 50% 에서 멈춤 (left 10 + 100)', a5c && a5w && near(a5c.x, 110, 0.6) && near(a5w.x, 110, 0.6), `css ${a5c && a5c.x} waapi ${a5w && a5w.x}`);
    check('t 없음: 끝 상태 (10 + 200)', aec && near(aec.x, 210, 0.6), `css ${aec && aec.x}`);
    const sh = at('st/steps-hold', 'mv'), sl = at('st/steps-late', 'mv');
    check('--freeze-after-steps: steps 가 시작한 300ms 전환을 150ms 에 멈춤 (10 + 100)', sh && near(sh.x, 110, 0.6), `mv ${sh && sh.x}`);
    check('freezeAfterSteps 없음: 전환이 찍기 전에 끝나 요소가 사라짐 (그래서 옵션이 필요)', !sl, sl ? `mv ${sl.x} 가 남아 있음` : 'mv 없음');
    // 늦은 READY: shot= 이면 READY 가 켜질 때까지 기다렸다가 찍는다
    const lr = await shot(['--url', `${base}/late.html?shot=late`, '--name', 'st/late', '--wait-ms', '50', '--no-compare']);
    const lp = py(['-c', 'import sys, cv2; im = cv2.imread(sys.argv[1]); print(*im[640, 262])', path.join(shotOut, 'st', 'late', 'shot.png')]);
    check('shot= 이면 READY(1.2초 뒤)까지 기다렸다 찍음 (초록)', lr.status === 0 && lp.out.trim() === '0 255 0' && !/READY 없음/.test(lr.out), `BGR ${lp.out.trim()}`);
    const singles = resets.splice(0);
    check('단일 shot 리셋 = 기본 시나리오 v1-start', singles.length === 8 && singles.every((x) => x === SL.DEFAULT_SCENARIO), JSON.stringify(singles));

    // --full + shots.d
    const fullOut = path.join(OUT, 'full');
    const tmpShots = path.join(fullOut, 'shots.json');
    fs.rmSync(fullOut, { recursive: true, force: true });
    writeJson(tmpShots, { base, shots: [
      { name: 'exact', url: '/exact.html', ref: refPng, waitMs: 50, mask: ['rightColumnIso'] },
      { name: 'shift', url: '/shift.html', ref: refPng, waitMs: 50, mask: ['rightColumnIso'] },
      { name: 'nomask', url: '/exact.html', ref: refPng, waitMs: 50, noDefaultMask: true },
    ] });
    writeJson(path.join(fullOut, 'shots.d', 'sel.json'), [
      { name: 'shift', scenario: 'v2', maskAdd: ['0,1000,524,44'] }, // 덮어쓰기(별칭 → v2-start) + 마스크 덧붙임
      { name: 'anim', url: '/anim.html', t: 250, waitMs: 50, noCompare: true }, // 새 항목
      { name: 'hold', url: '/steps.html', steps: [{ click: '#btn' }], t: 60, freezeAfterSteps: true, waitMs: 400, noCompare: true },
    ]);
    await shot(['--full', tmpShots, '--out', fullOut, '--quiet']);
    const fullResets = resets.splice(0);
    const sum = readJson(path.join(fullOut, 'summary.json'));
    const row = (n) => sum.find((r) => r.name === n) || {};
    const fh = B('hold', fullOut).boxes.find((b) => b.id === 'mv');
    check('shots.d 항목 "freezeAfterSteps" + t 60 (10 + 40)', fh && near(fh.css.x, 50, 0.6), `mv ${fh && fh.css.x}`);
    check('--full 요약 (px + dp)', sum.length === 5 && row('exact').meanAbsDiff < 0.5 && row('shift').globalOffsetPx === '(+3.0,+5.0)' &&
      row('shift').globalOffsetDp === '(+2.06,+3.44)' && fs.existsSync(path.join(fullOut, 'index.html')) && fs.readFileSync(path.join(fullOut, 'summary.md'), 'utf8').includes('| dp |'),
    JSON.stringify(sum.map((r) => [r.name, r.meanAbsDiff, r.globalOffsetPx, r.globalOffsetDp])));
    const fm = M('shift', fullOut);
    check('shots.d 덮어쓰기 (이름 마스크 + maskAdd, scenario 별칭 → v2-start)', fm.masks.extra.join(';') === '523,0,1,1280;0,1000,524,44' && row('shift').scenario === 'v2-start', `${fm.masks.extra} · ${row('shift').scenario}`);
    const nm = M('nomask', fullOut);
    check('noDefaultMask', !nm.masks.statusbar && !nm.masks.navbar && nm.comparedPixels === 524 * 1280, `comparedPixels=${nm.comparedPixels}`);
    const fa = B('anim', fullOut).boxes.find((b) => b.id === 'css');
    check('shots.d 새 항목 + 항목 "t" 250 (10 + 50)', fa && near(fa.css.x, 60, 0.6), `css ${fa && fa.css.x}`);
    check('scenario 리셋 순서 (정식 이름으로 보냄)', JSON.stringify(fullResets) === JSON.stringify(['v1-start', 'v2-start', 'v1-start', 'v1-start', 'v1-start']), JSON.stringify(fullResets));
    const onlyOut = path.join(OUT, 'only');
    fs.rmSync(onlyOut, { recursive: true, force: true });
    await shot(['--full', tmpShots, '--out', onlyOut, '--quiet', '--only', 'exact,anim', '--no-reset']);
    const os = readJson(path.join(onlyOut, 'summary.json'));
    check('--only exact,anim (앞부분) + --no-reset', os.map((r) => r.name).join() === 'exact,anim' && resets.length === 0, os.map((r) => r.name).join());
    const mergeOut = path.join(OUT, 'merge');
    fs.rmSync(mergeOut, { recursive: true, force: true });
    fs.mkdirSync(mergeOut, { recursive: true });
    fs.copyFileSync(path.join(fullOut, 'summary.json'), path.join(mergeOut, 'summary.json'));
    await shot(['--full', tmpShots, '--out', mergeOut, '--quiet', '--only', 'shift$', '--no-reset']);
    const ms = readJson(path.join(mergeOut, 'summary.json'));
    const mmd = fs.readFileSync(path.join(mergeOut, 'summary.md'), 'utf8');
    check('--only 는 이전 summary 와 합침 (안 찍은 4줄은 이전 실행 값)', ms.map((r) => r.name).join() === sum.map((r) => r.name).join() &&
      ms.filter((r) => r.previous).length === 4 && ms.find((r) => r.name === 'shift').globalOffsetPx === '(+3.0,+5.0)' && mmd.includes('이전 실행 값 4개'),
    ms.map((r) => `${r.name}${r.previous ? '(이전)' : ''}`).join());
    // 빈 레지스트리 (화면이 아직 없을 때)
    const emptyOut = path.join(OUT, 'empty-full');
    fs.rmSync(emptyOut, { recursive: true, force: true });
    writeJson(path.join(emptyOut, 'shots.json'), { shots: [] });
    const er = await shot(['--full', path.join(emptyOut, 'shots.json'), '--out', emptyOut, '--no-shots-d']);
    check('빈 레지스트리 --full → 오류 없이 빈 요약', er.status === 0 && readJson(path.join(emptyOut, 'summary.json')).length === 0, er.out.trim().split('\n').pop());
  } finally {
    srv.close();
  }
}

/* ── 6) 영상 ─────────────────────────────────────────────── */

function testVideo() {
  section('6) 영상 ref.py · woori_video · scan.py (v1-clean.mp4)');
  const r = py([path.join(TOOLS, 'ref.py'), '--name', '_selftest/v1-365', '--video', 'v1', '--i0', '#365', '--i1', '#372', '--quiet']);
  const png = path.join(REF_ST, 'v1-365.png');
  if (r.status !== 0 || !fs.existsSync(png)) { check('ref.py 구간 → 기준 프레임', false, tail(r)); return; }
  const sc = readJson(path.join(REF_ST, 'v1-365.json'));
  check('ref.py 출력 524x1280 + 옆 json (영상·구간·프레임 수)', pngSize(png).join('x') === '524x1280' && sc.video === 'v1' && sc.i0 === 365 && sc.i1 === 372 && sc.frames === 8 &&
    sc.rule === 'woori_video.median_ref', `${sc.video} #${sc.i0}–#${sc.i1} ${sc.frames}장 (${sc.t0}–${sc.t1}s)`);
  const pc = py(['-c', `import sys, json; sys.path.insert(0, ${JSON.stringify(TOOLS)}); sys.dont_write_bytecode = True
import numpy as np, cv2, woori_video as wv
a, idx = wv.median_ref("v1", 365, 372)
b, idx2, st = wv.median_ref_stack("v1", 365, 372)
c = cv2.imread(sys.argv[1])
it = [f for _, _, f in wv.iter_frames("v1", 365, 368)]
rf = [f for _, f in wv.read_frames("v1", 365, 368)]
big, idxb = wv.median_ref("v1", 365, 500, max_frames=20)
bigs, idxbs, _ = wv.median_ref_stack("v1", 365, 500, max_frames=20)
print(json.dumps({"refEq": bool((a == c).all()), "stackEq": bool((a == b).all()) and idx == idx2 and st.shape[0] == len(idx),
  "iterEq": len(it) == 4 and all((x == y).all() for x, y in zip(it, rf)), "sampleEq": bool((big == bigs).all()) and idxb == idxbs and len(idxb) == 20}))`, png]);
  let v = null;
  try { v = JSON.parse(pc.out); } catch { /* */ }
  check('ref.py 그림 = woori_video.median_ref (같은 화소)', !!v && v.refEq, v ? '' : tail(pc));
  check('median_ref_stack = median_ref (표본 20장 포함) · iter_frames = read_frames', !!v && v.stackEq && v.sampleEq && v.iterEq, v ? JSON.stringify(v) : '');
  const info = py([path.join(TOOLS, 'ref.py'), '--info', '--video', 'v1', '--i0', '13.139', '--i1', '13.2']);
  check('ref.py --info (초 → 그 시각에 보이던 프레임)', info.status === 0 && /# {2}365 {2}pts=/.test(info.out), info.out.trim().split('\n').pop());
  const dir = path.join(OUT, 'ref-all');
  writeJson(path.join(dir, 'shots.json'), { shots: [{ name: '_selftest/all-a', url: '/x', video: 'v1', i0: '#406', i1: '#409', mask: ['statusbar'] }, { name: '_selftest/no-video', url: '/y' }] });
  const all = py([path.join(TOOLS, 'ref.py'), '--all', '--shots', path.join(dir, 'shots.json'), '--quiet', '--force']);
  check('ref.py --all (shots 의 video·i0·i1, 구간 없는 항목은 건너뜀)', all.status === 0 && fs.existsSync(path.join(REF_ST, 'all-a.png')) && /생성 1 .* 구간 없음 1/.test(all.out), all.out.trim());
  const sj = path.join(OUT, 'scan.json');
  const scan = py([path.join(TOOLS, 'scan.py'), '--video', 'v1', '--from', '13.1', '--to', '14.0', '--json', sj, '--contact', path.join(OUT, 'scan-sheet.png')]);
  let segs = [];
  try { segs = readJson(sj).segments; } catch { /* */ }
  const hold = segs.find((x) => x.kind === 'hold' && x.i0 <= 380 && x.i1 >= 380);
  check('scan.py 짧은 구간: 정지 구간(#365 근처)과 접촉 시트', scan.status === 0 && !!hold && fs.existsSync(path.join(OUT, 'scan-sheet.png')),
    hold ? `HOLD #${hold.i0}–#${hold.i1} ${hold.t0.toFixed(3)}–${hold.t1.toFixed(3)}s` : tail(scan));
}

/* ── 실행 ───────────────────────────────────────────────── */

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const syn = path.join(OUT, 'synth');
  const pv = py(['-c', 'import cv2, numpy']);
  if (pv.status !== 0) {
    check('python3 + opencv + numpy', false, '없음 → python3 -m pip install opencv-python-headless numpy');
    process.exit(1);
  }
  const gs = py(['-c', PY_SYNTH, syn]);
  check('합성 기준 이미지 만들기 (524x1280, 고정 난수)', gs.status === 0 && pngSize(path.join(syn, 'ref.png')).join() === '524,1280', gs.status ? tail(gs) : '');
  testUnits();
  testCompare(syn);
  testRegistry();
  testGenerators();
  if (NO_BROWSER) skip('5) 브라우저', '--no-browser');
  else await testBrowser(syn);
  const clean = path.join(TOOLS, 'ref', 'video', 'v1-clean.mp4');
  if (NO_VIDEO) skip('6) 영상', '--no-video');
  else if (!fs.existsSync(clean)) skip('6) 영상', `${path.relative(ROOT, clean)} 없음`);
  else testVideo();
  if (!KEEP) fs.rmSync(REF_ST, { recursive: true, force: true }); // 실제 화면이 담긴 확인 그림은 남기지 않는다
  console.log(`\n${failed ? 'selftest FAILED' : 'selftest OK'}  (PASS ${passed}, FAIL ${failed})`);
  console.log(`결과: ${path.relative(process.cwd(), OUT) || OUT}/ (합성 그림·가짜 트리)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
