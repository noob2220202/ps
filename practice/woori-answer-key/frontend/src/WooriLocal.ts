// 로컬 모드 — 서버 없이 폰 혼자 도는 APK 용 (빌드 플래그 VITE_WOORI_LOCAL=1 일 때만 main.tsx 가 동적 import 해서 startWooriLocal() 을 부른다.
// 웹 빌드에는 들어가지 않는다).
//
// 브라우저(웹뷰) 안에서 backend 와 **같은 코드**를 돌린다:
//   - DB: sql.js(SQLite wasm) 위에 node:sqlite DatabaseSync 모양의 얇은 껍데기(WooriLocalDb) → backend/schema.js 의 SCHEMA 그대로
//   - 업무 로직·라우트: backend/app.js createApp → routes/*.js · repo.js · transfer.js · seed.js · banks.js · clock.js · util.js 그대로 import
//     (express·cors 는 vite.config.ts 가 로컬 빌드에서만 WooriLocalExpress.cjs · WooriLocalCors.cjs 로 바꾼다)
//   - 전송: window.fetch 를 감싸 같은 출처 '/api/…' 요청만 가로채 createApp 에 흘려 보내고, 라우트가 만든 JSON·상태 코드를 그대로 Response 로 돌려준다.
//     WooriApi.ts 는 그대로 (fetch 만 부른다).
//   - 저장: 요청이 DB 를 바꾸면(total_changes) DB 바이트 전체를 IndexedDB 에 쓴 뒤에 응답한다 → 앱을 껐다 켜도 잔액·거래내역·이체 결과가 남는다.
//     처음 실행(저장본 없음)이면 createApp 의 ensureSeeded 가 v1-start(잔액 345원)로 채운다. 스키마가 바뀐 저장본은 버리고 새로 채운다.
//     쓰기가 실패하면(기기 저장 공간 부족 등) 메모리 DB 를 마지막으로 저장된 바이트로 되돌리고 507 {code:'STORAGE_FAILED'} (한국어 error)
//     → 화면은 backend 오류처럼 안내하고, 메모리와 저장본(= 다시 켰을 때)이 어긋나지 않는다 (이체가 메모리에서만 된 것처럼 보이지 않게).
//   - 시계: backend 와 같다 (덮어쓰기 meta → 실제 시각, Asia/Seoul). 처음 상태로 되돌리는 화면 안 메뉴는 없다 — 앱 데이터를 지우면
//     (안드로이드 설정 → 앱 → 저장공간 → 데이터 삭제) 다음 실행에 v1-start 로 다시 채운다. /api/dev/reset · /api/dev/clock 은 도구(woori-local-check)용으로 남는다.
//   - 폰 뒤로 버튼(@capacitor/app backButton, APK 에서만): 먼저 window 에 취소 가능한 WOORI_BACK_EVENT('woori-back') →
//     WooriEnv 의 뒤로 처리 스택(열린 시트·팝업 > 페이지 머리 ‹·✕)이 하나만 받는다. 아무도 막지 않으면
//     처음 화면(/ 스플래시 · /cert 인증서·로그인 로딩 · /home 홈)이면 '한 번 더 누르면 종료' 토스트 → 2초 안에 또 누르면 exitApp,
//     그 밖은 기록이 있으면 history.back() (WooriNav 가 들어온 전환의 반대로 돌아간다), 없으면 홈으로.
//   - <html data-woori-local="1">, APK 안이면 data-woori-native="1" (WooriEnv.ts)
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import initSqlJs, { type SqlJsDatabase, type SqlValue } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import { createApp, type WooriBackendDb } from 'woori-backend/app.js'
import { SCHEMA } from 'woori-backend/schema.js'
import { WOORI_BACK_EVENT, wooriToast } from './WooriEnv.ts'
import express from './WooriLocalExpress.cjs'
import WooriLocalRoot from './WooriLocalMenu.tsx'

/* ───────────────────────── Node 전역 껍데기 ───────────────────────── */

// backend/routes/accounts.js 의 거래내역 커서가 Buffer.from(…).toString('base64url') 을 쓴다 — 그 두 가지만 (웹뷰에는 Buffer 가 없다).
// process.env 는 빌드가 {} 로 바꾼다 (WOORI_* 환경 변수 없음 = backend 기본값: 시나리오 v1-start, 비밀번호 1234, 실제 시계).
function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const wooriBuffer = {
  from(input: string, encoding?: string) {
    const bytes = encoding === 'base64url' ? base64UrlDecode(String(input)) : new TextEncoder().encode(String(input))
    return {
      toString: (enc?: string) => (enc === 'base64url' ? base64UrlEncode(bytes) : new TextDecoder().decode(bytes)),
    }
  },
}
const g = globalThis as { Buffer?: unknown }
g.Buffer ??= wooriBuffer

