// express 의 아주 작은 부분 — server/index.mjs 를 브라우저(APK 웹뷰)에서 그대로 돌리기 위한 것. vite.config.ts 가 APK 빌드에서만 'express' 를 이 파일로 바꾼다.
// (woori-answer-key/frontend/src/WooriLocalExpress.cjs 와 같은 요령 — 거기서 옮겨 서버가 더 쓰는 것을 덧붙였다.)
//
// 흉내 내는 것:
//   express() → app.set · app.use([path], fn) · app.get/post/patch/put/delete(path, fn) · app.listen(아무것도 안 함) · app.handle(req, res, done)
//   express.json() · express.static()(아무것도 안 함: 화면은 APK 안에 있다)
//   req.method · url · originalUrl · path · baseUrl · params · query · body · headers · get(이름) · ip, res.status() · json() · send() · end() · setHeader() · type()
// 라우팅 = Express 기본값: 대소문자 무시, 끝 '/' 무시, ':name' 은 '/' 없는 한 칸. use(path) 는 칸 경계 접두사를 떼고 넘긴다. 인자 4개 함수 = 오류 처리기.
// 처리기가 던지면 next(err) → 다음 오류 처리기. 처리는 전부 동기 (setTimeout 으로 미루지 않는다).

let firstApp = null;
/** 서버가 처음 만든 app (local.ts 가 요청을 흘려 보낼 곳) */
export const getApp = () => firstApp;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compilePath(path, end) {
  const keys = [];
  const trimmed = path === "/" ? "" : String(path).replace(/\/+$/, "");
  const src = trimmed
    .split("/")
    .map((seg, i) => {
      if (i === 0) return "";
      if (seg.startsWith(":")) {
        keys.push(seg.slice(1));
        return "\\/([^\\/]+?)";
      }
      return "\\/" + escapeRe(seg);
    })
    .join("");
  const re = end ? new RegExp("^" + src + "\\/?$", "i") : new RegExp("^" + src + "(?=\\/|$)", "i");
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

const isErrorHandler = (fn) => typeof fn === "function" && fn.length === 4 && !fn.__router;

function makeRouter() {
  const stack = [];
  function router(req, res, out) {
    router.handle(req, res, out);
  }
  router.__router = true;
  router.handle = function handle(req, res, out) {
    let i = 0;
    const parentUrl = req.url;
    const parentBase = req.baseUrl;
    const parentParams = req.params;
    function next(err) {
      req.url = parentUrl;
      req.baseUrl = parentBase;
      req.params = parentParams;
      if (err === "router" || err === "route") err = undefined;
      const pathname = req.url.split("?")[0] || "/";
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
        if (layer.kind === "use") {
          const removed = m[0];
          req.baseUrl = parentBase + removed;
          const rest = req.url.slice(removed.length);
          req.url = rest.startsWith("/") ? rest : "/" + rest;
          req.path = req.url.split("?")[0] || "/";
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
    let path = "/";
    let fns = args;
    if (typeof args[0] === "string") {
      path = args[0];
      fns = args.slice(1);
    }
    for (const fn of fns.flat()) {
      const { re, keys } = compilePath(path, false);
      stack.push({ kind: "use", method: null, re, keys, fn });
    }
    return router;
  }
  function addRoute(method) {
    return (path, ...fns) => {
      for (const fn of fns.flat()) {
        const { re, keys } = compilePath(path, true);
        stack.push({ kind: "route", method, re, keys, fn });
      }
      return router;
    };
  }
  router.use = (...args) => addUse(args);
  router.get = addRoute("GET");
  router.post = addRoute("POST");
  router.put = addRoute("PUT");
  router.patch = addRoute("PATCH");
  router.delete = addRoute("DELETE");
  return router;
}

export default function express() {
  const app = makeRouter();
  app.disable = () => app;
  app.enable = () => app;
  app.set = () => app;
  app.listen = () => ({ close() {} });
  firstApp ??= app;
  return app;
}

/** express.json(): req.rawBody(문자열) → req.body. 본문 없으면 {} */
express.json = function json() {
  return function localJson(req, res, next) {
    const raw = typeof req.rawBody === "string" ? req.rawBody : "";
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    req.body = req.body || {};
    if (!raw || !ct.includes("json")) return next();
    const first = raw.trimStart()[0];
    let parsed;
    try {
      if (first !== "{" && first !== "[") throw new SyntaxError("strict");
      parsed = JSON.parse(raw);
    } catch (e) {
      const err = new SyntaxError(e && e.message);
      err.type = "entity.parse.failed";
      err.status = 400;
      err.statusCode = 400;
      return next(err);
    }
    req.body = parsed;
    return next();
  };
};
express.static = () => (_req, _res, next) => next();
express.Router = makeRouter;

function parseQuery(search) {
  const q = {};
  for (const [k, v] of new URLSearchParams(search)) {
    if (Object.hasOwn(q, k)) q[k] = Array.isArray(q[k]) ? [...q[k], v] : [q[k], v];
    else q[k] = v;
  }
  return q;
}

/** 요청 하나를 app 에 흘려 보내고 {status, body(문자열), headers} 를 돌려준다 (동기) */
export function dispatch(app, r) {
  const [pathname, search = ""] = r.url.split("?");
  const headers = {};
  for (const [k, v] of Object.entries(r.headers || {})) headers[k.toLowerCase()] = String(v);
  const req = {
    method: r.method.toUpperCase(),
    url: r.url,
    originalUrl: r.url,
    path: pathname,
    baseUrl: "",
    params: {},
    query: parseQuery(search),
    headers,
    ip: "127.0.0.1",
    rawBody: r.body,
    body: undefined,
    get: (name) => headers[String(name).toLowerCase()],
  };
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
      return this;
    },
    setHeader(name, value) {
      return this.set(name, value);
    },
    type(t) {
      return this.set("content-type", t === "html" ? "text/html; charset=utf-8" : t);
    },
    json(obj) {
      this.headers["content-type"] = "application/json; charset=utf-8";
      this.body = obj === undefined ? "" : JSON.stringify(obj);
      this.finished = true;
      return this;
    },
    send(text) {
      this.body = typeof text === "string" ? text : JSON.stringify(text);
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
      console.error("[allone-local] 처리되지 않은 오류", err);
      res.status(500).json({ code: "SERVER_ERROR", message: "서버 오류예요" });
    } else {
      res.status(404).json({ code: "NOT_FOUND", message: `Cannot ${req.method} ${pathname}` });
    }
  });
  return { status: res.statusCode, body: res.body, headers: res.headers };
}
