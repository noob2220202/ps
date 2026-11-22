'use strict';
// 계좌 조회 + 이체 흐름: 검사([다음]) → 계좌 비밀번호 → 실행 → 완료 정보.
//
//   POST /api/lookup             {bankCode, accountNumber}            → 예금주·처음 보내는 계좌 여부
//   POST /api/transfers/check    {fromAccountId, recipientId | bankCode+accountNumber, amount}
//                                → ticket + 중복 이체 경고(오늘 같은 받는 계좌·같은 금액이면 'N분 전') + 처음 보내는 계좌 여부
//   POST /api/transfers/password {ticket, pin}                         → 계좌 비밀번호 4자리 검사 (더미 값은 README)
//   POST /api/transfers          {ticket, recipientLabel?, myLabel?}   → 201 잔액 감소 + 거래 추가 + 최근입금계좌 갱신
//   GET  /api/transfers/:txId                                          → 완료 화면 정보

const { withTransaction } = require('./schema');
const { getBank, transferDisplayName } = require('./banks');
const { now: clockNow } = require('./clock');
const { digitsOnly, formatAccount, won, isValidLocalIso, localIsoToSeconds, ApiError } = require('./util');
const {
  getAccountRow, getTxRow, transferredOn, findDirectoryEntry, isFirstTime, toListItem, recipientInfo,
} = require('./repo');
const { txIdFor, TRANSFER_DETAIL } = require('./seed');

const LABEL_MAX_LENGTH = 20; // 통장표기 최대 글자 수 (설계값, 하나 답지와 같음)
const PIN_MAX_FAILURES = 5; // 비밀번호 5번 틀리면 이 이체는 잠김 (설계값)

/** 은행 코드 + 계좌번호 형식 검증 → { bankCode, digits } (잘못되면 400) */
function parseBankAccount(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, '요청 본문이 올바르지 않습니다', 'INVALID_BODY');
  }
  const { bankCode, accountNumber } = body;
  if (typeof bankCode !== 'string' || !bankCode.trim()) throw new ApiError(400, '금융회사를 선택해 주세요', 'INVALID_BANK');
  if (!getBank(bankCode.trim())) throw new ApiError(400, `알 수 없는 금융회사 코드입니다: ${bankCode}`, 'INVALID_BANK');
  if (typeof accountNumber !== 'string' && typeof accountNumber !== 'number') {
    throw new ApiError(400, '계좌번호를 입력해 주세요', 'INVALID_ACCOUNT_NUMBER');
  }
  const raw = String(accountNumber).trim();
  if (!/^[\d\s-]+$/.test(raw)) throw new ApiError(400, "계좌번호는 숫자와 '-' 만 입력할 수 있습니다", 'INVALID_ACCOUNT_NUMBER');
  const digits = digitsOnly(raw);
  if (digits.length < 6 || digits.length > 16) throw new ApiError(400, '계좌번호 자릿수가 올바르지 않습니다', 'INVALID_ACCOUNT_NUMBER');
  return { bankCode: bankCode.trim(), digits };
}

/** POST /api/lookup */
function lookup(db, body) {
  const { bankCode, digits } = parseBankAccount(body);
  const entry = findDirectoryEntry(db, bankCode, digits);
  if (!entry) throw new ApiError(404, '입력하신 계좌 정보를 확인할 수 없습니다', 'ACCOUNT_NOT_FOUND');
  return {
    holderName: entry.holderName,
    bankCode: entry.bankCode, // 실제 기관 ('농협은행' 을 골라도 지역농축협 계좌면 'NHLOCAL')
    bankName: entry.bank.short, // '카카오뱅크', '지역농축협'
    accountNumber: formatAccount(entry.bankCode, digits),
    logo: entry.bank.logo,
    firstTime: isFirstTime(db, entry.bankCode, digits), // 처음 보내는 계좌예요 칩
  };
}

function parseLabel(value, fallback, field) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') throw new ApiError(400, `${field} 값이 올바르지 않습니다`, 'INVALID_LABEL');
  const v = value.trim();
  if (!v) return fallback;
  if ([...v].length > LABEL_MAX_LENGTH) throw new ApiError(400, `${field}는 ${LABEL_MAX_LENGTH}자 이하로 입력해 주세요`, 'INVALID_LABEL');
  return v;
}

function parseId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d{1,15}$/.test(value)) return Number(value);
  return null;
}

