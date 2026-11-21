#!/usr/bin/env node
/*
 * 실시간 오버레이 뷰어: 앱(iframe, 360x880 dp) 위에 손잡이를 지운 영상(v1/v2 clean) 또는 ref PNG 를 겹쳐 본다.
 *   node tools/viewer.cjs [--port 5298] [--app http://localhost:5273] [--v1 PATH] [--v2 PATH] [--raw]
 *   -> 브라우저에서 http://localhost:5298/  (단축키는 페이지 안내 참고)
 *
 *   --app 기본값: http://localhost:$WOORI_WEB_PORT (없으면 5273). 포트 기본값: $WOORI_VIEWER_PORT 또는 5298.
 *   영상 기본값: tools/ref/video/<v>-clean.mp4 (환경 변수 WOORI_V1 / WOORI_V2 가 있으면 그것 — woori_video.py 와 같은 규칙).
 *   --raw 는 손잡이를 지우지 않은 원본 <v>.mp4 (손잡이가 보인다. 확인용으로만).
 *
 * 제공: /                 viewer.html (단위 상수는 tools/woori-units.cjs 에서 넣는다)
 *       /video/v1.mp4     영상 (Range 지원 → 프레임 단위 탐색)
 *       /pts/v1.json      원본 프레임 pts 목록 (tools/ref/video/v1-pts.json, 없으면 woori_video.py pts 로 만든다)
 *       /refs.json        tools/ref 아래 PNG 목록 (video/ 제외),  /ref/<group>/<state>.png
 *       /shots.json       tools/shots.json + tools/shots.d 병합 (상태 목록 바로가기)
 *       POST /reset?scenario=v1-start|v2-start|v2-end  → <app>/api/dev/reset 으로 전달 (상태를 고르면 뷰어가 자동으로 부름)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const U = require('./woori-units.cjs');
const { loadShots, SCENARIOS, DEFAULT_SCENARIO, checkScenario } = require('./shots-lib.cjs');

const TOOLS = __dirname;
const VIDEO_DIR = path.join(TOOLS, 'ref', 'video');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(opt('port', process.env.WOORI_VIEWER_PORT || 5298));
const APP = opt('app', `http://localhost:${process.env.WOORI_WEB_PORT || 5273}`).replace(/\/+$/, '');
const RAW = args.includes('--raw');
const VIDEOS = ['v1', 'v2'];

function videoPath(v) {
  const flag = opt(v);
  if (flag) return path.resolve(flag);
  const env = process.env['WOORI_' + v.toUpperCase()];
  if (env && !RAW) return env;
  return path.join(VIDEO_DIR, RAW ? `${v}.mp4` : `${v}-clean.mp4`);
}

/** pts 목록: tools/ref/video/<v>-pts.json (woori_video.py 캐시). 영상보다 오래됐거나 없으면 woori_video.py pts 로 만든다 */
function ptsFile(v) {
  const cache = path.join(VIDEO_DIR, `${v}-pts.json`);
  const vid = videoPath(v);
  const fresh = () => fs.existsSync(cache) && (!fs.existsSync(vid) || fs.statSync(cache).mtimeMs >= fs.statSync(vid).mtimeMs);
  if (!fresh() && fs.existsSync(vid)) {
    const r = spawnSync('python3', [path.join(TOOLS, 'woori_video.py'), 'pts', '--video', v], { encoding: 'utf8' });
    if (r.status !== 0) console.warn(`[viewer] ${v} pts 만들기 실패: ${(r.stderr || '').trim().split('\n').pop()}`);
  }
  return fs.existsSync(cache) ? cache : null;
}

function listRefs(dir, base = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) return rel === 'video' ? [] : listRefs(path.join(dir, e.name), rel);
    return e.name.endsWith('.png') ? [rel] : [];
  }).sort();
}

function sendFile(req, res, file, type) {
  if (!file || !fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  const size = fs.statSync(file).size;
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${size}`, 'cache-control': 'no-cache' });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  }
}

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

/** viewer.html 에 넣는 상수 (단위는 woori-units.cjs 하나에서) */
const CONFIG = {
  app: APP,
  raw: RAW,
  frame: U.FRAME,
  viewportDp: U.VIEWPORT_DP,
  pxPerDpX: U.PX_PER_DP_X,
  xCenterPx: U.X_CENTER_PX,
  xCenterDp: U.X_CENTER_DP,
  dpPerPxY: U.DP_PER_PX_Y,
  statusBarDp: U.STATUS_BAR_DP,
  appBottomDp: U.APP_BOTTOM_DP,
  frameMode: U.FRAME_MODE,
  scenarios: SCENARIOS,
  defaultScenario: DEFAULT_SCENARIO,
  videos: Object.fromEntries(VIDEOS.map((v) => [v, fs.existsSync(videoPath(v))])),
};

const server = http.createServer(async (req, res) => {
  const [rawPath, query = ''] = req.url.split('?');
  let u;
  try { u = decodeURIComponent(rawPath); } catch { res.writeHead(400); res.end('bad url'); return; }
  if (u === '/' || u === '/index.html') {
    const html = fs.readFileSync(path.join(TOOLS, 'viewer.html'), 'utf8')
      .replace('__WOORI_VIEWER_CONFIG__', JSON.stringify(CONFIG).replace(/</g, '\\u003c'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); return;
  }
  let m = /^\/video\/(v[12])\.mp4$/.exec(u);
  if (m) return sendFile(req, res, videoPath(m[1]), 'video/mp4');
  m = /^\/pts\/(v[12])\.json$/.exec(u);
  if (m) return sendFile(req, res, ptsFile(m[1]), 'application/json');
  if (u === '/refs.json') return json(res, 200, listRefs(path.join(TOOLS, 'ref')));
  if (u === '/shots.json') {
    try { return json(res, 200, { shots: loadShots(path.join(TOOLS, 'shots.json')).shots }); }
    catch (e) { return json(res, 500, { error: e.message }); }
  }
  if (u === '/reset' && req.method === 'POST') {
    let scenario;
    try { scenario = checkScenario(new URLSearchParams(query).get('scenario') || DEFAULT_SCENARIO); }
    catch (e) { return json(res, 400, { ok: false, error: e.message }); }
    try {
      const r = await fetch(APP + '/api/dev/reset', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario }), signal: AbortSignal.timeout(5000) });
      return json(res, r.status, { ok: r.ok, scenario });
    } catch (e) { return json(res, 502, { ok: false, error: e.message }); }
  }
  const safe = !u.includes('..') && u.endsWith('.png');
  if (safe && u.startsWith('/ref/') && !u.startsWith('/ref/video/')) return sendFile(req, res, path.join(TOOLS, u), 'image/png');
  if (safe && u.startsWith('/out/')) return sendFile(req, res, path.join(TOOLS, u), 'image/png');
  res.writeHead(404); res.end('not found');
});

server.on('error', (e) => { console.error(`[viewer] ${e.code === 'EADDRINUSE' ? `포트 ${PORT} 사용 중 (--port 로 바꾼다)` : e.message}`); process.exit(1); });
server.listen(PORT, () => {
  const vids = VIDEOS.map((v) => `${v} ${CONFIG.videos[v] ? path.relative(process.cwd(), videoPath(v)) : '(없음)'}`).join(' · ');
  console.log(`[viewer] http://localhost:${PORT}/   (app: ${APP})`);
  console.log(`         영상 ${vids}${RAW ? '  ← 원본(손잡이 보임)' : ''}`);
  console.log('         단위 D1: x_dp = 180 + (x_px − 262.02)/1.45803, y_dp = y_px × 0.6875');
});
