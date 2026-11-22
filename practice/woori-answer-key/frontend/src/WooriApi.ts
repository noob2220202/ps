// WooriApi — 백엔드(Express :4100, Vite 가 /api 를 WOORI_API_PORT 로 프록시) 타입 클라이언트
// 응답 모양은 backend/README.md 'API · 응답 모양' 과 backend/routes/*.js · repo.js · transfer.js 의 실제 응답에 맞춘 것.
// 금액은 원 단위 정수, 시각은 로컬 'YYYY-MM-DDTHH:mm:ss' (Asia/Seoul, 시간대 표기 없음).
// 오류 응답은 늘 { error: 한국어 메시지, code: 'INVALID_AMOUNT' 같은 코드 (+ failCount·maxFailures) } → WooriApiError.
// 이름·계좌번호는 시드의 더미 값이다 (실제 값은 저장소에 없다).

/* ───────────────────────── 응답 모양 ───────────────────────── */

export interface Account {
  id: number
  bank: string
  bankCode: string
  /** '우리은행' */
  bankName: string
  /** '우리' */
  bankShort: string
  /** 프론트 에셋 이름 ('bank-woori') */
  logo: string
  /** 'WON 통장' */
  product: string
  /** 'WON통장' */
  productNoSpace: string
  /** '1002-123-456789' (4-3-6) */
  number: string
  /** '한도제한' 칩 */
  badge: string | null
  ownerName: string
  balance: number
  /** 출금가능금액 (= 잔액) */
  withdrawable: number
  dailyLimit?: number | null
  /** 설계값 */
  remainingDailyLimit?: number | null
}

export type TxType = 'in' | 'out'
export type TxTypeFilter = 'all' | TxType
export type TxPeriod = 'thisMonth' | '3m' | '6m' | '1y' | 'custom'
export type TxOrder = 'desc' | 'asc'

export interface TxItem {
  /** 'tx-20261121-110240' */
  id: string
  accountId: number
  occurredAt: string
  /** '농협정우진' · '카카오페이' … (영상 표기 그대로) */
  displayName: string
  /** 부호 있는 정수 (출금 음수) */
  amount: number
  balanceAfter: number
  type: TxType
  /** 지어낸 행 (영상 밖, BRIEF D7) */
  synthetic: boolean
  display: {
    /** '11월 21일 · 11:02:40' */
    dateLine: string
    /** '-1원' · '+100,000원' */
    amount: string
    /** '잔액 345원' */
    balance: string
    amountColor: 'black' | 'blue'
    /** '2026년 11월' (월 머리글 — 바뀌는 곳에 프론트가 머리글을 넣는다) */
    month: string
  }
}

export interface TxPage {
  range: { period: TxPeriod; from: string; to: string; fromDate: string; toDate: string; text: string }
  type: TxTypeFilter
  order: TxOrder
  /** 필터 줄 글자 ('3개월', '전체', '최신순') */
  labels: { period: string; type: string; order: string }
  limit: number
  total: number
  items: TxItem[]
  nextCursor: string | null
  /** '기간 내 합계' 펼침 (영상에서 늘 접혀 있음 → 설계값) */
  summary: { inSum: number; outSum: number; inCount: number; outCount: number; design: true }
}

export interface TxQuery {
  period?: TxPeriod
  /** 'YYYY-MM-DD' 또는 'YYYY.MM.DD' (custom) */
  from?: string
  to?: string
  type?: TxTypeFilter
  order?: TxOrder
  cursor?: string | null
  limit?: number
}

export interface BankRef {
  name: string
  bankCode: string
  bankName: string
  accountNumber: string
  logo: string
}

export interface TxDetailField {
  key: string
  label: string
  value: string
  sub?: string
  placeholder?: string
  link?: string
  button?: string
}

export interface TxDetail {
  id: string
  accountId: number
  kind: 'deposit' | 'withdraw-transfer' | 'withdraw'
  type: TxType
  displayName: string
  amount: number
  occurredAt: string
  balanceAfter: number
  /** 거래구분 ('0543', '모바일') */
  code: string
  /** 의뢰인 */
  requester: string | null
  recipient: BankRef | null
  recipientLabel: string | null
  myLabel: string | null
  /** 이체확인증 */
  receipt: boolean
  chequeAmount: number
  fee: number
  /** 관리점 */
  branch: string
  memo: string | null
  synthetic: boolean
  /** 'video' = 영상에 나온 상세, 'rule' = 같은 종류 상세의 값을 쓴 설계값 */
  detailSrc: 'video' | 'rule'
  display: {
    pageTitle: string
    title: string
    amount: string
    amountColor: 'black' | 'blue'
    fields: TxDetailField[]
    /** "'한지호' 검색하기" */
    search: string
    buttons: string[]
  }
}

