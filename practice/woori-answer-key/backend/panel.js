'use strict';
// 🔔 관리 패널(frontend WooriDevPanel) 쓰기 동작 — bank-app-clone server/index.mjs 의 같은 API 를 이 앱 스키마로 옮긴 것.
//   잔액 규칙도 같다: 거래마다의 '거래후 잔액'은 계좌 잔액에서 거꾸로 계산한다 (repo.recomputeBalances) —
//   잔액을 직접 고치면 지난 거래들의 잔액이 같이 밀리고, 거래를 추가·수정·삭제하면 잔액이 그만큼 바뀐다.
//   받는 분(payees) = 계좌번호 조회에 쓰는 디렉터리(directory). 최근입금계좌(recipients)·☆ 는 그 위의 표시.

const { withTransaction } = require('./schema');
const { getBank } = require('./banks');
const { now } = require('./clock');
const { getAccountRow, getTxRow, recomputeBalances, toListItem, toDetail, toAccount, transferredOn } = require('./repo');
const { MAIN_ACCOUNT_ID, DEPOSIT_DETAIL, WITHDRAW_DETAIL, resetMode } = require('./seed');
const { uniqueTxId } = require('./transfer');
const { digitsOnly, formatAccount, isValidLocalIso, ApiError } = require('./util');

const OWN_BANK = 'WOORI';
const OWN_DIGITS = 13; // 우리은행 계좌번호 1002-123-456789
const DEFAULT_ACCOUNT_NAME = 'WON 통장';
// 금액 한도 없음 — 원본(bank-app-clone)의 한 번에 1천만원 · 잔액 10억원 제한은 뺐다. JS 가 정확히 셀 수 있는 정수(약 9천조원)까지만
const MONEY_MAX = Number.MAX_SAFE_INTEGER;

/** bank-app-clone bad(): 400 + fields (패널은 fields 의 첫 값을 알림으로) */
function bad(message, fields) {
  return new ApiError(400, message, 'VALIDATION', fields ? { fields } : undefined);
}
function conflict(message, fields) {
  return new ApiError(409, message, 'CONFLICT', fields ? { fields } : undefined);
}
const money = (v) => v === undefined || (Number.isSafeInteger(v) && v >= 0);
const checkName = (name) =>
  name === undefined ? null : typeof name !== 'string' || !name.trim() || name.trim().length > 20 ? '계좌 이름은 1~20자' : null;

function checkOwnNumber(digits) {
  return digits.length === OWN_DIGITS ? null : `우리은행 계좌번호는 숫자 ${OWN_DIGITS}자리`;
}
function checkOtherNumber(digits) {
  return digits.length >= 6 && digits.length <= 16 ? null : '계좌번호는 숫자 6~16자리';
}
const checkNumberFor = (bankCode, digits) => (bankCode === OWN_BANK ? checkOwnNumber(digits) : checkOtherNumber(digits));

function accountView(db, row) {
  return toAccount(row, transferredOn(db, row.id, now(db).slice(0, 10)));
}

/** 내 계좌 중 (기관, 숫자) 가 같은 것 */
function myAccountByNumber(db, bankCode, digits) {
  return db.prepare('SELECT * FROM accounts WHERE bank_code = ? AND account_digits = ?').get(bankCode, digits);
}

/* ───────────────────────── 기본: 내 정보 · 데이터 ───────────────────────── */

function getProfile(db) {
  const a = getAccountRow(db, MAIN_ACCOUNT_ID);
  return { userName: a ? a.owner_name : '' };
}

/** PATCH /api/profile {userName} — 이름은 1~10자. 내 계좌 예금주(디렉터리 포함)를 모두 바꾼다 */
function patchProfile(db, body) {
  const { userName } = body ?? {};
  if (userName !== undefined && !(typeof userName === 'string' && /^.{1,10}$/u.test(userName.trim()))) {
    throw bad('입력값을 확인해 주세요', { userName: '이름은 1~10자' });
  }
  if (userName !== undefined) {
    const name = userName.trim();
    withTransaction(db, () => {
      for (const a of db.prepare('SELECT bank_code, account_digits FROM accounts').all()) {
        db.prepare('UPDATE directory SET holder_name = ? WHERE bank_code = ? AND account_digits = ?').run(name, a.bank_code, a.account_digits);
      }
      db.prepare('UPDATE accounts SET owner_name = ?').run(name);
    });
  }
  return getProfile(db);
}

