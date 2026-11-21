// WooriSendAmount — /send/amount 금액 입력 (spec/send-b.md 2.1–2.6 · 3.1–3.8 · send-b.json)
//   ?bank=<spec 은행 코드 (kakao, nh-local …)>&acct=<숫자> | ?to=<recipientId>  (send-a 의 /send/account 가 넘긴다)
//   단계적 그리기(흰 페이지+스피너 → 머리 → 계좌 → ⌄ → 키패드) → 앱 키패드(빠른 금액·숫자·[확인] 물결) → 폼([추가이체][다음] + 통장표기 묶음 들어옴)
//   → [다음] = POST /api/transfers/check → 중복이면 경고 시트, 아니면 계좌 비밀번호 시트(섞인 키패드) → POST /api/transfers/password
//   → 시트 한 프레임에 닫힘 + 스피너 → /send/confirm?ticket=…
// 데이터는 모두 wooriApi (이름·계좌는 시드의 더미). 비밀번호는 백엔드가 검사한다(dev 더미). 누른 키 위치는 어디에도 기록하지 않는다
// (눌림 회색 칸은 CSS :active 뿐, 입력 숫자는 ref 에만 두고 보낸 뒤 지운다).
// 키가 다른 화면(APK, 셸 640–900dp): 키패드 층·폼 버튼 층은 아래끝 기준(.woori-amt__layer--bottom), 머리·계좌·금액은 위끝 기준.
//   셸이 낮아 빠른 금액 줄이 금액 묶음에 닿으면 빠른 금액~[확인] 사이를 고르게 눌러 담는다(keypadSqueeze, 설계). 프레임 모드는 영상 그대로.
// 영상에 없는 설계: 폼 단계 금액 줄 탭 = 키패드로 돌아가 고치기 · 통장표기 › = 편집 시트(10자, [다음] 검사에 실어 보냄)
//   · 오류는 네이티브 alert 대신 안내 시트(WooriSendAlert — 확인 화면도 쓴다) · 받는 분을 못 찾으면 토스트 + /send 로
//   · 확인 화면에서 뒤로 = 채운 폼 그대로(금액·통장표기, 비밀번호는 [다음] 으로 다시 — sessionStorage WOORI_SEND_DRAFT_KEY, 실제 앱만).
//   · 통장표기 시트의 시스템 키보드로 셸이 줄어도 뒤 폼은 키보드 전 자리 그대로 (usePageHeight stable).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import { artSrc, bankArtName, type WooriArtName } from './WooriArt.ts'
import { WooriButton } from './WooriButton.tsx'
import { WooriHeader } from './WooriHeader.tsx'
import { useWooriStages } from './WooriLoadingPage.tsx'
import { WooriOverlay, WooriSheet } from './WooriSheet.tsx'
import { WooriSpinner } from './WooriSpinner.tsx'
import { useShotReady, useShotState } from './WooriShot.ts'
import { isFrameMode, useArrivedByPop, useBackTo, useWooriNavigate } from './WooriNav.ts'
import { WOORI_BOTTOM_FIX, WOORI_VIDEO_PAGE_H } from './WooriLayout.ts'
import { wooriApi, WooriApiError, type Account, type LookupResult, type Ticket } from './WooriApi.ts'
import { wooriLiveApp, wooriToast, wooriTodo } from './WooriEnv.ts'
import './WooriSendAmount.css'

/* ───────────────────────── 위치 도우미 ───────────────────────── */

const r3 = (v: number) => Math.round(v * 1000) / 1000
/** 앱 dp (x, y) → 정수 left/top + 소수 translate (렌더 규칙 1). dy = 글자 +0.25px 같은 추가 이동 */
function at(x: number, y: number, dy = 0): CSSProperties {
  const lx = Math.round(x)
  const ly = Math.round(y)
  const fx = r3(x - lx)
  const fy = r3(y - ly + dy)
  return { left: lx, top: ly, ...(fx || fy ? { translate: `${fx}px ${fy}px` } : {}) }
}
function txt(x: number, y: number, size: number, weight: number, extra: CSSProperties = {}, dy = 0): CSSProperties {
  return { ...at(x, y, dy), fontSize: size, fontWeight: weight, ...extra }
}

function Icon({ name, x, y, w, h, color, inline, style }: { name: WooriArtName; x?: number; y?: number; w: number; h: number; color?: string; inline?: boolean; style?: CSSProperties }) {
  const pos = inline || x == null || y == null ? {} : at(x, y)
  const base: CSSProperties = { width: w, height: h, ...pos, ...style }
  if (color) {
    const url = `url(${artSrc(name)})`
    return <span className="woori-amt__icon woori-amt__mask" style={{ ...base, background: color, WebkitMaskImage: url, maskImage: url }} aria-hidden />
  }
  return <img className="woori-amt__icon" src={artSrc(name)} alt="" style={base} draggable={false} />
}

/* ───────────────────────── 상수 ───────────────────────── */

/** 단계적 그리기 (v1, 흰 화면부터 ms): S1 머리 · S2 계좌·안내 · S3 ⌄ · S4 키패드 + 스피너 끔 (3.1) */
const AMOUNT_STAGES_MS = [175, 276, 443, 655] as const
const STAGE_KEYPAD = 4

/** spec 은행 코드(URL) → 백엔드 코드 ('nh-local' → 'NHLOCAL') */
const apiBankCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')
/** 백엔드 logo ('bank-kakao') → 그림 이름 (banks.kakao) */
function logoArt(logo: string | undefined): WooriArtName | undefined {
  return logo ? bankArtName(logo.replace(/^bank-/, '')) : undefined
}

const fmt = (n: number) => n.toLocaleString('ko-KR')

const QUICK = [
  { label: '+1만', add: 10_000 },
  { label: '+5만', add: 50_000 },
  { label: '+10만', add: 100_000 },
  { label: '+100만', add: 1_000_000 },
  { label: '전액', add: 0 },
] as const