export interface Recipient {
  id: number
  name: string
  bankCode: string
  /** 짧은 이름 ('지역농축협', '카카오뱅크') */
  bankName: string
  accountNumber: string
  logo: string
  /** '2026.11.21' */
  date: string
  lastUsedAt: string
  favorite: boolean
}

export type RecipientTab = 'recommend' | 'frequent' | 'mine'

export interface Bank {
  code: string
  /** 그리드 이름 ('농협은행') */
  name: string
  /** 칩 이름 ('농협') */
  short: string
  /** 프론트 에셋 이름 ('bank-nh') */
  logo: string | null
  order: number
  kftc: string
  inGrid: boolean
  prefix: string
  prefixSrc: string
}

export interface BankChip {
  code: string
  name: string
  logo: string | null
}

export interface LookupResult {
  holderName: string
  bankCode: string
  bankName: string
  accountNumber: string
  logo: string
  /** 처음 보내는 계좌 ('처음 보내는 계좌예요. 사기의심조회' 칩) */
  firstTime: boolean
}

export type TicketState = 'checked' | 'verified' | 'done' | 'locked'

export interface Ticket {
  ticket: string
  state: TicketState
  fromAccountId: number
  from: { bankCode: string; bankName: string; bankShort: string; product: string; number: string; logo: string }
  to: BankRef
  holderName: string
  amount: number
  fee: number
  recipientLabel: string
  myLabel: string
  /** 거래내역에 생길 이름 */
  displayName: string
  firstTime: boolean
  /** 중복 이체 경고 ('6분 전') */
  duplicate: { minutesAgo: number; secondsAgo: number; at: string; transactionId: string; text: string } | null
  withdrawable: number
  checkedAt: string
  transactionId?: string | null
  display: {
    amount: string
    confirmTo: string
    confirmAmount: string
    confirmSub: string
    fee: string
    footnote: string
    duplicateTitle: string | null
    duplicateAgo: string | null
    firstTimeChip: string | null
  }
}

export type TransferCheckRequest =
  | { fromAccountId: number; recipientId: number; amount: number; recipientLabel?: string; myLabel?: string }
  | { fromAccountId: number; bankCode: string; accountNumber: string; amount: number; recipientLabel?: string; myLabel?: string }

export interface Done {
  transactionId: string
  occurredAt: string
  holderName: string
  to: BankRef
  amount: number
  fee: number
  recipientLabel: string
  myLabel: string
  memo: string | null
  receipt: boolean
  balanceAfter: number
  recipientId: number | null
  favorite: boolean
  display: { title: string; account: string; amount: string }
}

export interface TransferResult {
  transaction: TxItem
  balanceAfter: number
  done: Done
}

export interface HealthResult {
  ok: boolean
  db: 'ok' | 'empty'
  now: string
}

/** 시나리오 (backend/seed.js · tools/shots-lib.cjs 와 같은 이름). 별칭 v1 · v1-end · v2 도 받는다 */
export type DevScenario = 'v1-start' | 'v2-start' | 'v2-end'

export interface DevResetResult {
  ok: boolean
  scenario: DevScenario
  balance: number
  transactions: number
  clock: unknown
  now: string
  source: string
}

export interface ClockView {
  now: string
  source: 'override' | 'env' | 'real'
}

/* ───────────────────────── 요청 ───────────────────────── */

export class WooriApiError extends Error {
  readonly status: number
  readonly body: unknown
  /** 백엔드 오류 코드 ('WRONG_PIN' …). 없으면 undefined */
  readonly code: string | undefined
  constructor(status: number, message: string, body: unknown, code?: string) {
    super(message)
    this.name = 'WooriApiError'
    this.status = status
    this.body = body
    this.code = code
  }
}

const BASE = '/api'

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const obj = data && typeof data === 'object' ? (data as { error?: unknown; code?: unknown }) : null
    const msg = obj && typeof obj.error === 'string' ? obj.error : `${method} ${path} → ${res.status}`
    const code = obj && typeof obj.code === 'string' ? obj.code : undefined
    throw new WooriApiError(res.status, msg, data, code)
  }
  return data as T
}

const enc = encodeURIComponent

function qs(params: Record<string, string | number | null | undefined>): string {
  const entries = Object.entries(params)
    .filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== null && e[1] !== '')
    .map(([k, v]) => [k, String(v)])
  return entries.length ? '?' + new URLSearchParams(entries).toString() : ''
}

