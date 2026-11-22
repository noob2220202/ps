// WooriHistory — /history 거래내역조회 (spec/history.md · history.json, 1부 + 2부)
//
// 구조 (앱 dp, 페이지 스크롤 = .woori-layer__scroll 이 문서 전체를 스크롤한다 — 9.1):
//   머리 52 (WooriHeader, 겹침 자리 = 스크롤 밖 고정) · 계좌 영역 84–349.333 (배지·로고·계좌·잔액·[모으기][이체]·띠)
//   필터·기간 블록 373.333–457.333 (84dp) — scrollTop ≥ 321.333 이면 겹침 자리 52–136 에 붙은 복제, 제자리는 빈 흰 칸 (JS 토글)
//   기간 내 합계 457.667 · 구분선 533.333 · 월 머리글 기준선 580 · 행 (날짜 기준선 635.25, 같은 날 +117.1667 · 날짜 바뀜 +142.1667 · 달 바뀜 +198)
// 들어오기(3.1): 흰 페이지+스피너 → 제목·관리 → 스켈레톤 → ‹ + 반짝임 → 내용(토글 끔·아이콘 없음) → 토글 켬 1단계 → 손잡이·아이콘 → 스피너 끔
//   (v2 1차 단계 시각). 조회조건 시트(2.5·3.4–3.6) → [적용하기] = 맨 위로 + 닫힘 + 다시 불러오기(3.7).
// 목록은 한 번에 다 받는다 (9.3 — 더보기·무한 스크롤 없음). 오버레이 스크롤바는 앱이 그린다 (9.5).
// 행 탭 → 상세(rise). 목록 위 흰 막(상세 3.1·3.3: 0 → 0.69 linear 330ms / 0.69 → 0 linear 271ms +30ms)은 여기서 그린다.
// 조회조건 (영상은 늘 3개월·최신순 — 나머지는 설계값, 스펙 4.4 · 8절): 조회기간 이번달·3개월·6개월·1년·직접입력(시작일·종료일 type=date),
//   상세조건조회 ⌄ 펼침 = 정렬 최신순·과거순. 고른 값은 [적용하기] 때 적용 → 다시 불러오기, 필터 줄('1년 · 입금 · 과거순')·기간 줄이 바뀐다.
//   [초기화] = 3개월·전체·최신순. 펼침·직접입력 칸은 시트를 위로 키운다 (기본 모양은 영상 그대로 — 프레임 shot 과 같다).
//   필터 줄 글자 자리는 영상 값('3개월 · ? · 최신순')이면 영상 좌표, 다른 글자면 같은 오른끝에 맞춘 줄.
// 폰 뒤로 버튼: 시트가 열려 있으면 닫기, 아니면 ‹ 와 같이 홈 (스펙 4.1 'OS 뒤로').
// 기다리는 이동(‹ 676ms · [이체] 645ms · 출금 행 21ms)은 하나만 — 그 사이 행·시트·다른 이동을 누르면 앞의 것은 버린다 (언마운트·덮임도).
// 계좌번호 복사 아이콘 = 클립보드 복사('우리은행 1002-…', 홈과 같은 글자) + 토스트 (설계). 오버레이 스크롤바는 실제 앱에서 스크롤 상자 높이로 잰다 (키가 다른 화면).
//   실제 앱은 스크롤되지 않는 문서와 앱이 옮긴 자리([적용하기] 의 맨 위로 · 합계 닫힘의 끝 맞춤)에 스크롤바를 띄우지 않는다 (손가락 스크롤만).
// 실제 앱만: 문서 높이는 내용 끝까지(영상 셸 800.667 바닥 없음), 긴 이름(통장표기)은 금액 앞에서 말줄임 (WooriHistory.css).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { artSrc } from './WooriArt.ts'
import { wooriApi, type Account, type TxItem, type TxOrder, type TxPage, type TxPeriod, type TxTypeFilter } from './WooriApi.ts'
import { WooriButton } from './WooriButton.tsx'
import { useWooriBack, wooriCopy, wooriLiveApp, wooriTodo, wooriToast } from './WooriEnv.ts'
import { WooriHeader } from './WooriHeader.tsx'
import { wooriPlace, wooriScrollTo } from './WooriLayout.ts'
import { useWooriStages } from './WooriLoadingPage.tsx'
import { isFrameMode, useBackTo, useWooriLayer, useWooriNavigate, type WooriTransition } from './WooriNav.ts'
import { WooriOverlay, WooriSheet } from './WooriSheet.tsx'
import { useShotReady, useShotState } from './WooriShot.ts'
import { WooriSpinner } from './WooriSpinner.tsx'
import './WooriHistory.css'

/* ───────────────────────── 값 (spec/history.md) ───────────────────────── */

/** 들어오기 단계 (흰 페이지 첫 프레임부터 ms, v2 1차 — 3.1 표):
 *  1 제목·관리 527 · 2 스켈레톤 560 · 3 ‹(+반짝임 42ms 뒤) 652 · 4 내용 1488 · 5 토글 켬 1단계 1664 · 6 손잡이·아이콘 1756 · 7 스피너 끔 2241 */
const LOAD_TIMES = [527, 560, 652, 1488, 1664, 1756, 2241] as const
const STAGE_DONE = 7
/** 이체 완료 [확인] 에서 올 때 (v2 완료→ 열, 흰 페이지 기준 ms): 흰 페이지가 스피너 없이 먼저, 스피너 +605.
 *  완료 화면이 navigate state { from: 'done' } 를 넘기면 쓴다 (안 넘기면 홈 경로 값) */
const LOAD_TIMES_DONE = [812, 913, 946, 1775, 1874, 1992, 2431] as const
const DONE_SPINNER_AT = [605] as const
/** 다시 불러오기 (3.7): 닫힘 시작 +500ms 채움, +470ms 스피너 끔 */
const RELOAD_FILL_MS = 500
const RELOAD_SPIN_MS = 970
/** [이체] → 이체 흰 페이지 (3.8 v2 +645ms) · ‹ → 홈 (+676ms) */
const TRANSFER_GO_MS = 645
const BACK_GO_MS = 676

/** 상세 열기 (history-detail 3.1) */
const DETAIL_RISE: WooriTransition = {
  kind: 'rise',
  dy: 100,
  duration: 265,
  easing: 'cubic-bezier(0, 0, 0.2, 1)',
  fadeDuration: 265,
  fadeEasing: 'cubic-bezier(0, 0, 0.2, 1)',
  fadeDelay: 0,
}

