// src/apk/local.ts(TS)가 server/db.mjs 를 import 할 때 쓰는 최소 타입 (서버는 JS 라 원래 타입이 없다)
export const APP: string;
export const AVATARS: string[];
export const COLORS: string[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const registry: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function profileDb(id: string): any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SEEDS: Record<string, { example: (d: any, name?: string) => void; empty: (d: any, name?: string) => void }>;