/** 금액 키패드 숫자 키 (3.1 표: 글자 left·top·추가 이동은 글자마다 잰 값) */
const AMOUNT_KEYS: ReadonlyArray<{ k: string; col: number; row: number; l: number; dy: number; ls?: string }> = [
  { k: '1', col: 0, row: 0, l: 54.22, dy: 0.25 },
  { k: '2', col: 1, row: 0, l: 172.53, dy: 0.25 },
  { k: '3', col: 2, row: 0, l: 292.22, dy: 0.25 },
  { k: '4', col: 0, row: 1, l: 51.83, dy: -0.25 },
  { k: '5', col: 1, row: 1, l: 172.53, dy: -0.25 },
  { k: '6', col: 2, row: 1, l: 292.22, dy: -0.25 },
  { k: '7', col: 0, row: 2, l: 53.11, dy: 0 },
  { k: '8', col: 1, row: 2, l: 172.19, dy: 0 },
  { k: '9', col: 2, row: 2, l: 292.22, dy: 0 },
  { k: '00', col: 0, row: 3, l: 44.62, dy: 0.25, ls: '-0.005em' },
  { k: '0', col: 1, row: 3, l: 172.19, dy: 0.25 },
]
const AMOUNT_ROW_TOP = [520, 573, 624, 676] as const
/** 글자마다 열 안 left (열 왼끝 기준) — 비밀번호 키패드가 섞인 자리에 같은 글자를 놓을 때 쓴다 */
const DIGIT_IN_COL: Record<string, number> = Object.fromEntries(AMOUNT_KEYS.filter((k) => k.k.length === 1).map((k) => [k.k, k.l - k.col * 120]))

/** 비밀번호 키패드 4행 글자 top / 추가 이동 (기준선 576.25 / 642 / 706.25 / 772) */
const PW_ROW_TOP = [555, 621, 685, 751] as const
const PW_ROW_DY = [0.25, 0, 0.25, 0] as const
const PW_TOP = 256.667
const DUP_TOP = 374
/** 관찰 배치 (shot 상태): 위 3×3, 마지막 줄 가운데 9 고정 (2.6) */
const PW_LAYOUT_V1 = [1, 6, 2, 4, 3, 7, 0, 5, 8] as const
const PW_LAYOUT_V2 = [4, 3, 7, 6, 8, 2, 5, 0, 1] as const

