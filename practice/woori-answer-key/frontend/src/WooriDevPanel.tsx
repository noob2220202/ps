// WooriDevPanel — 🔔 종 버튼으로 여는 관리 패널 (bank-app-clone 의 다른 은행 앱들과 같은 자리·같은 역할).
//   이 레포(답지)는 녹화 시나리오를 그대로 재현하는 게 목적이라 계좌·거래를 자유로 만들 수는 없다 —
//   백엔드가 주는 것만: 시나리오 리셋/시계(backend/routes/dev.js)·받는 분 즐겨찾기·삭제(backend/routes/recipients.js).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { wooriApi, WooriApiError, type ClockView, type DevScenario, type Recipient } from './WooriApi.ts'
import './WooriDevPanel.css'

type Tab = 'scenario' | 'recipients'
const TABS: [Tab, string][] = [
  ['scenario', '시나리오'],
  ['recipients', '받는 분'],
]

export function WooriDevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('scenario')
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
          <strong>관리</strong>
          <button type="button" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <nav className="woori-dev-panel__tabs">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="woori-dev-panel__body">
          {open && tab === 'scenario' && <ScenarioTab run={run} />}
          {open && tab === 'recipients' && <RecipientsTab run={run} />}
        </div>
        {toast && <div className={`woori-dev-toast ${toast.error ? 'woori-dev-toast--error' : ''}`}>{toast.text}</div>}
      </section>
    </div>
  )
}

type Run = (fn: () => Promise<unknown>, success: string) => Promise<boolean>

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="woori-dev-field">
      <span className="woori-dev-field__label">{label}</span>
      {children}
    </label>
  )
}

const SCENARIOS: [DevScenario, string][] = [
  ['v1-start', 'v1 시작 (345원)'],
  ['v2-start', 'v2 시작 (344원)'],
  ['v2-end', 'v2 끝 (342원)'],
]

/* ---------- 시나리오: 리셋 · 시계 ---------- */
function ScenarioTab({ run }: { run: Run }) {
  const [scenario, setScenario] = useState<DevScenario>('v1-start')
  const [clock, setClock] = useState<ClockView | null>(null)
  const [draft, setDraft] = useState('')

  const reload = () => wooriApi.devClock().then(setClock, () => setClock(null))
  useEffect(() => {
    reload()
  }, [])

  return (
    <div className="woori-dev-tab">
      <h3 className="woori-dev-tab__h woori-dev-tab__h--first">시나리오 리셋</h3>
      <p className="woori-dev-tab__hint">계좌·거래내역·받는 분을 그 시나리오의 처음 상태로 통째로 다시 채워요.</p>
      <div className="woori-dev-seg">
        {SCENARIOS.map(([v, label]) => (
          <button key={v} type="button" className={v === scenario ? 'on' : ''} onClick={() => setScenario(v)}>
            {label}
          </button>
        ))}
      </div>
      <div className="woori-dev-row">
        <button
          type="button"
          className="woori-dev-btn"
          onClick={async () => {
            if (await run(() => wooriApi.devReset(scenario), '시나리오를 리셋했어요')) reload()
          }}
        >
          이 시나리오로 리셋
        </button>
        <button
          type="button"
          className="woori-dev-btn woori-dev-btn--ghost"
          onClick={async () => {
            if (await run(() => wooriApi.devReset(scenario, 'video'), '리셋하고 영상 시각으로 고정했어요')) reload()
          }}
        >
          + 영상 시각으로
        </button>
      </div>

      <h3 className="woori-dev-tab__h">시계</h3>
      <p className="woori-dev-tab__hint">
        지금: <strong>{clock?.now ?? '불러오는 중…'}</strong>{' '}
        {clock && <small>({clock.source === 'override' ? '고정' : clock.source === 'env' ? '서버 설정' : '실제 시각'})</small>}
      </p>
      <Field label="시각 고정 ('YYYY-MM-DDTHH:mm:ss')">
        <input value={draft} placeholder="2026-11-21T11:09:11" onChange={(e) => setDraft(e.target.value)} />
      </Field>
      <div className="woori-dev-row">
        <button
          type="button"
          className="woori-dev-btn woori-dev-btn--sm"
          disabled={!draft.trim()}
          onClick={async () => {
            if (await run(() => wooriApi.devClock(draft.trim()), '시각을 고정했어요')) reload()
          }}
        >
          이 시각으로 고정
        </button>
        <button
          type="button"
          className="woori-dev-btn woori-dev-btn--sm woori-dev-btn--ghost"
          onClick={async () => {
            if (await run(() => wooriApi.devClock(null), '시각 고정을 풀었어요')) {
              setDraft('')
              reload()
            }
          }}
        >
          고정 풀기
        </button>
      </div>
    </div>
  )
}

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
      <h3 className="woori-dev-tab__h woori-dev-tab__h--first">받는 분 {list.length}명</h3>
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
