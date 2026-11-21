// WooriTheme — 토큰(색·딤·글꼴) + 라이트/다크 + 프레임 모드 띠(상태바·내비 바 자리) 색
//
// 토큰: spec/tokens.json(전역 토큰, 1단계 측정값)이 있으면 그 값을 그대로 쓰고, 없으면 아래 자리표시 값을 쓴다.
//   빌드 때 import.meta.glob 으로 읽는다 — 파일이 없으면 빈 표라 빌드가 깨지지 않는다 (vite.config.ts 가 dev 서버에 ../spec 을 연다).
//   토큰 이름 → CSS 변수: camelCase → --woori-kebab (primaryPressed → --woori-primary-pressed). tokens.md 의 권장 이름이 다른 것은 별칭도 단다
//   (primaryKeypadConfirm → --woori-primary-keypad). 딤(alpha 표)은 색(--woori-dim-sheet: rgba(…))과 불투명도 숫자(--woori-dim-sheet-alpha)를 둘 다.
//   요소별 정확한 색은 화면 스펙(spec/<group>.json)이 우선한다 — 토큰은 화면 공통 기본값이다.
// 테마: URL ?theme=dark|light  >  sessionStorage 'woori.theme'  >  prefers-color-scheme. ?theme=auto 는 저장값을 지운다.
//   index.html 의 인라인 스크립트가 같은 순서로 첫 페인트 전에 data-theme 를 단다 (순서를 바꾸면 그 스크립트도 같이 고친다).
//   다크: 영상은 라이트뿐이다. 지금은 구조만 — WOORI_DARK_OVERRIDES 가 비어 있어 다크도 라이트 값이다 (설계는 나중에).
// 띠: ?frame=1 의 위 31dp(상태바 자리)·아래 48dp(내비 바 자리) 스페이서 색. 화면마다·상태마다 다르다
//   (홈은 회색 241, 홈 팝업 때 내비 검정, 키보드 때 키보드 색 …, units.md 5.3절). 화면은 useWooriBands 로 바란다.
//   맨 위 페이지 레이어(App.tsx)의 요청만 쓴다 → 덮여 있는(push/rise 아래) 페이지의 요청은 새지 않는다.
//   프레임 모드가 아니면 상태바 색을 <meta name="theme-color"> 로 (모바일 브라우저 주소창 색).
import { createContext, useContext, useId, useLayoutEffect, useSyncExternalStore } from 'react'

export type WooriThemeName = 'light' | 'dark'

/* ───────────────────────── 토큰 ───────────────────────── */

interface TokenEntry {
  value?: string
}
interface TokensJson {
  colors?: Record<string, TokenEntry>
  alpha?: Record<string, TokenEntry>
  font?: { family?: string }
}

/** spec/tokens.json (있으면 1개, 없으면 0개) */
const TOKEN_FILES = import.meta.glob<TokensJson>('../../spec/tokens.json', { eager: true, import: 'default' })
const TOKENS_JSON: TokensJson | null = Object.values(TOKEN_FILES)[0] ?? null

/** 토큰 출처: 'spec/tokens.json' 이면 측정값, 'placeholder' 면 아래 자리표시 값만 */
export const WOORI_TOKEN_SOURCE: 'spec/tokens.json' | 'placeholder' = TOKENS_JSON ? 'spec/tokens.json' : 'placeholder'

/**
 * 자리표시 색 — spec/tokens.json 이 없을 때만 보인다 (있으면 같은 이름을 그 값으로 덮는다). 측정값이 아니다.
 * 이 뼈대(셸·스피너·시트·로딩 페이지)가 쓰는 이름만 둔다. 화면이 새 토큰을 쓰면 tokens.json 에 넣는다.
 */
