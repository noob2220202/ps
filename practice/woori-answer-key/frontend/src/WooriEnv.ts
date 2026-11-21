// 빌드·실행 환경 플래그 — 화면이 읽는 것만 (가벼운 모듈: 로컬 모드 코드(sql.js 등)를 끌어오지 않는다).
//   WOORI_LOCAL  로컬 빌드 (VITE_WOORI_LOCAL=1 — 서버 없는 APK 용. tools/build-apk.sh). 웹 빌드에선 false 로 접혀 관련 코드가 빠진다
//   네이티브      APK(Capacitor) 안에서 도는 중 → <html data-woori-native="1"> (WooriLocalMenu.startWooriLocal 이 단다)
// APK 약속 (BRIEF D14): ?frame 스페이서 없음 · 진짜 상태바·내비 바 · 삼성 키보드 재현 대신 진짜 시스템 키보드 · 폰 뒤로 버튼 → 앱 뒤로.
//
// 이 모듈이 가진 실제 앱(프레임 모드 아님) 몫 세 가지 — 프레임 모드·shot 모드에서는 아무것도 하지 않는다 (영상 비교 화면이 바뀌지 않게):
//   1. 뒤로 처리 스택 useWooriBack — 폰 뒤로 버튼(WOORI_BACK_EVENT)을 열린 대화상자 > 시트·팝업 > 페이지(머리 ‹·✕) 순서로 하나만 받는다
//   2. 토스트 wooriToast · wooriTodo('답지에는 없는 화면이에요') — App 이 셸 안에 그린다 (WooriToastHost)
//   3. 화면 맞춤 installWooriFit — 앱(360dp 기준 레이아웃) 전체를 화면 폭·높이에 맞춰 확대·축소한다 (레이아웃 높이 640dp 바닥, 아래 '화면 맞춤')
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { isFrameMode, readShot } from './WooriNav.ts'

export const WOORI_LOCAL: boolean = import.meta.env.VITE_WOORI_LOCAL === '1'

/**
 * 폰 뒤로 버튼(APK). window 에 취소 가능한 Event 로 먼저 보낸다 — 화면은 직접 듣지 말고 useWooriBack 으로 등록한다
 * (이 모듈의 듣는 이가 등록된 것 중 하나만 부르고 preventDefault). 아무도 막지 않으면 WooriLocal.ts 가
 * 처음 화면(/ · /cert · /home)이면 '한 번 더 누르면 종료', 아니면 history.back().
 */
export const WOORI_BACK_EVENT = 'woori-back'

/** 로컬 모드 숨은 메뉴를 여는 window 이벤트 (WooriLocal.ts 모서리 탭 → WooriLocalMenu.tsx) */
export const WOORI_LOCAL_MENU_EVENT = 'woori-local-menu'

/** APK(Capacitor 네이티브) 안인지 */
export function wooriIsNative(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.wooriNative === '1'
}

/** 삼성 키보드 재현을 끄고 진짜 시스템 키보드를 쓸지: 로컬(APK) 빌드이면서 프레임 모드가 아닐 때 */
export function wooriUsesSystemKeyboard(): boolean {
  return WOORI_LOCAL && !isFrameMode()
}

/** 실제 앱 몫(토스트 등)을 켤지: 프레임 모드도 shot 모드도 아닐 때 */
export function wooriLiveApp(): boolean {
  return typeof document !== 'undefined' && !isFrameMode() && !readShot()
}

/* ───────────────────────── 1. 뒤로 처리 스택 ───────────────────────── */

/** 우선순위: 큰 값이 먼저. 같으면 나중에 등록한 것 */
export const WOORI_BACK_PRIO = {
  /** 페이지 기본 뒤로 (머리 ‹ · ✕ 와 같은 동작, 완료 화면 [확인]) */
  page: 10,
  /** 그 페이지의 시트·팝업 (WooriSheet onBack) */
  sheet: 20,
  /** App 밖 대화상자 (숨은 메뉴) */
  dialog: 30,
} as const

interface BackEntry {
  prio: number
  seq: number
  run: () => void
}

const backEntries: BackEntry[] = []
let backSeq = 0
let backListening = false

function onBackEvent(e: Event) {
  if (e.defaultPrevented || backEntries.length === 0) return
  let best = backEntries[0]
  for (const b of backEntries) if (b.prio > best.prio || (b.prio === best.prio && b.seq > best.seq)) best = b
  e.preventDefault()
  best.run()
}

