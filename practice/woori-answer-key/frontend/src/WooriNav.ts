// WooriNav — 화면 이동 + 페이지 전환(영상의 이동 방식) + 페이지 스택 + 브라우저 뒤로/앞으로
//
// 영상(inventory 2절)의 이동 방식:
//   instant  한 프레임 교체 (기본값. 영상의 페이지 이동은 거의 다 이것 + 흰 페이지/스피너 + 단계적 그리기)
//   push     새 페이지가 오른쪽에서 밀려 들어옴 + 아래 페이지는 제자리에서 흰 베일로 덮임 (계좌번호·금융회사 페이지, v2 63.760 · 71.588)
//   pop      push 의 반대: 지금 페이지가 오른쪽으로 빠지고 아래 페이지의 베일이 걷힘 (영상에 없음 — 브라우저 뒤로 대비 설계값)
//   reveal   지금 페이지가 한 프레임에 사라지고, 아래 페이지가 흰 베일(0.8)째 보였다가 잠시 뒤 선형으로 걷힘 (계좌번호 [확인], v2 74.214)
//   rise     새 페이지가 아래에서 올라오며 페이드 인 (거래 상세 열기, v1 91.367 · 101.519 · 154.314)
//   sink     rise 의 반대: 지금 페이지가 아래로 내려가며 페이드 아웃 (상세 닫기, v1 95.699 · 104.531 · 156.273)
//   바텀시트·팝업 시트는 라우트가 아니라 화면 상태다 → WooriSheet (곡선 상수는 아래 WOORI_MOTION.sheet / popup).
// 곡선·시간은 아래 WOORI_MOTION 이 기본값(1단계 타임라인 맞춤값)이다. 화면 작업은 자기 스펙에서 잰 값을 이동할 때 넘겨 덮어쓴다:
//   go('/send/account', { transition: { kind: 'push', duration: 255, easing: 'cubic-bezier(0, 0.122, 0.253, 1)' } })
// 전환은 모두 CSS 애니메이션(woori.css .woori-tr-*, .woori-layer__veil)이라 tools/shot.cjs --t 가 document.getAnimations() 로 멈춘다.
//
// 페이지 스택: 라우트 패턴 하나(WOORI_PAGES) = 페이지 하나. 같은 패턴 안의 이동(/history?type=in → ?type=out)은 인스턴스를 그대로 두고
// 위치만 바뀐다. push·rise 로 들어온 페이지 아래의 페이지는 마운트된 채 남는다 (덮여 있는 동안 visibility:hidden + inert):
//   /history → /history/:txId (rise) → 뒤로 (sink) 하면 목록이 같은 인스턴스·같은 스크롤로 드러난다.
//   /send → /send/account (push) → [확인] reveal 하면 '어디로 이체' 가 그대로 드러난다.
// instant push 는 아래 페이지를 내린다 (돌아오면 새로 마운트 — 화면이 자기 캐시로 '떠날 때 모습'을 그린다).
// 브라우저 뒤로/앞으로: 기록 칸마다 들어온 전환을 적어 두고(sessionStorage), 뒤로는 그 반대(push→pop, rise→sink, 그 밖은 instant),
// 앞으로는 같은 전환을 다시 쓴다. useWooriNavigate 로 go(-1, { transition }) 하면 그 전환이 우선이다.
// 전환 중에는 App 이 모든 레이어를 inert 로 둔다 (연타가 아래 페이지를 누르지 않게). 한 기록 칸에서는 한 번만 떠난다 (연타 막기).
import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties } from 'react'
import { matchPath, NavigationType, useLocation, useNavigate, useNavigationType, type Location, type NavigateOptions, type To } from 'react-router-dom'

/* ───────────────────────── 전환 정의 ───────────────────────── */

export type WooriTransitionKind = 'instant' | 'push' | 'pop' | 'reveal' | 'rise' | 'sink'

