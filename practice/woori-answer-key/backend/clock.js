'use strict';
// 서버 시계. 우선순위:
//   1) 개발용 덮어쓰기 — POST /api/dev/clock {now} 또는 POST /api/dev/reset {scenario, now} (DB meta 'now_override')
//   2) WOORI_NOW 환경변수 — 'YYYY-MM-DDTHH:mm:ss' (예: 2026-11-21T11:09:11 = 영상 v1 이체 시각)
//   3) 실제 현재 시각 (Asia/Seoul, 프로세스 TZ 와 무관)
// 시계는 '오늘'(조회기간 3개월 = 오늘 − 3개월 ~ 오늘, 중복 이체 경고의 '오늘'·'N분 전')과 이체 거래시각을 정한다.
const { isValidLocalIso } = require('./util');

const seoulFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function realNow() {
  const parts = Object.fromEntries(seoulFmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/** 개발용 덮어쓰기 값 (없으면 null) */
function getOverride(db) {
  if (!db) return null;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'now_override'").get();
  return row && isValidLocalIso(row.value) ? row.value : null;
}

/** @param {string|null} value 'YYYY-MM-DDTHH:mm:ss' 또는 null(해제) */
function setOverride(db, value) {
  if (value == null) db.prepare("DELETE FROM meta WHERE key = 'now_override'").run();
  else db.prepare("INSERT INTO meta (key, value) VALUES ('now_override', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(value);
}

/** 지금 시각이 어디서 왔는지: 'override' | 'env' | 'real' */
function clockSource(db) {
  if (getOverride(db)) return 'override';
  if (isValidLocalIso(process.env.WOORI_NOW)) return 'env';
  return 'real';
}

/** 현재 로컬 시각 'YYYY-MM-DDTHH:mm:ss' */
function now(db) {
  const o = getOverride(db);
  if (o) return o;
  const fixed = process.env.WOORI_NOW;
  if (fixed && isValidLocalIso(fixed)) return fixed;
  return realNow();
}

module.exports = { now, realNow, getOverride, setOverride, clockSource };