/** 뒤로 처리 하나를 등록한다. 돌려준 함수로 뺀다 */
export function addWooriBackHandler(run: () => void, prio: number): () => void {
  if (!backListening && typeof window !== 'undefined') {
    window.addEventListener(WOORI_BACK_EVENT, onBackEvent)
    backListening = true
  }
  const entry: BackEntry = { prio, seq: ++backSeq, run }
  backEntries.push(entry)
  return () => {
    const i = backEntries.indexOf(entry)
    if (i >= 0) backEntries.splice(i, 1)
  }
}

/**
 * 폰 뒤로 버튼을 받는다 (handler 가 null/undefined 면 등록하지 않음). 페이지 레이어 안이면 맨 위 레이어일 때만 넘긴다
 * (예: useWooriBack(top && sheetOpen ? closeSheet : null, WOORI_BACK_PRIO.sheet)). handler 가 렌더마다 바뀌어도 다시 등록하지 않는다.
 */
export function useWooriBack(handler: (() => void) | null | undefined, prio: number = WOORI_BACK_PRIO.page): void {
  const ref = useRef(handler)
  useLayoutEffect(() => {
    ref.current = handler
  })
  const active = handler != null
  useEffect(() => {
    if (!active) return
    return addWooriBackHandler(() => ref.current?.(), prio)
  }, [active, prio])
}

/* ───────────────────────── 2. 토스트 ───────────────────────── */

export interface WooriToastItem {
  id: number
  text: string
}

/** 영상에 없어 동작이 없는 단추·메뉴를 눌렀을 때 (프레임·shot 모드에서는 안 나온다) */
export const WOORI_TODO_TEXT = '답지에는 없는 화면이에요'

let toastNow: WooriToastItem | null = null
let toastSeq = 0
let toastTimer = 0
const toastSubs = new Set<() => void>()

function emitToast() {
  for (const f of toastSubs) f()
}

/** 짧은 알림 (기본 2초). 프레임 모드·shot 모드에서는 아무것도 하지 않는다 */
export function wooriToast(text: string, ms = 2000): void {
  if (!wooriLiveApp()) return
  toastNow = { id: ++toastSeq, text }
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastNow = null
    emitToast()
  }, ms)
  emitToast()
}

/** onClick 에 바로: 바깥(예: 카드 탭)으로 번지지 않게 막고 '답지에는 없는 화면이에요' */
export function wooriTodo(e?: { stopPropagation?: () => void }): void {
  e?.stopPropagation?.()
  wooriToast(WOORI_TODO_TEXT)
}

/**
 * 글자를 클립보드에 넣고 토스트 (계좌번호 복사 아이콘 등 — 영상에는 누르는 장면이 없다: 설계).
 * navigator.clipboard 가 없거나 막히면(오래된 웹뷰·http) 숨은 textarea + execCommand('copy'). 둘 다 안 되면 실패 토스트.
 * onClick 에 바로 쓸 때는 e.stopPropagation() 을 먼저 (카드 탭으로 번지지 않게).
 */
export function wooriCopy(text: string, doneText = '계좌번호가 복사되었어요'): void {
  const fallback = (): boolean => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      ta.style.pointerEvents = 'none'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
  const report = (ok: boolean) => wooriToast(ok ? doneText : '복사하지 못했어요')
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => report(true),
      () => report(fallback()),
    )
  } else report(fallback())
}

export function useWooriToast(): WooriToastItem | null {
  return useSyncExternalStore(
    (f) => {
      toastSubs.add(f)
      return () => toastSubs.delete(f)
    },
    () => toastNow,
    () => null,
  )
}

