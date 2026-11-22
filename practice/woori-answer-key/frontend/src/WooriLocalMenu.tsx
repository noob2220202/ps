// 로컬 모드(서버 없는 APK, VITE_WOORI_LOCAL=1)의 App 밖 React 루트 — WooriLocal.ts startWooriLocal() 이 #woori-local-root 에 그린다.
//
//   - 진짜 상태바·내비 바 뒤 색 = 화면이 바라는 띠 색 (useWooriFrameBands → 네이티브 WooriBars 플러그인, android MainActivity 옆).
//     큰 화면에서 앱 기둥 양옆 바탕이 기둥으로 보일 만큼 넓으면(WooriEnv useWooriFit() side · 한쪽 gutter ≥ 8dp) 두 바도 그 바탕색(--woori-side-bg)
//     — 기둥이 떠 있는 모양. 640dp 바닥 맞춤으로 생기는 1dp 남짓 틈(360x638 등)은 화면 띠 색 그대로
//   (예전의 숨은 메뉴 '시나리오 되돌리기'(맨 위 가운데 5번 탭)는 뺐다 — 처음 상태로는 앱 데이터 삭제)
import { Capacitor, registerPlugin } from '@capacitor/core'
import { useEffect } from 'react'
import { useWooriFit } from './WooriEnv.ts'
import { resolveColor, useWooriFrameBands } from './WooriTheme.ts'

/* ───────────────────────── 진짜 상태바·내비 바 색 (APK) ───────────────────────── */

interface WooriBarsPlugin {
  setColors(o: { statusBar: string; navBar: string }): Promise<void>
}
const WooriBars = registerPlugin<WooriBarsPlugin>('WooriBars')

let probeCtx: CanvasRenderingContext2D | null = null
/** CSS 색 → '#rrggbb' (Android Color.parseColor 가 읽는 모양). 모르면 흰색 */
function toHex(css: string): string {
  probeCtx ??= document.createElement('canvas').getContext('2d')
  if (!probeCtx) return '#ffffff'
  probeCtx.fillStyle = '#ffffff'
  probeCtx.fillStyle = css
  const v = String(probeCtx.fillStyle)
  if (v.startsWith('#')) return v
  const m = /rgba?\(([^)]+)\)/.exec(v)
  if (!m) return '#ffffff'
  const [r, g, b] = m[1].split(',').map((x) => Math.round(Number(x)))
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

/** 앱 기둥 양옆 바탕 (woori.css --woori-side-bg 와 같은 값) */
const SIDE_BG = '#e9ebee'
/** 바를 양옆 바탕색으로 바꾸는 한쪽 gutter 폭 (dp) — 이보다 좁은 틈은 떠 있는 기둥으로 보이지 않는다 */
const COLUMN_GUTTER = 8

function WooriLocalBars() {
  const bands = useWooriFrameBands()
  const { side, gutter } = useWooriFit()
  const column = side && gutter >= COLUMN_GUTTER
  useEffect(() => {
    const statusBar = column ? SIDE_BG : toHex(resolveColor(bands.statusbar))
    const navBar = column ? SIDE_BG : toHex(resolveColor(bands.navbar))
    void WooriBars.setColors({ statusBar, navBar }).catch(() => {})
  }, [bands, column])
  return null
}

/** #woori-local-root 에 그리는 것 (APK 에서만 바 색) */
export default function WooriLocalRoot() {
  return Capacitor.isNativePlatform() ? <WooriLocalBars /> : null
}
