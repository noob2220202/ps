// WooriDevPanel — 🔔 종 버튼으로 여는 관리 패널 (bank-app-clone 의 다른 은행 앱들과 같은 자리·같은 역할).
//   이 레포(답지)는 녹화 시나리오를 그대로 재현하는 게 목적이라 계좌·거래를 자유로 만들 수는 없다 —
//   백엔드가 주는 것만: 받는 분 즐겨찾기·삭제(backend/routes/recipients.js).
import { useEffect, useRef, useState } from 'react'
import { wooriApi, WooriApiError, type Recipient } from './WooriApi.ts'
import './WooriDevPanel.css'

export function WooriDevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const timer = useRef(0)

  const notify = (text: string, error = false) => {
    setToast({ text, error })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2200)
  }
  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn()
      notify(success)
      return true
    } catch (e) {
      notify(e instanceof WooriApiError ? e.message : '연결에 실패했어요', true)
      return false
    }
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <div className={`woori-dev-panel ${open ? 'woori-dev-panel--open' : ''}`} aria-hidden={!open}>
      <div className="woori-dev-panel__backdrop" onClick={onClose} />
      <section className="woori-dev-panel__sheet" role="dialog" aria-label="관리 패널">
        <div className="woori-dev-panel__grabber" />
        <header className="woori-dev-panel__head">
          <strong>관리 · 받는 분</strong>
          <button type="button" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <div className="woori-dev-panel__body">{open && <RecipientsTab run={run} />}</div>
        {toast && <div className={`woori-dev-toast ${toast.error ? 'woori-dev-toast--error' : ''}`}>{toast.text}</div>}
      </section>
    </div>
  )
}

type Run = (fn: () => Promise<unknown>, success: string) => Promise<boolean>

/* ---------- 받는 분: 즐겨찾기 · 삭제 (추천 탭 = 서버가 주는 최근입금계좌) ---------- */
function RecipientsTab({ run }: { run: Run }) {
  const [list, setList] = useState<Recipient[] | null>(null)

  const reload = () => wooriApi.getRecipients('recommend').then(setList, () => setList([]))
  useEffect(() => {
    reload()
  }, [])

  if (!list) return <div className="woori-dev-tab">불러오는 중…</div>

  return (
    <div className="woori-dev-tab">
      <p className="woori-dev-tab__hint">이체 화면에서 계좌번호를 입력하면 여기 등록된 이름이 나와요. 새 받는 분 등록은 이체 화면에서 해요.</p>
      <h3 className="woori-dev-tab__h">받는 분 {list.length}명</h3>
      {list.length === 0 && <p className="woori-dev-tab__hint">받는 분이 없어요.</p>}
      {list.map((r) => (
        <div key={r.id} className="woori-dev-recipient">
          <span className="woori-dev-recipient__name">
            {r.favorite && '★ '}
            {r.name}
          </span>
          <span className="woori-dev-recipient__num">
            {r.bankName} {r.accountNumber}
          </span>
          <div className="woori-dev-row">
            <button
              type="button"
              className="woori-dev-btn woori-dev-btn--sm woori-dev-btn--ghost"
              onClick={async () => {
                if (await run(() => wooriApi.setRecipientFavorite(r.id, !r.favorite), r.favorite ? '즐겨찾기에서 뺐어요' : '즐겨찾기에 넣었어요'))
                  reload()
              }}
            >
              {r.favorite ? '★ 즐겨찾기 빼기' : '☆ 즐겨찾기 넣기'}
            </button>
            <button
              type="button"
              className="woori-dev-btn woori-dev-btn--sm woori-dev-btn--danger"
              onClick={async () => {
                if (confirm(`${r.name}님을 받는 분에서 지울까요?`) && (await run(() => wooriApi.deleteRecipient(r.id), '받는 분을 지웠어요'))) reload()
              }}
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
