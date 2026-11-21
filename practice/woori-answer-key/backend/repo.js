'use strict';
// DB 행 → API 응답 모양 변환 + 공용 조회.
// 표시 문자열(display)은 ledger 의 실제 표기를 그대로 만든다 — 프론트가 같은 규칙을 다시 짜지 않아도 되게.

const { getBank, lookupCodes } = require('./banks');
const { formatAccount, digitsOnly, won, signedWon, dateLine, detailDateTime, dotDate, monthHeader } = require('./util');

/**
 * Account — 홈 카드·거래내역 위·이체 출금 계좌.
 * {id, bank:'woori', product:'WON 통장', number:'1002-123-456789', badge:'한도제한', balance, withdrawable, …}
 */
function toAccount(row, todayTransferred = 0) {
  const bank = getBank(row.bank_code);
  return {
    id: row.id,
    bank: 'woori',
    bankCode: row.bank_code,
    bankName: bank.name, // '우리은행' (이체 '우리은행 계좌에서')
    bankShort: bank.short, // '우리' (홈 카드 '우리 1002-123-456789')
    logo: bank.logo,
    product: row.product, // 'WON 통장'
    productNoSpace: row.product.replace(/\s+/g, ''), // 'WON통장' (이체 화면 표기)
    number: formatAccount(row.bank_code, row.account_digits), // '1002-123-456789'
    badge: row.badge, // '한도제한'
    ownerName: row.owner_name,
    balance: row.balance,
    withdrawable: row.balance, // 출금가능금액 (입출금 통장: 잔액과 같음 — 영상 345/345, 344/344, 342/342)
    dailyLimit: row.daily_limit, // 설계값
    remainingDailyLimit: row.daily_limit == null ? null : Math.max(0, row.daily_limit - todayTransferred),
  };
}

/** 거래내역 목록 한 행. type: 'in'(입금) | 'out'(출금) */
function toListItem(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    occurredAt: row.occurred_at,
    displayName: row.display_name,
    amount: row.amount,
    balanceAfter: row.balance_after,
    type: row.amount > 0 ? 'in' : 'out',
    synthetic: row.source === 'synthetic',
    display: {
      dateLine: dateLine(row.occurred_at), // '11월 21일 · 11:02:40'
      amount: signedWon(row.amount), // '-1원', '+100,000원'
      balance: `잔액 ${won(row.balance_after)}`, // '잔액 345원'
      amountColor: row.amount > 0 ? 'blue' : 'black', // 입금 파랑, 출금 검정 (ledger 12절)
      month: monthHeader(row.occurred_at), // 월 머리글 '2026년 11월' (각 달 첫 행 위)
    },
  };
}

function recipientInfo(bankCode, digits, name) {
  const bank = getBank(bankCode);
  return {
    name,
    bankCode,
    bankName: bank ? bank.short : bankCode, // '지역농축협', '카카오뱅크'
    accountNumber: formatAccount(bankCode, digits),
    logo: bank ? bank.logo : null,
  };
}

const DETAIL_KIND = { deposit: 'deposit', transfer: 'withdraw-transfer', withdraw: 'withdraw' };

/**
 * 거래내역 상세 (ledger 7절). kind:
 *   'deposit'           입금 — 메모입력·거래일시·거래구분·거래후 잔액·의뢰인·수표금액·관리점 (영상 상세 ①)
 *   'withdraw-transfer' 이 앱의 이체 — 메모입력·거래일시·받는 분(두 줄)·받는 분 통장표기·이체확인증[보기]·거래구분·거래후 잔액·수표금액·관리점 (영상 상세 ②)
 *   'withdraw'          그 밖의 출금 — 영상에 없음(설계값): 받는 분 묶음 없이 메모입력·거래일시·거래구분·거래후 잔액·수표금액·관리점
 * detailSrc 'video' = 이 행의 상세가 영상에 나옴, 'rule' = 같은 종류 영상 상세를 본뜬 설계값.
 */
