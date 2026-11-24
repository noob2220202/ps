// node:sqlite 모양의 sql.js 껍데기 — server/db.mjs 의 `new DatabaseSync(파일)` 이 부르는 부분만: exec · prepare(→ run / get / all) · close.
// (woori-answer-key 의 WooriLocalDb 와 같은 요령.) 파일 경로는 저장본 이름표로만 쓴다: local.ts 가 IndexedDB 에서 읽어 둔 바이트가 있으면 그걸로 연다.
// 문장은 부를 때마다 컴파일하고 바로 free 한다 (sql.js 문장은 GC 되지 않는다).
import type { Database as SqlJsDatabase, SqlJsStatic, SqlValue } from "sql.js";

let SQL: SqlJsStatic | null = null;
const saved = new Map<string, Uint8Array>();
/** 열린 DB 전부 (경로 → 연결). local.ts 가 바뀐 DB 를 저장할 때 */
export const openDbs = new Map<string, DatabaseSync>();

export function configureSqlite(sql: SqlJsStatic, savedBytes: Map<string, Uint8Array>) {
  SQL = sql;
  for (const [k, v] of savedBytes) saved.set(k, v);
}

type Row = Record<string, SqlValue>;

export class DatabaseSync {
  raw: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  path: string;
  /** server/db.mjs 가 붙이는 값 (어느 앱 DB 인지) */
  app?: string;
  constructor(path: string) {
    if (!SQL) throw new Error("sql.js 가 아직 준비되지 않았다");
    this.path = path;
    const bytes = saved.get(path);
    this.raw = bytes ? new SQL.Database(bytes) : new SQL.Database();
    this.raw.exec("PRAGMA foreign_keys = ON;");
    openDbs.set(path, this);
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  prepare(sql: string) {
    const step = <T>(params: unknown[], fn: (s: ReturnType<SqlJsDatabase["prepare"]>) => T): T => {
      const s = this.raw.prepare(sql);
      try {
        // node:sqlite 는 undefined 를 못 받고 null 만 받음 — 같은 규칙. boolean 은 정수로
        s.bind(params.map((p) => (typeof p === "boolean" ? Number(p) : p === undefined ? null : p)));
        return fn(s);
      } finally {
        s.free();
      }
    };
    return {
      run: (...params: unknown[]) =>
        step(params, (s) => {
          while (s.step()) {
            /* 끝까지 */
          }
          return { changes: this.raw.getRowsModified() as number, lastInsertRowid: this.scalar("SELECT last_insert_rowid()") };
        }),
      get: (...params: unknown[]) => step(params, (s) => (s.step() ? (s.getAsObject() as Row) : undefined)),
      all: (...params: unknown[]) =>
        step(params, (s) => {
          const rows: Row[] = [];
          while (s.step()) rows.push(s.getAsObject() as Row);
          return rows;
        }),
    };
  }

  scalar(sql: string): number {
    const r = this.raw.exec(sql);
    return Number(r[0]?.values[0]?.[0] ?? 0);
  }

  /** 이 연결에서 바뀐 행 수 누계 (요청 전후로 비교해 저장할지 정한다) */
  totalChanges(): number {
    return this.scalar("SELECT total_changes()");
  }

  /** DB 바이트. sql.js export() 는 연결을 닫았다 다시 열므로 PRAGMA 를 다시 건다 */
  exportBytes(): Uint8Array {
    const bytes = this.raw.export();
    this.raw.exec("PRAGMA foreign_keys = ON;");
    return bytes;
  }

  close(): void {
    openDbs.delete(this.path);
    this.raw.close();
  }
}