/** POST /api/reset {mode: 'empty'|'example'} */
function reset(db, body) {
  const mode = (body && body.mode) ?? 'example';
  if (mode !== 'empty' && mode !== 'example') throw bad('mode는 empty 또는 example');
  resetMode(db, mode);
}

/* ───────────────────────── 계좌 ───────────────────────── */

/** POST /api/accounts {name?, number, balance?} — 우리은행 계좌만 */
function addAccount(db, body) {
  const { bankCode = OWN_BANK, number, balance = 0, name } = body ?? {};
  const fields = {};
  if (bankCode !== OWN_BANK) fields.bankCode = '우리WON뱅킹에는 우리은행 계좌만 추가할 수 있어요';
  const nameError = checkName(name);
  if (nameError) fields.name = nameError;
  const digits = digitsOnly(number);
  const numberError = checkOwnNumber(digits);
  if (numberError) fields.number = numberError;
  if (!Number.isSafeInteger(balance) || balance < 0) fields.balance = '0원 이상';
  if (Object.keys(fields).length) throw bad('입력값을 확인해 주세요', fields);
  if (myAccountByNumber(db, OWN_BANK, digits)) throw conflict('이미 추가된 계좌예요', { number: '이미 추가된 계좌예요' });
  if (db.prepare('SELECT 1 FROM directory WHERE bank_code = ? AND account_digits = ?').get(OWN_BANK, digits)) {
    throw conflict('받는 분으로 등록된 계좌예요', { number: '받는 분으로 등록된 계좌' });
  }
  const main = getAccountRow(db, MAIN_ACCOUNT_ID);
  const id = withTransaction(db, () => {
    const sort = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS s FROM accounts').get().s;
    const r = db
      .prepare(`INSERT INTO accounts (bank_code, account_digits, product, owner_name, badge, balance, daily_limit, pin, sort_order)
        VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?)`)
      .run(OWN_BANK, digits, name?.trim() || DEFAULT_ACCOUNT_NAME, main.owner_name, balance, main.pin, sort);
    db.prepare('INSERT INTO directory (bank_code, account_digits, holder_name) VALUES (?, ?, ?)').run(OWN_BANK, digits, main.owner_name);
    return Number(r.lastInsertRowid);
  });
  return accountView(db, getAccountRow(db, id));
}

/** PATCH /api/accounts/:id {balance?, number?, name?} — 잔액을 바꾸면 지난 거래들의 거래후 잔액도 같이 */
function patchAccount(db, id, body) {
  const row = getAccountRow(db, id);
  if (!row) throw new ApiError(404, '계좌를 찾을 수 없습니다', 'ACCOUNT_NOT_FOUND');
  const { balance, number, name } = body ?? {};
  const nameError = checkName(name);
  if (nameError) throw bad(nameError, { name: nameError });
  if (!money(balance)) throw bad('입력값을 확인해 주세요', { balance: '0원 이상' });
  let digits = row.account_digits;
  if (number !== undefined) {
    digits = digitsOnly(number);
    const numberError = checkOwnNumber(digits);
    if (numberError) throw bad(numberError, { number: numberError });
    const other = myAccountByNumber(db, row.bank_code, digits);
    if (other && other.id !== row.id) throw conflict('이미 추가된 계좌예요', { number: '이미 추가된 계좌예요' });
    if (digits !== row.account_digits && db.prepare('SELECT 1 FROM directory WHERE bank_code = ? AND account_digits = ?').get(row.bank_code, digits)) {
      throw conflict('받는 분으로 등록된 계좌예요', { number: '받는 분으로 등록된 계좌' });
    }
  }
  withTransaction(db, () => {
    db.prepare('UPDATE accounts SET balance = ?, account_digits = ?, product = ? WHERE id = ?').run(
      balance ?? row.balance,
      digits,
      name === undefined ? row.product : name.trim(),
      row.id,
    );
    if (digits !== row.account_digits) {
      db.prepare('UPDATE directory SET account_digits = ? WHERE bank_code = ? AND account_digits = ?').run(digits, row.bank_code, row.account_digits);
    }
    if (balance !== undefined) recomputeBalances(db, row.id);
  });
  return accountView(db, getAccountRow(db, row.id));
}