function toDetail(row) {
  const kind = DETAIL_KIND[row.kind];
  const recipient = row.kind === 'transfer'
    ? recipientInfo(row.counterparty_bank, row.counterparty_account, row.counterparty_name)
    : null;
  const f = (key, label, value, extra = {}) => ({ key, label, value, ...extra });
  const memo = f('memo', '메모입력', '메모를 입력해 보세요', { placeholder: true, link: true }); // 파랑 + ›
  const when = f('occurredAt', '거래일시', detailDateTime(row.occurred_at));
  const code = f('code', '거래구분', row.code);
  const balance = f('balanceAfter', '거래후 잔액', won(row.balance_after));
  const cheque = f('chequeAmount', '수표금액', won(row.cheque_amount));
  const branch = f('branch', '관리점', row.branch);
  let fields;
  if (kind === 'deposit') {
    fields = [memo, when, code, balance, f('requester', '의뢰인', row.requester), cheque, branch];
  } else if (kind === 'withdraw-transfer') {
    fields = [
      memo,
      when,
      f('recipient', '받는 분', recipient.name, { sub: `${recipient.bankName} ${recipient.accountNumber}` }), // 두 줄, 오른쪽 정렬
      f('recipientLabel', '받는 분 통장표기', row.recipient_label),
      f('receipt', '이체확인증', '보기', { button: true }), // 테두리 알약 버튼
      code,
      balance,
      cheque,
      branch,
    ];
  } else {
    fields = [memo, when, code, balance, cheque, branch];
  }
  return {
    id: row.id,
    accountId: row.account_id,
    kind,
    type: row.amount > 0 ? 'in' : 'out',
    displayName: row.display_name,
    amount: row.amount,
    occurredAt: row.occurred_at,
    balanceAfter: row.balance_after,
    code: row.code, // '0543' | '모바일'
    requester: row.requester, // 입금만
    recipient, // 이체만 {name, bankCode, bankName, accountNumber, logo}
    recipientLabel: row.recipient_label,
    myLabel: row.my_label,
    receipt: row.kind === 'transfer', // 이체확인증 [보기]
    chequeAmount: row.cheque_amount,
    fee: row.fee,
    branch: row.branch,
    memo: null, // 영상의 어느 거래에도 메모 없음 (자리표시만)
    synthetic: row.source === 'synthetic',
    detailSrc: row.detail_src,
    display: {
      pageTitle: '거래내역 상세',
      title: row.display_name, // 큰 글씨
      amount: signedWon(row.amount),
      amountColor: row.amount > 0 ? 'blue' : 'black',
      fields,
      search: `'${row.display_name}' 검색하기`, // 아래 링크 (› 는 아이콘)
      buttons: ['공유', '확인'],
    },
  };
}

/** Recipient — 최근입금계좌 행. {id, name, date:'2026.11.21', bankCode, bankName, accountNumber, favorite, …} */
function toRecipient(row) {
  return {
    id: row.id,
    ...recipientInfo(row.bank_code, row.account_digits, row.name),
    date: dotDate(row.last_used_at), // '2026.11.21'
    lastUsedAt: row.last_used_at,
    favorite: !!row.favorite,
  };
}

function getAccountRow(db, id) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

function getTxRow(db, id) {
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(String(id));
}

/** 그 날짜(YYYY-MM-DD)에 이 계좌에서 이 앱으로 이체한 합계 (한도 계산용, 양수) */
function transferredOn(db, accountId, date) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(-amount), 0) AS s FROM transactions
       WHERE account_id = ? AND kind = 'transfer' AND substr(occurred_at, 1, 10) = ?`,
    )
    .get(accountId, date).s;
}

/**
 * 계좌 조회: 고른 기관 + 계좌번호 → 디렉터리 항목 (예금주, 실제 기관 코드).
 * '농협은행'(NH) 을 골라도 지역농축협(NHLOCAL) 계좌를 찾는다.
 */
function findDirectoryEntry(db, bankCode, accountNumber) {
  const digits = digitsOnly(accountNumber);
  const stmt = db.prepare('SELECT * FROM directory WHERE bank_code = ? AND account_digits = ?');
  for (const code of lookupCodes(bankCode)) {
    const row = stmt.get(code, digits);
    if (row) return { holderName: row.holder_name, bankCode: row.bank_code, digits, bank: getBank(row.bank_code) };
  }
  return null;
}

/** 이 계좌로 이 앱에서 보낸 적이 없으면 true (처음 보내는 계좌예요 칩) */
function isFirstTime(db, bankCode, digits) {
  const r = db.prepare('SELECT 1 FROM recipients WHERE bank_code = ? AND account_digits = ?').get(bankCode, digits);
  if (r) return false;
  const t = db
    .prepare("SELECT 1 FROM transactions WHERE kind = 'transfer' AND counterparty_bank = ? AND counterparty_account = ? LIMIT 1")
    .get(bankCode, digits);
  return !t;
}

module.exports = {
  toAccount,
  toListItem,
  toDetail,
  toRecipient,
  recipientInfo,
  getAccountRow,
  getTxRow,
  transferredOn,
  findDirectoryEntry,
  isFirstTime,
};