function parseAmount(amount) {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new ApiError(400, '이체금액은 1원 이상의 정수여야 합니다', 'INVALID_AMOUNT');
  }
  return amount;
}

/** 받는 계좌: recipientId(최근입금계좌 행) 또는 bankCode+accountNumber(직접 입력) → {bankCode, digits, holderName} */
function resolveTarget(db, body) {
  if (body.recipientId !== undefined) {
    const id = parseId(body.recipientId);
    if (id === null) throw new ApiError(400, '받는 분이 올바르지 않습니다', 'INVALID_RECIPIENT');
    const r = db.prepare('SELECT * FROM recipients WHERE id = ?').get(id);
    if (!r) throw new ApiError(404, '받는 분을 찾을 수 없습니다', 'RECIPIENT_NOT_FOUND');
    const entry = findDirectoryEntry(db, r.bank_code, r.account_digits);
    return { bankCode: r.bank_code, digits: r.account_digits, holderName: entry ? entry.holderName : r.name };
  }
  const { bankCode, digits } = parseBankAccount(body);
  const entry = findDirectoryEntry(db, bankCode, digits);
  if (!entry) throw new ApiError(404, '입력하신 계좌 정보를 확인할 수 없습니다', 'ACCOUNT_NOT_FOUND');
  return { bankCode: entry.bankCode, digits, holderName: entry.holderName };
}

function checkLimits(from, amount, used) {
  if (amount > from.balance) throw new ApiError(422, '출금가능금액이 부족합니다', 'INSUFFICIENT_BALANCE');
  if (from.daily_limit != null && used + amount > from.daily_limit) {
    throw new ApiError(
      422,
      `1일 이체한도(${won(from.daily_limit)})를 초과했습니다. 남은 한도 ${won(Math.max(0, from.daily_limit - used))}`,
      'DAILY_LIMIT_EXCEEDED',
    );
  }
}

/** '6분 전' (v1 중복 경고). 1분 미만 '방금 전', 60분 이상 'N시간 전' 은 설계값 */
function agoText(seconds) {
  const m = Math.floor(seconds / 60);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  return `${Math.floor(m / 60)}시간 전`;
}

/**
 * 중복 이체: 오늘(시계 날짜) 같은 출금 계좌 → 같은 받는 계좌로 같은 금액을 이 앱에서 보낸 적이 있으면 가장 최근 것.
 * v1: 11:02:40 지역농축협 1원 → 11:09:11 에 다시 1원 = 6분 31초 → '6분 전' (내림)
 */
function findDuplicate(db, accountId, bankCode, digits, amount, at) {
  const row = db
    .prepare(
      `SELECT * FROM transactions
       WHERE account_id = ? AND kind = 'transfer' AND counterparty_bank = ? AND counterparty_account = ?
         AND amount = ? AND substr(occurred_at, 1, 10) = ? AND occurred_at <= ?
       ORDER BY occurred_at DESC, seq DESC LIMIT 1`,
    )
    .get(accountId, bankCode, digits, -amount, at.slice(0, 10), at);
  if (!row) return null;
  const secondsAgo = Math.max(0, localIsoToSeconds(at) - localIsoToSeconds(row.occurred_at));
  return {
    minutesAgo: Math.floor(secondsAgo / 60),
    secondsAgo,
    at: row.occurred_at,
    transactionId: row.id,
    text: agoText(secondsAgo),
  };
}

