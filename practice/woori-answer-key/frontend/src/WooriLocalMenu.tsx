// 로컬 모드(서버 없는 APK, VITE_WOORI_LOCAL=1)의 App 밖 React 루트 — WooriLocal.ts startWooriLocal() 이 #woori-local-root 에 그린다.
//
//   - 숨은 메뉴 '시나리오 되돌리기': 화면 맨 위 가운데(제목 자리) 5번 빠른 탭(WooriLocal.ts 가 WOORI_LOCAL_MENU_EVENT 를 보낸다) → 대화상자
//     (v1 시작 345원 · v2 시작 344원 · v2 끝 342원, '시계를 영상 시각에 고정' = POST /api/dev/reset {now:'video'}). 고르면 처음 화면(/)부터 다시 연다.
//     열려 있으면 폰 뒤로 버튼('woori-back')을 가장 먼저 받아 닫힌다 (WooriEnv 뒤로 처리 스택, dialog 우선순위).
//     연습에 필요한 값 안내: 계좌 비밀번호 1234 · 인증서 비밀번호는 아무 6자리 · 이 메뉴 여는 곳.
//   - 진짜 상태바·내비 바 뒤 색 = 화면이 바라는 띠 색 (useWooriFrameBands → 네이티브 WooriBars 플러그인, android MainActivity 옆).
//     큰 화면에서 앱 기둥 양옆 바탕이 보이면(WooriEnv useWooriFit().side) 두 바도 그 바탕색(--woori-side-bg) — 기둥이 떠 있는 모양
// 이 대화상자는 App 밖의 따로 된 React 루트라 position: fixed 를 쓴다 (페이지 내용 상자의 transform 과 무관).
import './WooriLocalMenu.css'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { SCENARIOS } from 'woori-backend/seed.js'
import { useWooriBack, useWooriFit, WOORI_BACK_PRIO, WOORI_LOCAL_MENU_EVENT } from './WooriEnv.ts'
import { resolveColor, useWooriFrameBands } from './WooriTheme.ts'

type ScenarioId = 'v1-start' | 'v2-start' | 'v2-end'
const SCENARIO_ROWS: readonly { id: ScenarioId; label: string; note: string }[] = [
  { id: 'v1-start', label: 'v1 시작', note: '1원 이체 전' },
  { id: 'v2-start', label: 'v2 시작 (= v1 끝)', note: '2원 이체 전' },
  { id: 'v2-end', label: 'v2 끝', note: '2원 이체 뒤' },
]

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

interface MenuInfo {
  balance: number | null
  now: string
  source: string
}

async function readInfo(): Promise<MenuInfo> {
  const [accounts, clock] = await Promise.all([
    fetch('/api/accounts').then((r) => r.json() as Promise<{ balance: number }[]>),
    fetch('/api/dev/clock').then((r) => r.json() as Promise<{ now: string; source: string }>),
  ])
  return { balance: accounts[0]?.balance ?? null, now: clock.now, source: clock.source }
}

function WooriLocalMenu() {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<MenuInfo | null>(null)
  const [videoClock, setVideoClock] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setError(null)
      readInfo().then(setInfo, (e: unknown) => setError(String(e)))
    }
    window.addEventListener(WOORI_LOCAL_MENU_EVENT, onOpen)
    return () => window.removeEventListener(WOORI_LOCAL_MENU_EVENT, onOpen)
  }, [])

  useWooriBack(open ? () => !busy && setOpen(false) : null, WOORI_BACK_PRIO.dialog)

  if (!open) return null

  const reset = async (scenario: ScenarioId) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/dev/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoClock ? { scenario, now: 'video' } : { scenario }),
      })
      if (!res.ok) throw new Error(`reset ${res.status}`)
      try {
        window.sessionStorage.removeItem('woori.nav.arrivals')
      } catch {
        /* 없어도 된다 */
      }
      window.location.replace('/')
    } catch (e) {
      setBusy(false)
      setError(String(e))
    }
  }

  return (
    <div className="woori-local-menu" role="presentation" onClick={() => !busy && setOpen(false)}>
      <div
        className="woori-local-menu__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="woori-local-menu-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="woori-local-menu-title" className="woori-local-menu__title">
          시나리오 되돌리기
        </h2>
        <p className="woori-local-menu__desc">
          기기 안에 저장된 잔액·거래내역·이체 결과를 고른 시나리오의 처음 상태로 되돌립니다. (연습용 답지 · 서버 없음)
        </p>
        <dl className="woori-local-menu__hint" data-testid="woori-local-hint">
          <div>
            <dt>계좌 비밀번호</dt>
            <dd>1234</dd>
          </div>
          <div>
            <dt>인증서 비밀번호</dt>
            <dd>아무 6자리</dd>
          </div>
          <div>
            <dt>이 메뉴</dt>
            <dd>화면 맨 위 가운데(제목 자리)를 빠르게 5번</dd>
          </div>
        </dl>
        <p className="woori-local-menu__now" data-testid="woori-local-now">
          {info
            ? `지금 잔액 ${info.balance === null ? '-' : won(info.balance)} · 시계 ${info.now.replace('T', ' ')} (${info.source === 'override' ? '고정' : '실제 시각'})`
            : '읽는 중…'}
        </p>
        <div className="woori-local-menu__list">
          {SCENARIO_ROWS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="woori-local-menu__item"
              data-scenario={s.id}
              disabled={busy}
              onClick={() => void reset(s.id)}
            >
              <span className="woori-local-menu__label">{s.label}</span>
              <span className="woori-local-menu__note">
                {won(SCENARIOS[s.id].balance)} · {s.note}
              </span>
            </button>
          ))}
        </div>
        <label className="woori-local-menu__check">
          <input type="checkbox" checked={videoClock} disabled={busy} onChange={(e) => setVideoClock(e.target.checked)} />
          시계를 영상 시각에 고정 (2026-11-21, 이체 시각)
        </label>
        {error && <p className="woori-local-menu__error">{error}</p>}
        <button type="button" className="woori-local-menu__close" disabled={busy} onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>
    </div>
  )
}

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

function WooriLocalBars() {
  const bands = useWooriFrameBands()
  const { side } = useWooriFit()
  useEffect(() => {
    const statusBar = side ? SIDE_BG : toHex(resolveColor(bands.statusbar))
    const navBar = side ? SIDE_BG : toHex(resolveColor(bands.navbar))
    void WooriBars.setColors({ statusBar, navBar }).catch(() => {})
  }, [bands, side])
  return null
}

/** #woori-local-root 에 그리는 것 */
export default function WooriLocalRoot() {
  return (
    <>
      <WooriLocalMenu />
      {Capacitor.isNativePlatform() && <WooriLocalBars />}
    </>
  )
}
