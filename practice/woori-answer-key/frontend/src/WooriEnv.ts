// 빌드·실행 환경 플래그 — 화면이 읽는 것만 (가벼운 모듈: 로컬 모드 코드(sql.js 등)를 끌어오지 않는다).
//   WOORI_LOCAL  로컬 빌드 (VITE_WOORI_LOCAL=1 — 서버 없는 APK 용. tools/build-apk.sh). 웹 빌드에선 false 로 접혀 관련 코드가 빠진다
//   네이티브      APK(Capacitor) 안에서 도는 중 → <html data-woori-native="1"> (WooriLocalMenu.startWooriLocal 이 단다)
// APK 약속 (BRIEF D14): ?frame 스페이서 없음 · 진짜 상태바·내비 바 · 삼성 키보드 재현 대신 진짜 시스템 키보드 · 폰 뒤로 버튼 → 앱 뒤로.
//
// 이 모듈이 가진 실제 앱(프레임 모드 아님) 몫 세 가지 — 프레임 모드·shot 모드에서는 아무것도 하지 않는다 (영상 비교 화면이 바뀌지 않게):
//   1. 뒤로 처리 스택 useWooriBack — 폰 뒤로 버튼(WOORI_BACK_EVENT)을 열린 대화상자 > 시트·팝업 > 페이지(머리 ‹·✕) 순서로 하나만 받는다
//   2. 토스트 wooriToast — App 이 셸 안에 그린다 (WooriToastHost). wooriTodo = 영상에 없는 곳 누름: 아무것도 하지 않는다(토스트 없음)
//   3. 화면 맞춤 installWooriFit — 앱(360dp 기준 레이아웃) 전체를 화면 폭·높이에 맞춰 확대·축소한다 (레이아웃 높이 640dp 바닥, 아래 '화면 맞춤').
//      시스템 키보드 판단 wooriKeyboardMayBeUp · onWooriKeyboardSettled 는 금액 화면(통장표기 시트 뒤 폼 자리)도 같이 쓴다
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

/**
 * onClick 에 바로: 영상에 없는 곳 누름 — 바깥(예: 카드 탭)으로 번지지 않게 막기만 하고 아무것도 하지 않는다.
 * (예전에는 '답지에는 없는 화면이에요' 토스트를 띄웠다 — 아무 데나 누를 때마다 떠서 뺐다)
 */