/** 시드 PRNG (mulberry32) + Fisher–Yates 로 0–8 섞기. 9 는 마지막 줄 가운데 고정 */
function shuffledDigits(seedText: string): number[] {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  let a = h >>> 0
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const d = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

/** 시트 열림 (3.5: easeOutCubic 245ms + 딤 linear 305ms, 7ms 늦게) */
const SHEET_MOTION = { open: { duration: 245, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', dimDuration: 305, dimEasing: 'linear', dimDelay: 7 } }

/**
 * 통장표기 최대 글자 수 (코드 포인트 — 'n/10' 세는 법과 같다). backend transfer.js LABEL_MAX_LENGTH(20) 보다 엄하게:
 * 한글 10자(≈130dp)·'W' 10자(≈146dp)까지 폼·확인 화면 줄에서 제목과 겹치지 않는다 (설계 — 은행 통장표기는 보통 7–10자)
 */
const LABEL_MAX = 10
/** 고쳐서 다시 해야 하는 [다음] 오류 → 안내 시트를 닫으면 키패드로 (설계) */
const AMOUNT_ERRORS: ReadonlySet<string> = new Set(['INSUFFICIENT_BALANCE', 'DAILY_LIMIT_EXCEEDED', 'INVALID_AMOUNT'])

/* ── 확인 화면에서 뒤로 왔을 때의 폼 (설계, 실제 앱만) ── */
/**
 * 비밀번호를 맞힌 뒤 확인 화면으로 가기 전에 남기는 폼 (sessionStorage): 받는 분 쿼리(key)·입력한 숫자·고친 통장표기.
 * 뒤로(POP) 돌아온 금액 화면만 읽는다. 새로 들어오면(push·replace·첫 로드) 지우고, 확인 화면은 [이체] 성공·취소 때 지운다
 * → 보낸 금액이 다시 채워지지 않는다. 숨은 메뉴의 되돌리기도 woori.* 라 지운다.
 */
export const WOORI_SEND_DRAFT_KEY = 'woori.send.draft'
interface SendDraft {
  key: string
  digits: string
  labels: { recipient?: string; my?: string }
}
function readSendDraft(key: string): SendDraft | null {
  if (!wooriLiveApp()) return null
  try {
    const d = JSON.parse(sessionStorage.getItem(WOORI_SEND_DRAFT_KEY) || 'null') as SendDraft | null
    return d && d.key === key && /^[1-9]\d{0,11}$/.test(d.digits) ? { ...d, labels: d.labels ?? {} } : null
  } catch {
    return null
  }
}
function saveSendDraft(d: SendDraft) {
  if (!wooriLiveApp()) return
  try {
    sessionStorage.setItem(WOORI_SEND_DRAFT_KEY, JSON.stringify(d))
  } catch {
    /* 저장 못 함 — 뒤로 오면 빈 키패드 */
  }
}
function clearSendDraft() {
  try {
    sessionStorage.removeItem(WOORI_SEND_DRAFT_KEY)
  } catch {
    /* 저장소를 못 씀 */
  }
}

/* ── 키 작은 화면 (APK) ── */
/** 키패드 묶음: 빠른 금액 줄 top · 키패드 [확인] top (영상 dp) */
const KP_QUICK_TOP = 460
const KP_CONFIRM_TOP = 730.333
/** 금액 묶음(출금가능금액 줄 아래끝)과 빠른 금액 줄 사이 최소 간격 (설계) */
const KP_MIN_GAP = 16
/** 눌러 담는 최대 양 (키 줄 간격 52 → 43dp 쯤) */
const KP_SQUEEZE_MAX = 48

/**
 * 아래끝 기준 키패드의 빠른 금액 줄이 금액 묶음(아래끝 upperBottom)에 KP_MIN_GAP 보다 가까워지는 만큼(dp).
 * 셸 640dp + 처음 보내는 계좌 칩에서 38dp 쯤 — 그만큼 빠른 금액~[확인] 사이를 고르게 줄인다(kpY). 프레임 모드·보통 폰은 0.
 */
function keypadSqueeze(pageH: number, upperBottom: number): number {
  const quickTop = pageH - (WOORI_VIDEO_PAGE_H - KP_QUICK_TOP)
  return Math.min(KP_SQUEEZE_MAX, Math.max(0, upperBottom + KP_MIN_GAP - quickTop))
}
/** 영상 y (키패드 층 안) → 눌러 담은 y: [확인] 자리는 그대로, 위로 갈수록 sq 까지 내려온다. sq 0 이면 y 그대로 */
const kpY = (y: number, sq: number) => (sq ? y + (sq * (KP_CONFIRM_TOP - y)) / (KP_CONFIRM_TOP - KP_QUICK_TOP) : y)

/**
 * 화면 루트 높이 dp — 실제 앱만 잰다. 프레임 모드는 영상 셸 높이 그대로 (영상 비교 화면이 바뀌지 않게).
 *   h      지금 높이 (키패드 눌러 담기 keypadSqueeze)
 *   stable 같은 창 폭에서 본 가장 큰 높이(소수까지) = 시스템 키보드가 떠서 줄기 전 높이 (installWooriFit 의 k 와 같은 방식).
 *          통장표기 시트가 떠 있는 동안 폼 층을 이 높이 기준에 둔다 (설계)
 */
function usePageHeight(ref: RefObject<HTMLElement | null>): { h: number; stable: number } {
  const [dims, setDims] = useState({ h: WOORI_VIDEO_PAGE_H, stable: WOORI_VIDEO_PAGE_H })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || isFrameMode()) return
    let winW = -1
    const apply = () => {
      const h = el.clientHeight || WOORI_VIDEO_PAGE_H
      const exact = parseFloat(getComputedStyle(el).height) || h
      const fresh = Math.abs(window.innerWidth - winW) > 1
      winW = window.innerWidth
      setDims((d) => {
        const stable = fresh ? exact : Math.max(d.stable, exact)
        return d.h === h && d.stable === stable ? d : { h, stable }
      })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return dims
}

/* ───────────────────────── shot 상태 ───────────────────────── */

type Phase = 'keypad' | 'hide' | 'form'
interface AmountShot {
  stage: number
  phase: Phase
  typed?: boolean
  confirmPressed?: boolean
  fields?: 'none' | 'anim' | 'in'
  next?: 'pressed' | 'released'
  spinner?: boolean
  sheet?: 'dup' | 'pw'
  sheetAnim?: boolean
  yesPressed?: boolean
  dots?: number
}
const K: AmountShot = { stage: STAGE_KEYPAD, phase: 'keypad' }
const F: AmountShot = { stage: STAGE_KEYPAD, phase: 'form', typed: true, fields: 'in' }
const AMOUNT_SHOTS: Readonly<Record<string, AmountShot>> = {
  'amount-blank': { stage: 0, phase: 'keypad' },
  'amount-render': { stage: 3, phase: 'keypad' },
  'amount-keypad': K,
  'amount-1won': { ...K, typed: true },
  'amount-2won': { ...K, typed: true },
  'amount-confirm-pressed': { ...K, typed: true, confirmPressed: true },
  'amount-keypad-hide': { ...F, phase: 'hide', fields: 'none' },
  'amount-1won-form': { ...F, fields: 'none' },
  'amount-fields-in': { ...F, fields: 'anim' },
  'amount-form': F,
  'amount-next-pressed': { ...F, next: 'pressed', spinner: true },
  'amount-next-spinner': { ...F, next: 'released', spinner: true },
  'amount-processing': { ...F, spinner: true },
  'dup-open': { ...F, sheet: 'dup', sheetAnim: true, spinner: true },
  'dup-idle': { ...F, sheet: 'dup' },
  'dup-yes-pressed': { ...F, sheet: 'dup', yesPressed: true },
  'password-leak': { ...F, sheet: 'pw', dots: 4 },
  'password-leak-spinner': { ...F, sheet: 'pw', dots: 4, spinner: true },
}

/* ───────────────────────── 데이터 ───────────────────────── */

interface AmountData {
  from: Account
  to: LookupResult
  /** 백엔드 은행 코드 */
  bankCode: string
  digits: string
}

async function loadData(params: URLSearchParams): Promise<AmountData> {
  const accounts = await wooriApi.getAccounts()
  const from = accounts[0]
  let bankCode = params.get('bank') ? apiBankCode(params.get('bank') as string) : ''
  let digits = (params.get('acct') ?? '').replace(/\D/g, '')
  const toId = params.get('to')
  if ((!bankCode || !digits) && toId) {
    const list = await wooriApi.getRecipients('recommend')
    const r = list.find((x) => String(x.id) === toId)
    // 지운 받는 분 · 내계좌 탭 행(account-N) 등 목록에 없는 id: 은행 없이 조회하면 '금융회사를 선택해 주세요' 가 나와 헷갈린다
    if (!r) throw new Error('받는 분을 찾을 수 없어요')
    bankCode = r.bankCode
    digits = r.accountNumber.replace(/\D/g, '')
  }
  const to = await wooriApi.lookup(bankCode, digits)
  return { from, to, bankCode: to.bankCode, digits }
}

/* ───────────────────────── 화면 ───────────────────────── */

export default function WooriSendAmount() {
  const [params] = useSearchParams()
  const go = useWooriNavigate()
  const shot = useShotState('send-amount', AMOUNT_SHOTS)
  const s = shot?.state ?? null
  const paramKey = params.toString()

  const [data, setData] = useState<AmountData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    loadData(new URLSearchParams(paramKey)).then(
      (d) => alive && setData(d),
      (e: unknown) => alive && setLoadError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      alive = false
    }
  }, [paramKey])
  // 받는 분을 못 찾음 등 (실제 앱): 막힌 오류 화면 대신 토스트 + 받는 분 고르는 /send 로 (기록에 있으면 거기까지 뒤로)
  const backToSend = useBackTo('/send')
  useEffect(() => {
    if (!loadError || !wooriLiveApp()) return
    wooriToast(loadError)
    backToSend()
  }, [loadError, backToSend])

  const rootRef = useRef<HTMLDivElement>(null)
  const { h: pageH, stable: stableH } = usePageHeight(rootRef)

  // 확인 화면에서 뒤로(POP) 왔으면 그 받는 분의 채운 폼으로 (설계, 실제 앱만). 새로 들어왔으면 지난 폼을 지운다
  const byPop = useArrivedByPop()
  const [draft] = useState(() => (byPop ? readSendDraft(paramKey) : null))
  useEffect(() => {
    if (!byPop && wooriLiveApp()) clearSendDraft()
  }, [byPop])

  // 단계적 그리기: 데이터가 온 순간부터 (영상: 흰 화면 + 스피너 → 단계마다 한 프레임 교체)
  const stage = useWooriStages(AMOUNT_STAGES_MS, { start: data != null, shotStage: s ? s.stage : null })
  const st = s ? s.stage : stage

  // 금액: shot 은 v1(지역농축협) 1원 / v2(카카오뱅크) 2원
  const shotAmount = params.get('bank') === 'nh-local' ? '1' : '2'
  const [digitsTyped, setDigitsTyped] = useState(draft?.digits ?? '')
  const amountStr = s ? (s.typed ? shotAmount : '') : digitsTyped
  const amount = amountStr ? Number(amountStr) : 0

  const [phaseLive, setPhase] = useState<Phase>(draft ? 'form' : 'keypad')
  const phase = s ? s.phase : phaseLive
  const [fieldsLive, setFieldsLive] = useState<'none' | 'anim'>(draft ? 'anim' : 'none')
  const fields = s ? (s.fields ?? 'none') : fieldsLive

  // 버튼·시트·스피너
  const [busy, setBusy] = useState(false)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [dup, setDup] = useState<'open' | 'closing' | null>(null)
  const [pwOpen, setPwOpen] = useState(false)
  const [dots, setDots] = useState(0)
  const [pwError, setPwError] = useState<string | null>(null)
  const pinRef = useRef('')
  // 오류 안내 시트 (window.alert 대신). keypad = 닫으면 키패드로 돌아가 금액을 고친다
  const [alert, setAlert] = useState<{ text: string; open: boolean; keypad: boolean } | null>(null)
  // 통장표기 (설계): 고친 값만 둔다. 없으면 ticket 값 → 기본값 (받는 분 = 보내는 사람 이름, 내 = 받는 분 예금주 — backend 와 같음)
  const [labels, setLabels] = useState<{ recipient?: string; my?: string }>(draft?.labels ?? {})
  const [labelEdit, setLabelEdit] = useState<{ field: 'recipient' | 'my'; open: boolean } | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const labelInput = useRef<HTMLInputElement>(null)

  // shot: 시트 상태면 ticket 을 미리 받는다 (중복 경고 문구·섞는 시드)
  const shotNeedsTicket = !!s?.sheet
  const [shotTicket, setShotTicket] = useState<Ticket | null>(null)
  useEffect(() => {
    if (!shotNeedsTicket || !data) return
    let alive = true
    wooriApi
      .checkTransfer({ fromAccountId: data.from.id, bankCode: data.bankCode, accountNumber: data.digits, amount: Number(shotAmount) })
      .then((t) => alive && setShotTicket(t))
      .catch(() => alive && setShotTicket(null))
    return () => {
      alive = false
    }
  }, [shotNeedsTicket, data, shotAmount])

  const tk = s ? shotTicket : ticket
  const dupMode = s ? (s.sheet === 'dup' ? 'open' : null) : dup
  const pwShown = s ? s.sheet === 'pw' : pwOpen
  const dotCount = s ? (s.dots ?? 0) : dots
  const spinner = s ? (s.spinner ?? false) || st < STAGE_KEYPAD : st < STAGE_KEYPAD || busy

  useShotReady(data != null && (!shotNeedsTicket || shotTicket != null))

  /* ── 입력 ── */
  const typeKey = (k: string) => {
    if (phase !== 'keypad' || st < STAGE_KEYPAD) return
    setDigitsTyped((cur) => {
      if (k === '<') return cur.slice(0, -1)
      if (!cur && (k === '0' || k === '00')) return cur
      const next = (cur + k).slice(0, 12)
      return next
    })
  }
  const quick = (add: number) => {
    if (!data) return
    setDigitsTyped((cur) => {
      const v = add === 0 ? data.from.withdrawable : (cur ? Number(cur) : 0) + add
      return v > 0 ? String(Math.min(v, 999_999_999_999)) : ''
    })
  }

  // 키패드 [확인]: 누름 #185ba4 → 뗌 물결 → +100ms 키패드 닫힘 → +75ms 폼 → +194ms 통장표기 묶음 (3.3–3.4)
  const [ripple, setRipple] = useState<{ id: number; x: number; y: number; r: number } | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  const later = (ms: number, f: () => void) => {
    timers.current.push(window.setTimeout(f, ms))
  }
  const onConfirmUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (!amount) return
    const box = e.currentTarget.getBoundingClientRect()
    const sx = box.width / e.currentTarget.offsetWidth || 1
    const x = (e.clientX - box.left) / sx
    const y = (e.clientY - box.top) / sx
    const w = e.currentTarget.offsetWidth
    const h = e.currentTarget.offsetHeight
    const r = Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y))
    setRipple({ id: performance.now(), x, y, r })
  }
  const onConfirm = () => {
    if (!amount || phase !== 'keypad') return
    later(100, () => {
      setPhase('hide')
      setRipple(null)
      later(75, () => {
        setPhase('form')
        setFieldsLive('anim')
      })
    })
  }

  /** 폼 → 키패드 (금액 줄 탭 · 금액 오류 안내 뒤, 설계). 입력한 숫자는 그대로, ticket 은 [다음] 에서 새로.
   *  [다음] 검사 중 · 비밀번호를 맞혀 확인 화면으로 가는 600ms · 시트가 떠 있는 동안에는 받지 않는다 (가던 길이 옛 ticket 으로 이어지지 않게) */
  const reopenKeypad = () => {
    if (s || busy || pwOpen || dup) return
    setTicket(null)
    setFieldsLive('none')
    setPhase('keypad')
  }

  // [다음] → 검사 (고친 통장표기도 실어 보낸다 → ticket → 확인·완료 화면)
  const onNext = () => {
    if (!data || busy || !amount) return
    setBusy(true)
    wooriApi
      .checkTransfer({ fromAccountId: data.from.id, bankCode: data.bankCode, accountNumber: data.digits, amount, recipientLabel: labels.recipient, myLabel: labels.my })
      .then((t) => {
        setTicket(t)
        if (t.duplicate) setDup('open')
        else openPassword()
      })
      .catch((e: unknown) => {
        setBusy(false)
        const keypadAfter = e instanceof WooriApiError && AMOUNT_ERRORS.has(e.code ?? '')
        setAlert({ text: e instanceof Error ? e.message : String(e), open: true, keypad: keypadAfter })
      })
  }

  /* ── 통장표기 편집 시트 (설계) ── */
  const labelValue = (field: 'recipient' | 'my', d: AmountData) =>
    field === 'recipient' ? (labels.recipient ?? tk?.recipientLabel ?? d.from.ownerName) : (labels.my ?? tk?.myLabel ?? d.to.holderName)
  const openLabel = (field: 'recipient' | 'my') => {
    if (s || !data || busy) return
    setLabelDraft(labelValue(field, data))
    setLabelEdit({ field, open: true })
  }
  const closeLabel = () => {
    labelInput.current?.blur()
    setLabelEdit((l) => (l ? { ...l, open: false } : l))
  }
  const saveLabel = () => {
    if (!labelEdit) return
    // 비우면 기본값으로 (backend 도 빈 값 = 기본값)
    const v = [...labelDraft.trim()].slice(0, LABEL_MAX).join('')
    setLabels((cur) => ({ ...cur, [labelEdit.field]: v || undefined }))
    // 지난 [다음] 의 ticket 통장표기는 이제 옛 값 → 버린다 (비운 칸이 옛 값 대신 기본값으로 바로 보이게. [다음] 이 새로 만든다)
    setTicket(null)
    closeLabel()
  }
  const openPassword = () => {
    pinRef.current = ''
    setDots(0)
    setPwError(null)
    setBusy(false)
    setPwOpen(true)
  }
  /** 비밀번호 시트 ✕ · 폰 뒤로. 비밀번호 확인 중에는 받지 않는다 (닫힌 뒤에 결과가 와서 확인 화면으로 가지 않게) */
  const closePassword = () => {
    if (busy) return
    pinRef.current = ''
    setDots(0)
    setPwOpen(false)
  }

  const onPinKey = (k: string) => {
    if (!tk || busy) return
    if (k === 'clear') {
      pinRef.current = ''
      setDots(0)
      return
    }
    if (k === '<') {
      pinRef.current = pinRef.current.slice(0, -1)
      setDots(pinRef.current.length)
      return
    }
    if (pinRef.current.length >= 4) return
    pinRef.current += k
    const n = pinRef.current.length
    setDots(n)
    setPwError(null)
    if (n < 4) return
    const pin = pinRef.current
    pinRef.current = ''
    setBusy(true)
    wooriApi.verifyPassword(tk.ticket, pin).then(
      () => {
        // 시트·딤 한 프레임에 사라짐 → 금액 폼 + 스피너 → 확인 페이지 (3.8). 확인 화면에서 뒤로 오면 이 폼으로 (설계)
        setPwOpen(false)
        saveSendDraft({ key: paramKey, digits: digitsTyped, labels })
        later(600, () => go(`/send/confirm?ticket=${encodeURIComponent(tk.ticket)}`))
      },
      (e: unknown) => {
        setBusy(false)
        setDots(0)
        if (e instanceof WooriApiError && e.code === 'WRONG_PIN') {
          const b = e.body as { failCount?: number; maxFailures?: number } | null
          setPwError(`비밀번호가 맞지 않아요 (${b?.failCount ?? '?'}/${b?.maxFailures ?? 5})`)
        } else setPwError(e instanceof Error ? e.message : String(e))
      },
    )
  }

  const pwDigits = useMemo(() => {
    if (s) return [...(params.get('bank') === 'nh-local' ? PW_LAYOUT_V1 : PW_LAYOUT_V2)]
    return shuffledDigits(tk?.ticket ?? 'woori')
  }, [s, params, tk])

  const onBack = useCallback(() => go(-1), [go])
  const onCancel = useCallback(() => {
    clearSendDraft()
    go('/home', { replace: true })
  }, [go])

  if (loadError) {
    // 실제 앱은 위 effect 가 토스트 + /send 로 보낸다 (글자는 프레임·shot 모드에서만)
    return (
      <div ref={rootRef} className="woori-amt">
        <WooriHeader onBack={onBack} rightText="취소" onRight={onCancel} />
        {!wooriLiveApp() && (
          <p className="woori-amt__t" style={txt(20, 80, 15, 500)}>
            {loadError}
          </p>
        )}
      </div>
    )
  }

  const keypad = phase === 'keypad' && st >= STAGE_KEYPAD
  // 폼도 키패드 자리(단계 4)부터 — 뒤로 와서 채운 폼으로 시작할 때 계좌 줄보다 먼저 그리지 않게 (shot 의 폼 상태는 모두 단계 4)
  const form = phase === 'form' && st >= STAGE_KEYPAD
  const showAccounts = data != null && st >= 2
  const chev = st >= 3
  const first = data?.to.firstTime ?? false
  const off = first ? 36 : 0
  const fromArt: WooriArtName = (data && logoArt(data.from.logo)) || 'banks.woori'
  const toArt = data ? logoArt(data.to.logo) : undefined
  // 키 작은 화면: 키패드를 눌러 담는 양 (금액 묶음 아래끝 = 출금가능금액 줄 271 + 14)
  const sq = keypadSqueeze(pageH, 271 + off + 14)
  const kpF = 1 - sq / (KP_CONFIRM_TOP - KP_QUICK_TOP)

  return (
    <div ref={rootRef} className="woori-amt">
      {st >= 1 && <WooriHeader onBack={onBack} rightText="취소" onRight={onCancel} />}

      {/* 머리 아래 내용 (계좌 2줄 · 칩 · 금액). ⌄ · 사기의심조회 는 영상에 없는 화면 → wooriTodo */}
      {showAccounts && data && (
        <div className={'woori-amt__layer' + (keypad ? ' woori-amt__upper--keypad' : '')}>
          <Icon name={fromArt} x={20} y={67.667} w={24} h={24} />
          <div className="woori-amt__row" style={txt(49.94, 71, 17, 500, {}, 0.25)} onClick={wooriTodo}>
            <span>
              <b style={{ fontWeight: 700 }}>{data.from.bankName} 계좌</b>에서
            </span>
            {chev && <Icon name="history.chevron-down-small" w={16} h={16} inline color="#4a4b4e" style={{ marginLeft: 6.14, marginTop: 0.45 }} />}
          </div>
          <p className="woori-amt__t" style={txt(19.97, 102, 14, 500, { color: 'var(--woori-text-tertiary)' })}>
            {data.from.productNoSpace} {data.from.number}
          </p>

          {toArt && <Icon name={toArt} x={20} y={143.333} w={24} h={24} />}
          <div className="woori-amt__row" style={txt(49.97, 147, 17, 500)} onClick={wooriTodo}>
            <span>
              <b style={{ fontWeight: 700 }}>{data.to.holderName} 님 계좌</b>로
            </span>
            {chev && <Icon name="history.chevron-down-small" w={16} h={16} inline color="#4a4b4e" style={{ marginLeft: 6.95, marginTop: 0.32 }} />}
          </div>
          <p className="woori-amt__t" style={txt(19.98, 177, 14, 500, { color: 'var(--woori-text-tertiary)' }, 0.25)}>
            {data.to.bankName} {data.to.accountNumber}
          </p>

          {first && (
            <div className="woori-amt__chip-first" style={at(20, 203)} onClick={wooriTodo}>
              {chev ? <Icon name="send-b.siren" w={15.775} h={15.125} inline style={{ margin: '-1.708px -2.187px 0 -1.588px' }} /> : <span style={{ width: 12 }} />}
              <span style={{ marginLeft: 5.94, color: '#746770' }}>처음 보내는 계좌예요.</span>
              <span style={{ marginLeft: 2.65, color: '#3f323a' }}>사기의심조회</span>
              {chev ? (
                <Icon name="history.chevron-right-12" w={12} h={12} inline color="#4a3f46" style={{ marginLeft: 6.16, marginTop: -0.14 }} />
              ) : (
                <span style={{ width: 12, marginLeft: 6.16 }} />
              )}
            </div>
          )}

          {amount > 0 ? (
            <>
              <div className="woori-amt__row" style={txt(19.94, 228 + off, 25, 600)}>
                <span>{fmt(amount)}</span>
                <span style={{ marginLeft: 2.06 }}>원</span>
              </div>
              <div className="woori-amt__row" style={txt(19.94, 271 + off, 14, 500)}>
                <span style={{ color: 'var(--woori-text-body)', letterSpacing: '-0.005em' }}>{fmt(amount)}원</span>
                <span className="woori-amt__bar" />
                <span style={{ color: 'var(--woori-text-tertiary)' }}>출금가능금액 {fmt(data.from.withdrawable)} 원</span>
              </div>
            </>
          ) : (
            <>
              <p className="woori-amt__t" style={txt(19.98, 228 + off, 25, 600, { color: 'var(--woori-placeholder)' })}>
                얼마를 이체하시겠어요?
              </p>
              <p className="woori-amt__t" style={txt(19.98, 271 + off, 14, 500, { color: 'var(--woori-text-tertiary)' })}>
                출금가능금액 {fmt(data.from.withdrawable)} 원
              </p>
            </>
          )}
          {/* 폼 단계: 금액 줄을 누르면 키패드로 돌아가 고친다 (설계 — 보이지 않는 누름 상자). 출금가능금액 줄 아래 3dp 까지.
              z-index 1: 셸 640 + 처음 보내는 계좌 칩이면 아래끝 기준 통장표기 상자(314dp~)와 겹치는 몫도 이쪽 (통장표기 글자는 332dp~) */}
          {form && !s && (
            <button type="button" className="woori-amt__btn-reset woori-amt__hit" style={{ top: 218 + off, height: 70, zIndex: 1 }} aria-label="금액 고치기" onClick={reopenKeypad} />
          )}
        </div>
      )}

      {/* 앱 키패드 (아래끝 기준 층). 셸이 낮으면 sq 만큼 빠른 금액~[확인] 사이를 줄인다 — sq 0 이면 영상 자리 그대로 */}
      {keypad && (
        <div className="woori-amt__layer woori-amt__layer--bottom">
          {QUICK.map((q, i) => (
            <button key={q.label} type="button" className="woori-amt__btn-reset woori-amt__quick" style={at(20 + i * 65.6, kpY(KP_QUICK_TOP, sq))} onClick={() => quick(q.add)}>
              <span className="woori-amt__quick-label" style={q.label === '전액' ? { letterSpacing: '-0.005em' } : undefined}>
                {q.label}
              </span>
            </button>
          ))}
          {AMOUNT_KEYS.map((key) => {
            const top = 506 + key.row * 52
            return (
              <button
                key={key.k}
                type="button"
                className="woori-amt__btn-reset woori-amt__key"
                style={{ left: key.col * 120, top: kpY(top, sq), ...(sq ? { height: 52 * kpF } : {}) }}
                onClick={() => typeKey(key.k)}
                aria-label={key.k}
              >
                <span className="woori-amt__key-label" style={{ ...at(key.l - key.col * 120, (AMOUNT_ROW_TOP[key.row] - top) * kpF, key.dy), letterSpacing: key.ls }}>
                  {key.k}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            className="woori-amt__btn-reset woori-amt__key"
            style={{ left: 240, top: kpY(662, sq), ...(sq ? { height: 52 * kpF } : {}) }}
            onClick={() => typeKey('<')}
            aria-label="지우기"
          >
            <Icon name="send-b.keypad-backspace" x={48} y={14.333 * kpF} w={24} h={24} color="#33353a" />
          </button>
          <WooriButton
            className="woori-amt__kp-confirm"
            style={at(16, 730.333)}
            disabled={!amount}
            data-pressed={s?.confirmPressed ? '' : undefined}
            onPointerUp={onConfirmUp}
            onClick={onConfirm}
          >
            {ripple && (
              <span
                key={ripple.id}
                className="woori-amt__ripple"
                style={
                  {
                    left: ripple.x - ripple.r,
                    top: ripple.y - ripple.r,
                    width: ripple.r * 2,
                    height: ripple.r * 2,
                    '--woori-amt-ripple-ms': `${Math.round(ripple.r / 1.65)}ms`,
                  } as CSSProperties
                }
              />
            )}
            <span>확인</span>
          </WooriButton>
        </div>
      )}

      {/* 폼 (아래끝 기준 층): 통장표기 묶음 · 유의사항 · [추가이체][다음].
          통장표기 시트가 떠 있는 동안은 키보드가 뜨기 전 높이(stableH) 기준 — 셸이 줄어도 묶음이 머리·계좌 줄 위로 올라오지 않는다
          (단추는 키보드 뒤로 가려진다. 키보드가 없으면 CSS 그대로 — h 는 정수 반올림이라 1dp 넘게 줄었을 때만. 프레임 모드는 재지 않아 늘 CSS) */}
      {form && data && (
        <div className="woori-amt__layer woori-amt__layer--bottom" style={labelEdit && stableH - pageH > 1 ? { top: stableH - WOORI_VIDEO_PAGE_H } : undefined}>
          {fields !== 'none' && (
            <div
              className={'woori-amt__layer' + (fields === 'anim' ? ' woori-amt__fields--in' : '')}
              style={s ? ({ '--woori-amt-fields-delay': '0ms' } as CSSProperties) : undefined}
            >
              <p className="woori-amt__t" style={txt(19.91, 493, 16, 500, { color: '#38383a' })}>
                받는 분 통장표기
              </p>
              <p className="woori-amt__t woori-amt__label-val" style={{ ...txt(0, 494, 15, 600, { color: '#707275' }, -0.25), left: undefined, right: 44 }}>
                {labelValue('recipient', data)}
              </p>
              <Icon name="history.chevron-right" x={328.7} y={492.45} w={16} h={16} color="#9a9ca0" />
              <p className="woori-amt__t" style={txt(19.94, 548, 16, 500, { color: '#39393b' }, -0.25)}>
                내 통장표기
              </p>
              <p className="woori-amt__t woori-amt__label-val" style={{ ...txt(0, 548, 15, 600, { color: '#707275' }), left: undefined, right: 44 }}>
                {labelValue('my', data)}
              </p>
              <Icon name="history.chevron-right" x={328.7} y={546.7} w={16} h={16} color="#9a9ca0" />
              <div className="woori-amt__line" style={{ left: 20, top: 588, width: 320, background: '#ebebeb' }} />
              <div className="woori-amt__row" style={txt(151.78, 606, 14, 600, { color: '#717376', letterSpacing: '0.005em' })} onClick={wooriTodo}>
                <span>더보기</span>
                <Icon name="history.chevron-down-12" w={12} h={12} inline color="#717376" style={{ marginLeft: 5.4, marginTop: 1.2 }} />
              </div>
              {/* 통장표기 줄 › = 편집 시트 (설계 — 줄 전체가 누름 상자, 보이지 않음) */}
              {!s && (
                <>
                  <button type="button" className="woori-amt__btn-reset woori-amt__hit" style={{ top: 475, height: 52 }} aria-label="받는 분 통장표기 바꾸기" onClick={() => openLabel('recipient')} />
                  <button type="button" className="woori-amt__btn-reset woori-amt__hit" style={{ top: 529, height: 52 }} aria-label="내 통장표기 바꾸기" onClick={() => openLabel('my')} />
                </>
              )}
            </div>
          )}
          <p className="woori-amt__t" style={txt(120.55, 689, 14, 600, { color: '#6f7174' }, 0.25)} onClick={wooriTodo}>
            이체 유의사항 및 안내
          </p>
          <div className="woori-amt__line" style={{ ...at(120.32, 706.35), width: 119.34, height: 1.36, background: '#6f7174' }} />
          <WooriButton variant="secondary" className="woori-amt__btn" style={{ ...at(16, 726.667), width: 160 }} onClick={wooriTodo}>
            추가이체
          </WooriButton>
          <WooriButton
            className="woori-amt__btn"
            style={{ ...at(184, 726.667), width: 160, ...(s?.next === 'released' ? ({ scale: 0.95 } as CSSProperties) : {}) }}
            data-pressed={s?.next === 'pressed' ? '' : undefined}
            onClick={onNext}
          >
            다음
          </WooriButton>
        </div>
      )}

      {/* 중복 경고 시트 */}
      {dupMode && (
        <WooriSheet
          open={dupMode === 'open'}
          appear={s ? !!s.sheetAnim : true}
          motion={SHEET_MOTION}
          className="woori-amt__dup-sheet"
          label="중복 이체 경고"
          onOpened={() => setBusy(false)}
          onClosed={() => {
            setDup(null)
            setBusy(false)
          }}
          onBack={() => setDup('closing')}
        >
          <button type="button" className="woori-amt__btn-reset woori-amt__sheet-x" style={at(315.8, 405.95 - DUP_TOP)} aria-label="닫기" onClick={() => setDup('closing')}>
            <Icon name="history.close-x" x={0} y={0} w={24} h={24} color="#3b3a3b" />
          </button>
          <div className={'woori-amt__warn' + (s && !s.sheetAnim ? '' : ' woori-amt__warn--anim')}>
            <img className="woori-amt__warn-tri" src={artSrc('send-b.warning-triangle')} alt="" />
            <img className="woori-amt__warn-bar" src={artSrc('send-b.warning-bang-bar')} alt="" />
            <img className="woori-amt__warn-dot" src={artSrc('send-b.warning-bang-dot')} alt="" />
          </div>
          {(tk?.display.duplicateTitle ?? '오늘 같은 내용으로 보냈어요!\n한 번 더 보낼까요?').split('\n').map((line, i) => (
            <p key={i} className="woori-amt__center" style={{ ...at(0, [532, 563][i] - DUP_TOP), fontSize: 22, fontWeight: 600 }}>
              {line}
            </p>
          ))}
          <div className="woori-amt__ago" style={at(20, 621.333 - DUP_TOP)} />
          <p className="woori-amt__center" style={{ ...at(0, 648 - DUP_TOP, -0.25), fontSize: 15, fontWeight: 600, letterSpacing: '-0.005em', fontVariantNumeric: 'tabular-nums' }}>
            {s ? '6분 전' : (tk?.display.duplicateAgo ?? '')}
          </p>
          <WooriButton
            variant="secondary"
            className="woori-amt__btn"
            style={
              {
                ...at(16, 726.667 - DUP_TOP),
                width: 102.33,
                '--woori-btn-bg': 'var(--woori-bg-gray)',
                '--woori-btn-fg': '#45474b',
                '--woori-btn-bg-pressed': '#e3e4e8',
              } as CSSProperties
            }
            onClick={() => setDup('closing')}
          >
            아니요
          </WooriButton>
          <WooriButton
            className="woori-amt__btn"
            style={{ ...at(126.33, 726.667 - DUP_TOP), width: 217.67, paddingTop: 20.333 }}
            data-pressed={s?.yesPressed ? '' : undefined}
            onClick={() => {
              setDup(null)
              openPassword()
            }}
          >
            네, 보낼게요
          </WooriButton>
        </WooriSheet>
      )}

      {/* 계좌 비밀번호 시트 (섞인 키패드) */}
      {pwShown && (
        <WooriSheet
          open
          appear={!s}
          motion={SHEET_MOTION}
          dim={0.4392}
          className="woori-amt__pw-sheet"
          style={WOORI_BOTTOM_FIX}
          label="계좌 비밀번호"
          onBack={closePassword}
        >
          <button
            type="button"
            className="woori-amt__btn-reset woori-amt__sheet-x"
            style={at(315.8, 289.76 - PW_TOP)}
            aria-label="닫기"
            onClick={closePassword}
          >
            <Icon name="history.close-x" x={0} y={0} w={24} h={24} color="#3b3a3b" />
          </button>
          <p className="woori-amt__center" style={{ ...at(0, 348 - PW_TOP, 0.25), fontSize: 22, fontWeight: 700 }}>
            계좌 비밀번호
          </p>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={'woori-amt__dot' + (i < dotCount ? ' woori-amt__dot--on' : '')} style={at(138 + i * 24, 451.06 - PW_TOP)} />
          ))}
          <p
            className={'woori-amt__center' + (pwError ? ' woori-amt__pw-error' : '')}
            style={{ ...at(0, 512 - PW_TOP), fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em', color: pwError ? undefined : '#717274' }}
            onClick={pwError ? undefined : wooriTodo}
          >
            {pwError ?? '비밀번호가 기억나지 않아요'}
          </p>
          {!pwError && <div className="woori-amt__line" style={{ ...at(104.54, 527.64 - PW_TOP), width: 150.89, height: 1.02, background: '#717274' }} />}
          {pwDigits.map((d, i) => {
            const col = i % 3
            const row = Math.floor(i / 3)
            return <PwKey key={`k${i}`} col={col} row={row} onPress={() => onPinKey(String(d))} label={String(d)} />
          })}
          <PwKey col={0} row={3} onPress={() => onPinKey('clear')} label="전체삭제" />
          <PwKey col={1} row={3} onPress={() => onPinKey('9')} label="9" />
          <PwKey col={2} row={3} onPress={() => onPinKey('<')} label="<" />
        </WooriSheet>
      )}

      {/* 통장표기 편집 시트 (설계 — 영상에 없음): 10자(코드 포인트 — maxLength 는 UTF-16 이라 이모지 10개가 '10/20' 에서 막혔다), 비우면 기본값.
          글자는 시스템 키보드 */}
      {labelEdit && data && (
        <WooriSheet
          open={labelEdit.open}
          motion={SHEET_MOTION}
          className="woori-amt__label-sheet"
          label={labelEdit.field === 'recipient' ? '받는 분 통장표기' : '내 통장표기'}
          onOpened={() => labelInput.current?.focus({ preventScroll: true })}
          onClosed={() => setLabelEdit(null)}
          onBack={closeLabel}
        >
          <button type="button" className="woori-amt__btn-reset woori-amt__sheet-x" style={at(315.8, 31.95)} aria-label="닫기" onClick={closeLabel}>
            <Icon name="history.close-x" x={0} y={0} w={24} h={24} color="#3b3a3b" />
          </button>
          <p className="woori-amt__t" style={txt(20, 36, 22, 700)}>
            {labelEdit.field === 'recipient' ? '받는 분 통장표기' : '내 통장표기'}
          </p>
          <input
            ref={labelInput}
            className="woori-amt__label-input"
            type="text"
            value={labelDraft}
            placeholder={labelEdit.field === 'recipient' ? data.from.ownerName : data.to.holderName}
            enterKeyHint="done"
            aria-label={labelEdit.field === 'recipient' ? '받는 분 통장표기' : '내 통장표기'}
            onChange={(e) => setLabelDraft([...e.target.value].slice(0, LABEL_MAX).join(''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveLabel()
            }}
          />
          <p className="woori-amt__label-count">
            {[...labelDraft].length}/{LABEL_MAX}
          </p>
          <WooriButton className="woori-amt__btn" style={{ ...at(16, 252 - 74), width: 328 }} onClick={saveLabel}>
            확인
          </WooriButton>
        </WooriSheet>
      )}

      {/* 오류 안내 시트 (설계): 출금가능금액 부족 등. 금액 오류면 닫은 뒤 키패드로 */}
      {alert && (
        <WooriSendAlert
          text={alert.text}
          open={alert.open}
          onClose={() => setAlert((a) => (a ? { ...a, open: false } : a))}
          onClosed={() => {
            if (alert.keypad) reopenKeypad()
            setAlert(null)
          }}
        />
      )}

      {spinner && (
        <WooriOverlay>
          <div className="woori-amt__spinner-top">
            <WooriSpinner />
          </div>
        </WooriOverlay>
      )}
    </div>
  )
}

/**
 * 이체 오류 안내 시트 (설계 — 영상에 없음). window.alert 는 APK 에서 영어 'OK' 단추의 안드로이드 기본 대화상자가 되므로 대신 쓴다.
 * 중복 경고 시트와 같은 모양(⚠ · 22dp 둥근 위 모서리 · 같은 열림 곡선) + 문구(줄 수만큼 시트가 길어짐) + [확인]. 폰 뒤로 = [확인].
 * 확인 화면([이체] 오류)도 쓴다. open 이 false 가 되면 닫히고, 다 닫히면 onClosed.
 */
export function WooriSendAlert({ text, open, onClose, onClosed }: { text: string; open: boolean; onClose: () => void; onClosed: () => void }) {
  return (
    <WooriSheet open={open} motion={SHEET_MOTION} className="woori-amt__alert" label="알림" onClosed={onClosed} onBack={onClose}>
      <div className="woori-amt__warn" aria-hidden>
        <img className="woori-amt__warn-tri" src={artSrc('send-b.warning-triangle')} alt="" />
        <img className="woori-amt__warn-bar" src={artSrc('send-b.warning-bang-bar')} alt="" />
        <img className="woori-amt__warn-dot" src={artSrc('send-b.warning-bang-dot')} alt="" />
      </div>
      <p className="woori-amt__alert-text" role="alert">
        {text}
      </p>
      <WooriButton className="woori-amt__alert-ok" onClick={onClose}>
        확인
      </WooriButton>
    </WooriSheet>
  )
}

/** 비밀번호 키 한 칸 (120 × 65dp). 누른 칸 회색은 CSS :active — 위치를 어디에도 남기지 않는다 */
function PwKey({ col, row, label, onPress }: { col: number; row: number; label: string; onPress: () => void }) {
  const cellTop = 273 + row * 65 // 시트 기준 (앱 529.667 + 65·row)
  const relTop = (y: number) => y - PW_TOP - cellTop
  let inner
  if (label === '<') inner = <Icon name="send-b.keypad-backspace" x={48} y={relTop(750.667)} w={24} h={24} color="#33353a" />
  else if (label === '전체삭제')
    inner = (
      <span className="woori-amt__key-label" style={{ ...at(32.31, relTop(756)), fontSize: 16, fontWeight: 600 }}>
        전체삭제
      </span>
    )
  else
    inner = (
      <span className="woori-amt__key-label" style={at(DIGIT_IN_COL[label] ?? 52, relTop(PW_ROW_TOP[row]), PW_ROW_DY[row])}>
        {label}
      </span>
    )
  return (
    <button
      type="button"
      className="woori-amt__btn-reset woori-amt__pw-key"
      style={{ left: col * 120, top: cellTop }}
      aria-label={label === '<' ? '지우기' : label === '전체삭제' ? '전체삭제' : '숫자'}
      onClick={onPress}
    >
      {inner}
    </button>
  )
}