/** DELETE /api/accounts/:id — 대표 계좌는 못 지운다. 거래내역도 같이 */
function deleteAccount(db, id) {
  const row = getAccountRow(db, id);
  if (!row) throw new ApiError(404, '계좌를 찾을 수 없습니다', 'ACCOUNT_NOT_FOUND');
  if (row.id === MAIN_ACCOUNT_ID) throw bad('대표계좌는 지울 수 없어요');
  withTransaction(db, () => {
    db.prepare('DELETE FROM tickets WHERE account_id = ?').run(row.id);
    db.prepare('DELETE FROM transactions WHERE account_id = ?').run(row.id);
    db.prepare('DELETE FROM directory WHERE bank_code = ? AND account_digits = ?').run(row.bank_code, row.account_digits);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(row.id);
  });
}

/* ───────────────────────── 거래 ───────────────────────── */

/** 'YYYY-MM-DDTHH:mm' 또는 'YYYY-MM-DDTHH:mm:ss' → 초까지 (아니면 null) */
function normalizeAt(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return null;
  const s = v.length === 16 ? `${v}:00` : v;
  return isValidLocalIso(s) ? s : null;
}

const defaultCode = (kind) => (kind === 'deposit' ? DEPOSIT_DETAIL.code : WITHDRAW_DETAIL.code);
const defaultBranch = (kind) => (kind === 'deposit' ? DEPOSIT_DETAIL.branch : WITHDRAW_DETAIL.branch);
const text20 = (v) => String(v ?? '').trim().slice(0, 20);

/** POST /api/accounts/:id/transactions {merchant, amount, code?, at?} — 입금(+)/출금(−) 하나. 잔액도 같이 */
function addTransaction(db, accountId, body) {
  const row = getAccountRow(db, accountId);
  if (!row) throw new ApiError(404, '계좌를 찾을 수 없습니다', 'ACCOUNT_NOT_FOUND');
  const { merchant, amount, code, at } = body ?? {};
  const fields = {};
  if (typeof merchant !== 'string' || !merchant.trim()) fields.merchant = '거래처를 입력해 주세요';
  else if (merchant.trim().length > 20) fields.merchant = '20자 이하';
  if (!Number.isSafeInteger(amount) || amount === 0) fields.amount = '0이 아닌 금액을 입력해 주세요';
  const when = at === undefined ? null : normalizeAt(at);
  if (at !== undefined && !when) fields.at = '날짜 형식 오류';
  if (Object.keys(fields).length) throw bad('입력값을 확인해 주세요', fields);
  if (row.balance + amount < 0) throw new ApiError(400, `잔액이 부족해요 (현재 ${row.balance.toLocaleString('ko-KR')}원)`, 'INSUFFICIENT_BALANCE');
  if (row.balance + amount > MONEY_MAX) throw bad('금액이 너무 커요', { amount: '금액이 너무 커요' });

  const kind = amount > 0 ? 'deposit' : 'withdraw';
  const tx = withTransaction(db, () => {
    const occurredAt = when ?? now(db);
    const id = uniqueTxId(db, occurredAt);
    db.prepare(`INSERT INTO transactions
      (id, account_id, occurred_at, display_name, amount, balance_after, kind, code, branch, requester,
       counterparty_name, counterparty_bank, counterparty_account, recipient_label, my_label, fee, cheque_amount, detail_src, source, note)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 'rule', 'app', '관리 패널')`)
      .run(id, row.id, occurredAt, merchant.trim(), amount, kind, text20(code) || defaultCode(kind), defaultBranch(kind));
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(amount, row.id);
    recomputeBalances(db, row.id);
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  });
  return toListItem(tx);
}

