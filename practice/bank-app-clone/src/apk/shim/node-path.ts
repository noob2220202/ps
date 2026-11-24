// node:path — dirname · resolve 만 (문자열 이어 붙이기. 실제 경로는 쓰이지 않고 DB 이름표로만)
export const dirname = (p: string) => p.replace(/\/[^/]*$/, "") || "/";
export const resolve = (...parts: string[]) => parts.join("/").replace(/\/{2,}/g, "/");
export const join = resolve;
