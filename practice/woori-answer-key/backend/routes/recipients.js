'use strict';
// GET /api/recipients?tab=recommend|frequent|mine, POST /api/recipients {bankCode,accountNumber,holder} (🔔 관리 패널),
//   PATCH /api/recipients/:id {holder?,accountNumber?} (🔔), POST /api/recipients/:id/favorite, DELETE /api/recipients/:id
//   recommend (기본) — '추천' 탭의 최근입금계좌 (영상: 정우진 · 지역농축협 1행, 2026.11.21)
//   frequent         — '자주' 탭 = 즐겨찾기(☆)한 계좌 (설계값 — 영상에선 탭을 누르지 않았다)
//   mine             — '내계좌' 탭 = 내 계좌 (설계값)
const express = require('express');
const { toRecipient } = require('../repo');
const { getBank } = require('../banks');
const { now } = require('../clock');
const { formatAccount, digitsOnly, dotDate, ApiError, one } = require('../util');

const HOLDER_MAX = 20;

/** 요청 본문의 {bankCode, accountNumber} → {bankCode, digits} (잘못되면 400, 받는 분 등록·수정용 — transfer.js parseBankAccount 와 같은 규칙) */
function parseBankAccount(body) {
  const { bankCode, accountNumber } = body ?? {};
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

function parseHolder(holder) {
  if (typeof holder !== 'string' || !holder.trim()) throw new ApiError(400, '예금주 이름을 입력해 주세요', 'INVALID_HOLDER');
  const v = holder.trim();
  if ([...v].length > HOLDER_MAX) throw new ApiError(400, `이름은 ${HOLDER_MAX}자 이하로 입력해 주세요`, 'INVALID_HOLDER');
  return v;
}

// 최근순. 같은 초 이체(시계 고정)는 나중 거래(last_tx_seq 큰 것) 먼저 — 거래내역의 'occurred_at DESC, seq DESC' 와 같은 순서
const RECENT_ORDER = 'ORDER BY last_used_at DESC, last_tx_seq DESC, id ASC';

module.exports = function recipientsRouter(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const tab = one(req.query.tab) ?? 'recommend';
    if (tab === 'recommend') return res.json(db.prepare(`SELECT * FROM recipients ${RECENT_ORDER}`).all().map(toRecipient));
    if (tab === 'frequent') {
      return res.json(db.prepare(`SELECT * FROM recipients WHERE favorite = 1 ${RECENT_ORDER}`).all().map(toRecipient));
    }
    if (tab === 'mine') {
      const rows = db
        .prepare(`SELECT a.*, (SELECT MAX(occurred_at) FROM transactions t WHERE t.account_id = a.id) AS last_tx
                  FROM accounts a ORDER BY a.sort_order, a.id`)
        .all();
      return res.json(
        rows.map((a) => {
          const bank = getBank(a.bank_code);
          return {
            id: `account-${a.id}`,
            name: a.product,
            bankCode: a.bank_code,
            bankName: bank.short,
            accountNumber: formatAccount(a.bank_code, a.account_digits),
            logo: bank.logo,
            date: a.last_tx ? dotDate(a.last_tx) : '',
            lastUsedAt: a.last_tx ?? '',
            favorite: false,
            accountId: a.id,
            ownerName: a.owner_name,
            balance: a.balance,
          };
        }),
      );
    }
    throw new ApiError(400, 'tab 은 recommend|frequent|mine 중 하나입니다', 'INVALID_QUERY');
  });

  // 본문 {favorite: boolean} 이면 그 값으로, 없으면 토글 (☆, 영상에선 안 누름)
  router.post('/:id/favorite', (req, res) => {
    const row = db.prepare('SELECT * FROM recipients WHERE id = ?').get(req.params.id);
    if (!row) throw new ApiError(404, '받는 분을 찾을 수 없습니다', 'RECIPIENT_NOT_FOUND');
    const wanted = req.body && req.body.favorite;
    if (wanted !== undefined && typeof wanted !== 'boolean') throw new ApiError(400, 'favorite 은 true/false 여야 합니다', 'INVALID_BODY');
    const next = wanted === undefined ? !row.favorite : wanted;
    db.prepare('UPDATE recipients SET favorite = ? WHERE id = ?').run(next ? 1 : 0, row.id);
    res.json(toRecipient(db.prepare('SELECT * FROM recipients WHERE id = ?').get(row.id)));
  });

  // 🔔 관리 패널 '받는 분 등록' — bank-app-clone 의 다른 은행 앱들과 같은 자리 (이 레포에선 DevPanel 전용, 이체 화면엔 없음)
  router.post('/', (req, res) => {
    const { bankCode, digits } = parseBankAccount(req.body);
    const holder = parseHolder(req.body && req.body.holder);
    const at = now(db);
    try {
      db.prepare(`INSERT INTO recipients (name, bank_code, account_digits, last_used_at, last_tx_seq, favorite, source)
        VALUES (?, ?, ?, ?, NULL, 0, 'app')`).run(holder, bankCode, digits, at);
    } catch (e) {
      if (String(e && e.message).includes('UNIQUE')) {
        throw new ApiError(409, '이미 등록된 받는 분이에요', 'RECIPIENT_EXISTS');
      }
      throw e;
    }
    const row = db.prepare('SELECT * FROM recipients WHERE bank_code = ? AND account_digits = ?').get(bankCode, digits);
    res.status(201).json(toRecipient(row));
  });

  // 🔔 관리 패널 '편집' — 예금주 이름 · 계좌번호 고치기 (기관은 고정)
  router.patch('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM recipients WHERE id = ?').get(req.params.id);
    if (!row) throw new ApiError(404, '받는 분을 찾을 수 없습니다', 'RECIPIENT_NOT_FOUND');
    const body = req.body ?? {};
    const holder = body.holder === undefined ? row.name : parseHolder(body.holder);
    const digits = body.accountNumber === undefined ? row.account_digits : parseBankAccount({ bankCode: row.bank_code, accountNumber: body.accountNumber }).digits;
    db.prepare('UPDATE recipients SET name = ?, account_digits = ? WHERE id = ?').run(holder, digits, row.id);
    res.json(toRecipient(db.prepare('SELECT * FROM recipients WHERE id = ?').get(row.id)));
  });

  // 최근입금계좌 '편집' → 삭제 (설계값)
  router.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM recipients WHERE id = ?').run(req.params.id);
    if (info.changes === 0) throw new ApiError(404, '받는 분을 찾을 수 없습니다', 'RECIPIENT_NOT_FOUND');
    res.json({ ok: true });
  });

  return router;
};