/** 시트 곡선 (3.4 · 3.6) */
const SHEET_MOTION = {
  open: { duration: 256, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', dimDuration: 300, dimEasing: 'linear', dimDelay: 31 },
  close: { duration: 249, easing: 'cubic-bezier(0.32, 0, 0.67, 0)', dimDuration: 300, dimEasing: 'linear', dimDelay: 4 },
} as const

/** 붙는 기준 = 블록 위끝 373.333 − 머리 52 */
const STICK_AT = 321.333
const BLOCK_TOP = 373.333
/** 행 간격 (9.2) */
const SAME_DAY = 117.1667
const DAY_CHANGE = 142.1667
const MONTH_HEADER_GAP = 142.87
const HEADER_TO_ROW = 55.25
const DIVIDER_BELOW_DATE = 96.15
const FIRST_MONTH_BASELINE = 580
/** 오버레이 스크롤바 (9.5): 영상 셸 800.667 에서 트랙 9.7 부터 780.667 (아래 10.3 남김) — 실제 앱은 보이는 높이 − 20 */
const SB_TRACK_TOP = 9.7
const SB_TRACK = 780.667
const VIEWPORT_H = 800.667

/* ───────────────────────── shot 상태 ───────────────────────── */

interface HistShot {
  type: TxTypeFilter
  /** 들어오기 단계 (기본 7 = 다 그림) */
  stage?: number
  spinner?: boolean
  /** [적용하기] 뒤: 필터 줄만 새 값, 그 아래 비움 */
  reload?: boolean
  sheet?: TxTypeFilter
  applyPressed?: number
  transferPressed?: boolean
  /** dp */
  scrollTop?: number
  scrollbar?: boolean
}

const px = (v: number) => Math.round(((v * 11) / 16) * 10000) / 10000

const SHOTS_BASE: Record<string, HistShot> = {
  'loading-blank': { type: 'all', stage: 0, spinner: true },
  'loading-title': { type: 'all', stage: 1, spinner: true },
  'loading-skeleton': { type: 'all', stage: 3, spinner: true },
  render: { type: 'all', stage: 4, spinner: true },
  'render-toggle': { type: 'all', stage: 5, spinner: true },
  'all-top-spinner': { type: 'all', stage: 6, spinner: true },
  'spinner-off': { type: 'all' },
  'top-344-all': { type: 'all' },
  'top-344': { type: 'all' },
  'all-top': { type: 'all' },
  'reload-spinner': { type: 'in', reload: true, spinner: true },
  'reload-spinner-withdraw': { type: 'out', reload: true, spinner: true },
  'deposit-top': { type: 'in' },
  'filter-deposit-spinner': { type: 'in', spinner: true },
  'filter-deposit-top': { type: 'in' },
  'withdraw-top': { type: 'out' },
  'filter-withdraw-spinner': { type: 'out', spinner: true },
  'top-344-withdraw': { type: 'out' },
  'leave-spinner': { type: 'out', spinner: true },
  'row-tap-spinner': { type: 'out', spinner: true, scrollTop: px(64.028), scrollbar: true },
  'back-spinner': { type: 'out', spinner: true, scrollTop: px(64.028) },
  'transfer-pressed': { type: 'out', spinner: true, transferPressed: true },
  'transfer-wait': { type: 'out', spinner: true },
  'transfer-spinner': { type: 'out', spinner: true },
  'render-342': { type: 'all', stage: 4, spinner: true },
  'top-342-all': { type: 'all' },
  'top-342-headsup': { type: 'all' },
  'sheet-all': { type: 'all', sheet: 'all' },
  'sheet-deposit': { type: 'in', sheet: 'in' },
  'sheet-withdraw': { type: 'in', sheet: 'out' },
  'sheet-apply-pressed': { type: 'all', sheet: 'in', applyPressed: 0.995 },
  'sheet-apply-pressed-top': { type: 'in', sheet: 'out', applyPressed: 1 },
  'withdraw-scrolled-64': { type: 'out', scrollTop: px(64.028) },
}

/** 2부 스크롤 상태 (scrollTop frame px — history.json) */
const SCROLL_SHOTS: Record<string, number> = {
  'all-scroll': 2109.224,
  'all-scrolled-102': 101.847,
  'deposit-scroll': 2382.136,
  'deposit-scrolled-1991': 1991.497,
  'deposit-scrolled-2376': 2376.827,
  'deposit-scrolled-3781': 3781.704,
  'deposit-scrolled-4471': 4470.072,
  'withdraw-scroll': 6815.731,
  'withdraw-scrolled-10194': 10192.036,
  'deposit-scroll-drag1': 231.723,
  'deposit-scroll-pause-318': 318.1,
  'deposit-scroll-drag2': 434.949,
  'deposit-scroll-pause-472': 471.754,
  'deposit-scroll-drag3': 960.99,
  'deposit-scroll-pause-1594': 1594.025,
  'deposit-scroll-drag4': 1705.047,
  'deposit-scroll-pause-1754': 1753.482,
  'deposit-scroll-drag5': 2053.071,
  'deposit-scroll-pause-2351': 2350.176,
  'deposit-scroll-drag6': 2787.357,
  'deposit-scroll-pause-3223': 3222.289,
  'deposit-scroll-drag7': 3581.465,
  'deposit-scrolled': 3730.288,
  'withdraw-scroll-drag1': 173.064,
  'withdraw-scroll-pause-329': 328.761,
  'withdraw-scroll-drag2': 576.012,
  'withdraw-scroll-pause-738': 738.025,
  'withdraw-scroll-drag3': 829.619,
  'withdraw-scroll-pause-911': 911.544,
  'withdraw-scroll-drag4': 1002.613,
  'withdraw-scroll-pause-1041': 1040.912,
  'withdraw-scroll-drag5': 1888.237,
  'withdraw-scroll-pause-4058': 4056.994,
  'withdraw-scroll-drag6': 5023.158,
  'withdraw-scroll-drag7': 2988.662,
}

const HISTORY_SHOTS: Readonly<Record<string, HistShot>> = {
  ...SHOTS_BASE,
  ...Object.fromEntries(
    Object.entries(SCROLL_SHOTS).map(([id, top]) => [
      id,
      { type: id.startsWith('all') ? 'all' : id.startsWith('deposit') ? 'in' : 'out', scrollTop: px(top), scrollbar: true } satisfies HistShot,
    ]),
  ),
}

/* ───────────────────────── 목록 배치 ───────────────────────── */

const r4 = (v: number) => Math.round(v * 10000) / 10000

interface RowPos {
  item: TxItem
  /** 날짜 줄 기준선 (앱 dp, page) */
  base: number
}

interface ListLayout {
  rows: RowPos[]
  months: Array<{ text: string; base: number }>
  dividers: number[]
  end: number
}

function dayOf(item: TxItem) {
  return item.occurredAt.slice(0, 10)
}

function layoutList(items: readonly TxItem[], offset: number): ListLayout {
  const rows: RowPos[] = []
  const months: Array<{ text: string; base: number }> = []
  const dividers: number[] = []
  let prev: TxItem | null = null
  let base = 0
  for (const item of items) {
    if (!prev) {
      const mb = FIRST_MONTH_BASELINE + offset
      months.push({ text: item.display.month, base: mb })
      base = mb + HEADER_TO_ROW
    } else if (item.display.month !== prev.display.month) {
      dividers.push(base + DIVIDER_BELOW_DATE)
      const mb = base + MONTH_HEADER_GAP
      months.push({ text: item.display.month, base: mb })
      base = mb + HEADER_TO_ROW
    } else if (dayOf(item) !== dayOf(prev)) {
      dividers.push(base + DIVIDER_BELOW_DATE)
      base += DAY_CHANGE
    } else {
      base += SAME_DAY
    }
    rows.push({ item, base: r4(base) })
    prev = item
  }
  return { rows, months, dividers, end: rows.length ? base + 57.75 + 40 : 600 + offset }
}

const place = (x: number, y: number): CSSProperties => wooriPlace(x, r4(y))
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

/** 날짜 줄 '11월 21일 · 11:02:40' → [날짜, 시각] */
function splitDateLine(s: string): [string, string] {
  const i = s.lastIndexOf('·')
  return i < 0 ? [s, ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()]
}

/* ───────────────────────── 화면 ───────────────────────── */

type VeilPhase = 'none' | 'in' | 'out'

export default function WooriHistory() {
  const shot = useShotState('history', HISTORY_SHOTS)
  const s = shot?.state
  const go = useWooriNavigate()
  const goHome = useBackTo('/home')
  const { top } = useWooriLayer()
  const { search, state: navState } = useLocation()
  const fromDone = (navState as { from?: string } | null)?.from === 'done'

  const [account, setAccount] = useState<Account | null>(null)
  const [page, setPage] = useState<TxPage | null>(null)
  const [items, setItems] = useState<TxItem[] | null>(null)
  /** 적용된 조회조건 (거래구분 · 조회기간 · 정렬 · 직접입력 날짜) */
  const [query, setQuery] = useState<HistQuery>(() => (s ? { ...DEFAULT_QUERY, type: s.type } : initialQuery(search)))
  const type = query.type
  const queryKey = queryKeyOf(query)
  /** 지금 목록이 어느 조회조건으로 받은 것인지 */
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  /** 오늘 (서버 시계) 'YYYY-MM-DD' — 직접입력 날짜 칸의 max·min. 직접입력 응답의 range.toDate 는 고른 종료일이라 오늘이 아니다 */
  const [today, setToday] = useState<string | null>(null)
  const [filled, setFilled] = useState(true)
  const [busySpinner, setBusySpinner] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(s?.sheet != null)
  /** 시트에서 고르는 중인 값 ([적용하기] 전) */
  const [pending, setPending] = useState<HistQuery>(() => ({ ...query, type: s?.sheet ?? type }))
  const [detailOpen, setDetailOpen] = useState(false)
  const [stuck, setStuck] = useState(false)
  const [balanceShown, setBalanceShown] = useState(true)
  const [sumOpen, setSumOpen] = useState(false)
  const [applyHeld, setApplyHeld] = useState(false)
  const [veil, setVeil] = useState<VeilPhase>('none')
  const [prevTop, setPrevTop] = useState(top)
  if (top !== prevTop) {
    setPrevTop(top)
    if (top && veil === 'in') setVeil('out')
  }

  const stage = useWooriStages(fromDone ? LOAD_TIMES_DONE : LOAD_TIMES, { shotStage: s ? (s.stage ?? STAGE_DONE) : null })
  const doneSpin = useWooriStages(DONE_SPINNER_AT, { start: fromDone, shotStage: s ? 1 : null })
  const rootRef = useRef<HTMLDivElement>(null)
  const sbRef = useRef<HTMLDivElement>(null)
  /** 앱이 스스로 옮긴 스크롤 자리 — 그 자리의 스크롤 이벤트 한 번은 스크롤바 없이 (실제 앱, onScroll) */
  const quietTop = useRef<number | null>(null)
  const timers = useRef<number[]>([])
  /** 기다리는 이동 하나 (to = 갈 곳) */
  const leave = useRef<{ to: string; id: number } | null>(null)
  const topRef = useRef(top)
  useEffect(() => {
    topRef.current = top
  }, [top])

  // 데이터: 계좌 + 목록 (cursor 를 끝까지 따라 받아 합친다)
  const load = useCallback(async (q: HistQuery, needToday: boolean, signal?: AbortSignal) => {
    const accounts = await wooriApi.getAccounts(signal)
    const acct = accounts[0]
    let first: TxPage | null = null
    const all: TxItem[] = []
    let cursor: string | null = null
    const custom = q.period === 'custom' ? { from: q.from, to: q.to } : {}
    for (let i = 0; i < 50; i++) {
      const p: TxPage = await wooriApi.getTransactions(acct.id, { type: q.type, period: q.period, order: q.order, ...custom, cursor, limit: 100 }, signal)
      first ??= p
      all.push(...p.items)
      cursor = p.nextCursor
      if (!cursor) break
    }
    // 오늘 = 직접입력이 아닌 응답의 toDate. 직접입력부터 열었으면(URL — 오늘을 아직 모름) 이번달 한 건으로 묻는다 (실패해도 목록은 그대로 — 날짜 칸 max 만 없음)
    let day = q.period === 'custom' ? null : (first as TxPage).range.toDate
    if (!day && needToday) day = await wooriApi.getTransactions(acct.id, { period: 'thisMonth', limit: 1 }, signal).then((p) => p.range.toDate, () => null)
    return { acct, first: first as TxPage, all, day }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    const key = queryKeyOf(query)
    load(query, today == null, ac.signal)
      .then(({ acct, first, all, day }) => {
        setAccount(acct)
        setPage(first)
        setItems(all)
        setLoadedKey(key)
        if (day) setToday(day)
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        console.error('[history]', e)
        wooriToast('거래내역을 불러오지 못했어요')
        setLoadedKey(key)
      })
    return () => ac.abort()
    // query 는 queryKey 가 같으면 같은 조건이다 (today 는 물을지 말지만 정한다 — 바뀌어도 다시 받지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, queryKey])

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      if (leave.current) window.clearTimeout(leave.current.id)
    },
    [],
  )
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  /** 기다리던 이동을 버린다 (다른 데로 갈 때) */
  const cancelLeave = () => {
    if (!leave.current) return
    window.clearTimeout(leave.current.id)
    leave.current = null
    setBusySpinner(false)
  }
  /** 스피너를 띄우고 ms 뒤에 이동. 같은 곳으로 또 누르면(폰 뒤로 연타 등) 그대로, 다른 곳이면 앞의 것을 버리고 새로 */
  const leaveLater = (to: string, fn: () => void, ms: number) => {
    if (leave.current?.to === to) return
    cancelLeave()
    setBusySpinner(true)
    const id = window.setTimeout(() => {
      leave.current = null
      setBusySpinner(false)
      // 그 사이 다른 페이지가 위에 왔으면(다른 이동 등) 가지 않는다
      if (topRef.current) fn()
    }, ms)
    leave.current = { to, id }
  }

  const scroller = () => findScroller(rootRef.current)

  // shot: 스크롤 위치
  const dataReady = account != null && items != null
  useLayoutEffect(() => {
    if (!s?.scrollTop || !dataReady) return
    const el = findScroller(rootRef.current)
    if (el) wooriScrollTo(el, s.scrollTop)
  }, [s, dataReady])
  useShotReady(shot != null && (dataReady || (s?.stage ?? STAGE_DONE) < 4))

  // 스크롤: 붙는 블록 · 스크롤바
  useEffect(() => {
    const el = findScroller(rootRef.current)
    if (!el || s) return
    const onScroll = () => {
      const st = el.scrollTop
      setStuck(st >= STICK_AT)
      const sb = sbRef.current
      if (!sb) return
      // 실제 앱: 스크롤되지 않는 문서(빈·짧은 목록 · 다시 불러오는 중)와 앱이 옮긴 자리([적용하기] 의 맨 위로 · 합계 닫힘의 끝 맞춤)에는
      // 스크롤바를 띄우지 않는다 (안드로이드 오버레이 스크롤바와 같게 — 손가락 스크롤만). 프레임 모드는 그대로
      const quiet = quietTop.current
      quietTop.current = null
      if (wooriLiveApp() && (el.scrollHeight - el.clientHeight < 1 || (quiet != null && Math.abs(st - quiet) < 1))) {
        sb.classList.remove('is-fading')
        sb.style.opacity = '0'
        return
      }
      const docH = el.scrollHeight
      const max = Math.max(1, docH - el.clientHeight)
      // 보이는 높이: 프레임 모드는 영상 셸 값, 실제 앱은 스크롤 상자 높이 (APK 는 상태바·내비 바를 뺀 640–900dp)
      const viewH = isFrameMode() ? VIEWPORT_H : el.clientHeight
      const track = viewH - (VIEWPORT_H - SB_TRACK)
      const len = (track * viewH) / docH
      sb.style.height = `${r4(len)}px`
      sb.style.translate = `0 ${r4(SB_TRACK_TOP + ((track - len) * Math.min(st, max)) / max)}px`
      sb.classList.remove('is-fading')
      sb.style.opacity = '1'
      void sb.offsetWidth
      sb.classList.add('is-fading')
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [s])

  const shotStuck = s?.scrollTop != null ? s.scrollTop >= STICK_AT : null
  const isStuck = shotStuck ?? stuck

  /* 동작 */
  const openSheet = () => {
    cancelLeave()
    setPending(query)
    setDetailOpen(query.order !== 'desc')
    setSheetOpen(true)
  }
  const apply = () => {
    let next = pending
    if (next.period === 'custom') {
      const from = next.from ?? ''
      const to = next.to ?? ''
      if (!from || !to) {
        wooriToast('시작일과 종료일을 골라 주세요')
        return
      }
      if (from > to) {
        wooriToast('시작일이 종료일보다 늦어요')
        return
      }
    } else next = { ...next, from: undefined, to: undefined }
    const el = scroller()
    if (el) {
      // 이 맨 위로는 스크롤바 없이 (이미 맨 위면 이벤트가 오지 않는다 — 다음 손가락 스크롤을 삼키지 않게)
      if (el.scrollTop > 0) quietTop.current = 0
      el.scrollTop = 0
    }
    setStuck(false)
    setSheetOpen(false)
    // 눌린 색은 내려가기 시작한 뒤 ≈33ms 까지 (3.5)
    setApplyHeld(true)
    later(() => setApplyHeld(false), 33)
    setBusySpinner(true)
    setFilled(false)
    setQuery(next)
    later(() => setFilled(true), RELOAD_FILL_MS)
    later(() => setBusySpinner(false), RELOAD_SPIN_MS)
  }
  const reset = () => setPending({ ...DEFAULT_QUERY, from: page?.range.fromDate, to: page?.range.toDate })
  const pickPeriod = (period: TxPeriod) =>
    setPending((p) => {
      if (period !== 'custom' || (p.from && p.to)) return { ...p, period }
      // 직접입력: 지금 기간으로 미리 채운다
      return { ...p, period, from: p.from ?? page?.range.fromDate, to: p.to ?? page?.range.toDate }
    })
  const closeSheet = () => setSheetOpen(false)
  // 기간 내 합계 펼침·닫힘: 닫혀서 문서가 줄면 스크롤 자리가 새 끝으로 당겨진다 → 그 자리의 스크롤 이벤트는 스크롤바 없이
  const sumFrom = useRef<number | null>(null)
  const toggleSum = () => {
    sumFrom.current = scroller()?.scrollTop ?? null
    setSumOpen((v) => !v)
  }
  useLayoutEffect(() => {
    const from = sumFrom.current
    sumFrom.current = null
    const el = findScroller(rootRef.current)
    if (from != null && el && Math.abs(el.scrollTop - from) >= 1) quietTop.current = el.scrollTop
  }, [sumOpen])
  const onTransfer = () => leaveLater('/send', () => go('/send'), TRANSFER_GO_MS)
  const onBack = () => leaveLater('/home', goHome, BACK_GO_MS)
  // 폰 뒤로 버튼: 시트는 WooriSheet onBack, 그 밖은 ‹ 와 같이 (들어오는 중 ‹ 가 아직 없어도)
  useWooriBack(top && !s ? onBack : null)
  const openRow = (item: TxItem) => {
    const open = () => {
      setBusySpinner(false)
      setVeil('in')
      go(`/history/${item.id}`, { transition: DETAIL_RISE, state: { type: item.type } })
    }
    if (item.type === 'out') leaveLater(`/history/${item.id}`, open, 21)
    else {
      cancelLeave()
      open()
    }
  }

  /* 그리기 값 */
  const showTitle = stage >= 1
  const showSkeleton = stage >= 2 && (stage < 4 || !dataReady)
  const showBack = stage >= 3
  const showContent = stage >= 4 && dataReady
  const iconsOn = stage >= 6
  const toggleStage = !showContent ? 0 : stage >= 6 ? 2 : stage >= 5 ? 1 : 0
  const fresh = loadedKey === queryKey
  const listShown = showContent && filled && !s?.reload && (s != null || fresh)
  const spinnerOn = s ? s.spinner === true : (stage < STAGE_DONE && (!fromDone || doneSpin >= 1)) || busySpinner || (dataReady && !fresh)
  const labels = { period: PERIOD_LABEL[query.period], type: typeLabel(type), order: ORDER_LABEL[query.order] }
  const sumExtra = sumOpen ? 64 : 0

  const layout = useMemo(() => layoutList(items ?? [], sumExtra), [items, sumExtra])
  // 문서 높이: 영상(프레임·shot)은 셸 800.667 이 바닥. 실제 앱은 내용 끝까지만 — 빈·짧은 목록이 흰 칸으로 스크롤되지 않게 (모자란 아래는 페이지 바탕)
  const docHeight = Math.max(wooriLiveApp() ? 0 : VIEWPORT_H, Math.ceil(listShown ? layout.end : 600))


  const block = (stuckCopy: boolean) => (
    <FilterBlock
      labels={labels}
      range={page?.range.text ?? ''}
      showPeriod={listShown}
      iconsOn={iconsOn}
      toggleStage={toggleStage}
      balanceShown={balanceShown}
      onFilter={openSheet}
      onToggle={() => setBalanceShown((v) => !v)}
      onSearch={wooriTodo}
      style={stuckCopy ? { left: 0, top: 52 } : place(0, BLOCK_TOP)}
      hidden={!stuckCopy && isStuck}
    />
  )

  return (
    <div ref={rootRef} className="woori-hi" style={{ height: docHeight }}>
      {showSkeleton && <Skeleton />}
      {showContent && account && (
        <>
          <AccountArea
            account={account}
            iconsOn={iconsOn}
            transferPressed={s?.transferPressed === true}
            onTransfer={onTransfer}
            onCopy={() => wooriCopy(`${account.bankName} ${account.number}`)}
            onTodo={wooriTodo}
          />
          {block(false)}
          {listShown && (
            <>
              <button type="button" className="woori-hi__sum" style={{ ...place(20, 457.667), height: 52 + sumExtra }} onClick={toggleSum}>
                <span className="woori-hi__sum-label">기간 내 합계</span>
                {iconsOn && <img className={'woori-hi__sum-chevron' + (sumOpen ? ' is-open' : '')} src="/woori/history/chevron-down.svg" alt="" />}
                {sumOpen && page && (
                  <span className="woori-hi__sum-detail">
                    <span>
                      입금 {page.summary.inCount}건<b>{won(page.summary.inSum)}</b>
                    </span>
                    <span>
                      출금 {page.summary.outCount}건<b>{won(page.summary.outSum)}</b>
                    </span>
                  </span>
                )}
              </button>
              <div className="woori-hi__line" style={place(20, 533.333 + sumExtra)} />
              <ListRows layout={layout} balanceShown={balanceShown} onOpen={openRow} />
              {items?.length === 0 && (
                <Text className="woori-hi__empty" style={place(0, 600 + sumExtra)}>
                  조회된 거래내역이 없어요
                </Text>
              )}
            </>
          )}
        </>
      )}
      <WooriOverlay>
        <WooriHeader
          className="woori-hi__header"
          title={showTitle ? '거래내역조회' : undefined}
          onBack={showBack ? onBack : undefined}
          rightText={showTitle ? '관리' : undefined}
          onRight={wooriTodo}
        />
        {showContent && isStuck && block(true)}
        {!s && <div ref={sbRef} className="woori-hi__scrollbar" aria-hidden />}
        {s?.scrollbar && s.scrollTop != null && <ShotScrollbar scrollTop={s.scrollTop} docHeight={docHeight} />}
        {veil !== 'none' && <div className={`woori-hi__veil woori-hi__veil--${veil}`} onAnimationEnd={() => veil === 'out' && setVeil('none')} aria-hidden />}
      </WooriOverlay>
      <WooriSheet
        open={sheetOpen}
        appear={!s}
        motion={SHEET_MOTION}
        label="조회조건 선택"
        className="woori-hi-sheet"
        style={{ height: SHEET_H + sheetExtra(pending, detailOpen), translate: '0 0.333px' }}
        onDimClick={closeSheet}
        onBack={closeSheet}
      >
        <FilterSheet
          value={pending}
          detailOpen={detailOpen}
          maxDate={today ?? undefined}
          onSelect={(t) => setPending((p) => ({ ...p, type: t }))}
          onPeriod={pickPeriod}
          onOrder={(order) => setPending((p) => ({ ...p, order }))}
          onDates={(from, to) => setPending((p) => ({ ...p, from, to }))}
          onToggleDetail={() => setDetailOpen((v) => !v)}
          onClose={closeSheet}
          onReset={reset}
          onApply={apply}
          applyPressScale={s?.applyPressed}
          applyHeld={applyHeld}
        />
      </WooriSheet>
      {spinnerOn && (
        <WooriOverlay>
          <div className="woori-hi__spinner">
            <WooriSpinner />
          </div>
        </WooriOverlay>
      )}
    </div>
  )
}

function findScroller(el: HTMLElement | null): HTMLElement | null {
  return el?.closest<HTMLElement>('.woori-layer__scroll') ?? null
}

/** 조회조건 (적용된 값 · 시트에서 고르는 값) */
interface HistQuery {
  type: TxTypeFilter
  period: TxPeriod
  order: TxOrder
  /** 직접입력 'YYYY-MM-DD' */
  from?: string
  to?: string
}

const DEFAULT_QUERY: HistQuery = { type: 'all', period: '3m', order: 'desc' }
const PERIODS: readonly TxPeriod[] = ['thisMonth', '3m', '6m', '1y', 'custom']
const PERIOD_LABEL: Record<TxPeriod, string> = { thisMonth: '이번달', '3m': '3개월', '6m': '6개월', '1y': '1년', custom: '직접입력' }
const ORDER_LABEL: Record<TxOrder, string> = { desc: '최신순', asc: '과거순' }
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function queryKeyOf(q: HistQuery): string {
  return [q.type, q.period, q.order, q.period === 'custom' ? `${q.from}~${q.to}` : ''].join('|')
}

/** URL ?type=all|in|out&period=thisMonth|3m|6m|1y|custom&from=&to=&order=desc|asc (없으면 영상 값 3개월·전체·최신순) */
function initialQuery(search: string): HistQuery {
  const p = new URLSearchParams(search)
  const t = p.get('type')
  const period = p.get('period') as TxPeriod | null
  const from = p.get('from') ?? undefined
  const to = p.get('to') ?? undefined
  const q: HistQuery = {
    type: t === 'in' || t === 'out' ? t : 'all',
    period: period && PERIODS.includes(period) ? period : '3m',
    order: p.get('order') === 'asc' ? 'asc' : 'desc',
  }
  if (q.period === 'custom') {
    if (from && to && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to) Object.assign(q, { from, to })
    else q.period = '3m'
  }
  return q
}

function typeLabel(t: TxTypeFilter) {
  return t === 'in' ? '입금' : t === 'out' ? '출금' : '전체'
}

/* ───────────────────────── 부품 ───────────────────────── */

function Text({ className, style, children }: { className: string; style: CSSProperties; children: ReactNode }) {
  return (
    <p className={'woori-hi__t ' + className} style={style}>
      {children}
    </p>
  )
}

function AccountArea({
  account,
  iconsOn,
  transferPressed,
  onTransfer,
  onCopy,
  onTodo,
}: {
  account: Account
  iconsOn: boolean
  transferPressed: boolean
  onTransfer: () => void
  /** 계좌번호 복사 (영상에 누르는 장면 없음 — 설계: '우리은행 1002-…' 를 클립보드로 + 토스트) */
  onCopy: () => void
  /** 영상에 없는 단추 (WON 통장 ⌄ · [모으기]) — 실제 앱에서만 토스트 */
  onTodo: () => void
}) {
  return (
    <>
      {account.badge && (
        <span className="woori-hi__badge" style={place(20, 84)}>
          {account.badge}
        </span>
      )}
      <img className="woori-hi__logo" src={artSrc('history.woori-logo-40')} alt="" style={place(20, 116.333)} />
      <div className="woori-hi__acct-name" style={place(72, 118)} onClick={onTodo}>
        <span>{account.product}</span>
        {iconsOn && <img src="/woori/history/chevron-down-small.svg" alt="" />}
      </div>
      <div className="woori-hi__acct-no" style={place(72, 141)}>
        <span>
          {account.bankShort} {account.number}
        </span>
        {iconsOn && <img src="/woori/history/copy.svg" alt="계좌번호 복사" onClick={onCopy} />}
      </div>
      <Text className="woori-hi__balance" style={place(0, 179.25)}>
        {won(account.balance)}
      </Text>
      <Text className="woori-hi__avail" style={place(0, 220)}>
        출금가능금액 {won(account.withdrawable)}
      </Text>
      <WooriButton variant="secondary" className="woori-hi__btn woori-hi__btn--collect" style={place(20, 261.333)} onClick={onTodo}>
        모으기
      </WooriButton>
      <WooriButton
        className="woori-hi__btn woori-hi__btn--transfer"
        style={{ ...place(184, 261.333), ...(transferPressed ? ({ '--woori-btn-press-scale': '1' } as CSSProperties) : {}) }}
        {...(transferPressed ? { 'data-pressed': '' } : {})}
        onClick={onTransfer}
      >
        이체
      </WooriButton>
      <div className="woori-hi__band" style={place(0, 341.333)} />
    </>
  )
}

interface FilterBlockProps {
  labels: { period: string; type: string; order: string }
  range: string
  showPeriod: boolean
  iconsOn: boolean
  /** 0 끔 · 1 켬 1단계 · 2 켬 */
  toggleStage: number
  balanceShown: boolean
  onFilter: () => void
  onToggle: () => void
  onSearch: () => void
  style: CSSProperties
  hidden: boolean
}

/** 영상의 필터 줄 글자 ('3개월 · 전체|입금|출금 · 최신순') — 이 글자면 영상 좌표 그대로, 아니면 같은 오른끝(317.5)에 맞춘 줄 */
function isVideoFilter(labels: { period: string; order: string }) {
  return labels.period === '3개월' && labels.order === '최신순'
}

/** 필터·기간 블록 84dp (블록 위끝 기준 좌표 = 앱 y − 373.333) */
function FilterBlock({ labels, range, showPeriod, iconsOn, toggleStage, balanceShown, onFilter, onToggle, onSearch, style, hidden }: FilterBlockProps) {
  const at = (x: number, y: number) => place(x, y - BLOCK_TOP)
  const on = toggleStage > 0 && balanceShown
  const knob = toggleStage === 0 || !balanceShown ? 'off' : toggleStage === 1 ? 'mid' : 'on'
  return (
    <div className="woori-hi__block" style={{ ...style, visibility: hidden ? 'hidden' : undefined }}>
      {iconsOn && <img className="woori-hi__icon20" src="/woori/history/search.svg" alt="" style={at(20, 381)} onClick={onSearch} />}
      <button type="button" className="woori-hi__filter-hit" onClick={onFilter} aria-label="조회조건 선택" style={at(190, 373.333)} />
      {isVideoFilter(labels) ? (
        <>
          <Text className="woori-hi__filter" style={at(200.6562, 384)}>
            {labels.period}
          </Text>
          <span className="woori-hi__fdot" style={at(237.2, 390.5)} />
          <Text className="woori-hi__filter woori-hi__filter--tight" style={at(243.4531, 385)}>
            {labels.type}
          </Text>
          <span className="woori-hi__fdot" style={at(271.5, 390.5)} />
          <Text className="woori-hi__filter woori-hi__filter--tight" style={at(277.75, 385)}>
            {labels.order}
          </Text>
        </>
      ) : (
        <p className="woori-hi__filter-row" style={{ right: 360 - 317.5, top: 384 - BLOCK_TOP }} data-testid="history-filter-line">
          <span>{labels.period}</span>
          <i />
          <span>{labels.type}</span>
          <i />
          <span>{labels.order}</span>
        </p>
      )}
      {iconsOn && <img className="woori-hi__icon20" src="/woori/history/filter-sliders.svg" alt="" style={at(320, 381.5)} />}
      {showPeriod && (
        <>
          <Text className="woori-hi__period" style={at(19.9219, 427)}>
            {range}
          </Text>
          <Text className="woori-hi__bal-label" style={at(236.1562, 426)}>
            잔액 표시
          </Text>
          <button
            type="button"
            className={'woori-hi__toggle' + (on ? ' is-on' : '')}
            style={at(300, 421.333)}
            role="switch"
            aria-checked={on}
            aria-label="잔액 표시"
            onClick={onToggle}
          >
            <span className={`woori-hi__knob woori-hi__knob--${knob}`} />
          </button>
        </>
      )}
    </div>
  )
}

function ListRows({ layout, balanceShown, onOpen }: { layout: ListLayout; balanceShown: boolean; onOpen: (item: TxItem) => void }) {
  return (
    <>
      {layout.months.map((m) => (
        <Text key={'m' + m.base} className="woori-hi__month" style={place(19.9844, m.base - 14)}>
          {m.text}
        </Text>
      ))}
      {layout.dividers.map((y) => (
        <div key={'d' + y} className="woori-hi__line woori-hi__line--date" style={place(20, y)} />
      ))}
      {layout.rows.map(({ item, base }) => {
        const [date, time] = splitDateLine(item.display.dateLine)
        return (
          <div key={item.id} className="woori-hi__row" style={place(0, base - 24)} onClick={() => onOpen(item)} role="button" tabIndex={0}>
            <div className="woori-hi__dateline" style={place(19.9375, 12)}>
              <span className="woori-hi__date">{date}</span>
              <span className="woori-hi__dot" />
              <span className="woori-hi__time">{time}</span>
            </div>
            <Text className="woori-hi__name" style={place(19.9688, 47.75)}>
              {item.displayName}
            </Text>
            <Text className={'woori-hi__amount' + (item.type === 'in' ? ' is-in' : '')} style={place(0, 47.75)}>
              {item.display.amount}
            </Text>
            {balanceShown && (
              <Text className="woori-hi__rowbal" style={place(0, 69.75)}>
                {item.display.balance}
              </Text>
            )}
          </div>
        )
      })}
    </>
  )
}

/** 스켈레톤 (2.4) — 막대 안에서 밝은 띠가 한 번 지나간다 (3.2) */
const SKELETON: ReadonlyArray<readonly [number, number, number, number]> = [
  [20, 84, 40, 40],
  [72, 84, 80, 16],
  [72, 108, 160, 16],
  [192, 144, 148, 32],
  [20, 364, 96, 24],
  [20, 424, 110, 16],
  [20, 456, 60, 16],
  [244, 456, 96, 16],
  [20, 480, 80, 16],
  [220, 480, 120, 16],
  [20, 536, 110, 16],
  [20, 568, 60, 16],
  [244, 568, 96, 16],
  [20, 592, 80, 16],
  [220, 592, 120, 16],
]

function Skeleton() {
  return (
    <>
      {SKELETON.map(([x, y, w, h]) => (
        <span key={`${x},${y}`} className="woori-hi__sk" style={{ left: x, top: y, width: w, height: h }} />
      ))}
      <div className="woori-hi__band" style={{ left: 0, top: 248 }} />
    </>
  )
}

function ShotScrollbar({ scrollTop, docHeight }: { scrollTop: number; docHeight: number }) {
  const len = (SB_TRACK * VIEWPORT_H) / docHeight
  const max = Math.max(1, docHeight - VIEWPORT_H)
  const y = SB_TRACK_TOP + ((SB_TRACK - len) * Math.min(scrollTop, max)) / max
  return <div className="woori-hi__scrollbar is-shown" style={{ height: r4(len), translate: `0 ${r4(y)}px` }} aria-hidden />
}

/* ───────────────────────── 조회조건 시트 (2.5) ───────────────────────── */

const SEGMENTS: ReadonlyArray<{ label: ReactNode; x: number; top: number; tight?: boolean }> = [
  { label: '이번달', x: 35.4062, top: 473 },
  { label: '3개월', x: 100.3438, top: 472 },
  { label: '6개월', x: 163.5469, top: 472 },
  { label: '1년', x: 233.9219, top: 473 },
  { label: '직접', x: 294.2812, top: 464 },
]
const TYPE_BTNS: ReadonlyArray<{ t: TxTypeFilter; x: number; tx: number; label: string }> = [
  { t: 'all', x: 20, tx: 58.6094, label: '전체' },
  { t: 'in', x: 129.333, tx: 167.8438, label: '입금' },
  { t: 'out', x: 238.667, tx: 277.2344, label: '출금' },
]
const SHEET_TOP = 343.333
/** 시트 기본 높이 (2.5 — 영상 모양) */
const SHEET_H = 457.667
/** 직접입력 날짜 칸 줄 (조회기간 칸 아래, 설계값) · 상세조건 펼침 (정렬, 설계값) — 그만큼 시트가 위로 커진다 */
const CUSTOM_H = 64
const DETAIL_H = 71
/** 칸 사이 세로선: 경계 b(칸 b | b+1) — 영상 값 211.75 (b 2) · 274.83 (b 3) 간격 63.08 */
const sepX = (b: number) => 211.75 + 63.08 * (b - 2)

function sheetExtra(q: HistQuery, detailOpen: boolean) {
  return (q.period === 'custom' ? CUSTOM_H : 0) + (detailOpen ? DETAIL_H : 0)
}

/** 'YYYY-MM-DD' 오늘에서 n년 전 (직접입력 min, 설계값: 달력을 너무 넓히지 않는다) */
function minusYears(iso: string | undefined, n: number) {
  if (!iso) return undefined
  return `${Number(iso.slice(0, 4)) - n}${iso.slice(4)}`
}

function FilterSheet({
  value,
  detailOpen,
  maxDate,
  onSelect,
  onPeriod,
  onOrder,
  onDates,
  onToggleDetail,
  onClose,
  onReset,
  onApply,
  applyPressScale,
  applyHeld,
}: {
  value: HistQuery
  detailOpen: boolean
  /** 오늘 (서버 시계) 'YYYY-MM-DD' */
  maxDate?: string
  onSelect: (t: TxTypeFilter) => void
  onPeriod: (p: TxPeriod) => void
  onOrder: (o: TxOrder) => void
  onDates: (from: string | undefined, to: string | undefined) => void
  onToggleDetail: () => void
  onClose: () => void
  onReset: () => void
  onApply: () => void
  applyPressScale?: number
  applyHeld: boolean
}) {
  const custom = value.period === 'custom'
  const c = custom ? CUSTOM_H : 0
  const d = detailOpen ? DETAIL_H : 0
  // 패널이 위로 커진 만큼(c + d) 위쪽 요소는 패널 기준 그대로, 끼운 줄 아래 요소는 그만큼 내려 적는다 → 화면 자리는 영상 값 그대로
  const at = (x: number, y: number) => place(x, y - SHEET_TOP)
  const atC = (x: number, y: number) => place(x, y - SHEET_TOP + c)
  const atCD = (x: number, y: number) => place(x, y - SHEET_TOP + c + d)
  const sel = Math.max(0, PERIODS.indexOf(value.period))
  return (
    <div className="woori-hi-sheet__body">
      <Text className="woori-hi-sheet__title" style={at(19.9375, 377)}>
        조회조건 선택
      </Text>
      <button type="button" className="woori-hi-sheet__close" aria-label="닫기" style={at(316, 375)} onClick={onClose} />
      <Text className="woori-hi-sheet__label" style={at(19.9375, 421)}>
        조회기간
      </Text>
      <div className="woori-hi-sheet__segment" style={at(20, 457.667)} />
      <div className="woori-hi-sheet__seg-on" style={at(22 + 63.2 * sel, 459.667)} />
      {SEGMENTS.map((g, i) => (
        <Text key={i} className={'woori-hi-sheet__seg' + (i === sel ? ' is-on' : '')} style={at(g.x, g.top)}>
          {g.label}
        </Text>
      ))}
      <Text className={'woori-hi-sheet__seg' + (sel === 4 ? ' is-on' : '')} style={at(294.2812, 481)}>
        입력
      </Text>
      {[0, 1, 2, 3]
        .filter((b) => b !== sel && b + 1 !== sel)
        .map((b) => (
          <span key={b} className="woori-hi-sheet__seg-sep" style={at(sepX(b), 472.333)} />
        ))}
      {PERIODS.map((p, i) => (
        <button
          key={p}
          type="button"
          className="woori-hi-sheet__seg-hit"
          style={at(22 + 63.2 * i, 459.667)}
          aria-label={PERIOD_LABEL[p]}
          aria-pressed={i === sel}
          data-period={p}
          onClick={() => onPeriod(p)}
        />
      ))}
      {custom && (
        <div className="woori-hi-sheet__dates" style={at(20, 515.667)}>
          <input
            type="date"
            className="woori-hi-sheet__date"
            aria-label="시작일"
            data-testid="history-from"
            value={value.from ?? ''}
            min={minusYears(maxDate, 5)}
            max={value.to || maxDate}
            onChange={(e) => onDates(e.target.value || undefined, value.to)}
          />
          <span className="woori-hi-sheet__tilde">~</span>
          <input
            type="date"
            className="woori-hi-sheet__date"
            aria-label="종료일"
            data-testid="history-to"
            value={value.to ?? ''}
            min={value.from}
            max={maxDate}
            onChange={(e) => onDates(value.from, e.target.value || undefined)}
          />
        </div>
      )}
      <Text className="woori-hi-sheet__label" style={atC(19.9375, 538.25)}>
        거래구분
      </Text>
      {TYPE_BTNS.map((b) => (
        <button
          key={b.t}
          type="button"
          className={'woori-hi-sheet__type' + (b.t === value.type ? ' is-on' : '')}
          style={atC(b.x, 574.667)}
          onClick={() => onSelect(b.t)}
        >
          <span className="woori-hi__t woori-hi-sheet__type-text" style={place(b.tx - b.x, 587 - 574.667)}>
            {b.label}
          </span>
        </button>
      ))}
      <button type="button" className="woori-hi-sheet__detail-hit" style={atC(110, 651)} aria-expanded={detailOpen} onClick={onToggleDetail}>
        상세조건
      </button>
      <Text className="woori-hi-sheet__detail" style={atC(133.7031, 663.25)}>
        {detailOpen ? '상세조건접기' : '상세조건조회'}
      </Text>
      <img
        className={'woori-hi-sheet__detail-chevron' + (detailOpen ? ' is-open' : '')}
        src="/woori/history/chevron-down-tiny.svg"
        alt=""
        style={atC(210.4, 663)}
      />
      {detailOpen && (
        <>
          <Text className="woori-hi-sheet__label" style={atC(19.9375, 693.25)}>
            정렬
          </Text>
          {(['desc', 'asc'] as const).map((o, i) => (
            <button
              key={o}
              type="button"
              className={'woori-hi-sheet__type woori-hi-sheet__type--half' + (value.order === o ? ' is-on' : '')}
              style={atC(20 + 164 * i, 729.667)}
              data-order={o}
              onClick={() => onOrder(o)}
            >
              <span className="woori-hi-sheet__type-label">{ORDER_LABEL[o]}</span>
            </button>
          ))}
        </>
      )}
      <WooriButton variant="secondary" className="woori-hi-sheet__btn woori-hi-sheet__btn--reset" style={atCD(16, 726.667)} onClick={onReset}>
        초기화
      </WooriButton>
      <WooriButton
        className="woori-hi-sheet__btn woori-hi-sheet__btn--apply"
        style={{ ...atCD(126.3, 726.667), ...(applyPressScale != null ? ({ '--woori-btn-press-scale': String(applyPressScale) } as CSSProperties) : {}) }}
        {...(applyPressScale != null || applyHeld ? { 'data-pressed': '' } : {})}
        onClick={onApply}
      >
        적용하기
      </WooriButton>
    </div>
  )
}