/** 아래 페이지 위 흰 베일 (불투명도 애니메이션). 숫자는 0–1 */
export interface WooriVeil {
  from?: number
  to?: number
  /** ms */
  duration?: number
  easing?: string
  /** 시작 전 기다림 (ms). 그동안 from 값을 보인다 (reveal 의 0.8 유지 200ms) */
  delay?: number
}

export interface WooriTransition {
  kind: WooriTransitionKind
  /** 위치 이동 길이 (ms). 생략하면 WOORI_MOTION */
  duration?: number
  /** 위치 이동 곡선 (CSS easing) */
  easing?: string
  /** rise / sink: 세로 이동 거리 (dp). rise 는 아래 dy 에서 0 으로, sink 는 0 에서 아래 dy 로 */
  dy?: number
  /** rise / sink: 불투명도 길이·곡선·지연 (ms) */
  fadeDuration?: number
  fadeEasing?: string
  fadeDelay?: number
  /** push: 덮이는 아래 페이지 베일 · pop/reveal: 드러나는 아래 페이지 베일. false 면 베일 없음 */
  veil?: WooriVeil | false
}

/**
 * 이동 방식 기본값 (1단계 timeline/inventory 맞춤값 — 화면 스펙이 다시 재서 호출 때 넘기거나 여기를 고친다).
 *   push   새 페이지 왼끝 524→0px md-decelerate(0,0,0.2,1) 260ms (v2 두 번 함께 rms 0.69px). 베일 α 0→≈0.44(보이는 동안) … 0.8–0.84 → 0→0.8 선형은 근사
 *   reveal 베일 0.80 유지 ≈200ms → linear 307ms 로 걷힘 (v2 74.214–74.723, rms 0.01)
 *   rise   y +≈120px(83dp) → 0 md-decelerate 250ms + 페이드 인 md-standard(0.4,0,0.2,1) 308ms (v1 세 번 jointFit)
 *   sink   아래로 ≈100px(69dp) 이동 ≈100–140ms + 페이드 아웃 ≈170–280ms fast-out-slow-in-emph(0.2,0,0,1) 근사 (v1 세 번, 흩어짐)
 *   pop    영상에 없음 (브라우저 뒤로 대비): push 를 거꾸로, md-accelerate(0.4,0,1,1) 260ms — 설계값
 *   sheet  조회조건 시트(v2 깨끗한 회차): 열림 easeOutCubic(0.33,1,0.68,1) 260ms + 딤 linear 300ms(시트보다 ≈25ms 늦게),
 *          닫힘 easeInCubic(0.32,0,0.67,0) 255ms + 딤 linear 293ms. 딤 불투명도 = 토큰 dimSheet (정지 프레임 0.5686; 곡선 맞춤은 0.556–0.564)
 *   popup  홈 프로모션 팝업: 열림 ≈300ms easeOutCubic + 딤 ease 178ms, 닫힘 ≈150ms (영상 프레임이 드물어 맞춤이 나쁨 — 스펙에서 다시),
 *          딤 = 토큰 dimPopup (0.5098), 내비 바 검정
 */