const PLACEHOLDER_COLORS: Record<string, string> = {
  bg: '#ffffff',
  bgGray: '#eeeeee',
  surface: '#f5f5f5',
  skeleton: '#eeeeee',
  text: '#333333',
  textBody: '#4a4a4a',
  textSecondary: '#707070',
  primary: '#2a7ef0',
  primaryPressed: '#1a5aa0',
  textOnPrimary: '#ffffff',
  divider: '#e6e6e6',
  spinnerArcDark: '#0a2a90',
  spinnerArcLight: '#20c0f0',
}
const PLACEHOLDER_ALPHA: Record<string, string> = {
  dimSheet: 'rgba(0, 0, 0, 0.56)',
  dimPopup: 'rgba(0, 0, 0, 0.5)',
}
/** spec/font.md 1절의 스택 (tokens.json font.family 가 있으면 그것) */
const FONT_STACK =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif"

/** tokens.md 권장 CSS 이름이 키 이름(kebab)과 다른 것 → 별칭도 같은 값으로 */
const TOKEN_ALIASES: Record<string, readonly string[]> = {
  primaryKeypadConfirm: ['primary-keypad'],
}

/**
 * 다크 테마 덮어쓰기 (설계값 자리). 비어 있으면 다크도 라이트 값이다.
 * 채울 때: 토큰 이름 → 색. 라이트에 없는 이름은 무시하지 않고 그대로 CSS 변수가 된다.
 */
export const WOORI_DARK_OVERRIDES: Readonly<Record<string, string>> = {}

function pickValues(table: Record<string, TokenEntry> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(table ?? {})) if (typeof v?.value === 'string' && v.value) out[k] = v.value
  return out
}

/** 라이트 토큰 (이름 → CSS 값). 색과 딤을 한 표에 */
export const WOORI_TOKENS_LIGHT: Readonly<Record<string, string>> = {
  ...PLACEHOLDER_COLORS,
  ...PLACEHOLDER_ALPHA,
  ...pickValues(TOKENS_JSON?.colors),
  ...pickValues(TOKENS_JSON?.alpha),
}
const ALPHA_NAMES = new Set([...Object.keys(PLACEHOLDER_ALPHA), ...Object.keys(TOKENS_JSON?.alpha ?? {})])

export const WOORI_FONT_FAMILY: string = TOKENS_JSON?.font?.family || FONT_STACK

export function tokensFor(theme: WooriThemeName): Readonly<Record<string, string>> {
  return theme === 'dark' ? { ...WOORI_TOKENS_LIGHT, ...WOORI_DARK_OVERRIDES } : WOORI_TOKENS_LIGHT
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

/** 토큰 이름 → CSS 변수 이름 (primaryPressed → --woori-primary-pressed) */
export function tokenVar(name: string): string {
  return `--woori-${kebab(name)}`
}

/** 'rgba(0, 0, 0, 0.5686)' → 0.5686 (네 번째 값이 없으면 1) */
function alphaOf(css: string): number | null {
  const m = /rgba?\(([^)]*)\)/i.exec(css)
  if (!m) return null
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  if (parts.length < 3) return null
  const a = parts[3] ?? '1'
  const n = a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a)
  return Number.isFinite(n) ? n : null
}

/** 테마 하나의 CSS 변수 표 (:root 에 단다) */
export function tokenCssVars(theme: WooriThemeName): Record<string, string> {
  const vars: Record<string, string> = { '--woori-font': WOORI_FONT_FAMILY }
  for (const [name, value] of Object.entries(tokensFor(theme))) {
    vars[tokenVar(name)] = value
    for (const alias of TOKEN_ALIASES[name] ?? []) vars[`--woori-${alias}`] = value
    if (ALPHA_NAMES.has(name)) {
      const a = alphaOf(value)
      if (a != null) vars[`${tokenVar(name)}-alpha`] = String(a)
    }
  }
  return vars
}

