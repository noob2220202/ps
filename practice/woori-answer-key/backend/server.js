'use strict';
// 실행: npm start. 포트 WOORI_API_PORT (기본 4100), DB WOORI_DB_PATH (기본 backend/woori.db), 시계 WOORI_NOW (README)
const { openDb } = require('./db');
const { createApp } = require('./app');
const { setStatement } = require('./statement');

// 거래 명세 기본 데이터 (backend/data/statement.json — 있을 때만, .gitignore). 없으면 영상 시드. WOORI_NO_STATEMENT=1 이면 있어도 안 쓴다 (테스트)
if (process.env.WOORI_NO_STATEMENT !== '1') {
  try {
    setStatement(require('./data/statement.json'));
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
  }
}

const port = Number(process.env.WOORI_API_PORT) || 4100;
const db = openDb();
const app = createApp({ db });

const server = app.listen(port, () => {
  console.log(`[woori-backend] http://localhost:${server.address().port}/api`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