/**
 * PATCH /api/transactions/:id — 거래내역 상세에 보이는 값 전부:
 *   merchant(이름) · amount(부호 = 입금/출금) · at(거래일시) · code(거래구분) · branch(관리점) · chequeAmount(수표금액) ·
 *   requester(의뢰인, 입금) · counterBank/counterNumber/counterHolder(받는 분, 출금) · recipientLabel(받는 분 통장표기)
 *   출금에 받는 분 셋을 다 채우면 이체(받는 분 · 통장표기 · 이체확인증)로, 비우면 그 밖의 출금으로.
 */
function patchTransaction(db, id, body) {
  const t = getTxRow(db, id);
  if (!t) throw new ApiError(404, '거래내역을 찾을 수 없습니다', 'TRANSACTION_NOT_FOUND');
  const b = body ?? {};
  const fields = {};
  const next = { ...t };

  if ('merchant' in b) {
    const m = String(b.merchant ?? '').trim();
    if (!m) fields.merchant = '이름을 입력해 주세요';
    else if (m.length > 20) fields.merchant = '20자 이하';
    else next.display_name = m;
  }
  if ('at' in b) {
    const at = normalizeAt(b.at);
    if (!at) fields.at = '날짜 형식 오류';
    else next.occurred_at = at;
  }
  let delta = 0;
  if ('amount' in b) {
    if (!Number.isSafeInteger(b.amount) || b.amount === 0) fields.amount = '0이 아닌 금액을 입력해 주세요';
    else {
      delta = b.amount - t.amount;
      next.amount = b.amount;
    }
  }
  if ('chequeAmount' in b) {
    if (!Number.isSafeInteger(b.chequeAmount) || b.chequeAmount < 0) fields.chequeAmount = '0원 이상';
    else next.cheque_amount = b.chequeAmount;
  }
  if ('requester' in b) next.requester = text20(b.requester) || null;
  if ('recipientLabel' in b) next.recipient_label = text20(b.recipientLabel) || null;
  if ('branch' in b) next.branch = text20(b.branch);
  if ('code' in b) next.code = text20(b.code);

  const touchesCounter = 'counterBank' in b || 'counterNumber' in b || 'counterHolder' in b;
  if (touchesCounter) {
    const bankCode = String(b.counterBank ?? '').trim();
    const digits = digitsOnly(b.counterNumber);
    const holder = text20(b.counterHolder);
    if (bankCode && !getBank(bankCode)) fields.counterBank = '알 수 없는 은행';
    if (bankCode && digits && holder) {
      next.counterparty_bank = bankCode;
      next.counterparty_account = digits;
      next.counterparty_name = holder;
    } else {
      next.counterparty_bank = null;
      next.counterparty_account = null;
      next.counterparty_name = null;
    }
  }
  if (Object.keys(fields).length) throw bad('입력값을 확인해 주세요', fields);

  const acct = getAccountRow(db, t.account_id);
  if (acct.balance + delta < 0) throw new ApiError(400, `잔액이 부족해요 (현재 ${acct.balance.toLocaleString('ko-KR')}원)`, 'INSUFFICIENT_BALANCE');
  if (acct.balance + delta > MONEY_MAX) throw bad('금액이 너무 커요', { amount: '금액이 너무 커요' });

  // 종류: 입금 / 받는 분이 있는 출금 = 이체 / 그 밖의 출금
  next.kind = next.amount > 0 ? 'deposit' : next.counterparty_bank && next.counterparty_account && next.counterparty_name ? 'transfer' : 'withdraw';
  if (!next.code) next.code = defaultCode(next.kind);
  if (!next.branch) next.branch = defaultBranch(next.kind);
  if (next.kind === 'transfer' && !next.recipient_label) next.recipient_label = acct.owner_name;

  withTransaction(db, () => {
    db.prepare(`UPDATE transactions SET display_name = ?, occurred_at = ?, amount = ?, kind = ?, code = ?, branch = ?, requester = ?,
        counterparty_name = ?, counterparty_bank = ?, counterparty_account = ?, recipient_label = ?, cheque_amount = ?, detail_src = 'rule'
        WHERE seq = ?`)
      .run(next.display_name, next.occurred_at, next.amount, next.kind, next.code, next.branch, next.requester,
        next.counterparty_name, next.counterparty_bank, next.counterparty_account, next.recipient_label, next.cheque_amount, t.seq);
    if (delta) db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(delta, t.account_id);
    recomputeBalances(db, t.account_id);
  });
  return toDetail(getTxRow(db, t.id));
}