/** 'var(--woori-bg-gray)' 같은 토큰 참조를 지금 테마의 실제 색으로 (theme-color meta 용). 모르면 그대로 */
export function resolveColor(css: string, theme: WooriThemeName = getTheme()): string {
  const m = /^var\(\s*--woori-([a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/.exec(css.trim())
  if (!m) return css
  const want = m[1]
  for (const [name, value] of Object.entries(tokensFor(theme))) if (kebab(name) === want) return value
  return m[2]?.trim() ?? css
}

/* ───────────────────────── 테마 ───────────────────────── */

/** 테마 저장 키 (sessionStorage). 숨은 메뉴의 시나리오 되돌리기도 이것은 지우지 않는다 (WooriLocalMenu) */
export const WOORI_THEME_KEY = 'woori.theme'
const STORAGE_KEY = WOORI_THEME_KEY
const themeListeners = new Set<() => void>()
let override: WooriThemeName | null = null
let systemDark = false
let mediaQuery: MediaQueryList | null = null

function safeSessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSessionSet(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key)
    else window.sessionStorage.setItem(key, value)
  } catch {
    /* private mode 등: 무시 */
  }
}

function parseTheme(v: string | null | undefined): WooriThemeName | 'auto' | null {
  return v === 'dark' || v === 'light' || v === 'auto' ? v : null
}

export function getTheme(): WooriThemeName {
  return override ?? (systemDark ? 'dark' : 'light')
}

function applyTheme() {
  if (typeof document === 'undefined') return
  const theme = getTheme()
  const root = document.documentElement
  root.dataset.theme = theme
  for (const [k, v] of Object.entries(tokenCssVars(theme))) root.style.setProperty(k, v)
  applyBandsMeta()
  themeListeners.forEach((l) => l())
}

/** 앱 시작 때 1회 (main.tsx). URL 의 ?theme= 를 읽고 시스템 테마 변화를 구독한다 */
export function initTheme(search: string = window.location.search) {
  const fromUrl = parseTheme(new URLSearchParams(search).get('theme'))
  if (fromUrl === 'auto') {
    override = null
    safeSessionSet(STORAGE_KEY, null)
  } else if (fromUrl) {
    override = fromUrl
    safeSessionSet(STORAGE_KEY, fromUrl)
  } else {
    const stored = parseTheme(safeSessionGet(STORAGE_KEY))
    override = stored === 'dark' || stored === 'light' ? stored : null
  }
  if (!mediaQuery && typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark = mediaQuery.matches
    mediaQuery.addEventListener('change', (e) => {
      systemDark = e.matches
      applyTheme()
    })
  }
  applyTheme()
}

/** 코드에서 테마 강제 (null = 시스템 따름) */
export function setThemeOverride(theme: WooriThemeName | null) {
  override = theme
  safeSessionSet(STORAGE_KEY, theme)
  applyTheme()
}

function subscribeTheme(cb: () => void) {
  themeListeners.add(cb)
  return () => {
    themeListeners.delete(cb)
  }
}

/** 지금 테마 (바뀌면 리렌더) */
export function useWooriTheme(): WooriThemeName {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme)
}

/* ───────────────────────── 프레임 모드 띠 ─────────────────────────
 * 띠 = ?frame=1 의 위 스페이서(상태바 0–31.333dp)와 아래 스페이서(내비 바 832–880dp) 색.
 * 레이어(페이지)마다 요청을 모으고, App 이 알려 주는 맨 위 레이어의 요청만 쓴다. 한 레이어 안에서는 나중에 마운트된 요청이 이긴다
 * (예: 홈이 회색을 바라고, 그 위 팝업 시트(WooriSheet variant='popup')가 내비만 검정으로).
 */

export interface WooriBands {
  /** 위 스페이서 (상태바 자리). CSS 색 — 토큰 참조 'var(--woori-bg-gray)' 도 된다 */
  statusbar?: string
  /** 아래 스페이서 (내비 바 자리) */
  navbar?: string
}

/** 띠 기본값: 페이지 바탕 (영상의 대부분 화면에서 상태바·내비 바 바탕이 흰색 255) */
export const WOORI_BAND_DEFAULT = 'var(--woori-bg)'