export const wooriApi = {
  health: (signal?: AbortSignal) => request<HealthResult>('GET', '/health', undefined, signal),

  getAccounts: (signal?: AbortSignal) => request<Account[]>('GET', '/accounts', undefined, signal),
  getAccount: (id: number, signal?: AbortSignal) => request<Account>('GET', `/accounts/${enc(String(id))}`, undefined, signal),
  /** 🔔 관리 패널 '내 정보' — 이름만 */
  updateAccountOwnerName: (id: number, ownerName: string) => request<Account>('PATCH', `/accounts/${enc(String(id))}`, { ownerName }),
  /** 🔔 관리 패널 '거래' 입금하기(amount > 0)/출금하기(amount < 0) — 늘 맨 뒤에 덧붙는다 */
  addTransaction: (accountId: number, merchant: string, amount: number) =>
    request<TxItem>('POST', `/accounts/${enc(String(accountId))}/transactions`, { merchant, amount }),
  /** 🔔 되돌리기 — 그 계좌의 가장 최근 거래이면서 addTransaction 으로 추가한 것만 (아니면 403/409) */
  deleteTransaction: (id: string) => request<{ ok: true }>('DELETE', `/transactions/${enc(id)}`),

  /** 거래내역 한 쪽 (기본 3개월·전체·최신순, 30건). 다음 쪽은 nextCursor 를 cursor 로 */
  getTransactions: (accountId: number, q: TxQuery = {}, signal?: AbortSignal) =>
    request<TxPage>(
      'GET',
      `/accounts/${enc(String(accountId))}/transactions${qs({ period: q.period, from: q.from, to: q.to, type: q.type, order: q.order, cursor: q.cursor, limit: q.limit })}`,
      undefined,
      signal,
    ),
  getTransaction: (id: string, signal?: AbortSignal) => request<TxDetail>('GET', `/transactions/${enc(id)}`, undefined, signal),

  getRecipients: (tab: RecipientTab = 'recommend', signal?: AbortSignal) =>
    request<Recipient[]>('GET', `/recipients${qs({ tab })}`, undefined, signal),
  /** 🔔 관리 패널 '받는 분 등록' */
  addRecipient: (bankCode: string, accountNumber: string, holder: string) =>
    request<Recipient>('POST', '/recipients', { bankCode, accountNumber, holder }),
  /** 🔔 관리 패널 '편집' — 예금주 이름·계좌번호 (기관은 고정) */
  updateRecipient: (id: number, fields: { holder?: string; accountNumber?: string }) =>
    request<Recipient>('PATCH', `/recipients/${enc(String(id))}`, fields),
  /** 즐겨찾기 ☆. favorite 생략(빈 본문)이면 토글 */
  setRecipientFavorite: (id: number, favorite?: boolean) =>
    request<Recipient>('POST', `/recipients/${enc(String(id))}/favorite`, favorite === undefined ? {} : { favorite }),
  deleteRecipient: (id: number) => request<{ ok: true }>('DELETE', `/recipients/${enc(String(id))}`),

  /** 금융회사 그리드 (은행 21곳 순서). securities 는 빈 배열 */
  getBanks: (type: 'bank' | 'securities' = 'bank', signal?: AbortSignal) => request<Bank[]>('GET', `/banks${qs({ type })}`, undefined, signal),
  /** 추천 은행 칩 — 입력 자리 수 → 영상의 칩 목록 (ledger 11절) */
  suggestBanks: (digits: number, signal?: AbortSignal) => request<BankChip[]>('GET', `/banks/suggest${qs({ digits, seq: 'v2' })}`, undefined, signal),

  /** 계좌 조회 (예금주). 없으면 404 ACCOUNT_NOT_FOUND */
  lookup: (bankCode: string, accountNumber: string) => request<LookupResult>('POST', '/lookup', { bankCode, accountNumber }),

  /** [다음]: 검사 → ticket (중복 경고·처음 보내는 계좌) */
  checkTransfer: (req: TransferCheckRequest) => request<Ticket>('POST', '/transfers/check', req),
  getTicket: (ticket: string, signal?: AbortSignal) => request<Ticket>('GET', `/transfers/check/${enc(ticket)}`, undefined, signal),
  /** 계좌 비밀번호 4자리 (더미 1234). 틀리면 422 WRONG_PIN, 5번이면 423 PIN_LOCKED */
  verifyPassword: (ticket: string, pin: string) => request<{ ok: true; ticket: string; state: 'verified' }>('POST', '/transfers/password', { ticket, pin }),
  /** 이체 실행 (201) */
  executeTransfer: (ticket: string, labels: { recipientLabel?: string; myLabel?: string } = {}) =>
    request<TransferResult>('POST', '/transfers', { ticket, ...labels }),
  /** 완료 화면 */
  getDone: (txId: string, signal?: AbortSignal) => request<Done>('GET', `/transfers/${enc(txId)}`, undefined, signal),

  /** 개발용: 시나리오 리셋 (now: 'video' 면 그 녹화의 시계로 고정) */
  devReset: (scenario: DevScenario, now?: string) => request<DevResetResult>('POST', '/dev/reset', now ? { scenario, now } : { scenario }),
  devClock: (now?: string | null) => (now === undefined ? request<ClockView>('GET', '/dev/clock') : request<ClockView>('POST', '/dev/clock', { now })),
}

export type WooriApi = typeof wooriApi
