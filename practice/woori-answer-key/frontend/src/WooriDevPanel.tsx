// WooriDevPanel — 🔔 버튼으로 여는 관리 패널. bank-app-clone src/dev-panel/DevPanel.tsx 를 그대로 옮긴 것
// (앱별 분기는 하나원큐 · i-ONE Bank 같은 '그 은행 계좌만' 앱 쪽: 계좌 이름·번호를 대표계좌까지 바꿈, 그 은행 계좌 추가).
// 앱 화면은 실제 앱처럼 "보기"만 하고, 계좌 잔액·이름·번호, 거래내역, 받는 분, 내 정보 같은 데이터 관리는 전부 여기서 버튼/숫자 입력으로 한다.
//
// 이 앱 쪽으로 바꾼 것:
//   - 받는 분 = 이체 계좌번호 조회 디렉터리. 원본 카카오뱅크의 '최근 이체에 표시' → 이체 '추천' 탭(최근입금계좌), 올원의 ☆ → '자주' 탭
//   - 거래 종류(원본 #체크카드 등 태그) → 이 앱 거래내역 상세의 '거래구분'. 상세에 보이는 관리점 · 수표금액 · 의뢰인 · 받는 분 통장표기도 고칠 수 있다
//   - 기본 탭: 프로필 · 로그인(서버 계정)은 이 앱에 없다. 기기 · 캡쳐모드 · 인트로 영상 · 테마는 원본 웹판의 폰 테두리 · .exe 용이라 뺐고,
//     화면 녹화는 원본이 폰에서 보이는 안내 그대로
//   - 폰 뒤로 버튼(APK) = 닫기
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { artSrc } from './WooriArt.ts'
import {
  notifyWooriDataChanged,
  useWooriDataVersion,
  wooriApi,
  WooriApiError,
  type Account,
  type Bank,
  type Payee,
  type Profile,
  type TxDetail,
  type TxItem,
} from './WooriApi.ts'
import { useWooriBack, WOORI_BACK_PRIO } from './WooriEnv.ts'
import { bankLogoArt } from './WooriSendFlow.ts'
import './WooriDevPanel.css'

type Tab = 'basic' | 'accounts' | 'payees' | 'tx'
const TABS: [Tab, string][] = [
  ['basic', '기본'],
  ['accounts', '계좌'],
  ['payees', '받는 분'],
  ['tx', '거래'],
]

const MAIN_ACCOUNT_ID = 1
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

export function WooriDevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('basic')
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const timer = useRef(0)
  useWooriBack(open ? onClose : null, WOORI_BACK_PRIO.dialog)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const notify = (text: string, error = false) => {
    setToast({ text, error })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 2200)
  }
  // 서버 요청 → 성공 메시지 or 서버가 준 에러 메시지. 성공하면 열려 있는 화면들이 다시 받는다 (원본 client.invalidate)
  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn()
      notifyWooriDataChanged()
      notify(success)
      return true
    } catch (e) {
      const err = e instanceof WooriApiError ? e : null
      const fields = (err?.body as { fields?: Record<string, string> } | null)?.fields
      notify(err ? (fields ? Object.values(fields)[0] : err.message) : '연결에 실패했어요', true)
      return false
    }
  }

  return (
    <div className={`dev-panel ${open ? 'dev-panel--open' : ''} dev-panel--woori`} aria-hidden={!open}>
      <div className="dev-panel__backdrop" onClick={onClose} />
      <section className="dev-panel__sheet" role="dialog" aria-label="관리 패널">
        <div className="dev-panel__grabber" />
        <header className="dev-panel__head">
          <strong>관리</strong>
          <button onClick={onClose} aria-label="닫기">
            <Icon name="close" size={20} stroke={2} />
          </button>
        </header>
        <nav className="dev-panel__tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="dev-panel__body">
          {open && tab === 'basic' && <BasicTab run={run} />}
          {open && tab === 'accounts' && <AccountsTab run={run} />}
          {open && tab === 'payees' && <PayeesTab run={run} />}
          {open && tab === 'tx' && <TxTab run={run} />}
        </div>
        {toast && <div className={`dev-toast ${toast.error ? 'dev-toast--error' : ''}`}>{toast.text}</div>}
      </section>
    </div>
  )
}