/** DELETE /api/transactions/:id — 그 거래가 없던 일이 되므로 잔액도 되돌린다 */
function deleteTransaction(db, id) {
  const t = getTxRow(db, id);
  if (!t) throw new ApiError(404, '거래내역을 찾을 수 없습니다', 'TRANSACTION_NOT_FOUND');
  const acct = getAccountRow(db, t.account_id);
  if (acct.balance - t.amount < 0) throw new ApiError(400, `잔액이 부족해요 (현재 ${acct.balance.toLocaleString('ko-KR')}원)`, 'INSUFFICIENT_BALANCE');
  withTransaction(db, () => {
    db.prepare('UPDATE tickets SET tx_seq = NULL WHERE tx_seq = ?').run(t.seq);
    db.prepare('UPDATE tickets SET dup_tx_id = NULL, dup_seconds = NULL WHERE dup_tx_id = ?').run(t.id);
    db.prepare('UPDATE recipients SET last_tx_seq = NULL WHERE last_tx_seq = ?').run(t.seq);
    db.prepare('DELETE FROM transactions WHERE seq = ?').run(t.seq);
    db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(t.amount, t.account_id);
    recomputeBalances(db, t.account_id);
  });
}

/* ───────────────────────── 받는 분 ───────────────────────── */

const payeeId = (bankCode, digits) => `${bankCode}-${digits}`;
function parsePayeeId(id) {
  const m = /^([A-Z0-9_]+)-(\d{1,20})$/.exec(String(id ?? ''));
  return m ? { bankCode: m[1], digits: m[2] } : null;
}

function toPayee(d, r) {
  const bank = getBank(d.bank_code);
  return {
    id: payeeId(d.bank_code, d.account_digits),
    bank: { code: d.bank_code, name: bank ? bank.name : d.bank_code, short: bank ? bank.short : d.bank_code, logo: bank ? bank.logo : null },
    number: formatAccount(d.bank_code, d.account_digits),
    holder: d.holder_name,
    favorite: !!(r && r.favorite), // ☆ (이체 '자주' 탭)
    showRecent: !!r, // 이체 '추천' 탭 최근입금계좌에 보임
  };
}

function recipientOf(db, bankCode, digits) {
  return db.prepare('SELECT * FROM recipients WHERE bank_code = ? AND account_digits = ?').get(bankCode, digits);
}

/** GET /api/payees — 내 계좌는 빼고 이름순 */
function listPayees(db) {
  const mine = new Set(db.prepare('SELECT bank_code, account_digits FROM accounts').all().map((a) => payeeId(a.bank_code, a.account_digits)));
  return db
    .prepare('SELECT * FROM directory ORDER BY holder_name, bank_code, account_digits')
    .all()
    .filter((d) => !mine.has(payeeId(d.bank_code, d.account_digits)))
    .map((d) => toPayee(d, recipientOf(db, d.bank_code, d.account_digits)));
}

function findPayee(db, id) {
  const key = parsePayeeId(id);
  const d = key && db.prepare('SELECT * FROM directory WHERE bank_code = ? AND account_digits = ?').get(key.bankCode, key.digits);
  if (!d || myAccountByNumber(db, d.bank_code, d.account_digits)) throw new ApiError(404, '받는 분을 찾을 수 없어요', 'NOT_FOUND');
  return d;
}

