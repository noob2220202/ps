// WooriDevPanel — 🔔 종 버튼으로 여는 관리 패널 (bank-app-clone 의 다른 은행 앱들과 같은 자리·같은 역할: 기본 · 계좌 · 받는 분 · 거래 탭).
//   이 레포(답지)는 녹화 시나리오를 그대로 재현하는 게 목적이라, 영상·지어낸 과거 거래의 시각·금액은 고치거나 지울 수 없다 —
//   거래는 늘 맨 뒤에 덧붙이고(POST /api/accounts/:id/transactions), 되돌리기는 방금 패널로 추가한 거래 하나만(DELETE /api/transactions/:id).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { wooriApi, WooriApiError, type Account, type Bank, type Recipient, type TxItem } from './WooriApi.ts'
import './WooriDevPanel.css'

const MAIN_ACCOUNT_ID = 1

type Tab = 'basic' | 'account' | 'recipients' | 'tx'
const TABS: [Tab, string][] = [
  ['basic', '기본'],
  ['account', '계좌'],
  ['recipients', '받는 분'],
  ['tx', '거래'],
]

export function WooriDevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('basic')
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
          {open && tab === 'basic' && <BasicTab run={run} />}
          {open && tab === 'account' && <AccountTab run={run} />}
          {open && tab === 'recipients' && <RecipientsTab run={run} />}
          {open && tab === 'tx' && <TxTab run={run} />}
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

function MoneyInput({ value, onChange, quick = [1000, 10000, 100000] }: { value: number; onChange: (n: number) => void; quick?: number[] }) {
  return (
    <div className="woori-dev-money">
      <div className="woori-dev-money__box">
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString('ko-KR') : ''}
          placeholder="0"
          onChange={(e) => onChange(Math.min(Number(e.target.value.replace(/\D/g, '')) || 0, 1_000_000_000))}
        />
        <span>원</span>
      </div>
      <div className="woori-dev-chips">
        {quick.map((q) => (
          <button key={q} type="button" className="woori-dev-chip" onClick={() => onChange(value + q)}>
            +{q >= 10000 ? `${q / 10000}만` : `${q / 1000}천`}
          </button>
        ))}
        <button type="button" className="woori-dev-chip woori-dev-chip--ghost" onClick={() => onChange(0)}>
          지우기
        </button>
      </div>
    </div>
  )
}

/* ---------- 기본: 내 정보 ---------- */
function BasicTab({ run }: { run: Run }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    wooriApi.getAccount(MAIN_ACCOUNT_ID).then((a) => {
      setAccount(a)
      setName(a.ownerName)
    })
  }, [])

  if (!account) return <div className="woori-dev-tab">불러오는 중…</div>

  return (
    <div className="woori-dev-tab">
      <h3 className="woori-dev-tab__h woori-dev-tab__h--first">내 정보</h3>
      <Field label="이름 (홈·이체·거래내역에 쓰여요)">
        <input value={name} maxLength={10} onChange={(e) => setName(e.target.value)} />
      </Field>
      <button
        type="button"
        className="woori-dev-btn"
        onClick={() => run(() => wooriApi.updateAccountOwnerName(MAIN_ACCOUNT_ID, name), '이름을 저장했어요')}
      >
        저장
      </button>
      <p className="woori-dev-tab__hint">계좌번호·상품명은 시나리오 고정값이라 여기서 바꾸지 않아요. 잔액은 '계좌' 탭, 거래는 '거래' 탭에서.</p>
    </div>
  )
}