interface BandEntry {
  layer: string
  id: string
  seq: number
  bands: WooriBands
}

let bandEntries: BandEntry[] = []
let bandSeq = 0
let topLayer: string | null = null
const bandListeners = new Set<() => void>()
let bandSnapshot: Required<WooriBands> = { statusbar: WOORI_BAND_DEFAULT, navbar: WOORI_BAND_DEFAULT }

function computeBands(): Required<WooriBands> {
  let statusbar: string | undefined
  let navbar: string | undefined
  const mine = bandEntries.filter((e) => e.layer === topLayer).sort((a, b) => b.seq - a.seq)
  for (const e of mine) {
    statusbar ??= e.bands.statusbar
    navbar ??= e.bands.navbar
  }
  return { statusbar: statusbar ?? WOORI_BAND_DEFAULT, navbar: navbar ?? WOORI_BAND_DEFAULT }
}

function applyBandsMeta() {
  if (typeof document === 'undefined' || document.documentElement.dataset.frame === '1') return
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = resolveColor(bandSnapshot.statusbar)
}

function emitBands() {
  const next = computeBands()
  if (next.statusbar !== bandSnapshot.statusbar || next.navbar !== bandSnapshot.navbar) {
    bandSnapshot = next
    applyBandsMeta()
    bandListeners.forEach((l) => l())
  }
}

/** App.tsx: 지금 맨 위 레이어 (그 레이어의 띠 요청만 쓴다) */
export function setTopBandLayer(layerKey: string | null) {
  if (topLayer === layerKey) return
  topLayer = layerKey
  emitBands()
}

function subscribeBands(cb: () => void) {
  bandListeners.add(cb)
  return () => {
    bandListeners.delete(cb)
  }
}

/** 지금 쓰이는 띠 색 (App.tsx 의 프레임이 스페이서에 칠한다) */
export function useWooriFrameBands(): Required<WooriBands> {
  return useSyncExternalStore(
    subscribeBands,
    () => bandSnapshot,
    () => bandSnapshot,
  )
}

/** 도구·디버그용: 지금 띠 색 */
export function getFrameBands(): Required<WooriBands> {
  return bandSnapshot
}

/** App.tsx 가 페이지 레이어마다 넣는다: 그 레이어의 key (useWooriBands 가 어느 레이어의 요청인지 안다) */
export const WooriBandLayerContext = createContext<string>('')

/**
 * 이 컴포넌트가 마운트된 동안 프레임 띠 색을 바란다 (그 레이어가 맨 위일 때만 보인다). null 이면 바라지 않음.
 *   useWooriBands({ statusbar: 'var(--woori-bg-gray)', navbar: 'var(--woori-bg-gray)' })   // 홈 (241 회색)
 *   useWooriBands(popupOpen ? { navbar: '#000000' } : null)                               // 팝업 딤 때 내비 검정
 * 레이아웃 effect 라 첫 프레임부터 칠해져 있다. 값만 바뀌면 순서(나중에 마운트된 것이 이김)는 그대로다.
 */
export function useWooriBands(bands: WooriBands | null | undefined) {
  const layer = useContext(WooriBandLayerContext)
  const id = useId()
  const statusbar = bands?.statusbar
  const navbar = bands?.navbar
  const active = bands != null
  useLayoutEffect(() => {
    if (!active) return
    const seq = ++bandSeq
    bandEntries = [...bandEntries, { layer, id, seq, bands: {} }]
    return () => {
      bandEntries = bandEntries.filter((e) => !(e.id === id && e.seq === seq))
      emitBands()
    }
  }, [layer, id, active])
  useLayoutEffect(() => {
    if (!active) return
    bandEntries = bandEntries.map((e) => (e.id === id && e.layer === layer ? { ...e, bands: { statusbar, navbar } } : e))
    emitBands()
  }, [layer, id, active, statusbar, navbar])
}