export function wooriTodo(e?: { stopPropagation?: () => void }): void {
  e?.stopPropagation?.()
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
//   그 밖(높이가 모자란 폰, 태블릿 세로·가로, 폴더블): 폰 비율 기둥 — k = min(폭/360, max(높이/800, min(한도, 높이/640)))
//     한도 = max(폭 몫, 경계 몫)
//       폭 몫 = max(1, min(폭/360, 2.5 − 폭/360)): 폰 폭(450dp 까지)은 폭/360 → k = 높이/640 (레이아웃 640dp 바닥을 지키는 만큼 키운다:
//         412x732 → 1.144, 412x700 → 1.094, 411x659 → 1.030, 360x600 → 0.9375, 320x568 → 0.8875) · 450–540dp 는 1 까지 차츰 · 540dp 위(태블릿)는 1
//       경계 몫 = 폭을 채운 레이아웃 높이(높이 ÷ 폭/360)가 560 → 640dp 일 때 1 → 폭/360 으로 차츰 (FIT_RAMP_H). 폰 모양 경계(그 높이 640)에서
//         한도가 폭/360 이 되어 k 가 폰 모양과 이어진다 — 450dp 넘는 폭에서도 폭·높이 1dp 차이로 튀지 않는다 (300–1400 x 400–2000 을 1dp 씩 훑어
//         한 걸음 0.013 아래). 폰 폭은 폭 몫이 이미 폭/360 이라 경계 몫이 바꾸는 것이 없다
//       태블릿(경계 몫이 1 인 곳): 높이 800 이상 → 높이/800 (기둥 높이 800dp 로 화면을 채운다: 800x1280 → 1.6, 1280x800 → 1) · 640–800 → 1 (레이아웃 높이 = 화면 높이)
//   셸 레이아웃 높이 = 지금 높이 / k. 시스템 키보드가 떠 있을 수 있는 동안(wooriKeyboardMayBeUp — 키보드는 입력칸에 포커스가 있을 때만 뜬다)
//   웹뷰 높이만 줄면 k 는 그대로 (그 폭에서 본 가장 큰 높이로 정한다) → 앱만 위로 줄어든다 (그동안은 640 아래일 수 있다 — 화면이 키보드 위로
//   줄어드는 것은 시스템 키보드 몫). 그 밖에 높이가 줄면(화면 분할 · 팝업 창) 처음 연 것처럼 다시 맞춘다. 입력칸에서 막 빠진 뒤 KBD_CLOSE_MS
//   동안은 아직 키보드가 닫히는 중으로 본다 (닫히며 오는 중간 높이에 k 가 튀지 않게) — 그 뒤 한 번 더 맞춰 자리를 잡는다 (onWooriKeyboardSettled).
//   기둥이 화면보다 좁으면 양옆 바탕(--woori-side-bg)이 보이고 <html data-woori-side="1">. APK 상태바·내비 바는 양옆이 기둥으로 보일 만큼
//   넓을 때(한쪽 gutter ≥ 8dp)만 그 색 (WooriLocalMenu — 1dp 남짓 틈에 바 색까지 바꾸지 않는다).
// 결과는 <html data-woori-fit="scale">(k ≠ 1 일 때) + --woori-fit-scale · --woori-shell-h. 포인터 좌표를 앱 dp 로 바꿀 때는 wooriFitScale() 로 나눈다
// (k < 1 도 같다. 셸 getBoundingClientRect 폭 ÷ offsetWidth 로 재도 된다 — WooriLocal appPoint).

export interface WooriFit {
  scale: number
  /** 양옆 바탕이 보이는지 (기둥 폭 < 화면 폭) */
  side: boolean
  /** 양옆 바탕 한쪽 폭 (화면 CSS px = (폭 − 360·k) / 2, 폭을 채우면 0) */
  gutter: number
  /** 화면(웹뷰) CSS px */
  width: number
  height: number
}

const COL_W = 360
const COL_H = 800
/** 셸 레이아웃 높이의 바닥 (dp). 폭을 꽉 채워도 이만큼 높이가 남으면 폰으로 보고 폭을 채운다 */
const MIN_H = 640
/** 폭을 채운 레이아웃 높이가 이만큼부터 MIN_H 까지면 한도를 폭/360 쪽으로 차츰 올린다 (폰 모양 경계에서 k 가 튀지 않게, dp) */
const FIT_RAMP_H = 560
/** 입력칸에서 포커스가 빠진 뒤 이만큼은 키보드가 닫히는 중으로 본다 (ms) */
const KBD_CLOSE_MS = 1000

let fitNow: WooriFit = { scale: 1, side: false, gutter: 0, width: 0, height: 0 }
const fitSubs = new Set<() => void>()

/** 지금 셸 배율 (프레임 모드·맞춤 전이면 1) */
export function wooriFitScale(): number {
  return fitNow.scale
}

/** 폭·높이(CSS px) → 배율. stableH = 그 폭에서 본 가장 큰 높이 (키보드로 줄어든 높이는 쓰지 않는다) */
export function wooriFitScaleFor(width: number, stableH: number): number {
  const kw = width / COL_W
  // 폭을 채웠을 때의 레이아웃 높이 (dp)
  const fillH = stableH / kw
  if (fillH >= MIN_H) return kw
  // 높이가 모자랄 때 키울 수 있는 한도 = max(폭 몫, 경계 몫).
  //   폭 몫: 폰 폭(kw ≤ 1.25)은 kw (→ 높이/640, 폰 모양과 이어진다), 1.25–1.5 는 1 까지 차츰, 그 위(태블릿)는 1
  //   경계 몫: fillH 가 FIT_RAMP_H → MIN_H 일 때 1 → kw (폰 모양 경계에서 한도 = kw → k = kw 로 이어진다)
  const ramp = Math.min(1, Math.max(0, (fillH - FIT_RAMP_H) / (MIN_H - FIT_RAMP_H)))
  const cap = Math.max(1, Math.min(kw, 2.5 - kw), 1 + (kw - 1) * ramp)
  return Math.min(kw, Math.max(stableH / COL_H, Math.min(cap, stableH / MIN_H)))
}

/** 시스템 키보드를 띄우는 입력칸인지 (글자 입력 input · textarea · contenteditable — 체크 상자·날짜 등은 아니다) */
function opensKeyboard(el: Element | null): boolean {
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && el.inputMode !== 'none' && /^(text|search|tel|url|email|password|number)$/.test(el.type)
  }
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && el.inputMode !== 'none'
  return el instanceof HTMLElement && el.isContentEditable
}

