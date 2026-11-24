// node:url — fileURLToPath 만 (import.meta.url 을 경로 문자열로)
export const fileURLToPath = (u: string | URL) => String(u).replace(/^file:\/\//, "").replace(/^https?:\/\/[^/]*/, "");