/** ticket 행 → 검사 결과 (확인 화면이 쓰는 모든 값) */
function ticketView(db, t) {
  const from = getAccountRow(db, t.account_id);
  const fromBank = getBank(from.bank_code);
  const to = recipientInfo(t.bank_code, t.account_digits, t.holder_name);
  const dup = t.dup_tx_id
    ? { minutesAgo: Math.floor(t.dup_seconds / 60), secondsAgo: t.dup_seconds, at: getTxRow(db, t.dup_tx_id)?.occurred_at ?? null,
      transactionId: t.dup_tx_id, text: agoText(t.dup_seconds) }
    : null;
  return {
    ticket: t.ticket,
    state: t.state, // 'checked' | 'verified' | 'done' | 'locked'
    fromAccountId: from.id,
    from: {
      bankCode: from.bank_code,
      bankName: fromBank.name, // '우리은행' ('우리은행 계좌에서 ⌄')
      bankShort: fromBank.short,
      product: from.product.replace(/\s+/g, ''), // 'WON통장'
      number: formatAccount(from.bank_code, from.account_digits),
      logo: fromBank.logo,
    },
    to, // {name, bankCode, bankName, accountNumber, logo}
    holderName: t.holder_name,
    amount: t.amount,
    fee: 0, // 수수료 면제
    recipientLabel: t.recipient_label, // 받는 분 통장표기
    myLabel: t.my_label, // 내 통장표기
    displayName: transferDisplayName(t.bank_code, t.holder_name, t.my_label), // 거래내역에 생길 이름 ('농협정우진')
    firstTime: !!t.first_time,
    duplicate: dup,
    withdrawable: from.balance,
    checkedAt: t.checked_at,
    transactionId: t.tx_seq ? db.prepare('SELECT id FROM transactions WHERE seq = ?').get(t.tx_seq)?.id ?? null : null,
    display: {
      amount: won(t.amount), // '1원'
      confirmTo: `${t.holder_name} 님에게`,
      confirmAmount: `${won(t.amount)}을 이체하시겠어요?`,
      confirmSub: `${to.bankName} ${to.accountNumber} 계좌로 보냅니다.`,
      fee: '면제',
      footnote: '인증서 비밀번호 입력 없이 바로 이체됩니다.',
      duplicateTitle: dup ? '오늘 같은 내용으로 보냈어요!\n한 번 더 보낼까요?' : null,
      duplicateAgo: dup ? dup.text : null,
      firstTimeChip: t.first_time ? '처음 보내는 계좌예요. 사기의심조회' : null,
    },
  };
}

function getTicketRow(db, ticket) {
  if (typeof ticket !== 'string' || !ticket) throw new ApiError(400, 'ticket 이 필요합니다', 'INVALID_TICKET');
  const t = db.prepare('SELECT * FROM tickets WHERE ticket = ?').get(ticket);
  if (!t) throw new ApiError(404, '이체 정보를 찾을 수 없습니다. 처음부터 다시 해 주세요', 'TICKET_NOT_FOUND');
  return t;
}

/** POST /api/transfers/check — [다음] */
function check(db, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, '요청 본문이 올바르지 않습니다', 'INVALID_BODY');
  const fromId = parseId(body.fromAccountId);
  if (fromId === null) throw new ApiError(400, '출금계좌가 올바르지 않습니다', 'INVALID_FROM_ACCOUNT');
  const amount = parseAmount(body.amount);
  const from = getAccountRow(db, fromId);
  if (!from) throw new ApiError(404, '출금계좌를 찾을 수 없습니다', 'FROM_ACCOUNT_NOT_FOUND');
  const target = resolveTarget(db, body);
  if (target.bankCode === from.bank_code && target.digits === from.account_digits) {
    throw new ApiError(400, '출금계좌와 입금계좌가 같습니다', 'SAME_ACCOUNT');
  }
  // 받는 분 통장표기 기본값 = 보내는 사람(출금계좌 예금주), 내 통장표기 기본값 = 받는 분 예금주 (영상: 둘 다 '정우진')
  const recipientLabel = parseLabel(body.recipientLabel, from.owner_name, '받는 분 통장표기');
  const myLabel = parseLabel(body.myLabel, target.holderName, '내 통장표기');
  const at = clockNow(db);
  checkLimits(from, amount, transferredOn(db, from.id, at.slice(0, 10)));
  const dup = findDuplicate(db, from.id, target.bankCode, target.digits, amount, at);
  const firstTime = isFirstTime(db, target.bankCode, target.digits);

  const t = withTransaction(db, () => {
    const seq = db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM tickets').get().n;
    const ticket = `tk-${String(seq).padStart(6, '0')}`;
    db.prepare(`INSERT INTO tickets (seq, ticket, account_id, bank_code, account_digits, holder_name, amount, recipient_label, my_label,
        first_time, dup_tx_id, dup_seconds, state, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'checked', ?)`)
      .run(seq, ticket, from.id, target.bankCode, target.digits, target.holderName, amount, recipientLabel, myLabel,
        firstTime ? 1 : 0, dup ? dup.transactionId : null, dup ? dup.secondsAgo : null, at);
    return db.prepare('SELECT * FROM tickets WHERE ticket = ?').get(ticket);
  });
  return ticketView(db, t);
}

