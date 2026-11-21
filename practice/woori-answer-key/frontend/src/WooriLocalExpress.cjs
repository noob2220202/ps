'use strict';
// 로컬 모드(VITE_WOORI_LOCAL=1, 서버 없는 APK) 전용 — 브라우저에서 backend/app.js · backend/routes/*.js 를 그대로 돌리기 위한
// Express 4 의 아주 작은 부분. vite.config.ts 가 로컬 빌드에서만 'express' 를 이 파일로 바꾼다 (웹 빌드·백엔드 서버와 무관).
//
// 흉내 내는 것 (backend 가 쓰는 것만):
//   express() → app.disable() · app.use([path], fn | router) · app.handle(req, res, done)
//   express.Router() → get · post · delete · use([path], fn | router)
//   express.json() → 본문 JSON 파싱 (body-parser strict: '{' 또는 '[' 로 시작, 틀리면 type 'entity.parse.failed' · 400)
//   req.method · req.url · req.originalUrl · req.baseUrl · req.params · req.query · req.body,  res.status() · res.json()
// 라우팅 규칙 = Express 4 기본값: 대소문자 무시, 끝 '/' 무시(strict 아님), ':name' 은 '/' 없는 한 칸(decodeURIComponent),
//   use(path) 는 칸 경계 접두사를 떼고 안쪽 라우터에 넘긴다(mergeParams 없음). 인자 4개 함수 = 오류 처리기.
//   처리기가 던지면 next(err) → 다음 오류 처리기 (backend/app.js 의 ApiError → {error, code} 변환).

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** '/:id/transactions' → { re, keys }. end=true 면 전체 일치(끝 '/' 허용), false 면 칸 경계 접두사 */
function compilePath(path, end) {
  const keys = [];
  const trimmed = path === '/' ? '' : String(path).replace(/\/+$/, '');
  const src = trimmed
    .split('/')
    .map((seg, i) => {
      if (i === 0) return '';
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '\\/([^\\/]+?)';
      }
      return '\\/' + escapeRe(seg);
    })
    .join('');
  const re = end ? new RegExp('^' + src + '\\/?$', 'i') : new RegExp('^' + src + '(?=\\/|$)', 'i');
  return { re, keys };
}

function decodeParam(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    const err = new Error(`Failed to decode param '${v}'`);
    err.status = 400;
    throw err;
  }
}

function isErrorHandler(fn) {
  return typeof fn === 'function' && fn.length === 4 && !fn.__wooriRouter;
}

/** 층(layer) 목록을 차례로 돈다. Express 4 Router.handle 과 같은 흐름 (동기 처리기만 — backend 는 모두 동기) */
function makeRouter() {
  const stack = [];

  function router(req, res, out) {
    router.handle(req, res, out);
  }
  router.__wooriRouter = true;

  router.handle = function handle(req, res, out) {
    let i = 0;
    const parentUrl = req.url;
    const parentBase = req.baseUrl;
    const parentParams = req.params;

    function next(err) {
      req.url = parentUrl;
      req.baseUrl = parentBase;
      req.params = parentParams;
      if (err === 'router' || err === 'route') err = undefined;
      const pathname = req.url.split('?')[0] || '/';
      while (i < stack.length) {
        const layer = stack[i++];
        if (res.finished) return;
        if (layer.method && layer.method !== req.method) continue;
        const m = layer.re.exec(pathname);
        if (!m) continue;
        const errHandler = isErrorHandler(layer.fn);
        if (err ? !errHandler : errHandler) continue;
        let params;
        try {
          params = {};
          layer.keys.forEach((k, j) => {
            if (m[j + 1] !== undefined) params[k] = decodeParam(m[j + 1]);
          });
        } catch (e) {
          err = e;
          continue;
        }
        if (layer.kind === 'use') {
          const removed = m[0];
          req.baseUrl = parentBase + removed;
          const rest = req.url.slice(removed.length);
          req.url = rest.startsWith('/') ? rest : '/' + rest;
          req.params = parentParams;
        } else {
          req.params = params;
        }
        try {
          if (errHandler) layer.fn(err, req, res, next);
          else layer.fn(req, res, next);
        } catch (e) {
          next(e);
        }
        return;
      }
      out(err);
    }

    next();
  };

  function addUse(args) {
    let path = '/';
    let fns = args;
    if (typeof args[0] === 'string') {
      path = args[0];
      fns = args.slice(1);
    }
    for (const fn of fns.flat()) {
      const { re, keys } = compilePath(path, false);
      stack.push({ kind: 'use', method: null, re, keys, fn });
    }
    return router;
  }

  function addRoute(method) {
    return (path, ...fns) => {
      for (const fn of fns.flat()) {
        const { re, keys } = compilePath(path, true);
        stack.push({ kind: 'route', method, re, keys, fn });
      }
      return router;
    };
  }

  router.use = (...args) => addUse(args);
  router.get = addRoute('GET');
  router.post = addRoute('POST');
  router.put = addRoute('PUT');
  router.patch = addRoute('PATCH');
  router.delete = addRoute('DELETE');
  return router;
}