type Run = (fn: () => Promise<unknown>, success: string) => Promise<boolean>

/**
 * GET + 데이터 버전 (원본 useApi 를 작게): 패널이 데이터를 바꾸면 다시 받고, 받는 동안은 받아 둔 값을 그대로 보인다.
 * key 가 바뀌면(다른 계좌 · 다른 거래) 새로 받는다.
 */
function useLoad<T>(load: () => Promise<T>, key: string): T | undefined {
  const version = useWooriDataVersion()
  const [state, setState] = useState<{ key: string; data?: T }>({ key })
  useEffect(() => {
    let cancelled = false
    load().then(
      (data) => {
        if (!cancelled) setState({ key, data })
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load 는 key 로 정해진다
  }, [key, version])
  return state.key === key ? state.data : undefined
}

// ---------- 공통 조각 ----------
function Icon({ name, size = 20, stroke = 2 }: { name: 'close' | 'chevron-down' | 'chevron-right' | 'search'; size?: number; stroke?: number }) {
  const d = {
    close: 'M6 6l12 12M18 6L6 18',
    'chevron-down': 'M6 9l6 6 6-6',
    'chevron-right': 'M9 6l6 6-6 6',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  }[name]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

function BankIcon({ bank, size }: { bank?: { name: string; logo: string | null } | null; size: number }) {
  const art = bankLogoArt(bank?.logo)
  if (art) return <img className="bank-icon" src={artSrc(art)} alt="" width={size} height={size} draggable={false} />
  return (
    <span className="bank-icon bank-icon--blank" style={{ width: size, height: size }} aria-hidden>
      {bank?.name.slice(0, 1)}
    </span>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  )
}

// 금액 입력: 화면엔 "12,000" 처럼 콤마, 값은 숫자. 아래 버튼으로 더하기.
function MoneyInput({ value, onChange, quick = [1000, 10000, 100000] }: { value: number; onChange: (n: number) => void; quick?: number[] }) {
  return (
    <div className="money">
      <div className="money__box">
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString('ko-KR') : ''}
          placeholder="0"
          onChange={(e) => onChange(Math.min(Number(e.target.value.replace(/\D/g, '')) || 0, 1_000_000_000))}
        />
        <span>원</span>
      </div>
      <div className="chips-row">
        {quick.map((q) => (
          <button key={q} type="button" className="chip-btn" onClick={() => onChange(value + q)}>
            +{q >= 10000 ? `${q / 10000}만` : `${q / 1000}천`}
          </button>
        ))}
        <button type="button" className="chip-btn chip-btn--ghost" onClick={() => onChange(0)}>
          지우기
        </button>
      </div>
    </div>
  )
}

// ---------- 기본: 화면 녹화 / 내 정보 / 데이터 ----------
function BasicTab({ run }: { run: Run }) {
  const profile = useLoad<Profile>(() => wooriApi.getProfile(), 'profile')
  if (!profile) return <div className="tab">불러오는 중…</div>
  return <BasicForm run={run} initial={profile} />
}

function BasicForm({ run, initial }: { run: Run; initial: Profile }) {
  const [name, setName] = useState(initial.userName)

  return (
    <div className="tab">
      <RecordButton />

      <h3 className="tab__h">내 정보</h3>
      <Field label="이름">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={10} />
      </Field>
      <button className="btn" onClick={() => run(() => wooriApi.updateProfile({ userName: name }), '내 정보를 저장했어요')}>
        저장
      </button>

      <h3 className="tab__h">이 프로필 데이터</h3>
      <div className="row">
        <button
          className="btn btn--sm btn--danger"
          onClick={() => confirm('계좌·거래내역·받는 분을 모두 지우고 빈 상태(통장 0원)로 만들까요?') && run(() => wooriApi.reset('empty'), '빈 상태로 만들었어요')}
        >
          빈 상태로
        </button>
        <button
          className="btn btn--sm btn--danger"
          onClick={() => confirm('지금 데이터를 지우고 예시 데이터(잔액 345원 · 거래내역 · 받는 분)로 채울까요?') && run(() => wooriApi.reset('example'), '예시 데이터로 채웠어요')}
        >
          예시 데이터로
        </button>
      </div>
    </div>
  )
}

// 화면 녹화: 원본은 웹(PC 크롬/엣지)에서만 녹화하고, 폰(웹뷰)에서는 이 안내를 보인다 — 이 앱은 폰(APK)이라 안내만
function RecordButton() {
  return (
    <Field label="화면 녹화">
      <p className="tab__hint">이 브라우저는 웹 화면 녹화를 지원하지 않아요. 폰에서는 폰 자체 화면녹화를 써 주세요.</p>
    </Field>
  )
}

// ---------- 계좌: 잔액 · 이름 · 번호 수정 / 우리은행 계좌 추가·삭제 ----------
function AccountsTab({ run }: { run: Run }) {
  const accounts = useLoad<Account[]>(() => wooriApi.getAccounts(), 'accounts')
  if (!accounts) return <div className="tab">불러오는 중…</div>
  return (
    <div className="tab">
      <h3 className="tab__h tab__h--first">내 계좌</h3>
      {accounts.map((a) => (
        <AccountEditor key={a.id} account={a} run={run} />
      ))}
      <h3 className="tab__h">우리은행 계좌 추가</h3>
      <AddOwnBankAccount run={run} />
    </div>
  )
}

const OWN_HINT = { name: 'WON 통장', number: '숫자 13자리', max: 15 }

function AccountEditor({ account, run }: { account: Account; run: Run }) {
  // draft: 사용자가 고치기 시작한 값. 안 건드렸으면 null → 서버 잔액을 그대로 보여줌
  // (effect로 서버 값을 state에 복사하지 않아도 거래가 추가되면 자동으로 최신 잔액이 보임)
  const [draft, setDraft] = useState<number | null>(null)
  const balance = draft ?? account.balance
  const [number, setNumber] = useState(account.number)
  const [label, setLabel] = useState(account.product)
  const [openEdit, setOpenEdit] = useState(false)
  const external = account.id !== MAIN_ACCOUNT_ID // 대표계좌는 지울 수 없음

  return (
    <div className="acct-edit">
      <button className="acct-edit__head" onClick={() => setOpenEdit(!openEdit)}>
        <BankIcon bank={{ name: account.bankName, logo: account.logo }} size={30} />
        <span className="acct-edit__name">
          <strong>{account.product}</strong>
          <small>{account.number}</small>
        </span>
        <span className="acct-edit__bal">{won(account.balance)}</span>
        <Icon name={openEdit ? 'chevron-down' : 'chevron-right'} size={16} stroke={2} />
      </button>
      {openEdit && (
        <div className="acct-edit__body">
          <Field label="잔액">
            <MoneyInput value={balance} onChange={setDraft} quick={[10000, 100000, 1000000]} />
          </Field>
          <button
            className="btn btn--sm"
            onClick={async () => {
              if (await run(() => wooriApi.updateAccount(account.id, { balance }), `${account.product} 잔액을 바꿨어요`)) setDraft(null)
            }}
          >
            잔액 저장
          </button>
          <Field label="계좌 이름 (홈·내역에 보이는 이름)">
            <input value={label} maxLength={20} placeholder={OWN_HINT.name} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <button className="btn btn--sm" onClick={() => run(() => wooriApi.updateAccount(account.id, { name: label }), '계좌 이름을 바꿨어요')}>
            이름 저장
          </button>
          <Field label="계좌번호">
            {/* 우리은행 13자리(1002-123-456789) → 숫자만 받고 서버가 하이픈을 넣음 */}
            <input value={number} inputMode="numeric" placeholder={OWN_HINT.number} onChange={(e) => setNumber(e.target.value.replace(/[^\d-]/g, '').slice(0, OWN_HINT.max))} />
          </Field>
          <div className="row">
            <button className="btn btn--sm" onClick={() => run(() => wooriApi.updateAccount(account.id, { number }), '계좌번호를 바꿨어요')}>
              계좌번호 저장
            </button>
            {external && (
              <button
                className="btn btn--sm btn--danger"
                onClick={() => confirm(`${account.product}를 삭제할까요?\n거래내역도 함께 지워져요.`) && run(() => wooriApi.deleteAccount(account.id), '계좌를 삭제했어요')}
              >
                계좌 삭제
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 우리WON뱅킹: 우리은행 계좌만 추가 (이름 · 번호 · 시작 잔액)
function AddOwnBankAccount({ run }: { run: Run }) {
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [balance, setBalance] = useState(0)
  return (
    <div className="add-bank">
      <Field label="계좌 이름">
        <input value={name} maxLength={20} placeholder={OWN_HINT.name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="우리은행 계좌번호 (13자리)">
        <input value={number} inputMode="numeric" placeholder="숫자만" onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 13))} />
      </Field>
      <Field label="시작 잔액">
        <MoneyInput value={balance} onChange={setBalance} quick={[10000, 100000, 1000000]} />
      </Field>
      <button
        className="btn"
        onClick={async () => {
          if (await run(() => wooriApi.addAccount({ name: name.trim() || undefined, number, balance }), '우리은행 계좌를 추가했어요')) {
            setName('')
            setNumber('')
            setBalance(0)
          }
        }}
      >
        계좌 추가
      </button>
    </div>
  )
}

// 은행 고르기: 고른 은행을 보여주는 버튼 → 누르면 '은행선택' 목록(검색 가능)이 펼쳐짐
function BankSelect({ banks, value, onChange }: { banks: Bank[]; value: Bank; onChange: (b: Bank) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="bank-select" onClick={() => setOpen(!open)}>
        <BankIcon bank={value} size={30} />
        <strong>{value.name}</strong>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} stroke={2} />
      </button>
      {open && (
        <div className="bank-select__picker">
          <BankPicker
            banks={banks}
            onPick={(b) => {
              onChange(b)
              setOpen(false)
            }}
          />
        </div>
      )}
    </>
  )
}

function BankPicker({ banks, onPick }: { banks: Bank[]; onPick: (b: Bank) => void }) {
  const [query, setQuery] = useState('')
  const list = useMemo(() => banks.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())), [banks, query])
  return (
    <>
      <h2 className="bank-sheet__title">은행선택</h2>
      <div className="bank-sheet__search">
        <Icon name="search" size={20} stroke={2} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="은행검색" />
      </div>
      <div className="bank-sheet__list">
        {list.length > 0 && (
          <div className="bank-sheet__grid">
            {list.map((b) => (
              <button key={b.code} className="bank-sheet__item" onClick={() => onPick(b)}>
                <BankIcon bank={b} size={22} />
                <span>{b.name}</span>
              </button>
            ))}
          </div>
        )}
        {!list.length && <p className="transfer__empty">검색 결과가 없어요.</p>}
      </div>
    </>
  )
}

// 계좌번호 입력칸: 우리은행은 1002-123-456789 처럼 하이픈, 다른 은행은 숫자만 (이 앱 화면과 같은 표기)
function NumberInput({ bank, value, onChange }: { bank: { code: string }; value: string; onChange: (v: string) => void }) {
  const woori = bank.code === 'WOORI'
  const shape = (raw: string) => {
    const d = raw.replace(/\D/g, '')
    if (!woori) return d.slice(0, 16)
    const t = d.slice(0, 13)
    return [t.slice(0, 4), t.slice(4, 7), t.slice(7)].filter(Boolean).join('-')
  }
  return <input value={value} inputMode="numeric" placeholder={woori ? '0000-000-000000' : '숫자 6~16자리'} onChange={(e) => onChange(shape(e.target.value))} />
}

// ---------- 받는 분: 이체할 때 계좌번호로 찾을 "다른 사람 계좌" ----------
function PayeesTab({ run }: { run: Run }) {
  const payees = useLoad<Payee[]>(() => wooriApi.getPayees(), 'payees')
  const banks = useLoad<Bank[]>(() => wooriApi.getAllBanks(), 'banks')
  if (!payees || !banks) return <div className="tab">불러오는 중…</div>
  return (
    <div className="tab">
      <p className="tab__hint">
        이체 화면에서 계좌번호를 입력하면 여기 등록된 이름이 나와요. 등록 안 된 계좌는 "입력하신 계좌 정보를 확인할 수 없습니다"가 떠요. (내 계좌는 등록하지 않아도
        돼요) '최근입금계좌'를 켠 받는 분만 이체 화면 '추천' 탭에, ★ 받는 분은 '자주' 탭에 나와요.
      </p>
      <h3 className="tab__h tab__h--first">받는 분 {payees.length}명</h3>
      {payees.map((p) => (
        <PayeeEditor key={p.id} payee={p} run={run} />
      ))}
      <h3 className="tab__h">받는 분 등록</h3>
      <AddPayee banks={banks} run={run} />
    </div>
  )
}

function PayeeEditor({ payee, run }: { payee: Payee; run: Run }) {
  const [open, setOpen] = useState(false)
  const [holder, setHolder] = useState(payee.holder)
  const [number, setNumber] = useState(payee.number)
  return (
    <div className="acct-edit">
      <button className="acct-edit__head" onClick={() => setOpen(!open)}>
        <BankIcon bank={payee.bank} size={30} />
        <span className="acct-edit__name">
          <strong>
            {payee.holder} {payee.favorite && '★'}
            {payee.showRecent && <small> · 최근입금계좌</small>}
          </strong>
          <small>
            {payee.bank.short} {payee.number}
          </small>
        </span>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} stroke={2} />
      </button>
      {open && (
        <div className="acct-edit__body">
          <Field label="예금주 이름">
            <input value={holder} maxLength={20} onChange={(e) => setHolder(e.target.value)} />
          </Field>
          <Field label="계좌번호">
            <NumberInput bank={payee.bank} value={number} onChange={setNumber} />
          </Field>
          <div className="row">
            <button className="btn btn--sm" onClick={() => run(() => wooriApi.updatePayee(payee.id, { holder, number }), '받는 분 정보를 바꿨어요')}>
              저장
            </button>
            {/* 이체 '추천' 탭(최근입금계좌)에 보일지 — 원본 카카오뱅크 '최근 이체에 표시' */}
            <button
              className="btn btn--sm btn--ghost"
              onClick={() =>
                run(() => wooriApi.updatePayee(payee.id, { showRecent: !payee.showRecent }), payee.showRecent ? '최근입금계좌에서 뺐어요' : '최근입금계좌에 넣었어요')
              }
            >
              {payee.showRecent ? '최근입금계좌에서 빼기' : '최근입금계좌에 넣기'}
            </button>
            {/* ☆ (이체 '자주' 탭) — 원본 올원뱅크 */}
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => run(() => wooriApi.updatePayee(payee.id, { favorite: !payee.favorite }), payee.favorite ? '자주 보내는 분에서 뺐어요' : '자주 보내는 분에 넣었어요')}
            >
              {payee.favorite ? '☆ 자주에서 빼기' : '★ 자주에 넣기'}
            </button>
            <button
              className="btn btn--sm btn--danger"
              onClick={() => confirm(`${payee.holder}님을 받는 분에서 지울까요?`) && run(() => wooriApi.deletePayee(payee.id), '받는 분을 지웠어요')}
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddPayee({ banks, run }: { banks: Bank[]; run: Run }) {
  // 처음 고른 은행 = 이 앱 은행 (우리은행)
  const [bank, setBank] = useState(banks.find((b) => b.code === 'WOORI') ?? banks[0])
  const [number, setNumber] = useState('')
  const [holder, setHolder] = useState('')
  const [recent, setRecent] = useState(true) // 이체 '추천' 탭(최근입금계좌)에 보이게
  return (
    <div className="add-bank">
      <BankSelect
        banks={banks}
        value={bank}
        onChange={(b) => {
          setBank(b)
          setNumber('')
        }}
      />
      <Field label={`${bank.name} 계좌번호`}>
        <NumberInput bank={bank} value={number} onChange={setNumber} />
      </Field>
      <Field label="예금주 이름">
        <input value={holder} maxLength={20} placeholder="예: 김민지" onChange={(e) => setHolder(e.target.value)} />
      </Field>
      <button type="button" className={`chip-btn${recent ? ' on' : ''}`} style={{ alignSelf: 'flex-start' }} onClick={() => setRecent(!recent)}>
        {recent ? '✓ 최근입금계좌에 표시' : '최근입금계좌에 안 보임'}
      </button>
      <button
        className="btn"
        onClick={async () => {
          if (await run(() => wooriApi.addPayee({ bankCode: bank.code, number, holder, showRecent: recent }), `${holder}님을 등록했어요`)) {
            setNumber('')
            setHolder('')
          }
        }}
      >
        받는 분 등록
      </button>
    </div>
  )
}

// ---------- 거래: 계좌 고르고 → 금액·거래처 → 입금/출금 ----------
const MERCHANTS = ['편의점', '카페', '배달앱', '마트', '교통', '월급', '용돈', '이체']
// 거래구분 (이 앱 거래내역 상세의 '거래구분' — 영상: 입금 0543 · 이체/출금 모바일)
const CODES: [string, string][] = [
  ['모바일', '모바일'],
  ['0543', '0543'],
  ['체크카드', '체크카드'],
  ['자동이체', '자동이체'],
  ['이자', '이자'],
]

/** 그 계좌 거래 전부 (최신순, cursor 로 끝까지) */
async function allTransactions(accountId: number): Promise<TxItem[]> {
  const out: TxItem[] = []
  let cursor: string | null = null
  for (let guard = 0; guard < 100; guard++) {
    const page = await wooriApi.getTransactions(accountId, { period: 'custom', from: '2000-01-01', to: '2099-12-31', limit: 200, cursor })
    out.push(...page.items)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  return out
}

function TxTab({ run }: { run: Run }) {
  const accounts = useLoad<Account[]>(() => wooriApi.getAccounts(), 'accounts')
  const banks = useLoad<Bank[]>(() => wooriApi.getAllBanks(), 'banks')
  const [accountId, setAccountId] = useState(MAIN_ACCOUNT_ID)
  const [amount, setAmount] = useState(5000)
  const [merchant, setMerchant] = useState('편의점')
  const [code, setCode] = useState('모바일')
  const list = useLoad<TxItem[]>(() => allTransactions(accountId), `tx-${accountId}`)
  const [editing, setEditing] = useState<string | null>(null)
  const [shown, setShown] = useState(10) // 보여 줄 거래 수 (더 보기로 늘림)

  if (!accounts || !banks) return <div className="tab">불러오는 중…</div>
  const current = accounts.find((a) => a.id === accountId) ?? accounts[0]

  const send = (sign: 1 | -1) =>
    run(() => wooriApi.createTransaction(current.id, { merchant, amount: sign * amount, code }), `${merchant} ${won(amount)} ${sign > 0 ? '입금' : '출금'}했어요`)

  return (
    <div className="tab">
      <Field label="계좌">
        <div className="chips-row chips-row--wrap">
          {accounts.map((a) => (
            <button key={a.id} className={`chip-btn ${a.id === current.id ? 'on' : ''}`} onClick={() => setAccountId(a.id)}>
              {a.product}
            </button>
          ))}
        </div>
      </Field>
      <p className="tab__hint">
        현재 잔액 <strong>{won(current.balance)}</strong>
      </p>

      <Field label="금액">
        <MoneyInput value={amount} onChange={setAmount} quick={[1000, 5000, 10000, 50000]} />
      </Field>
      <Field label="거래처">
        <div className="chips-row chips-row--wrap">
          {MERCHANTS.map((m) => (
            <button key={m} type="button" className={`chip-btn ${m === merchant ? 'on' : ''}`} onClick={() => setMerchant(m)}>
              {m}
            </button>
          ))}
        </div>
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={20} placeholder="직접 입력" />
      </Field>
      <Field label="거래구분">
        <Segmented value={code} options={CODES} onChange={setCode} />
      </Field>

      <div className="row">
        <button className="btn btn--in" onClick={() => send(1)}>
          입금하기 +
        </button>
        <button className="btn btn--out" onClick={() => send(-1)}>
          출금하기 −
        </button>
      </div>

      <h3 className="tab__h">최근 거래</h3>
      <p className="tab__hint">거래를 누르면 거래내역 상세에 보이는 값을 전부 고칠 수 있어요 (시간까지).</p>
      {list && list.length === 0 && <p className="tab__hint">거래가 없어요.</p>}
      {list &&
        list.slice(0, shown).map((t) => (
          <div key={t.id}>
            <div className="tx-row">
              <button type="button" className="tx-row__main" onClick={() => setEditing(editing === t.id ? null : t.id)}>
                <span>
                  {t.occurredAt.slice(5, 10).replace('-', '.')} {t.displayName}
                </span>
                <span className={t.amount > 0 ? 'tx-row__in' : ''}>{t.amount > 0 ? `+${won(t.amount)}` : won(t.amount)}</span>
              </button>
              <button aria-label="거래 삭제" onClick={() => run(() => wooriApi.deleteTransaction(t.id), '거래를 지웠어요')}>
                <Icon name="close" size={14} stroke={2} />
              </button>
            </div>
            {editing === t.id && <TxEditForm tx={t} banks={banks} run={run} onSaved={() => setEditing(null)} />}
          </div>
        ))}
      {/* 예전엔 최근 10건만 보여서 그보다 오래된 거래는 고칠 수 없었음 → 더 보기 / 전부 보기 */}
      {list && list.length > shown && (
        <div className="row">
          <button className="btn btn--sm" style={{ flex: 1 }} onClick={() => setShown(shown + 20)}>
            더 보기 ({shown} / {list.length}건)
          </button>
          <button className="btn btn--sm btn--ghost" onClick={() => setShown(list.length)}>
            전부 보기
          </button>
        </div>
      )}
    </div>
  )
}

const SIGN_OPTIONS: ['out' | 'in', string][] = [
  ['out', '출금'],
  ['in', '입금'],
]

// 거래내역 상세에 보이는 값 전부: 이름·금액(입금/출금)·거래일시(초까지)·거래구분·관리점·수표금액 +
//   입금: 의뢰인 / 출금: 받는 분(은행·계좌·예금주 — 셋 다 채우면 이체, 비우면 그 밖의 출금)·받는 분 통장표기
function TxEditForm({ tx, banks, run, onSaved }: { tx: TxItem; banks: Bank[]; run: Run; onSaved: () => void }) {
  const detail = useLoad<TxDetail>(() => wooriApi.getTransaction(tx.id), `detail-${tx.id}`)
  const [merchant, setMerchant] = useState(tx.displayName)
  const [sign, setSign] = useState<'out' | 'in'>(tx.amount < 0 ? 'out' : 'in')
  const [amount, setAmount] = useState(Math.abs(tx.amount))
  const [date, setDate] = useState(tx.occurredAt.slice(0, 10))
  const [time, setTime] = useState(tx.occurredAt.slice(11, 19))
  const [code, setCode] = useState('')
  const [branch, setBranch] = useState('')
  const [cheque, setCheque] = useState(0)
  const [requester, setRequester] = useState('')
  const [bank, setBank] = useState(banks.find((b) => b.code === 'WOORI') ?? banks[0])
  const [counterNumber, setCounterNumber] = useState('')
  const [counterHolder, setCounterHolder] = useState('')
  const [recipientLabel, setRecipientLabel] = useState('')
  const [busy, setBusy] = useState(false)
  // 상세 조회가 끝나면 그 값으로 한 번만 채움 (타이핑하는 중에 다시 덮어쓰지 않게)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (detail && loadedFor !== tx.id) {
    setLoadedFor(tx.id)
    setCode(detail.code ?? '')
    setBranch(detail.branch ?? '')
    setCheque(detail.chequeAmount)
    setRequester(detail.requester ?? '')
    setRecipientLabel(detail.recipientLabel ?? '')
    if (detail.recipient) {
      setBank(banks.find((b) => b.code === detail.recipient!.bankCode) ?? bank)
      setCounterNumber(detail.recipient.accountNumber)
      setCounterHolder(detail.recipient.name)
    }
  }
  const ready = !!detail && loadedFor === tx.id

  const save = async () => {
    if (busy || !ready) return
    setBusy(true)
    const ok = await run(
      () =>
        wooriApi.updateTransaction(tx.id, {
          merchant,
          amount: sign === 'out' ? -amount : amount,
          at: `${date}T${time}`,
          code,
          branch,
          chequeAmount: cheque,
          ...(sign === 'in'
            ? { requester }
            : { counterBank: bank.code, counterNumber, counterHolder, recipientLabel }),
        }),
      '거래를 고쳤어요',
    )
    setBusy(false)
    if (ok) onSaved()
  }

  return (
    <div className="tx-edit">
      <Field label="이름">
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={20} />
      </Field>
      <div className="row">
        <Field label="거래내용">
          <Segmented value={sign} options={SIGN_OPTIONS} onChange={setSign} />
        </Field>
      </div>
      <Field label="금액">
        <MoneyInput value={amount} onChange={setAmount} quick={[1000, 5000, 10000, 50000]} />
      </Field>
      <div className="row">
        <Field label="날짜">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="시간">
          <input type="time" step={1} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="거래 종류">
        <Segmented value={CODES.some(([v]) => v === code) ? code : ''} options={CODES} onChange={setCode} />
      </Field>
      <Field label="거래구분">
        <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} placeholder={ready ? '비우면 기본값' : '불러오는 중…'} disabled={!ready} />
      </Field>
      <Field label="관리점">
        <input value={branch} onChange={(e) => setBranch(e.target.value)} maxLength={20} placeholder={ready ? '비우면 기본값' : '불러오는 중…'} disabled={!ready} />
      </Field>
      <Field label="수표금액">
        <MoneyInput value={cheque} onChange={setCheque} quick={[]} />
      </Field>
      {sign === 'in' ? (
        <Field label="의뢰인">
          <input value={requester} onChange={(e) => setRequester(e.target.value)} maxLength={20} placeholder={ready ? undefined : '불러오는 중…'} disabled={!ready} />
        </Field>
      ) : (
        <>
          <Field label="상대은행">
            <BankSelect banks={banks} value={bank} onChange={setBank} />
          </Field>
          <Field label="상대계좌">
            <NumberInput bank={bank} value={counterNumber} onChange={setCounterNumber} />
          </Field>
          <Field label="상대계좌 예금주명">
            <input value={counterHolder} onChange={(e) => setCounterHolder(e.target.value)} maxLength={20} placeholder="계좌·예금주명을 비우면 상대 정보 없음" />
          </Field>
          <Field label="받는 분 통장표기">
            <input value={recipientLabel} onChange={(e) => setRecipientLabel(e.target.value)} maxLength={20} placeholder="이체일 때만 보여요" />
          </Field>
        </>
      )}
      <div className="row">
        <button type="button" className="btn btn--sm" disabled={busy || !ready} onClick={save}>
          저장
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onSaved}>
          닫기
        </button>
      </div>
    </div>
  )
}