/** GET /api/transfers/check/:ticket — 확인 화면 다시 그리기 */
function getTicket(db, ticket) {
  return ticketView(db, getTicketRow(db, ticket));
}

/** POST /api/transfers/password — 계좌 비밀번호 4자리 */
function verifyPin(db, body) {
  const t = getTicketRow(db, body && body.ticket);
  if (t.state === 'done') throw new ApiError(409, '이미 처리된 이체입니다', 'TICKET_USED');
  if (t.state === 'locked') throw new ApiError(423, `비밀번호를 ${PIN_MAX_FAILURES}회 잘못 입력했습니다`, 'PIN_LOCKED');
  const pin = body.pin;
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) throw new ApiError(400, '계좌 비밀번호 4자리를 입력해 주세요', 'INVALID_PIN');
  const account = getAccountRow(db, t.account_id);
  if (pin !== account.pin) {
    const failCount = t.pin_failures + 1;
    const locked = failCount >= PIN_MAX_FAILURES;
    db.prepare('UPDATE tickets SET pin_failures = ?, state = ? WHERE seq = ?').run(failCount, locked ? 'locked' : t.state, t.seq);
    if (locked) {
      throw new ApiError(423, `비밀번호를 ${PIN_MAX_FAILURES}회 잘못 입력했습니다`, 'PIN_LOCKED', { failCount, maxFailures: PIN_MAX_FAILURES });
    }
    throw new ApiError(422, `비밀번호가 일치하지 않습니다 (${failCount}/${PIN_MAX_FAILURES})`, 'WRONG_PIN', {
      failCount,
      maxFailures: PIN_MAX_FAILURES,
    });
  }
  db.prepare("UPDATE tickets SET state = 'verified' WHERE seq = ?").run(t.seq);
  return { ok: true, ticket: t.ticket, state: 'verified' };
}

