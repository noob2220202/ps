// 진입점: 전역 CSS, 프레임 모드(?frame=1), 테마·토큰(?theme=), shot 모드(?shot=) 초기화 후 렌더
// 글꼴은 index.html 이 /fonts/woori-font.css 로 읽는다 (spec/font.md 8절).
import './woori.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { installWooriFit } from './WooriEnv.ts'
import { readShot, WOORI_MOTION, type WooriTransition, type WooriTransitionKind } from './WooriNav.ts'
import { markShotReady, registeredShots } from './WooriShot.ts'
import { getFrameBands, getTheme, setThemeOverride, initTheme, WOORI_TOKEN_SOURCE, type WooriBands, type WooriThemeName } from './WooriTheme.ts'

/** 도구·검증용 핸들 (예: wooriDebug.navigate('/send/account', 'push')) */
interface WooriDebug {
  setThemeOverride: (theme: WooriThemeName | null) => void
  theme: () => WooriThemeName
  markShotReady: typeof markShotReady
  /** 화면별 등록된 shot id */
  shots: () => Record<string, readonly string[]>
  /** 지금 프레임 띠 색 */
  bands: () => Required<WooriBands>
  /** 'spec/tokens.json' | 'placeholder' */
  tokenSource: string
  motion: typeof WOORI_MOTION
  /** App 이 마운트되면 생긴다: 전환을 붙여 이동 (숫자면 기록 이동) */
  navigate?: (to: string | number, transition?: WooriTransition | WooriTransitionKind, options?: { replace?: boolean }) => void
  /** 로컬 빌드만: 폰 뒤로 버튼을 흉내 (APK 의 backButton 과 같은 처리). 무엇을 했는지 돌려준다 */
  pressBack?: (canGoBack?: boolean) => string
}

declare global {
  interface Window {
    wooriDebug?: WooriDebug
  }
}

const FRAME_KEY = 'woori.frame'

/**
 * 프레임 모드: ?frame=1 이면 <html data-frame="1"> → 위 31dp 스페이서 + 앱 셸(360 x 800.667dp, 보정 transform) + 아래 48dp 스페이서.
 * 360x880 뷰포트를 DSF 16/11 로 찍으면 524x1280 = 영상 프레임 1:1 (tools/woori-units.cjs FRAME_MODE). 세션 동안 유지되고 ?frame=0 으로 끈다.
 * index.html 의 인라인 스크립트가 첫 페인트 전에 같은 규칙으로 먼저 단다.
 */
function initFrameMode(search: string) {
  const q = new URLSearchParams(search).get('frame')
  let on = false
  try {
    if (q === '1') window.sessionStorage.setItem(FRAME_KEY, '1')
    else if (q === '0') window.sessionStorage.removeItem(FRAME_KEY)
    on = window.sessionStorage.getItem(FRAME_KEY) === '1'
  } catch {
    on = q === '1'
  }
  if (on) document.documentElement.dataset.frame = '1'
  else delete document.documentElement.dataset.frame
}

/** shot 모드: 첫 렌더 전에 data-shot 을 달고(트랜지션 끔), 화면이 준비될 때까지 __WOORI_READY__ = false */
function initShotMode(search: string) {
  const shot = readShot(search)
  if (!shot) return
  document.documentElement.dataset.shot = shot
  window.__WOORI_READY__ = false
}

initFrameMode(window.location.search)
initTheme(window.location.search)
initShotMode(window.location.search)
// 프레임 모드가 아니면 큰 화면 맞춤 (태블릿: 360dp 기준 앱 전체를 확대해 화면 높이를 채운다 — WooriEnv)
installWooriFit()

// 글꼴 로드 완료 표시: html[data-fonts-ready="1"]
void document.fonts?.ready.then(() => {
  document.documentElement.dataset.fontsReady = '1'
})

window.wooriDebug = {
  setThemeOverride,
  theme: getTheme,
  markShotReady,
  shots: registeredShots,
  bands: getFrameBands,
  tokenSource: WOORI_TOKEN_SOURCE,
  motion: WOORI_MOTION,
}

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

// 로컬 빌드(VITE_WOORI_LOCAL=1, 서버 없는 APK — tools/build-apk.sh): '/api' 를 앱 안 backend(sql.js)로 가로채고 숨은 메뉴를 단 뒤 그린다.
// 웹 빌드에선 조건이 false 로 접혀 이 import 가 번들에서 빠지고, 지금처럼 바로 그린다.
if (import.meta.env.VITE_WOORI_LOCAL === '1') {
  void import('./WooriLocal.ts').then(
    (m) => {
      m.startWooriLocal()
      render()
    },
    (err: unknown) => {
      console.error('[woori-local] 로컬 모드를 불러오지 못했다', err)
      render()
    },
  )
} else {
  render()
}