let leftInputAt = -Infinity
let kbdSettleTimer = 0
let kbdListening = false
const kbdSettleSubs = new Set<() => void>()

/** 입력칸에서 포커스가 빠진 때를 적는다 (한 번만 듣는다). KBD_CLOSE_MS 가 지나 키보드가 다 닫혔으면 onWooriKeyboardSettled 를 부른다 */
function listenKeyboardFocus(): void {
  if (kbdListening || typeof document === 'undefined') return
  kbdListening = true
  document.addEventListener('focusout', (e) => {
    if (!opensKeyboard(e.target as Element | null)) return
    leftInputAt = performance.now()
    window.clearTimeout(kbdSettleTimer)
    kbdSettleTimer = window.setTimeout(() => {
      for (const f of kbdSettleSubs) f()
    }, KBD_CLOSE_MS + 50)
  })
}

/**
 * 시스템 키보드가 떠 있을 수 있는지: 키보드를 띄우는 입력칸에 포커스가 있거나, 거기서 빠진 지 KBD_CLOSE_MS 안 (닫히는 중).
 * 아니면 웹뷰 높이가 줄어도 키보드가 아니다 (화면 분할 · 팝업 창) → 줄어든 높이를 그대로 쓴다.
 * 화면 맞춤(installWooriFit)과 금액 화면 높이(WooriSendAmount usePageHeight)가 같은 판단을 쓴다
 */
export function wooriKeyboardMayBeUp(): boolean {
  listenKeyboardFocus()
  return opensKeyboard(document.activeElement) || performance.now() - leftInputAt < KBD_CLOSE_MS
}

/** 입력칸에서 빠지고 KBD_CLOSE_MS 가 지나 키보드가 다 닫혔을 때 f (높이를 한 번 더 잰다 — 그동안 줄어든 높이가 그대로면 그 높이로). 돌려준 함수로 그만 듣는다 */
export function onWooriKeyboardSettled(f: () => void): () => void {
  listenKeyboardFocus()
  kbdSettleSubs.add(f)
  return () => kbdSettleSubs.delete(f)
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
    // 키보드일 수 있는 때(입력칸에 포커스가 있거나 막 빠졌을 때 — 닫히는 중)가 아니면 줄어든 높이로 다시 맞춘다 (화면 분할 · 팝업 창)
    if (Math.abs(w - stableW) > 1 || (h < stableH && !wooriKeyboardMayBeUp())) {
      stableW = w
      stableH = h
    } else stableH = Math.max(stableH, h)
    const k = Math.round(wooriFitScaleFor(w, stableH) * 10000) / 10000
    const side = COL_W * k < w - 1
    const gutter = Math.max(0, Math.round(((w - COL_W * k) / 2) * 100) / 100)
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
      fitNow = { scale: k, side, gutter, width: w, height: h }
      for (const f of fitSubs) f()
    }
  }
  apply()
  window.addEventListener('resize', apply)
  window.visualViewport?.addEventListener('resize', apply)
  // 입력칸에서 빠짐 → 키보드가 닫히는 동안은 기다렸다가, 끝나면 한 번 더 맞춘다 (높이가 그대로 작으면 그 높이로 자리 잡는다)
  onWooriKeyboardSettled(apply)
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