export const WOORI_MOTION = {
  push: {
    duration: 260,
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
    veil: { from: 0, to: 0.8, duration: 260, easing: 'linear', delay: 0 },
  },
  pop: {
    duration: 260,
    easing: 'cubic-bezier(0.4, 0, 1, 1)',
    veil: { to: 0, duration: 260, easing: 'linear', delay: 0 },
  },
  reveal: {
    veil: { from: 0.8, to: 0, duration: 307, easing: 'linear', delay: 200 },
  },
  // rise/sink: 2단계 스펙 값(spec/history-detail.md — 거래 상세 열기·닫기). 브라우저/OS 뒤로(reverseOf)도 이 값을 쓴다.
  rise: {
    duration: 265,
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
    dy: 100,
    fadeDuration: 265,
    fadeEasing: 'cubic-bezier(0, 0, 0.2, 1)',
    fadeDelay: 0,
  },
  sink: {
    duration: 240,
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
    dy: 96,
    fadeDuration: 260,
    fadeEasing: 'cubic-bezier(0, 0, 0.2, 1)',
    fadeDelay: 0,
  },
  sheet: {
    open: { duration: 260, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', dimDuration: 300, dimEasing: 'linear', dimDelay: 25 },
    close: { duration: 255, easing: 'cubic-bezier(0.32, 0, 0.67, 0)', dimDuration: 293, dimEasing: 'linear', dimDelay: 0 },
    /** 딤 불투명도 (CSS 값). 토큰 --woori-dim-sheet-alpha */
    dim: 'var(--woori-dim-sheet-alpha)',
  },
  popup: {
    open: { duration: 300, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', dimDuration: 178, dimEasing: 'ease', dimDelay: 0 },
    close: { duration: 150, easing: 'cubic-bezier(0.32, 0, 0.67, 0)', dimDuration: 150, dimEasing: 'linear', dimDelay: 0 },
    dim: 'var(--woori-dim-popup-alpha)',
    /** 팝업이 떠 있는 동안 내비 바 자리 색 (OS 가 검정으로 바꾼다, units.md 5.3절) */
    navbar: '#000000',
  },
} as const

/** 시트 한 방향(열림/닫힘)의 곡선 */
export interface WooriSheetPhaseMotion {
  duration: number
  easing: string
  dimDuration: number
  dimEasing: string
  dimDelay: number
}

/** 덮는 전환: 새 페이지가 아래 페이지 위로 들어오고 아래 페이지는 마운트된 채 남는다 */
export function isCovering(kind: WooriTransitionKind): boolean {
  return kind === 'push' || kind === 'rise'
}

/** 뒤로 갈 때 쓸 반대 전환 (그 칸에 들어온 전환 기준) */
export function reverseOf(t: WooriTransition | undefined): WooriTransition {
  if (!t) return { kind: 'instant' }
  if (t.kind === 'push') return { kind: 'pop' }
  if (t.kind === 'rise') return { kind: 'sink' }
  return { kind: 'instant' }
}

const ms = (v: number) => `${Math.round(v * 1000) / 1000}ms`

/** 움직이는 레이어에 다는 CSS 변수 (woori.css .woori-tr-* 가 읽는다) */
export function transitionVars(t: WooriTransition): CSSProperties {
  const vars: Record<string, string> = {}
  if (t.kind === 'push' || t.kind === 'pop') {
    const d = WOORI_MOTION[t.kind]
    vars['--woori-tr-duration'] = ms(t.duration ?? d.duration)
    vars['--woori-tr-easing'] = t.easing ?? d.easing
  } else if (t.kind === 'rise' || t.kind === 'sink') {
    const d = WOORI_MOTION[t.kind]
    vars['--woori-tr-duration'] = ms(t.duration ?? d.duration)
    vars['--woori-tr-easing'] = t.easing ?? d.easing
    vars['--woori-tr-dy'] = `${t.dy ?? d.dy}px`
    vars['--woori-tr-fade-duration'] = ms(t.fadeDuration ?? d.fadeDuration)
    vars['--woori-tr-fade-easing'] = t.fadeEasing ?? d.fadeEasing
    vars['--woori-tr-fade-delay'] = ms(t.fadeDelay ?? d.fadeDelay)
  }
  return vars as CSSProperties
}

/** 움직이는 레이어의 애니메이션 클래스 */
export function transitionClass(kind: WooriTransitionKind): string {
  if (kind === 'push') return 'woori-tr-push-in'
  if (kind === 'pop') return 'woori-tr-pop-out'
  if (kind === 'rise') return 'woori-tr-rise-in'
  if (kind === 'sink') return 'woori-tr-sink-out'
  return ''
}

/** 레이어 위 흰 베일 애니메이션 하나 (id 가 바뀌면 처음부터 다시) */
export interface WooriVeilAnim {
  id: number
  from: number
  to: number
  duration: number
  easing: string
  delay: number
}

let veilSeq = 0

function veilAnim(base: Required<WooriVeil>, over: WooriVeil | false | undefined): WooriVeilAnim | null {
  if (over === false) return null
  const v = { ...base, ...(over ?? {}) }
  return { id: ++veilSeq, from: v.from, to: v.to, duration: v.duration, easing: v.easing, delay: v.delay }
}

/** 베일 CSS 변수 (woori.css .woori-layer__veil) */
export function veilVars(v: WooriVeilAnim): CSSProperties {
  return {
    '--woori-veil-from': String(v.from),
    '--woori-veil-to': String(v.to),
    '--woori-veil-duration': ms(v.duration),
    '--woori-veil-easing': v.easing,
    '--woori-veil-delay': ms(v.delay),
  } as CSSProperties
}

/* ───────────────────────── 페이지 패턴 ───────────────────────── */

/**
 * 페이지 = 라우트 패턴 하나 (위에서부터 먼저 맞는 것). 패턴 문자열 자체가 페이지 이름이다.
 * App.tsx 의 라우트와 같은 목록 (라우트를 더하면 여기도).
 */
export const WOORI_PAGES = [
  '/',
  '/cert',
  '/home',
  '/history',
  '/history/:txId',
  '/notice',
  '/send',
  '/send/account',
  '/send/account/bank',
  '/send/amount',
  '/send/confirm',
  '/send/done',
  '/dev/keyboard',
  '/dev/keypad',
  '/dev/frame',
] as const

export function pageOf(pathname: string): string {
  return WOORI_PAGES.find((p) => matchPath(p, pathname)) ?? pathname
}

/* ───────────────────────── 다음 이동의 전환 ─────────────────────────
 * useWooriNavigate() 가 "지금 위치(key)에서 떠날 때 쓸 전환"을 적어 두고, 페이지 스택이 위치가 바뀔 때 읽는다.
 * 이 API 를 거치지 않은 이동(브라우저 뒤로/앞으로, <Navigate>)은 기록 칸의 전환 표(arrivals)로 정한다.
 */
let pending: { fromKey: string; transition: WooriTransition } | null = null

function toTransition(t: WooriTransition | WooriTransitionKind | undefined): WooriTransition | undefined {
  return typeof t === 'string' ? { kind: t } : t
}

/** 컴포넌트 밖(도구, wooriDebug)에서 다음 이동의 전환을 지정 */
export function setNextTransition(fromKey: string, t: WooriTransition | WooriTransitionKind | undefined) {
  const transition = toTransition(t)
  pending = transition ? { fromKey, transition } : null
}

function pendingFrom(fromKey: string): WooriTransition | null {
  return pending && pending.fromKey === fromKey ? pending.transition : null
}

/* 기록 칸(location.key) → 그 칸에 들어온 전환. 뒤로(반대 전환)·앞으로(같은 전환)에 쓴다. 새로고침에도 남게 sessionStorage */
const ARRIVALS_KEY = 'woori.nav.arrivals'
const ARRIVALS_MAX = 200
const arrivals: Map<string, WooriTransition> = (() => {
  try {
    const raw = typeof window === 'undefined' ? null : window.sessionStorage.getItem(ARRIVALS_KEY)
    const arr = raw ? (JSON.parse(raw) as Array<[string, WooriTransition]>) : []
    return new Map(Array.isArray(arr) ? arr : [])
  } catch {
    return new Map()
  }
})()

function saveArrivals() {
  try {
    const arr = [...arrivals.entries()].slice(-ARRIVALS_MAX)
    window.sessionStorage.setItem(ARRIVALS_KEY, JSON.stringify(arr))
  } catch {
    /* 저장소를 못 쓰면 이 탭의 메모리만 */
  }
}

/* 연타 막기: 한 기록 칸(location.key)에서는 한 번만 떠난다. 위치가 바뀌면 푼다 (안 바뀌는 이동에 갇히지 않게 1초 뒤에도) */
let departed: { key: string; at: number } | null = null
const DEPART_LOCK_MS = 1000

export interface WooriNavigateOptions extends NavigateOptions {
  /** 페이지 전환 (기본 instant). 'push' 처럼 종류만 줘도 된다 */
  transition?: WooriTransition | WooriTransitionKind
}

/**
 * navigate + 전환. 예)
 *   const go = useWooriNavigate()
 *   go('/send/account', { transition: 'push' })
 *   go(-1, { transition: 'reveal' })          // 계좌번호 [확인]: 페이지가 한 프레임에 사라지고 아래 페이지 베일이 걷힘
 *   go('/history?type=all', { replace: true })
 * 같은 위치에서 이미 이동했으면(위치가 바뀌기 전의 연타) 아무것도 하지 않는다.
 */
export function useWooriNavigate() {
  const navigate = useNavigate()
  const { key } = useLocation()
  return useCallback(
    (to: To | number, options: WooriNavigateOptions = {}) => {
      const now = performance.now()
      if (departed && departed.key === key && now - departed.at < DEPART_LOCK_MS) return
      departed = { key, at: now }
      const { transition, ...navOptions } = options
      setNextTransition(key, transition)
      if (typeof to === 'number') navigate(to)
      else navigate(to, navOptions)
    },
    [navigate, key],
  )
}

/* ───────────────────────── 페이지 스택 (App.tsx 가 그림) ───────────────────────── */

export interface WooriPageLayer {
  /** React key — 같은 key 면 페이지 인스턴스(상태)가 유지된다 */
  key: string
  location: Location
  /** 뒤로/앞으로 가기(POP)로 도착했는지 (useArrivedByPop) */
  arrivedByPop: boolean
  className: string
  style: CSSProperties
  /** 이 레이어의 애니메이션이 끝나면 전환 종료 (App 이 finish 를 부른다) */
  animating: boolean
  /** 덮여 있음 (visibility:hidden + inert) */
  covered: boolean
  /** 맨 위(지금 위치의) 페이지 */
  top: boolean
  /** 베일 애니메이션 (없으면 null) */
  veil: WooriVeilAnim | null
}

interface StackPage {
  key: string
  location: Location
  pattern: string
  /** 이 페이지가 들어온 전환 (뒤로 갈 때 반대로) */
  arrival: WooriTransition
  arrivedByPop: boolean
  veil: WooriVeilAnim | null
}

interface StackState {
  location: Location
  /** 지금 위치의 기록 번호 (React Router 가 history.state.idx 에 적는다) */
  idx: number
  /** 아래 → 위. 맨 위 = 지금 위치 */
  pages: StackPage[]
  /** 나가는 중인 페이지 (pop/sink): 맨 위 페이지 위에 그린다 */
  leaving: StackPage | null
  /** 움직이는 전환 (들어오는 맨 위 페이지 또는 나가는 페이지) */
  moving: { key: string; transition: WooriTransition } | null
  /** 전환이 끝나면 내릴 페이지 (덮는 전환으로 replace 했을 때의 옛 맨 위) */
  drop: string[]
}

/** 현재 앱 내부 기록 위치 (React Router 가 넣는 history.state.idx). 알 수 없으면 0 */
export function historyIndex(): number {
  if (typeof window === 'undefined') return 0
  const st = window.history.state as { idx?: unknown } | null
  return typeof st?.idx === 'number' ? st.idx : 0
}

let pageSeq = 0

function freshPage(location: Location, arrival: WooriTransition, arrivedByPop: boolean): StackPage {
  return { key: `${pageOf(location.pathname)}#${++pageSeq}`, location, pattern: pageOf(location.pathname), arrival, arrivedByPop, veil: null }
}

function nextStack(prev: StackState, location: Location, navType: NavigationType): StackState {
  const idx = historyIndex()
  const pattern = pageOf(location.pathname)
  const top = prev.pages[prev.pages.length - 1]
  // 진행 중이던 전환은 끝난 것으로 친다: 내리기로 한 페이지는 내리고(같은 페이지 안 이동은 아래에서 prev 그대로) 새로 시작한다
  const pages = prev.drop.length ? prev.pages.filter((p) => !prev.drop.includes(p.key)) : prev.pages
  const base = { location, idx, drop: [] as string[] }

  if (navType === NavigationType.Pop) {
    const back = idx < prev.idx
    // 뒤로: 스택 아래에 그 칸(같은 key, 없으면 같은 패턴)의 페이지가 남아 있으면 그 인스턴스를 드러낸다
    let j = -1
    if (back) {
      for (let i = pages.length - 2; i >= 0; i--) if (pages[i].location.key === location.key) { j = i; break }
      if (j < 0 && pattern !== top.pattern) for (let i = pages.length - 2; i >= 0; i--) if (pages[i].pattern === pattern) { j = i; break }
    }
    if (j < 0 && pattern === top.pattern) {
      // 같은 페이지 안의 뒤로/앞으로: 인스턴스 유지, 전환 없음
      return { ...prev, ...base, pages: [...prev.pages.slice(0, -1), { ...top, location }], drop: prev.drop }
    }
    if (back) {
      const t = pendingFrom(prev.location.key) ?? reverseOf(top.arrival)
      const under = j >= 0 ? { ...pages[j], location, arrivedByPop: true } : freshPage(location, arrivals.get(location.key) ?? { kind: 'instant' }, true)
      under.veil = revealVeil(t, under)
      const keep = j >= 0 ? pages.slice(0, j) : []
      const leaves = t.kind === 'pop' || t.kind === 'sink'
      return {
        ...base,
        pages: [...keep, under],
        leaving: leaves ? top : null,
        moving: leaves ? { key: top.key, transition: t } : null,
      }
    }
    // 앞으로: 그 칸에 들어왔던 전환을 다시
    const t = pendingFrom(prev.location.key) ?? arrivals.get(location.key) ?? { kind: 'instant' }
    return arrive(pages, base, t, true, false)
  }

  if (pattern === top.pattern) {
    // 같은 페이지 안 이동 (검색어만 바뀜 등): 인스턴스 유지, 전환 없음
    if (navType === NavigationType.Push) arrivals.set(location.key, { kind: 'instant' })
    return { ...prev, ...base, pages: [...prev.pages.slice(0, -1), { ...top, location }], drop: prev.drop }
  }
  const t = pendingFrom(prev.location.key) ?? { kind: 'instant' }
  arrivals.set(location.key, t)
  return arrive(pages, base, t, false, navType === NavigationType.Replace)
}

/** 드러나는 페이지의 베일: pop 은 덮일 때 값에서 걷히고, reveal 은 0.8 유지 뒤 걷힌다. instant·sink 는 없음 */
function revealVeil(t: WooriTransition, page: StackPage): WooriVeilAnim | null {
  if (t.kind === 'pop') {
    const covered = page.veil ? page.veil.to : 0
    return covered > 0 || t.veil ? veilAnim({ ...WOORI_MOTION.pop.veil, from: covered }, t.veil) : null
  }
  if (t.kind === 'reveal') return veilAnim(WOORI_MOTION.reveal.veil, t.veil)
  return null
}

/** 새 페이지가 들어온다 (push·replace·앞으로 가기) */
function arrive(
  pages: StackPage[],
  base: { location: Location; idx: number; drop: string[] },
  t: WooriTransition,
  byPop: boolean,
  replace: boolean,
): StackState {
  const { location } = base
  const top = pages[pages.length - 1]
  const below = replace ? pages.slice(0, -1) : pages
  const page = freshPage(location, t, byPop)
  if (isCovering(t.kind)) {
    // 아래 페이지(옛 맨 위)는 남는다. replace 면 전환이 끝난 뒤 내린다
    const under = { ...top, veil: t.kind === 'push' ? veilAnim(WOORI_MOTION.push.veil, t.veil) : null }
    return {
      ...base,
      pages: [...pages.slice(0, -1), under, page],
      leaving: null,
      moving: { key: page.key, transition: t },
      drop: replace ? [top.key] : [],
    }
  }
  if (t.kind === 'pop' || t.kind === 'sink') {
    // 앞으로 가는 이동에 나가는 전환을 준 경우: 옛 맨 위가 새 페이지 위에서 나간다
    return { ...base, pages: [{ ...page, veil: revealVeil(t, page) }], leaving: top, moving: { key: top.key, transition: t } }
  }
  page.veil = t.kind === 'reveal' ? revealVeil(t, page) : null
  // instant (또는 reveal): push 는 아래 페이지를 내리고, replace 는 그 아래 남은 페이지(덮는 전환으로 쌓인 것)를 유지
  return { ...base, pages: replace ? [...below, page] : [page], leaving: null, moving: null }
}

/**
 * 라우트 페이지 레이어 목록 (그리는 순서 = 아래 → 위).
 * 덮여 있는 페이지도 마운트된 채 들어 있다 (covered). 움직이는 레이어의 애니메이션이 끝나면 finish(key).
 */
export function useWooriPageStack(): { layers: WooriPageLayer[]; finish: (key: string) => void; busy: boolean; topKey: string } {
  const location = useLocation()
  // 페이지 레이어(<Routes location>) 밖이라 진짜 이동 종류 (안에서는 늘 'POP')
  const navigationType = useNavigationType()
  const [state, setState] = useState<StackState>(() => ({
    location,
    idx: historyIndex(),
    // 첫 로드(딥링크·새로고침)는 POP 이어도 arrivedByPop false
    pages: [freshPage(location, arrivals.get(location.key) ?? { kind: 'instant' }, false)],
    leaving: null,
    moving: null,
    drop: [],
  }))
  // 위치가 바뀌면 렌더 중에 바로 다음 스택을 계산한다 (이전 값 비교 패턴, 깜빡임 없음)
  if (state.location !== location) setState(nextStack(state, location, navigationType))

  // 쓴 전환은 지우고 연타 막기를 푼다. 기록 칸의 전환 표를 저장
  useEffect(() => {
    pending = null
    departed = null
    saveArrivals()
  }, [location.key])

  const finish = useCallback((key: string) => {
    setState((s) => {
      if (!s.moving || s.moving.key !== key) return s
      const pages = s.drop.length ? s.pages.filter((p) => !s.drop.includes(p.key)) : s.pages
      return { ...s, pages, leaving: null, moving: null, drop: [] }
    })
  }, [])

  const { pages, leaving, moving } = state
  const topIndex = pages.length - 1
  const busy = !!moving
  // 맨 위 페이지가 들어오는 중(push·rise)이면 바로 아래 페이지도 보인다 (덮는 replace 의 옛 맨 위 포함)
  const topAnimIn = !!moving && !leaving && moving.key === pages[topIndex].key
  const layers: WooriPageLayer[] = pages.map((p, i) => {
    const isTop = i === topIndex
    const animIn = isTop && topAnimIn
    const visible = isTop || (topAnimIn && i === topIndex - 1)
    return {
      key: p.key,
      location: p.location,
      arrivedByPop: p.arrivedByPop,
      className: `woori-layer${animIn && moving ? ' ' + transitionClass(moving.transition.kind) : ''}${visible ? '' : ' woori-layer--covered'}`,
      style: animIn && moving ? transitionVars(moving.transition) : {},
      animating: animIn,
      covered: !visible,
      top: isTop,
      veil: p.veil,
    }
  })
  if (leaving && moving) {
    layers.push({
      key: leaving.key,
      location: leaving.location,
      arrivedByPop: leaving.arrivedByPop,
      className: `woori-layer ${transitionClass(moving.transition.kind)}`,
      style: transitionVars(moving.transition),
      animating: true,
      covered: false,
      top: false,
      veil: null,
    })
  }
  return { layers, finish, busy, topKey: pages[topIndex].key }
}

/* ───────────────────────── 레이어 컨텍스트 ─────────────────────────
 * App 이 페이지 레이어마다 넣는다. 화면·공용 부품이 읽는다:
 *   overlayHost  그 레이어 페이지 상자 위의 겹침 자리 (WooriSheet 가 포털로 그린다 → 딤이 앱 뷰포트만 덮고 페이지와 같이 움직인다)
 *   arrivedByPop 뒤로/앞으로 가기로 도착했는지
 *   top          지금 위치의 페이지인지 (덮인 페이지·나가는 페이지는 false)
 */
export interface WooriLayerInfo {
  key: string
  overlayHost: HTMLElement | null
  arrivedByPop: boolean
  top: boolean
}

export const WooriLayerContext = createContext<WooriLayerInfo>({ key: '', overlayHost: null, arrivedByPop: false, top: true })

export function useWooriLayer(): WooriLayerInfo {
  return useContext(WooriLayerContext)
}

/**
 * 이 페이지가 뒤로/앞으로 가기(POP)로 도착했으면 true. push·replace 로 왔거나 첫 로드(딥링크·새로고침)면 false.
 * react-router 의 useNavigationType() 은 페이지 레이어(<Routes location>) 안에서 늘 'POP' 이라 이것을 쓴다.
 */
export function useArrivedByPop(): boolean {
  return useContext(WooriLayerContext).arrivedByPop
}

/* ───────────────────────── 뒤로가기 ───────────────────────── */

/**
 * 기록에서 지금보다 앞에 있는 가장 가까운 pathname 까지 몇 칸 뒤인지 (1 이상). 없으면 null.
 * Navigation API(navigation.entries())로 센다. 없는 브라우저는 null (→ useBackTo 가 replace 로).
 */
export function stepsBackTo(pathname: string): number | null {
  if (typeof window === 'undefined') return null
  const nav = (window as { navigation?: Navigation }).navigation
  if (!nav?.currentEntry) return null
  const current = nav.currentEntry.index
  const entries = nav.entries()
  for (let i = current - 1; i >= 0; i--) {
    const url = entries[i]?.url
    if (url && new URL(url).pathname === pathname) return current - i
  }
  return null
}

/**
 * 기록 속 가장 가까운 pathname 까지 한 번에 뒤로 (사이 기록은 건너뛴다). 기록에 없으면(딥링크) pathname 으로 replace.
 * 예) 상세 ✕ : useBackTo('/history', 'sink') · 거래내역 ‹ : useBackTo('/home')
 * transition 은 렌더마다 새로 만들지 말고 모듈 상수나 문자열로 넘긴다 (콜백이 매번 바뀌지 않게).
 */
export function useBackTo(pathname: string, transition?: WooriTransition | WooriTransitionKind) {
  const go = useWooriNavigate()
  return useCallback(() => {
    const steps = stepsBackTo(pathname)
    if (steps) go(-steps, { transition })
    else go(pathname, { replace: true, transition })
  }, [go, pathname, transition])
}

/* ───────────────────────── URL 옵션 ───────────────────────── */

/** URL 의 ?shot=<상태 id> (결정적 스크린샷 상태). 없으면 null */
export function readShot(search: string = typeof window === 'undefined' ? '' : window.location.search): string | null {
  const v = new URLSearchParams(search).get('shot')
  return v && v.length > 0 ? v : null
}

/** 프레임 모드 저장 키 (sessionStorage '1' = 켬, main.tsx initFrameMode · index.html 인라인 스크립트). 숨은 메뉴의 되돌리기도 지우지 않는다 */
export const WOORI_FRAME_KEY = 'woori.frame'

/** 프레임 모드(?frame=1, 세션 동안 유지)인지 — main.tsx 가 <html data-frame="1"> 을 단다 */
export function isFrameMode(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.frame === '1'
}
