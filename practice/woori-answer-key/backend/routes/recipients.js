'use strict';
// GET /api/recipients?tab=recommend|frequent|mine, POST /api/recipients/:id/favorite, DELETE /api/recipients/:id
//   recommend (기본) — '추천' 탭의 최근입금계좌 (영상: 정우진 · 지역농축협 1행, 2026.11.21)
//   frequent         — '자주' 탭 = 즐겨찾기(☆)한 계좌 (설계값 — 영상에선 탭을 누르지 않았다)
//   mine             — '내계좌' 탭 = 내 계좌 (설계값)
const express = require('express');
const { toRecipient } = require('../repo');
const { getBank } = require('../banks');
const { formatAccount, dotDate, ApiError, one } = require('../util');

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

  // 최근입금계좌 '편집' → 삭제 (설계값)
  router.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM recipients WHERE id = ?').run(req.params.id);
    if (info.changes === 0) throw new ApiError(404, '받는 분을 찾을 수 없습니다', 'RECIPIENT_NOT_FOUND');
    res.json({ ok: true });
  });

  return router;
};