/* ---------- 계좌: 지금 잔액 보기 + 목표 금액으로 맞추기(거래 한 건을 덧붙여서) ---------- */
function AccountTab({ run }: { run: Run }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [target, setTarget] = useState(0)

  const reload = () => wooriApi.getAccount(MAIN_ACCOUNT_ID).then((a) => {
    setAccount(a)
    setTarget(a.balance)
  })
  useEffect(() => {
    reload()
  }, [])

  if (!account) return <div className="woori-dev-tab">불러오는 중…</div>
  const diff = target - account.balance

  return (
    <div className="woori-dev-tab">
      <h3 className="woori-dev-tab__h woori-dev-tab__h--first">{account.bankShort} {account.number}</h3>
      <p className="woori-dev-tab__hint">{account.product} · 지금 잔액 {account.balance.toLocaleString('ko-KR')}원</p>
      <Field label="목표 잔액 (차액만큼 거래 한 건을 맨 뒤에 덧붙여요)">
        <MoneyInput value={target} onChange={setTarget} quick={[10000, 100000, 1000000]} />
      </Field>
      <button
        type="button"
        className="woori-dev-btn"
        disabled={diff === 0}
        onClick={async () => {
          if (await run(() => wooriApi.addTransaction(MAIN_ACCOUNT_ID, '관리자 조정', diff), `잔액을 ${target.toLocaleString('ko-KR')}원으로 맞췄어요`))
            reload()
        }}
      >
        {diff === 0 ? '지금 잔액과 같아요' : diff > 0 ? `+${diff.toLocaleString('ko-KR')}원 입금해서 맞추기` : `${diff.toLocaleString('ko-KR')}원 출금해서 맞추기`}
      </button>
    </div>
  )
}