/* ───────────────────────── node:sqlite 모양의 sql.js 껍데기 ───────────────────────── */

type Row = Record<string, SqlValue>

/**
 * backend 가 쓰는 DatabaseSync 의 부분: exec(sql) · prepare(sql) → run/get/all(...params).
 * 문장은 부를 때마다 컴파일하고 바로 free 한다 (sql.js 문장은 GC 되지 않는다 — 요청마다 prepare 하는 backend 코드에서 새지 않게).
 * run() → {changes, lastInsertRowid} (node:sqlite 와 같은 키), get() → 행 또는 undefined, all() → 행 배열.
 */
export class WooriLocalDb implements WooriBackendDb {
  raw: SqlJsDatabase
  constructor(raw: SqlJsDatabase) {
    this.raw = raw
  }

  exec(sql: string): void {
    this.raw.exec(sql)
  }

  prepare(sql: string) {
    const step = <T>(params: unknown[], fn: (s: ReturnType<SqlJsDatabase['prepare']>) => T): T => {
      const s = this.raw.prepare(sql)
      try {
        s.bind(params)
        return fn(s)
      } finally {
        s.free()
      }
    }
    return {
      run: (...params: unknown[]) =>
        step(params, (s) => {
          while (s.step()) {
            /* 끝까지 */
          }
          const changes = this.raw.getRowsModified()
          return { changes, lastInsertRowid: this.scalar('SELECT last_insert_rowid()') }
        }),
      get: (...params: unknown[]) => step(params, (s) => (s.step() ? (s.getAsObject() as Row) : undefined)),
      all: (...params: unknown[]) =>
        step(params, (s) => {
          const rows: Row[] = []
          while (s.step()) rows.push(s.getAsObject() as Row)
          return rows
        }),
    }
  }

  scalar(sql: string): number {
    const r = this.raw.exec(sql)
    return Number(r[0]?.values[0]?.[0] ?? 0)
  }

  /** 이 연결에서 바뀐 행 수 누계 (요청 전후로 비교해 저장할지 정한다) */
  totalChanges(): number {
    return this.scalar('SELECT total_changes()')
  }

  /** DB 바이트. sql.js export() 는 연결을 닫았다 다시 열므로 db.js openDb 와 같은 PRAGMA 를 다시 건다 */
  exportBytes(): Uint8Array {
    const bytes = this.raw.export()
    this.raw.exec('PRAGMA foreign_keys = ON;')
    return bytes
  }
}

/* ───────────────────────── IndexedDB 저장 ───────────────────────── */

const IDB_NAME = 'woori-answer-key'
const IDB_STORE = 'local-db'
const IDB_KEY = 'woori.db'

interface SavedDb {
  /** SCHEMA 해시 — 다르면 저장본을 버린다 (앱을 새 스키마로 바꿨을 때) */
  schemaKey: string
  bytes: Uint8Array
  savedAt: string
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open 실패'))
  })
}

async function idbGet(idb: IDBDatabase): Promise<SavedDb | undefined> {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    req.onsuccess = () => resolve(req.result as SavedDb | undefined)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB get 실패'))
  })
}

async function idbPut(idb: IDBDatabase, value: SavedDb): Promise<void> {
  return new Promise((resolve, reject) => {
    // strict: 디스크에 쓴 뒤 complete (이체 응답 직후 앱이 죽어도 남게)
    const tx = idb.transaction(IDB_STORE, 'readwrite', { durability: 'strict' })
    tx.objectStore(IDB_STORE).put(value, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put 실패'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB put 중단'))
  })
}

/** FNV-1a 32bit (스키마 바뀜 감지용) */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const SCHEMA_KEY = `schema-${hash(SCHEMA)}`

/* ───────────────────────── 런타임 ───────────────────────── */

interface LocalRuntime {
  db: WooriLocalDb
  app: unknown
  /** 지금 DB 를 저장한다 (순서대로, 쓰기가 끝나면 resolve). 실패하면 메모리 DB 를 마지막 저장본으로 되돌리고 reject */
  persist: () => Promise<void>
  /** 저장본에서 열었는지, 새로 채웠는지 */
  origin: 'saved' | 'seeded'
}

/** 저장 실패 응답 (WooriApi 가 WooriApiError(507) 로 받아 error 를 그대로 보인다) */
const STORAGE_FAILED = {
  error: '기기에 저장하지 못해 처리하지 않았습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요',
  code: 'STORAGE_FAILED',
} as const

let runtimePromise: Promise<LocalRuntime> | null = null

