// Node 전역 껍데기: server/*.mjs 가 읽는 process.env · process.argv. 서버 모듈보다 먼저 실행돼야 한다 (local.ts 가 동적 import 앞에서 부름).
//   APP=allone            이 서버는 NH올원뱅크 (server/db.mjs SERVER_ID · APP)
//   API_DELAY_MS=0        서버의 GET 지연(250ms)은 끈다 — 요청 처리가 동기여야 해서. 같은 지연은 local.ts 가 fetch 쪽에서 준다
export function installNodeGlobals() {
  const g = globalThis as { process?: unknown };
  g.process = { env: { APP: "allone", API_DELAY_MS: "0", DATA_DIR: "/allone" }, argv: ["node", "server", "--app", "allone"], exit: () => undefined };
}