function express() {
  const app = makeRouter();
  app.disable = () => app;
  app.enable = () => app;
  app.set = () => app;
  return app;
}

/** express.json(): req.rawBody(문자열) → req.body. 본문 없으면 {} (body-parser 1.x 와 같음) */
function json() {
  return function wooriJson(req, res, next) {
    const raw = typeof req.rawBody === 'string' ? req.rawBody : '';
    const ct = String(req.headers['content-type'] || '').toLowerCase();
    req.body = req.body || {};
    if (!raw || !ct.includes('json')) return next();
    const first = raw.trimStart()[0];
    let parsed;
    try {
      if (first !== '{' && first !== '[') throw new SyntaxError('strict');
      parsed = JSON.parse(raw);
    } catch (e) {
      const err = new SyntaxError(e && e.message);
      err.type = 'entity.parse.failed';
      err.status = 400;
      err.statusCode = 400;
      return next(err);
    }
    req.body = parsed;
    return next();
  };
}

/** 쿼리 문자열 → 객체 (같은 키가 여러 번이면 배열, Express 'extended' 파서의 평범한 경우와 같음) */
function parseQuery(search) {
  const q = {};
  for (const [k, v] of new URLSearchParams(search)) {
    if (Object.hasOwn(q, k)) q[k] = Array.isArray(q[k]) ? [...q[k], v] : [q[k], v];
    else q[k] = v;
  }
  return q;
}

/**
 * 요청 하나를 app 에 흘려 보내고 {status, body(문자열), headers} 를 돌려준다 (동기).
 * @param {Function} app express() 결과
 * @param {{method: string, url: string, headers?: Record<string,string>, body?: string}} r url = '/api/…?…'
 */
function dispatch(app, r) {
  const [pathname, search = ''] = r.url.split('?');
  const headers = {};
  for (const [k, v] of Object.entries(r.headers || {})) headers[k.toLowerCase()] = String(v);
  const req = {
    method: r.method.toUpperCase(),
    url: r.url,
    originalUrl: r.url,
    path: pathname,
    baseUrl: '',
    params: {},
    query: parseQuery(search),
    headers,
    rawBody: r.body,
    body: undefined,
    get: (name) => headers[String(name).toLowerCase()],
  };
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
      return this;
    },
    json(obj) {
      this.headers['content-type'] = 'application/json; charset=utf-8';
      this.body = obj === undefined ? '' : JSON.stringify(obj);
      this.finished = true;
      return this;
    },
    send(text) {
      this.body = typeof text === 'string' ? text : JSON.stringify(text);
      this.finished = true;
      return this;
    },
    end() {
      this.finished = true;
      return this;
    },
  };
  app.handle(req, res, (err) => {
    if (res.finished) return;
    if (err) {
      console.error('[woori-local] 처리되지 않은 오류', err);
      res.status(500).json({ error: '일시적인 오류가 발생했습니다', code: 'INTERNAL' });
    } else {
      res.status(404).json({ error: `Cannot ${req.method} ${pathname}`, code: 'NOT_FOUND' });
    }
  });
  return { status: res.statusCode, body: res.body, headers: res.headers };
}

express.Router = makeRouter;
express.json = json;
express.dispatch = dispatch;
module.exports = express;