/* ---------- 받는 분: 등록 · 수정 · 즐겨찾기 · 삭제 ---------- */
function RecipientsTab({ run }: { run: Run }) {
  const [list, setList] = useState<Recipient[] | null>(null)
  const [banks, setBanks] = useState<Bank[] | null>(null)
  const [editing, setEditing] = useState<number | null>(null)

  const reload = () => wooriApi.getRecipients('recommend').then(setList, () => setList([]))
  useEffect(() => {
    reload()
    wooriApi.getBanks().then(setBanks, () => setBanks([]))
  }, [])

  if (!list || !banks) return <div className="woori-dev-tab">불러오는 중…</div>

  return (
    <div className="woori-dev-tab">
      <p className="woori-dev-tab__hint">이체 화면에서 계좌번호를 입력하면 여기 등록된 이름이 나와요. 등록 안 된 계좌는 '계좌정보를 확인해 주세요'가 떠요.</p>
      <h3 className="woori-dev-tab__h woori-dev-tab__h--first">받는 분 {list.length}명</h3>
      {list.length === 0 && <p className="woori-dev-tab__hint">받는 분이 없어요.</p>}
      {list.map((r) => (
        <div key={r.id} className="woori-dev-recipient">
          <button type="button" className="woori-dev-recipient__head" onClick={() => setEditing(editing === r.id ? null : r.id)}>
            <span className="woori-dev-recipient__name">
              {r.favorite && '★ '}
              {r.name}
            </span>
            <span className="woori-dev-recipient__num">
              {r.bankName} {r.accountNumber}
            </span>
          </button>
          {editing === r.id && <RecipientEditor recipient={r} run={run} onSaved={reload} />}
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
      <h3 className="woori-dev-tab__h">받는 분 등록</h3>
      <AddRecipient banks={banks} run={run} onAdded={reload} />
    </div>
  )
}

function RecipientEditor({ recipient, run, onSaved }: { recipient: Recipient; run: Run; onSaved: () => void }) {
  const [holder, setHolder] = useState(recipient.name)
  const [number, setNumber] = useState(recipient.accountNumber)
  return (
    <div className="woori-dev-recipient__edit">
      <Field label="예금주 이름">
        <input value={holder} maxLength={20} onChange={(e) => setHolder(e.target.value)} />
      </Field>
      <Field label="계좌번호">
        <input value={number} inputMode="numeric" onChange={(e) => setNumber(e.target.value.replace(/[^\d-]/g, ''))} />
      </Field>
      <button
        type="button"
        className="woori-dev-btn woori-dev-btn--sm"
        onClick={async () => {
          if (await run(() => wooriApi.updateRecipient(recipient.id, { holder, accountNumber: number }), '받는 분 정보를 바꿨어요')) onSaved()
        }}
      >
        저장
      </button>
    </div>
  )
}

function AddRecipient({ banks, run, onAdded }: { banks: Bank[]; run: Run; onAdded: () => void }) {
  const [bankCode, setBankCode] = useState(banks[0]?.code ?? '')
  const [number, setNumber] = useState('')
  const [holder, setHolder] = useState('')
  return (
    <div className="woori-dev-add">
      <Field label="금융회사">
        <select value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="계좌번호">
        <input value={number} inputMode="numeric" placeholder="숫자만" onChange={(e) => setNumber(e.target.value.replace(/[^\d-]/g, ''))} />
      </Field>
      <Field label="예금주 이름">
        <input value={holder} maxLength={20} placeholder="예: 김민지" onChange={(e) => setHolder(e.target.value)} />
      </Field>
      <button
        type="button"
        className="woori-dev-btn"
        onClick={async () => {
          if (await run(() => wooriApi.addRecipient(bankCode, number, holder), `${holder}님을 등록했어요`)) {
            setNumber('')
            setHolder('')
            onAdded()
          }
        }}
      >
        등록
      </button>
    </div>
  )
}

/* ---------- 거래: 입금/출금 추가 + 최근 거래 (방금 추가한 것만 되돌리기) ---------- */
function TxTab({ run }: { run: Run }) {
  const [account, setAccount] = useState<Account | null>(null)
  const [items, setItems] = useState<TxItem[] | null>(null)
  const [merchant, setMerchant] = useState('용돈')
  const [amount, setAmount] = useState(5000)
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(new Set())

  const reload = () => {
    wooriApi.getAccount(MAIN_ACCOUNT_ID).then(setAccount)
    wooriApi.getTransactions(MAIN_ACCOUNT_ID, { period: '1y', limit: 10 }).then((p) => setItems(p.items))
  }
  useEffect(() => {
    reload()
  }, [])

  if (!account || !items) return <div className="woori-dev-tab">불러오는 중…</div>

  const send = (sign: 1 | -1) =>
    run(
      async () => {
        const tx = await wooriApi.addTransaction(MAIN_ACCOUNT_ID, merchant, sign * amount)
        setAddedIds((prev) => new Set(prev).add(tx.id))
      },
      `${merchant} ${amount.toLocaleString('ko-KR')}원 ${sign > 0 ? '입금' : '출금'}했어요`,
    ).then((ok) => {
      if (ok) reload()
      return ok
    })

  return (
    <div className="woori-dev-tab">
      <h3 className="woori-dev-tab__h woori-dev-tab__h--first">거래 추가</h3>
      <p className="woori-dev-tab__hint">지금 잔액 {account.balance.toLocaleString('ko-KR')}원. 늘 맨 뒤에 덧붙여요.</p>
      <Field label="거래처">
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={20} />
      </Field>
      <Field label="금액">
        <MoneyInput value={amount} onChange={setAmount} quick={[1000, 5000, 10000, 50000]} />
      </Field>
      <div className="woori-dev-row">
        <button type="button" className="woori-dev-btn woori-dev-btn--in" disabled={!merchant.trim() || !amount} onClick={() => send(1)}>
          입금하기 +
        </button>
        <button type="button" className="woori-dev-btn woori-dev-btn--out" disabled={!merchant.trim() || !amount} onClick={() => send(-1)}>
          출금하기 −
        </button>
      </div>

      <h3 className="woori-dev-tab__h">최근 거래</h3>
      {items.length === 0 && <p className="woori-dev-tab__hint">거래가 없어요.</p>}
      {items.map((t, i) => {
        const deletable = i === 0 && addedIds.has(t.id)
        return (
          <div key={t.id} className="woori-dev-tx">
            <span className="woori-dev-tx__main">
              <span>
                {t.display.dateLine} {t.displayName}
              </span>
              <span className={t.amount > 0 ? 'woori-dev-tx__in' : ''}>{t.display.amount}</span>
            </span>
            {deletable && (
              <button
                type="button"
                className="woori-dev-btn woori-dev-btn--sm woori-dev-btn--danger"
                onClick={async () => {
                  if (await run(() => wooriApi.deleteTransaction(t.id), '거래를 되돌렸어요')) reload()
                }}
              >
                되돌리기
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
