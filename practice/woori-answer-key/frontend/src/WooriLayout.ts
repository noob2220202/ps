// WooriLayout — 비교 스크린샷(?frame=1, DSF 16/11)에서 dp 위치가 영상과 정확히 맞게 놓는 도우미 (frontend/README '렌더 규칙')
//
// 1) 소수 dp 위치: 레이아웃 위치(top/left/width/height)는 그리기 전에 절대 좌표 기준 정수 dp 로 반올림되고 transform 은 그대로다 (units.md 6.2절).
//    → wooriPlace(x, y): 정수 left/top + 남는 소수는 translate 속성 (transform 애니메이션과 따로 논다).
// 2) 아래에 붙는 상자: 앱 뷰포트 높이가 800.667dp 라 bottom + height 가 정수인 상자의 위끝은 x.667 → 반올림으로 0.333dp(0.48px) 아래로 간다
//    (bottom 18 · 높이 56 버튼: 1103.03px, 영상 1102.55px). → style 에 WOORI_BOTTOM_FIX (translate: 0 var(--woori-bottom-fix), 프레임 모드 −0.333px).
//    bottom + height 가 정수가 아니면(위끝이 정수 dp) 쓰지 않는다.
// 3) 스크롤 컨테이너: 아래 머리말.
//
// 스크롤 컨테이너 — 프레임 모드(?frame=1)에서 스크롤 컨테이너 안 내용이 D1 자리에 정확히 놓이게 (frontend/README '렌더 규칙 — 스크롤 컨테이너')
//
// 왜: Chromium 은 스크롤 컨테이너 안 내용의 화면 위치(컨테이너 원점 − 스크롤 위치)를 정수 기기 화소로 반올림한다
//     (합성 스크롤이거나 스크롤 위치가 0 이 아니면). DSF 16/11 스크린샷에서 기기 화소 = 영상 frame px 라서, 원점이 소수 px 인
//     컨테이너 안의 모든 것이 최대 ±0.5px 밀린다. 셸 원점은 기기 (−0.4255, 45.5753)px 라 그대로면 (+0.43, +0.42)px (실측).
// 어떻게: 컨테이너를 transform 으로 옮겨 원점을 정수 기기 화소에 두고, 안쪽 내용 상자를 같은 만큼 되돌린다 → 반올림이 있든 없든 같은 자리.
//   - 페이지 스크롤 컨테이너(.woori-layer__scroll)는 woori.css 가 고정 값으로 한다 (--woori-snap-x/y).
//   - 화면 안의 스크롤 컨테이너는 useWooriScrollFix: <div ref={ref} className="woori-scroll-fix" style={{ overflowX: 'auto' }}>
//                                                      <div className="woori-scroll-fix__content">…</div></div>
//   - 스크롤 위치는 기기 화소(11/16dp) 배수일 때만 정확하다. shot 에서 스크롤 위치를 놓을 때는 wooriScrollTo(컨테이너, dp):
//     가장 가까운 배수로 scrollTop 을 두고 나머지는 --woori-scroll-residual 로 내용 상자가 옮긴다 (사용자가 스크롤하면 지운다).
// 프레임 모드가 아니면(실제 앱) 아무것도 하지 않는다 (셸 원점이 정수라 필요 없다).
import { useLayoutEffect, type CSSProperties, type RefObject } from 'react'
import { isFrameMode } from './WooriNav.ts'

const round4 = (v: number) => Math.round(v * 10000) / 10000

function dpr(): number {
  return window.devicePixelRatio || 1
}

/**
 * 스크롤 위치를 dp 로 놓는다 (shot 상태의 scrollTop 등).
 * 프레임 모드: scrollTop = 가장 가까운 기기 화소 배수, 나머지(|r| ≤ 0.5 기기 화소)는 컨테이너의 --woori-scroll-residual → 내용 상자 transform.
 * 실제 앱: scrollTop = topDp 그대로. 돌려주는 값 = 둔 scrollTop (dp).
 * 컨테이너 = .woori-layer__scroll 또는 .woori-scroll-fix (안쪽 내용 상자가 --woori-scroll-residual 을 읽는다).
 */
