// APK 로컬 모드: server/index.mjs(Express + SQLite)를 폰 웹뷰 안에서 그대로 돌린다 — 서버 · PC · 네트워크 없이.
//   · express · node:* · server/auth.mjs 는 vite.config.ts 가 APK 빌드(--mode allone-apk)에서만 src/apk/shim/* 로 바꿔 끼운다 (서버 코드는 한 글자도 안 고쳤다)
//   · 로그인 · 프로필 고르기는 없다: 늘 로그인된 한 사람, 프로필 하나 (PROFILE_ID). 처음 켜면 예시 데이터(홍길동)로 채우고, 이후는 🔔 관리 패널에서
//   · DB 는 sql.js(SQLite wasm). 바뀐 요청마다 바이트를 IndexedDB 에 저장 (앱을 다시 켜도 그대로, 앱 데이터를 지우면 처음으로)
//   · window.fetch 를 감싸 같은 출처 '/api/…' 요청만 서버 코드에 흘려 보낸다. GET 은 원래 서버처럼 250ms 늦춘다 (스켈레톤·로딩 막이 실제 앱처럼 잠깐 보이게)
import initSqlJs, { type SqlJsStatic } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";
import { installNodeGlobals } from "./globals";
import { configureSqlite, type DatabaseSync } from "./shim/node-sqlite";
import { dispatch, getApp } from "./shim/express.js";
import { APK_PROFILE_ID } from "../profile/session"; // 프로필 하나 (server/db.mjs isProfileId 모양: p + 16진수 8자리)

const DB_PATH = `/allone/profiles/${APK_PROFILE_ID}.db`;
const GET_DELAY_MS = 250;

const IDB_NAME = "allone-apk";
const IDB_STORE = "local-db";
const IDB_KEY = "profile.db";

const STORAGE_FAILED = { code: "STORAGE_FAILED", message: "기기에 저장하지 못해 처리하지 않았어요. 저장 공간을 확인한 뒤 다시 시도해 주세요" };

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open 실패"));
  });
}
const idbGet = (idb: IDBDatabase) =>
  new Promise<{ bytes: Uint8Array } | undefined>((resolve, reject) => {
    const req = idb.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve(req.result as { bytes: Uint8Array } | undefined);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB get 실패"));
  });
const idbPut = (idb: IDBDatabase, bytes: Uint8Array) =>
  new Promise<void>((resolve, reject) => {
    // strict: 디스크에 쓴 뒤 complete (이체 응답 직후 앱이 죽어도 남게)
    const tx = idb.transaction(IDB_STORE, "readwrite", { durability: "strict" });
    tx.objectStore(IDB_STORE).put({ bytes, savedAt: new Date().toISOString() }, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB put 실패"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB put 중단"));
  });

interface Runtime {
  db: DatabaseSync;
  persist: () => Promise<void>;
}
let runtime: Promise<Runtime> | null = null;