async function startRuntime(): Promise<LocalRuntime> {
  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl })
  let idb: IDBDatabase | null = null
  try {
    idb = await idbOpen()
  } catch (err) {
    console.error('[woori-local] IndexedDB 를 열 수 없어 저장 없이 돈다', err)
  }
  let saved: SavedDb | undefined
  if (idb) {
    try {
      saved = await idbGet(idb)
    } catch (err) {
      console.error('[woori-local] 저장본 읽기 실패 — 새로 채운다', err)
    }
  }

  // db.js openDb(':memory:') 와 같은 순서: foreign_keys → SCHEMA. 저장본이 깨졌으면 빈 DB 로
  let raw: SqlJsDatabase | null = null
  let origin: LocalRuntime['origin'] = 'seeded'
  if (saved && saved.schemaKey === SCHEMA_KEY && saved.bytes?.length) {
    try {
      raw = new SQL.Database(saved.bytes)
      raw.exec('PRAGMA foreign_keys = ON;')
      raw.exec(SCHEMA)
      raw.exec('SELECT COUNT(*) FROM accounts')
      origin = 'saved'
    } catch (err) {
      console.error('[woori-local] 저장본이 깨져 새로 채운다', err)
      raw?.close()
      raw = null
    }
  }
  if (!raw) {
    raw = new SQL.Database()
    raw.exec('PRAGMA foreign_keys = ON;')
    raw.exec(SCHEMA)
  }
  const db = new WooriLocalDb(raw)
  // createApp 이 ensureSeeded 를 부른다 → 빈 DB 면 v1-start (WOORI_SCENARIO 기본값)
  const before = db.totalChanges()
  const app = createApp({ db, hooks: {}, enableDev: true })
  if (origin === 'saved' && db.totalChanges() !== before) origin = 'seeded'

  // 마지막으로 저장된 바이트 = 앱을 다시 켜면 보일 상태 (새로 채운 DB 는 처음 저장이 실패해도 다시 켜면 똑같이 채워진다)
  let lastSaved: Uint8Array = origin === 'saved' && saved ? saved.bytes : db.exportBytes()
  /** 되돌린 횟수 — 되돌리기 전에 떠 둔 바이트(되돌린 변경이 들어 있다)는 쓰지 않는다 */
  let rollbacks = 0
  const rollback = () => {
    const next = new SQL.Database(lastSaved)
    next.exec('PRAGMA foreign_keys = ON;')
    db.raw.close()
    db.raw = next
    rollbacks++
  }
  let chain: Promise<void> = Promise.resolve()
  const persist = (): Promise<void> => {
    const bytes = db.exportBytes() // 지금 상태를 바로 떠 둔다 (다음 요청이 바꾸기 전에)
    if (!idb) return chain
    const target = idb
    const at = rollbacks
    chain = chain
      .catch(() => undefined)
      .then(async () => {
        // 앞 요청의 저장이 실패해 이 요청의 변경도 함께 되돌렸다 → 쓰지 않고 실패
        if (at !== rollbacks) throw new Error('앞 저장 실패로 되돌림')
        try {
          await idbPut(target, { schemaKey: SCHEMA_KEY, bytes, savedAt: new Date().toISOString() })
          lastSaved = bytes
        } catch (err) {
          rollback()
          throw err
        }
      })
    return chain
  }
  if (origin === 'seeded') {
    // 처음 저장이 안 돼도 앱은 띄운다 (IndexedDB 를 못 열 때처럼) — 다음 쓰기에서 다시 저장해 본다
    await persist().catch((err: unknown) => console.error('[woori-local] 처음 저장 실패 — 저장 없이 시작한다', err))
  }
  try {
    void navigator.storage?.persist?.()
  } catch {
    /* 없어도 된다 */
  }
  return { db, app, persist, origin }
}

