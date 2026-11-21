'use strict';
// 실행: npm start. 포트 WOORI_API_PORT (기본 4100), DB WOORI_DB_PATH (기본 backend/woori.db), 시계 WOORI_NOW (README)
const { openDb } = require('./db');
const { createApp } = require('./app');

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
