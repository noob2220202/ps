// express.js 껍데기의 타입 (local.ts 가 getApp · dispatch 만 쓴다)
export const getApp: () => unknown;
export function dispatch(
  app: unknown,
  r: { method: string; url: string; headers?: Record<string, string>; body?: string },
): { status: number; body: string; headers: Record<string, string> };
declare const express: unknown;
export default express;