function checkPayee(db, { bankCode, number, holder }, current) {
  const code = String(bankCode ?? current?.bank_code ?? '').trim();
  const bank = code ? getBank(code) : null;
  const fields = {};
  if (!bank) fields.bankCode = '은행을 골라 주세요';
  const digits = number === undefined && current ? current.account_digits : digitsOnly(number);
  const numberError = bank && checkNumberFor(code, digits);
  if (numberError) fields.number = numberError;
  const name = String(holder ?? current?.holder_name ?? '').trim();
  if (!name || name.length > 20) fields.holder = '이름은 1~20자';
  if (Object.keys(fields).length) throw bad(Object.values(fields)[0], fields);
  if (myAccountByNumber(db, code, digits)) throw conflict('내 계좌예요. 받는 분으로 등록할 필요 없어요', { number: '내 계좌' });
  const dup = db.prepare('SELECT 1 FROM directory WHERE bank_code = ? AND account_digits = ?').get(code, digits);
  const same = current && current.bank_code === code && current.account_digits === digits;
  if (dup && !same) throw conflict('이미 등록된 계좌예요', { number: '이미 등록된 계좌' });
  return { bankCode: code, digits, name };
}

/** POST /api/payees {bankCode, number, holder, showRecent?, favorite?} */
function addPayee(db, body) {
  const { bankCode, digits, name } = checkPayee(db, body ?? {});
  withTransaction(db, () => {
    db.prepare('INSERT INTO directory (bank_code, account_digits, holder_name) VALUES (?, ?, ?)').run(bankCode, digits, name);
    if (body.showRecent === true || body.favorite === true) {
      db.prepare(`INSERT INTO recipients (name, bank_code, account_digits, last_used_at, last_tx_seq, favorite, source)
        VALUES (?, ?, ?, ?, NULL, ?, 'app')`).run(name, bankCode, digits, now(db), body.favorite === true ? 1 : 0);
    }
  });
  return toPayee({ bank_code: bankCode, account_digits: digits, holder_name: name }, recipientOf(db, bankCode, digits));
}

/** PATCH /api/payees/:id {bankCode?, number?, holder?, showRecent?, favorite?} */
function patchPayee(db, id, body) {
  const d = findPayee(db, id);
  const b = body ?? {};
  const { bankCode, digits, name } = checkPayee(db, b, d);
  withTransaction(db, () => {
    db.prepare('UPDATE directory SET bank_code = ?, account_digits = ?, holder_name = ? WHERE bank_code = ? AND account_digits = ?')
      .run(bankCode, digits, name, d.bank_code, d.account_digits);
    db.prepare('UPDATE recipients SET bank_code = ?, account_digits = ?, name = ? WHERE bank_code = ? AND account_digits = ?')
      .run(bankCode, digits, name, d.bank_code, d.account_digits);
    const r = recipientOf(db, bankCode, digits);
    const wantRecent = b.showRecent === undefined ? !!r : b.showRecent === true;
    const wantFavorite = b.favorite === undefined ? !!(r && r.favorite) : b.favorite === true;
    if ((wantRecent || wantFavorite) && !r) {
      db.prepare(`INSERT INTO recipients (name, bank_code, account_digits, last_used_at, last_tx_seq, favorite, source)
        VALUES (?, ?, ?, ?, NULL, ?, 'app')`).run(name, bankCode, digits, now(db), wantFavorite ? 1 : 0);
    } else if (r && !wantRecent && !wantFavorite) {
      db.prepare('DELETE FROM recipients WHERE id = ?').run(r.id);
    } else if (r) {
      db.prepare('UPDATE recipients SET favorite = ? WHERE id = ?').run(wantFavorite ? 1 : 0, r.id);
    }
  });
  return toPayee({ bank_code: bankCode, account_digits: digits, holder_name: name }, recipientOf(db, bankCode, digits));
}

/** DELETE /api/payees/:id — 최근입금계좌(☆ 포함)도 같이 */
function deletePayee(db, id) {
  const d = findPayee(db, id);
  withTransaction(db, () => {
    db.prepare('DELETE FROM recipients WHERE bank_code = ? AND account_digits = ?').run(d.bank_code, d.account_digits);
    db.prepare('DELETE FROM directory WHERE bank_code = ? AND account_digits = ?').run(d.bank_code, d.account_digits);
  });
}

module.exports = {
  getProfile,
  patchProfile,
  reset,
  addAccount,
  patchAccount,
  deleteAccount,
  addTransaction,
  patchTransaction,
  deleteTransaction,
  listPayees,
  addPayee,
  patchPayee,
  deletePayee,
};
