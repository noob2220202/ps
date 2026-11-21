'use strict';
// 공용 헬퍼: 계좌번호 정규화/표시, 금액·날짜 표시 문자열, 로컬 시각(Asia/Seoul) 문자열 다루기, 입력 검증 오류.
// 시각은 모두 로컬 문자열 'YYYY-MM-DDTHH:mm:ss' (시간대 표기 없음, 하나 답지와 같은 규칙). 금액은 원 단위 정수.

/** 숫자만 남긴다 ('1002-123-456789' → '1002123456789') */
function digitsOnly(s) {
  return String(s ?? '').replace(/\D+/g, '');
}

/**
 * 계좌번호 표시 형식.
 * - 우리은행 13자리: 4-3-6 하이픈 ('1002-123-456789' — 영상의 홈 카드·거래내역·이체 화면 모양)
 * - 그 밖의 기관: 영상처럼 하이픈 없이 숫자 그대로 ('12345652789012' 지역농축협, '3333123456789' 카카오뱅크)
 */
function formatAccount(bankCode, digits) {
  const d = digitsOnly(digits);
  if (bankCode === 'WOORI' && d.length === 13) return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7)}`;
  return d;
}

/** 1234567 → '1,234,567' (부호 없음) */
function comma(n) {
  return Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 금액 표시: 1 → '1원', 100000 → '100,000원' */
function won(n) {
  return `${n < 0 ? '-' : ''}${comma(n)}원`;
}

/** 거래 금액 표시 (부호 항상): +100000 → '+100,000원', -1 → '-1원' (ledger display.amount) */
function signedWon(n) {
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${comma(n)}원`;
}

const LOCAL_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
const DATE_RE = /^(\d{4})[-.](\d{2})[-.](\d{2})$/;

/** 'YYYY-MM-DD' 또는 'YYYY.MM.DD' → 'YYYY-MM-DD' (잘못되면 null) */
function parseDate(s) {
  const m = DATE_RE.exec(String(s ?? ''));
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function isValidLocalIso(s) {
  const m = LOCAL_ISO_RE.exec(String(s ?? ''));
  if (!m) return false;
  return parseDate(`${m[1]}-${m[2]}-${m[3]}`) !== null && +m[4] < 24 && +m[5] < 60 && +m[6] < 60;
}

/** 로컬 시각 문자열 → 기준점(시간대 무관) 초. 두 시각의 차이 계산용 */
function localIsoToSeconds(s) {
  const m = LOCAL_ISO_RE.exec(s);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
}

/** 'YYYY-MM-DD' 에서 n 개월 뺀 날짜. 그 달에 같은 날이 없으면 말일 (2026-05-31 − 3개월 → 2026-02-28) */
function minusMonths(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) - n;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12; // 0..11
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, last);
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → 'YYYY.MM.DD' (조회기간 줄, 최근입금계좌 날짜) */
function dotDate(date) {
  return date.slice(0, 10).replace(/-/g, '.');
}

/** 'YYYY-MM-DDTHH:mm:ss' → '11월 21일 · 11:02:40' (거래내역 날짜 줄: 월·일 앞 0 없음, 시각 2자리) */
function dateLine(occurredAt) {
  return `${Number(occurredAt.slice(5, 7))}월 ${Number(occurredAt.slice(8, 10))}일 · ${occurredAt.slice(11, 19)}`;
}

/** 'YYYY-MM-DDTHH:mm:ss' → '2026.11.21 11:02:40' (거래내역 상세 '거래일시') */
function detailDateTime(occurredAt) {
  return `${dotDate(occurredAt)} ${occurredAt.slice(11, 19)}`;
}

/** 'YYYY-MM-DD…' → '2026년 11월' (거래내역 월 머리글 — 프론트가 만들지만 같은 규칙을 여기 둔다) */
function monthHeader(occurredAt) {
  return `${occurredAt.slice(0, 4)}년 ${Number(occurredAt.slice(5, 7))}월`;
}

/** 400/403/404/409/422/423 등 의도된 API 오류 */
class ApiError extends Error {
  constructor(status, message, code, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/** 쿼리 값이 배열로 오면 마지막 값 (?type=in&type=out → 'out') */
function one(v) {
  return Array.isArray(v) ? v[v.length - 1] : v;
}

module.exports = {
  digitsOnly,
  formatAccount,
  comma,
  won,
  signedWon,
  parseDate,
  isValidLocalIso,
  localIsoToSeconds,
  minusMonths,
  dotDate,
  dateLine,
  detailDateTime,
  monthHeader,
  ApiError,
  one,
};