/** 새 거래 id: 'tx-YYYYMMDD-HHMMSS', 같은 초에 이미 있으면 '-2', '-3' … (WOORI_NOW 로 시계를 고정한 경우) */
function uniqueTxId(db, occurredAt) {
  const base = txIdFor(occurredAt);
  const exists = db.prepare('SELECT 1 FROM transactions WHERE id = ?');
  if (!exists.get(base)) return base;
  for (let n = 2; ; n++) if (!exists.get(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * POST /api/transfers — 실행
 * @param {object} [hooks] 테스트용: hooks.onTransferStep(step) — 단계마다 호출, throw 하면 전체 롤백
 */
function execute(db, body, hooks = {}) {
  const step = (name) => hooks.onTransferStep && hooks.onTransferStep(name);
  const t0 = getTicketRow(db, body && body.ticket);
  if (t0.state === 'done') throw new ApiError(409, '이미 처리된 이체입니다', 'TICKET_USED');
  if (t0.state === 'locked') throw new ApiError(423, `비밀번호를 ${PIN_MAX_FAILURES}회 잘못 입력했습니다`, 'PIN_LOCKED');
  if (t0.state !== 'verified') throw new ApiError(403, '계좌 비밀번호를 먼저 입력해 주세요', 'PIN_REQUIRED');
  const recipientLabel = parseLabel(body.recipientLabel, t0.recipient_label, '받는 분 통장표기');
  const myLabel = parseLabel(body.myLabel, t0.my_label, '내 통장표기');
  if (body.occurredAt !== undefined && !isValidLocalIso(body.occurredAt)) {
    throw new ApiError(400, "occurredAt 은 'YYYY-MM-DDTHH:mm:ss' 형식이어야 합니다", 'INVALID_OCCURRED_AT');
  }
  step('beforeLock');

  return withTransaction(db, () => {
    const t = db.prepare('SELECT * FROM tickets WHERE seq = ?').get(t0.seq);
    if (t.state !== 'verified') throw new ApiError(409, '이미 처리된 이체입니다', 'TICKET_USED');
    const from = getAccountRow(db, t.account_id);
    const lastTx = db.prepare('SELECT MAX(occurred_at) AS t FROM transactions WHERE account_id = ?').get(from.id).t;
    let occurredAt;
    if (body.occurredAt !== undefined) {
      // 개발/테스트용 거래시각 지정 — 마지막 거래보다 이르면 잔액 연결이 깨지므로 거부
      occurredAt = body.occurredAt;
      if (lastTx && occurredAt < lastTx) {
        throw new ApiError(400, `occurredAt 이 마지막 거래(${lastTx})보다 이전입니다`, 'INVALID_OCCURRED_AT');
      }
    } else {
      // 시계(WOORI_NOW 등)가 마지막 거래보다 이르면 마지막 거래 시각으로 맞춘다 (같은 시각이면 나중 거래가 위)
      occurredAt = clockNow(db);
      if (lastTx && occurredAt < lastTx) occurredAt = lastTx;
    }
    checkLimits(from, t.amount, transferredOn(db, from.id, occurredAt.slice(0, 10)));

    const balanceAfter = from.balance - t.amount;
    db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(balanceAfter, from.id);
    step('debited');

    const id = uniqueTxId(db, occurredAt);
    const displayName = transferDisplayName(t.bank_code, t.holder_name, myLabel);
    const ins = db.prepare(`INSERT INTO transactions
      (id, account_id, occurred_at, display_name, amount, balance_after, kind, code, branch, requester,
       counterparty_name, counterparty_bank, counterparty_account, recipient_label, my_label, fee, cheque_amount, detail_src, source, note)
      VALUES (?, ?, ?, ?, ?, ?, 'transfer', ?, ?, NULL, ?, ?, ?, ?, ?, 0, 0, 'rule', 'app', NULL)`)
      .run(id, from.id, occurredAt, displayName, -t.amount, balanceAfter, TRANSFER_DETAIL.code, TRANSFER_DETAIL.branch,
        t.holder_name, t.bank_code, t.account_digits, recipientLabel, myLabel);
    const seq = Number(ins.lastInsertRowid);
    step('inserted');

    // 최근입금계좌: 같은 (기관, 계좌) 가 있으면 시각·마지막 거래만 갱신, 없으면 받는 분 예금주로 추가
    db.prepare(`INSERT INTO recipients (name, bank_code, account_digits, last_used_at, last_tx_seq, favorite, source)
      VALUES (?, ?, ?, ?, ?, 0, 'app')
      ON CONFLICT (bank_code, account_digits)
      DO UPDATE SET last_used_at = excluded.last_used_at, last_tx_seq = excluded.last_tx_seq`)
      .run(t.holder_name, t.bank_code, t.account_digits, occurredAt, seq);
    step('recipientUpserted');

    db.prepare("UPDATE tickets SET state = 'done', tx_seq = ?, recipient_label = ?, my_label = ? WHERE seq = ?")
      .run(seq, recipientLabel, myLabel, t.seq);
    const row = db.prepare('SELECT * FROM transactions WHERE seq = ?').get(seq);
    step('beforeCommit');
    return { transaction: toListItem(row), balanceAfter, done: doneView(db, row) };
  });
}

/** 완료 화면 정보 (거래 행 → 화면 값) */
function doneView(db, row) {
  const to = recipientInfo(row.counterparty_bank, row.counterparty_account, row.counterparty_name);
  const r = db.prepare('SELECT * FROM recipients WHERE bank_code = ? AND account_digits = ?').get(row.counterparty_bank, row.counterparty_account);
  const amount = -row.amount;
  return {
    transactionId: row.id,
    occurredAt: row.occurred_at,
    holderName: row.counterparty_name,
    to, // {name, bankCode, bankName, accountNumber, logo}
    amount,
    fee: row.fee,
    recipientLabel: row.recipient_label,
    myLabel: row.my_label,
    memo: null, // '메모 · 내용을 입력할 수 있어요 ›' 자리표시
    receipt: true, // 이체확인증 [보기]
    balanceAfter: row.balance_after,
    recipientId: r ? r.id : null,
    favorite: r ? !!r.favorite : false, // ☆
    display: {
      title: `${row.counterparty_name} 님에게\n이체했어요`,
      account: `${to.bankName} ${to.accountNumber}`, // 화면 폭에 따라 두 줄(지역농축협 / 12345652789012) 또는 한 줄
      amount: won(amount),
    },
  };
}

/** GET /api/transfers/:txId */
function getDone(db, txId) {
  const row = getTxRow(db, txId);
  if (!row || row.kind !== 'transfer') throw new ApiError(404, '이체 내역을 찾을 수 없습니다', 'TRANSFER_NOT_FOUND');
  return doneView(db, row);
}

module.exports = {
  lookup, check, getTicket, verifyPin, execute, getDone, parseBankAccount, agoText, uniqueTxId, LABEL_MAX_LENGTH, PIN_MAX_FAILURES,
};
