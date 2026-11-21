'use strict';
// SQLite (node:sqlite 내장 DatabaseSync, 네이티브 의존성 없음). 하나 답지 backend/db.js 와 같은 구성.
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { SCHEMA, withTransaction } = require('./schema');

const DEFAULT_DB_PATH = path.join(__dirname, 'woori.db');

/**
 * DB 를 열고 스키마를 만든다.
 * @param {string} [file] 파일 경로 또는 ':memory:' (기본: WOORI_DB_PATH 환경변수 또는 backend/woori.db)
 */
function openDb(file = process.env.WOORI_DB_PATH || DEFAULT_DB_PATH) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 3000;');
  }
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb, withTransaction, DEFAULT_DB_PATH, SCHEMA };