/* ───────────────────────── 3. 화면 맞춤 (프레임 모드 아님) ───────────────────────── */
//
// 앱 안 레이아웃은 늘 360dp 폭 기준이고, 셸 레이아웃 높이는 640dp 아래로 내리지 않는다 (화면들은 640–900dp 높이에서 맞게 그린다).
// 360dp 가 아닌 화면에서는 셸(앱 뷰포트)을 360dp 폭 그대로 두고 transform: scale(k) 로 키우거나 줄인다 (위끝 가운데 기준):
//   폰 모양(폭을 채워도 높이가 640dp 이상 남는 화면): k = 폭/360 → 폭을 꽉 채운다 (360x800 · 412x915 · 384x854 → 1 · 1.144 · 1.067,
//     글자 크게 보기로 폭이 좁아진 320x690 → 0.889: 줄여서 360dp 를 다 보인다)
//   그 밖(태블릿 세로·가로, 폴더블, 키 작은 화면): 폰 비율 기둥 — k = min(폭/360, max(높이/800, min(1, 높이/640)))
//     높이 800 이상 → 높이/800 (기둥 높이 800dp 로 화면을 채운다: 800x1280 → 1.6, 1280x800 → 1)
//     640–800 → 1 (레이아웃 높이 = 화면 높이) · 640 아래 → 높이/640 (레이아웃 높이 640dp 를 줄여 보인다: 360x600 → 0.9375, 320x568 → 0.8875)
//   셸 레이아웃 높이 = 지금 높이 / k. 시스템 키보드가 떠서 웹뷰 높이만 줄면 k 는 그대로(그 폭에서 본 가장 큰 높이로 정한다) → 앱만 위로 줄어든다
//   (그동안은 640 아래일 수 있다 — 화면이 키보드 위로 줄어드는 것은 시스템 키보드 몫).
//   기둥이 화면보다 좁으면 양옆 바탕(--woori-side-bg)이 보이고 <html data-woori-side="1"> — APK 는 상태바·내비 바도 그 색 (WooriLocalMenu).
// 결과는 <html data-woori-fit="scale">(k ≠ 1 일 때) + --woori-fit-scale · --woori-shell-h. 포인터 좌표를 앱 dp 로 바꿀 때는 wooriFitScale() 로 나눈다
// (k < 1 도 같다. 셸 getBoundingClientRect 폭 ÷ offsetWidth 로 재도 된다 — WooriLocal appPoint).

export interface WooriFit {
  scale: number
  /** 양옆 바탕이 보이는지 (기둥 폭 < 화면 폭) */
  side: boolean
  /** 화면(웹뷰) CSS px */
  width: number
  height: number
}

const COL_W = 360
const COL_H = 800
/** 셸 레이아웃 높이의 바닥 (dp). 폭을 꽉 채워도 이만큼 높이가 남으면 폰으로 보고 폭을 채운다 */
const MIN_H = 640

let fitNow: WooriFit = { scale: 1, side: false, width: 0, height: 0 }
const fitSubs = new Set<() => void>()

/** 지금 셸 배율 (프레임 모드·맞춤 전이면 1) */
export function wooriFitScale(): number {
  return fitNow.scale
}

/** 폭·높이(CSS px) → 배율. stableH = 그 폭에서 본 가장 큰 높이 (키보드로 줄어든 높이는 쓰지 않는다) */
export function wooriFitScaleFor(width: number, stableH: number): number {
  const kw = width / COL_W
  if (stableH / kw >= MIN_H) return kw
  return Math.min(kw, Math.max(stableH / COL_H, Math.min(1, stableH / MIN_H)))
}

let fitInstalled = false

/** main.tsx 가 프레임 모드가 아닐 때 한 번 부른다 */
export function installWooriFit(): void {
  if (fitInstalled || typeof window === 'undefined' || isFrameMode()) return
  fitInstalled = true
  const root = document.documentElement
  let stableW = -1
  let stableH = 0
  const apply = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    if (!w || !h) return
    if (Math.abs(w - stableW) > 1) {
      stableW = w
      stableH = h
    } else stableH = Math.max(stableH, h)
    const k = Math.round(wooriFitScaleFor(w, stableH) * 10000) / 10000
    const side = COL_W * k < w - 1
    if (Math.abs(k - 1) > 0.0001) {
      root.dataset.wooriFit = 'scale'
      root.style.setProperty('--woori-fit-scale', String(k))
      root.style.setProperty('--woori-shell-h', `${Math.round((h / k) * 1000) / 1000}px`)
    } else {
      delete root.dataset.wooriFit
      root.style.removeProperty('--woori-fit-scale')
      root.style.removeProperty('--woori-shell-h')
    }
    if (side) root.dataset.wooriSide = '1'
    else delete root.dataset.wooriSide
    if (fitNow.scale !== k || fitNow.side !== side || fitNow.width !== w || fitNow.height !== h) {
      fitNow = { scale: k, side, width: w, height: h }
      for (const f of fitSubs) f()
    }
  }
  apply()
  window.addEventListener('resize', apply)
  window.visualViewport?.addEventListener('resize', apply)
}

export function useWooriFit(): WooriFit {
  return useSyncExternalStore(
    (f) => {
      fitSubs.add(f)
      return () => fitSubs.delete(f)
    },
    () => fitNow,
    () => fitNow,
  )
}