export function wooriScrollTo(scroller: HTMLElement, topDp: number): number {
  if (!isFrameMode()) {
    scroller.scrollTop = topDp
    return scroller.scrollTop
  }
  const k = dpr()
  // Chromium 은 스크롤 위치를 정수 기기 화소로 저장한다 (읽으면 CSS px 로 반올림된 값이 나와 믿을 수 없다 — 99.6875 를 두면 100).
  // 그래서 둔 값(기기 화소 배수)으로 나머지를 계산한다
  const snapped = Math.round(topDp * k) / k
  scroller.scrollTop = snapped
  const readBack = scroller.scrollTop
  const residual = topDp - snapped
  if (Math.abs(residual) > 1e-4) {
    scroller.style.setProperty('--woori-scroll-residual', `${round4(residual)}px`)
    const onScroll = () => {
      if (Math.abs(scroller.scrollTop - readBack) < 0.01) return
      scroller.style.removeProperty('--woori-scroll-residual')
      scroller.removeEventListener('scroll', onScroll)
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
  } else {
    scroller.style.removeProperty('--woori-scroll-residual')
  }
  return snapped
}

/** 이 레이어 페이지 상자가 멈춰 있을 때의 화면 원점 (기기 px) = 셸 원점 (프레임 모드: −0.4255, 45.5753) */
function shellOriginDevice(el: HTMLElement): { x: number; y: number } | null {
  const shell = el.closest<HTMLElement>('.woori-shell')
  if (!shell) return null
  const r = shell.getBoundingClientRect()
  return { x: r.left * dpr(), y: r.top * dpr() }
}

/**
 * 화면 안의 스크롤 컨테이너를 기기 화소에 맞춘다 (프레임 모드만). ref 요소에 className 'woori-scroll-fix',
 * 그 바로 안 내용 상자에 'woori-scroll-fix__content' 를 단다. 마운트·크기 변화·조상 스크롤 때 다시 잰다.
 * 위치는 그 레이어 페이지 상자 기준으로 재서 셸 원점에 더한다 → 페이지 전환 중에 마운트돼도 멈춘 자리 기준이다.
 */
export function useWooriScrollFix(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !isFrameMode()) return
    const pageBox = el.closest<HTMLElement>('.woori-layer__page')
    const apply = () => {
      el.style.setProperty('--woori-fix-x', '0px')
      el.style.setProperty('--woori-fix-y', '0px')
      const origin = shellOriginDevice(el)
      if (!origin || !pageBox) return
      const k = dpr()
      const r = el.getBoundingClientRect()
      const p = pageBox.getBoundingClientRect()
      // 가로·세로 배율 (프레임 셸의 scaleX 1.0024 포함): 화면 px ÷ CSS px
      const sx = el.offsetWidth ? r.width / el.offsetWidth : 1
      const sy = el.offsetHeight ? r.height / el.offsetHeight : 1
      // 스크롤 내용의 원점 = 안쪽(padding box) 왼쪽 위 → 테두리 두께만큼 안
      const ox = origin.x + (r.left - p.left + el.clientLeft * sx) * k
      const oy = origin.y + (r.top - p.top + el.clientTop * sy) * k
      el.style.setProperty('--woori-fix-x', `${round4((Math.round(ox) - ox) / (k * sx))}px`)
      el.style.setProperty('--woori-fix-y', `${round4((Math.round(oy) - oy) / (k * sy))}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    // 조상 스크롤 컨테이너가 움직이면 원점이 바뀐다
    const scrollRoot = el.parentElement?.closest<HTMLElement>('.woori-layer__scroll, .woori-scroll-fix')
    scrollRoot?.addEventListener('scroll', apply, { passive: true })
    return () => {
      ro.disconnect()
      scrollRoot?.removeEventListener('scroll', apply)
    }
  }, [ref])
}

/* ───────────────────────── 소수 dp 위치 · 아래에 붙는 상자 ───────────────────────── */

/**
 * 소수 dp 자리에 놓는 style: 정수 left/top + 남는 소수는 translate (레이아웃 반올림을 피한다).
 *   <div style={{ position: 'absolute', ...wooriPlace(20.5, 133.25) }} />  → left 20, top 133, translate 0.5px 0.25px
 * 부모 상자의 위치도 정수 dp 여야 한다 (부모의 소수도 같이 반올림된다).
 */
export function wooriPlace(xDp: number, yDp: number): CSSProperties {
  const x = Math.floor(xDp)
  const y = Math.floor(yDp)
  const fx = round4(xDp - x)
  const fy = round4(yDp - y)
  return fx || fy ? { left: x, top: y, translate: `${fx}px ${fy}px` } : { left: x, top: y }
}

/**
 * 아래에 붙는 상자(bottom + height 가 정수 dp)의 0.333dp 반올림 보정. 프레임 모드에서만 값이 있다 (woori.css --woori-bottom-fix).
 *   <button style={{ position: 'absolute', bottom: 18, height: 56, ...WOORI_BOTTOM_FIX }} />  → 영상 1102.55–1184.0px
 * transform 애니메이션과 함께 써도 된다 (translate 는 따로 합쳐진다). 시트 패널은 style 로 넘긴다.
 */
export const WOORI_BOTTOM_FIX: CSSProperties = { translate: '0 var(--woori-bottom-fix)' }

/* ───────────────────────── 키가 다른 화면 (APK) — 아래끝 기준 자리 ───────────────────────── */
//
// 영상 앱 뷰포트(셸)는 800.667dp 지만 실제 폰 웹뷰는 상태바·내비 바를 뺀 높이라 대개 690–780dp 다 (WooriEnv 화면 맞춤이
// 레이아웃 높이를 640dp 아래로는 내리지 않는다). 영상에서 아래쪽에 붙어 있던 것(키패드 · [확인] · [이체] 단추 등)을
// top 고정값으로 두면 키 작은 폰에서 잘린다 → 아래끝 기준으로 놓는다:
//   top: calc(var(--woori-page-h) - (800.667 − y)px)
//   --woori-page-h = 실제 앱 100% (담는 상자 높이) · 프레임 모드 800.667px (woori.css)
//   → 프레임 모드에서는 top: y 와 계산값이 똑같다 (영상 비교 픽셀 그대로). 실제 앱에서는 페이지 아래끝과의 거리를 지킨다.
// 담는 상자(가장 가까운 position 조상)가 페이지 높이(셸 높이)인 절대 위치 상자에만 쓴다 (스크롤 내용 상자 안에서는 뜻이 달라진다).
// CSS 파일에서는 같은 식을 그대로: top: calc(var(--woori-page-h) - 74px)   /* 영상 top 726.667 */

/** 영상 앱 뷰포트(셸) 높이 dp = 프레임 모드 --woori-shell-h */
export const WOORI_VIDEO_PAGE_H = 800.667

/** 영상에서 top = yDp 인 상자의 아래끝 기준 top 값 (style.top 에 그대로) */
export function wooriBottomTop(yDp: number): string {
  return `calc(var(--woori-page-h) - ${round4(WOORI_VIDEO_PAGE_H - yDp)}px)`
}

/** wooriPlace 의 아래끝 기준판: 정수 left + 아래끝 기준 top(정수 y 부분) + 남는 소수는 translate */
export function wooriPlaceBottom(xDp: number, yDp: number): CSSProperties {
  const x = Math.floor(xDp)
  const y = Math.floor(yDp)
  const fx = round4(xDp - x)
  const fy = round4(yDp - y)
  const top = wooriBottomTop(y)
  return fx || fy ? { left: x, top, translate: `${fx}px ${fy}px` } : { left: x, top }
}