/** 런타임 (처음 부를 때 sql.js·저장본을 읽어 띄운다) */
export function wooriLocalRuntime(): Promise<LocalRuntime> {
  runtimePromise ??= startRuntime().catch((err) => {
    runtimePromise = null
    throw err
  })
  return runtimePromise
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

/** '/api/…' 요청 하나를 backend 라우트로 처리한다 */
export async function wooriLocalRequest(method: string, url: string, headers: Record<string, string>, body: string | undefined): Promise<Response> {
  const rt = await wooriLocalRuntime()
  const before = rt.db.totalChanges()
  const out = express.dispatch(rt.app, { method, url, headers, body })
  if (rt.db.totalChanges() !== before) {
    try {
      await rt.persist()
    } catch (err) {
      // persist 가 이미 메모리 DB 를 마지막 저장본으로 되돌렸다 (이 요청의 변경은 없던 일)
      console.error('[woori-local] 저장 실패 — 이 요청의 변경을 되돌렸다', err)
      return new Response(JSON.stringify(STORAGE_FAILED), { status: 507, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
    }
  }
  return new Response(out.body, {
    status: out.status,
    headers: { 'Content-Type': out.headers['content-type'] ?? 'application/json; charset=utf-8' },
  })
}

function isApiUrl(u: URL): boolean {
  return u.origin === window.location.origin && (u.pathname === '/api' || u.pathname.startsWith('/api/'))
}

/** window.fetch 를 감싼다: 같은 출처 '/api/…' 만 로컬 처리, 나머지(글꼴·에셋 등)는 원래 fetch */
export function installWooriLocalFetch(): void {
  const w = window as Window & { __wooriLocalFetch?: true }
  if (w.__wooriLocalFetch) return
  w.__wooriLocalFetch = true
  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const u = new URL(href, window.location.href)
    if (!isApiUrl(u)) return nativeFetch(input, init)
    const req = input instanceof Request ? input : null
    const signal = init?.signal ?? req?.signal ?? null
    if (signal?.aborted) throw abortError(signal)
    const method = (init?.method ?? req?.method ?? 'GET').toUpperCase()
    const headers: Record<string, string> = {}
    new Headers(init?.headers ?? req?.headers ?? undefined).forEach((v, k) => {
      headers[k] = v
    })
    let body: string | undefined
    if (init?.body !== undefined && init.body !== null) body = typeof init.body === 'string' ? init.body : await new Response(init.body).text()
    else if (req && method !== 'GET' && method !== 'HEAD') body = await req.clone().text()
    const res = await wooriLocalRequest(method, u.pathname + u.search, headers, body)
    if (signal?.aborted) throw abortError(signal)
    return res
  }
}

/* ───────────────────────── 폰 뒤로 버튼 ───────────────────────── */

/** 뒤로가 '앱 종료' 가 되는 처음 화면 (스플래시 · 인증서(로그인 로딩 포함) · 홈) */
const ROOT_PATHS = new Set(['/', '/cert', '/home'])
const EXIT_WINDOW_MS = 2000
export const WOORI_EXIT_TOAST = '뒤로 버튼을 한 번 더 누르면 종료됩니다'
let exitArmedAt = -Infinity

/**
 * 폰 뒤로 버튼 한 번. 무엇을 했는지 돌려준다:
 *   'handled' 화면이 받음(시트 닫기·페이지 뒤로 등) · 'armed' 종료 토스트 · 'exit' 앱 종료 · 'back' history.back() · 'home' 기록 없음 → 홈
 */
function pressBack(canGoBack: boolean, exit: () => void): string {
  const ev = new Event(WOORI_BACK_EVENT, { cancelable: true })
  window.dispatchEvent(ev)
  if (ev.defaultPrevented) return 'handled'
  if (ROOT_PATHS.has(window.location.pathname)) {
    const now = performance.now()
    if (now - exitArmedAt < EXIT_WINDOW_MS) {
      exitArmedAt = -Infinity
      exit()
      return 'exit'
    }
    exitArmedAt = now
    wooriToast(WOORI_EXIT_TOAST, EXIT_WINDOW_MS)
    return 'armed'
  }
  if (canGoBack) {
    window.history.back()
    return 'back'
  }
  window.location.replace('/home')
  return 'home'
}

/** 폰 뒤로 버튼 → 앱 안 뒤로 (APK 에서만). 브라우저 확인용으로 wooriDebug.pressBack 도 단다 (종료 대신 'exit' 만 돌려줌) */
function installBackButton(native: boolean) {
  if (window.wooriDebug) window.wooriDebug.pressBack = (canGoBack = window.history.length > 1) => pressBack(canGoBack, () => undefined)
  if (!native) return
  void CapApp.addListener('backButton', ({ canGoBack }) => {
    pressBack(canGoBack, () => void CapApp.exitApp())
  })
}

let started = false

/** 로컬 모드 시작: fetch 가로채기 → (sql.js·저장본 미리 띄우기) → (APK 면) 뒤로 버튼. main.tsx 가 App 을 그리기 전에 부른다 */
export function startWooriLocal(): void {
  if (started) return
  started = true
  const html = document.documentElement
  const native = Capacitor.isNativePlatform()
  html.dataset.wooriLocal = '1'
  if (native) html.dataset.wooriNative = '1'
  installWooriLocalFetch()
  void wooriLocalRuntime().catch((err: unknown) => console.error('[woori-local] 시작 실패', err))
  installBackButton(native)
  const host = document.createElement('div')
  host.id = 'woori-local-root'
  document.body.appendChild(host)
  createRoot(host).render(createElement(WooriLocalRoot))
}
