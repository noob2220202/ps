// sql.js(SQLite wasm)는 타입 패키지가 없다 — 쓰는 부분만 (woori-answer-key/frontend/src/WooriLocalModules.d.ts 와 같다)
declare module "sql.js" {
  export type SqlValue = number | string | Uint8Array | null;
  export interface Statement {
    bind(values?: readonly unknown[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, SqlValue>;
    free(): boolean;
  }
  export interface Database {
    exec(sql: string): { columns: string[]; values: SqlValue[][] }[];
    prepare(sql: string): Statement;
    /** 주의: 연결을 닫았다 다시 연다 (PRAGMA foreign_keys 도 초기화됨) */
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => Database;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}
