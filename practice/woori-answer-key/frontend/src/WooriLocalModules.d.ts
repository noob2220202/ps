// 로컬 모드(서버 없는 APK)가 쓰는 모듈의 최소 타입.
//   sql.js          SQLite wasm (npm sql.js — 타입 패키지 없이 쓰는 부분만)
//   woori-backend/* backend/ 의 순수 로직 모듈 (vite.config.ts 별칭 'woori-backend' → ../backend, CommonJS 그대로 번들)
// 이 파일은 import/export 가 없는 선언 파일이라 전역(ambient) 모듈 선언이 된다.

declare module 'sql.js' {
  export type SqlValue = number | string | Uint8Array | null
  export interface SqlJsStatement {
    bind(values?: readonly unknown[]): boolean
    step(): boolean
    getAsObject(): Record<string, SqlValue>
    free(): boolean
  }
  export interface SqlJsDatabase {
    exec(sql: string): { columns: string[]; values: SqlValue[][] }[]
    prepare(sql: string): SqlJsStatement
    /** 주의: 연결을 닫았다 다시 연다 (PRAGMA foreign_keys 도 초기화됨) */
    export(): Uint8Array
    close(): void
    getRowsModified(): number
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => SqlJsDatabase
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>
}

declare module 'woori-backend/schema.js' {
  /** backend/schema.js — db.js(node:sqlite) 와 같은 CREATE TABLE IF NOT EXISTS … */
  export const SCHEMA: string
}

declare module 'woori-backend/app.js' {
  /** node:sqlite DatabaseSync 와 같은 모양 (exec · prepare → run/get/all) */
  export interface WooriBackendDb {
    exec(sql: string): void
    prepare(sql: string): {
      run(...params: unknown[]): { changes: number; lastInsertRowid: number }
      get(...params: unknown[]): Record<string, unknown> | undefined
      all(...params: unknown[]): Record<string, unknown>[]
    }
  }
  /** backend/app.js createApp — 로컬에선 WooriLocalExpress.cjs 의 app */
  export function createApp(opts: { db: WooriBackendDb; hooks?: Record<string, unknown>; enableDev?: boolean }): unknown
}

declare module 'woori-backend/seed.js' {
  export const SCENARIOS: Record<string, { order: number; balance: number; clock: { recordStart: string; transferAt: string } }>
}
