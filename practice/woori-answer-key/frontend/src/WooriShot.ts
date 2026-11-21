// WooriShot — ?shot=<상태 id> 결정적 스크린샷 약속 (tools/shot.cjs 와, tools/README.md '앱 쪽 약속')
//
//   1. 화면이 자기 shot 상태 표를 등록한다:  const shot = useShotState('history', HISTORY_SHOTS)
//      → URL 의 ?shot= 이 표에 있으면 { id, state }, 없거나 shot 모드가 아니면 null. 화면은 그 state 로 "바로 그 모습"을 그린다
//        (데이터는 고정 시나리오 — shot.cjs 가 찍기 전에 POST /api/dev/reset {scenario}).
//      표에 없는 id 면 console.error 를 남기고 준비 표시를 하지 않는다 → shot.cjs 가 15초 기다린 뒤 'READY 없음' 으로 알린다.
//   2. 다 그렸으면 useShotReady(ready) — 글꼴(spec/font.md 8절: fonts.ready + fonts.load) → 모든 <img> decode → 2 프레임 뒤
//      window.__WOORI_READY__ = true. shot 모드가 아니면 아무것도 안 한다.
//   main.tsx 가 shot 모드면 첫 렌더 전에 <html data-shot="<id>"> 를 달고 __WOORI_READY__ = false 로 둔다
//   (woori.css: CSS 트랜지션 끔·캐럿 숨김·스피너 0 위상 고정).
// 애니메이션 중간 위상은 shots 항목의 "t"(shot.cjs --t)로 고른다. 화면이 위상을 직접 고를 때는 pause() 대신 playbackRate = 0 으로
// 세운다 (Playwright animations:'disabled' 가 멈춘 유한 애니메이션을 끝으로 보내기 때문, tools/README.md 주의).
import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { readShot } from './WooriNav.ts'

declare global {
  interface Window {
    /** shot 모드에서 화면이 준비되면 true (tools/shot.cjs 가 기다린다) */
    __WOORI_READY__?: boolean
    /** tools/shot.cjs 가 페이지 스크립트보다 먼저 true 로 둔다 */
    __WOORI_SHOT__?: boolean
    /** shot.cjs --t (ms). 없으면 null/undefined */
    __WOORI_SHOT_T__?: number | null
    /** 모르는 shot id 등 준비할 수 없는 이유 (도구가 읽는다) */
    __WOORI_SHOT_ERROR__?: string
  }
}

/** 화면 이름 → 등록된 shot id 목록 (wooriDebug.shots() 로 본다) */
const registry = new Map<string, readonly string[]>()

export function registeredShots(): Record<string, readonly string[]> {
  return Object.fromEntries(registry)
}

/** 이 레이어(페이지)의 ?shot= 값. shot 모드가 아니면 null */
export function useShot(): string | null {
  const { search } = useLocation()
  return useMemo(() => readShot(search), [search])
}

/**
 * 화면의 shot 상태 표 등록 + 지금 shot 찾기.
 *   const HOME_SHOTS = { idle: { scrollTop: 0 }, 'scrolled-260': { scrollTop: 260 } } as const   // 모듈 상수로
 *   const shot = useShotState('home', HOME_SHOTS)
 *   shot?.id === 'scrolled-260' → shot.state.scrollTop
 * states 는 렌더마다 새로 만들지 말고 모듈 상수로 넘긴다.
 */
export function useShotState<S>(screen: string, states: Readonly<Record<string, S>>): { id: string; state: S } | null {
  const shot = useShot()
  useEffect(() => {
    registry.set(screen, Object.keys(states))
  }, [screen, states])
  const known = shot != null && Object.hasOwn(states, shot)
  useEffect(() => {
    if (shot == null || known) return
    const msg = `[woori-shot] '${screen}' 화면에 없는 shot id: '${shot}' (있는 것: ${Object.keys(states).join(', ') || '없음'})`
    window.__WOORI_SHOT_ERROR__ = msg
    console.error(msg)
  }, [screen, shot, known, states])
  return useMemo(() => (shot != null && known ? { id: shot, state: states[shot] } : null), [shot, known, states])
}

/** 화면 쓰는 글꼴 (spec/font.md 8절): 이 굵기·글자를 불러 둔 뒤 준비 표시 */
const FONT_PROBES = ['400 16px "Pretendard Variable"', '600 17px "Pretendard Variable"', '700 22px "Pretendard Variable"']

let readyRun = 0

/**
 * shot 모드면: 글꼴 → <img> decode → (넘긴 약속들) → 2 프레임 뒤 window.__WOORI_READY__ = true.
 * shot 모드가 아니면 아무것도 안 한다. 여러 번 불러도 마지막 호출 기준으로 한 번만 켠다.
 */
export function markShotReady(...waits: Array<Promise<unknown>>): void {
  if (!readShot()) return
  const run = ++readyRun
  void (async () => {
    try {
      await document.fonts.ready
      await Promise.all(FONT_PROBES.map((f) => document.fonts.load(f, '가1').catch(() => null)))
      await document.fonts.ready
    } catch {
      /* FontFaceSet 이 없는 환경: 건너뜀 */
    }
    await Promise.all(
      Array.from(document.images, (img) => (img.complete && img.naturalWidth ? null : img.decode().catch(() => null))),
    )
    await Promise.all(waits.map((w) => w.catch(() => null)))
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    if (run === readyRun) window.__WOORI_READY__ = true
  })()
}

/** 화면용: ready 가 true 가 되면(데이터·그림이 다 그려지면) shot 준비 완료를 알린다 */
export function useShotReady(ready: boolean = true) {
  const shot = useShot()
  useEffect(() => {
    if (shot && ready) markShotReady()
  }, [shot, ready])
}