async function start(): Promise<Runtime> {
  installNodeGlobals();
  const SQL: SqlJsStatic = await initSqlJs({ locateFile: () => sqlWasmUrl });
  let idb: IDBDatabase | null = null;
  let saved: Uint8Array | undefined;
  try {
    idb = await idbOpen();
    saved = (await idbGet(idb))?.bytes;
  } catch (err) {
    console.error("[allone-local] IndexedDB 를 쓸 수 없어 저장 없이 돈다", err);
  }
  configureSqlite(SQL, new Map(saved?.length ? [[DB_PATH, saved]] : []));

  // 서버 모듈은 지금부터 (process · sql.js 가 준비된 뒤): db.mjs 는 import 하자마자 DB 를 연다
  const dbMod = await import("../../server/db.mjs");
  await import("../../server/index.mjs");
  const app = getApp();
  if (!app) throw new Error("서버 app 을 못 찾았다");

  // 로그인 · 프로필 고르기 대신: 프로필 표(프로필 목록)에 한 줄 — 서버의 X-Profile 검사가 이 줄을 찾는다
  dbMod.registry
    .prepare("INSERT OR IGNORE INTO profiles (id, name, avatar, color, owner_id, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))")
    .run(APK_PROFILE_ID, "올원뱅크", dbMod.AVATARS[0], dbMod.COLORS[0], "ulocal001");
  const db = dbMod.profileDb(APK_PROFILE_ID) as unknown as DatabaseSync;
  let seeded = false;
  if (!db.prepare("SELECT 1 FROM profile").get()) {
    dbMod.SEEDS[dbMod.APP].example(db, "홍길동"); // 처음 켠 앱: 예시 데이터. 바꾸는 건 🔔 관리 패널
    seeded = true;
  }

  let lastSaved: Uint8Array = saved && !seeded ? saved : db.exportBytes();
  let rollbacks = 0;
  const rollback = () => {
    const next = new SQL.Database(lastSaved);
    next.exec("PRAGMA foreign_keys = ON;");
    db.raw.close();
    db.raw = next;
    rollbacks++;
  };
  let chain: Promise<void> = Promise.resolve();
  const persist = (): Promise<void> => {
    const bytes = db.exportBytes(); // 지금 상태를 바로 떠 둔다 (다음 요청이 바꾸기 전에)
    if (!idb) return chain;
    const target = idb;
    const at = rollbacks;
    chain = chain
      .catch(() => undefined)
      .then(async () => {
        if (at !== rollbacks) throw new Error("앞 저장 실패로 되돌림");
        try {
          await idbPut(target, bytes);
          lastSaved = bytes;
        } catch (err) {
          rollback();
          throw err;
        }
      });
    return chain;
  };
  if (seeded) await persist().catch((err: unknown) => console.error("[allone-local] 처음 저장 실패 — 저장 없이 시작한다", err));
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* 없어도 된다 */
  }
  return { db, persist };
}

const abortError = (signal: AbortSignal) => signal.reason ?? new DOMException("The operation was aborted.", "AbortError");

function installFetch(rt: Runtime) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(href, window.location.href);
    if (!(u.origin === window.location.origin && (u.pathname === "/api" || u.pathname.startsWith("/api/")))) return nativeFetch(input, init);
    const req = input instanceof Request ? input : null;
    const signal = init?.signal ?? req?.signal ?? null;
    if (signal?.aborted) throw abortError(signal);
    const method = (init?.method ?? req?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init?.headers ?? req?.headers ?? undefined).forEach((v, k) => {
      headers[k] = v;
    });
    let body: string | undefined;
    if (init?.body !== undefined && init.body !== null) body = typeof init.body === "string" ? init.body : await new Response(init.body).text();
    else if (req && method !== "GET" && method !== "HEAD") body = await req.clone().text();
    if (method === "GET") await new Promise((r) => setTimeout(r, GET_DELAY_MS));
    if (signal?.aborted) throw abortError(signal);

    const before = rt.db.totalChanges();
    const out = dispatch(getApp(), { method, url: u.pathname + u.search, headers, body });
    if (rt.db.totalChanges() !== before) {
      try {
        await rt.persist();
      } catch (err) {
        console.error("[allone-local] 저장 실패 — 이 요청의 변경을 되돌렸다", err);
        return new Response(JSON.stringify(STORAGE_FAILED), { status: 507, headers: { "Content-Type": "application/json; charset=utf-8" } });
      }
    }
    if (signal?.aborted) throw abortError(signal);
    // 204 는 본문을 가질 수 없다 (Response 생성자가 던짐)
    return new Response(out.status === 204 ? null : out.body, {
      status: out.status,
      headers: { "Content-Type": out.headers["content-type"] ?? "application/json; charset=utf-8" },
    });
  };
}

/** 서버(웹뷰 안)를 띄우고 fetch 를 연결한다. 화면을 그리기 전에 한 번 기다린다 */
export function startLocalBackend(): Promise<void> {
  runtime ??= start().then((rt) => {
    installFetch(rt);
    return rt;
  });
  return runtime.then(() => undefined);
}
