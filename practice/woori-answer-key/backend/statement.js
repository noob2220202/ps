'use strict';
// 은행 '예금 거래 명세' PDF 에서 옮긴 기본 데이터 (backend/data/statement.json — 개인 정보라 .gitignore, 저장소에는 없다).
// 있으면 처음 실행 · 관리 패널 '예시 데이터로' 가 영상 시드 대신 이걸로 채운다. 없으면 아무것도 안 하고 영상 시드(v1-start).
//
//   { account: {ownerName, digits, product}, balance, rows: [ {date:'2026-11-19', kind:'체크우리', text:'쿠팡', out, in, bal, branch}, … 최신순 ] }
//   rows 는 PDF 순서 그대로(최신 → 과거), bal = 그 거래 뒤 잔액. 거래 시각은 PDF 에 날짜만 있어 seed.buildStatementSeed 가 같은 날 안에서 순서대로 정한다.
//
// 이 모듈은 순수하다(파일을 읽지 않는다): 서버는 server.js 가 파일을 읽어 setStatement 로 넣고,
// APK(로컬 모드)는 frontend/src/WooriLocal.ts 가 빌드 때 import.meta.glob 으로 같은 파일을 넣는다. 테스트는 아무것도 안 넣는다 → 늘 영상 시드.

let current = null;

/** 기본 데이터를 넣는다 (null/undefined = 없음). 모양이 틀리면 없는 것으로 */
function setStatement(data) {
  current = data && data.account && Array.isArray(data.rows) && data.rows.length > 0 ? data : null;
}

function getStatement() {
  return current;
}

module.exports = { setStatement, getStatement };
