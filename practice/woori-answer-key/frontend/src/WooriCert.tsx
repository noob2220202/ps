// WooriCert — /cert 우리WON인증서 6자리 PIN (spec/launch.md 2.2·2.4·3.3·4)
//   영상에 보인 것: 6점 다 참 + 가운데 스피너(1370.4ms) → 정지 477.1ms → /home replace (로그인 로딩 = 홈 첫 진입).
//   PIN 입력 중 보안 키패드는 녹화되지 않았다 → **설계값(영상에 없음)**: 계좌 비밀번호 시트 키패드 체계(3열 120dp x 4줄 65dp, 판 535.17–800.67,
//   숫자 25dp/500, [전체삭제] 16/600, [←] send-b.keypad-backspace, 누름 강조 97.5x56 r6 #e6eaee). 열 때마다 0–9 를 섞는다.
//   누른 키의 위치는 어디에도 남기지 않는다 (개인정보 D15) — 입력한 자릿값도 저장하지 않고 개수만 센다.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { artSrc } from './WooriArt.ts'
import { wooriPlace } from './WooriLayout.ts'
import { useWooriNavigate } from './WooriNav.ts'
import { useShotReady, useShotState } from './WooriShot.ts'
import { WooriSpinner } from './WooriSpinner.tsx'
import { useWooriBands } from './WooriTheme.ts'
import { wooriTodo } from './WooriEnv.ts'
import './WooriCert.css'

interface CertShot {
  filled: number
  spinner: boolean
  keypad: boolean
}
const CERT_SHOTS: Readonly<Record<string, CertShot>> = {
  'cert-pin-spinner': { filled: 6, spinner: true, keypad: false },
  'cert-pin-filled': { filled: 6, spinner: false, keypad: false },
  'cert-pin-keypad': { filled: 0, spinner: false, keypad: true },
}

/** shot 고정 배치 (설계: 영상의 두 배치와 다른 시드) — 1–3줄 9칸 + 4줄 가운데 */
const SHOT_LAYOUT = [5, 9, 1, 7, 0, 3, 8, 2, 6, 4] as const
const PIN_LEN = 6
/** cert-complete → 스피너 끔 1370.4ms → /home 477.1ms (3.1 표) */
const SPINNER_MS = 1370.4
const TO_HOME_MS = 477.1
const BANDS = { statusbar: '#ffffff', navbar: '#ffffff' }

function shuffled(): number[] {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 키패드 판 위끝 (앱 dp) · 줄 높이 · 칸 폭 */
const PAD_TOP = 535.17
const ROW = 65
const COL = 120

export default function WooriCert() {
  const shot = useShotState('launch', CERT_SHOTS)
  const go = useWooriNavigate()
  useWooriBands(BANDS)
  const [layout] = useState<readonly number[]>(() => (shot ? SHOT_LAYOUT : shuffled()))
  const [count, setCount] = useState(0)
  const [pressed, setPressed] = useState<number | null>(null)
  const [phase, setPhase] = useState<'input' | 'spinner' | 'done'>('input')
  const [autoLogin, setAutoLogin] = useState(true)
  useShotReady(shot != null)

  const filled = shot ? shot.state.filled : count
  const showKeypad = shot ? shot.state.keypad : phase === 'input'
  const showSpinner = shot ? shot.state.spinner : phase === 'spinner'

  // 6번째 키 → 같은 프레임에 6점·키패드 숨김·스피너 → 1370.4ms 스피너 끔 → 477.1ms 뒤 /home (첫 진입 표시)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  const complete = () => {
    setPhase('spinner')
    timers.current.push(
      window.setTimeout(() => setPhase('done'), SPINNER_MS),
      window.setTimeout(() => {
        try {
          sessionStorage.setItem('woori.home.entry', 'login')
        } catch {
          /* 저장 못 함 — 홈이 바로 그린다 */
        }
        go('/home', { replace: true })
      }, SPINNER_MS + TO_HOME_MS),
    )
  }

  // 손을 떼는 순간 점이 채워진다 (누름 강조는 누르는 동안만)
  const onKeyUp = (kind: 'digit' | 'clear' | 'back') => {
    setPressed(null)
    if (shot || phase !== 'input') return
    if (kind === 'clear') setCount(0)
    else if (kind === 'back') setCount((c) => Math.max(0, c - 1))
    else {
      const next = count + 1
      setCount(next)
      if (next >= PIN_LEN) complete()
    }
  }

  // 키 칸 12개: 1–3줄 9칸 = layout[0..8], 4줄 = [전체삭제] layout[9] [←]
  const keys: { kind: 'digit' | 'clear' | 'back'; label?: number; r: number; c: number }[] = []
  for (let i = 0; i < 9; i++) keys.push({ kind: 'digit', label: layout[i], r: Math.floor(i / 3), c: i % 3 })
  keys.push({ kind: 'clear', r: 3, c: 0 }, { kind: 'digit', label: layout[9], r: 3, c: 1 }, { kind: 'back', r: 3, c: 2 })

  const rootRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div ref={rootRef} className="woori-cert" tabIndex={-1}>
      <button type="button" className="woori-cert__back" aria-label="뒤로" onClick={() => go('/', { replace: true })}>
        <img src={artSrc('history.back-chevron')} alt="" />
      </button>
      <h1 className="woori-cert__title">우리WON인증서</h1>
      <p className="woori-cert__subtitle">6자리 비밀번호를 입력해 주세요.</p>
      <div className="woori-cert__dots" aria-label={`${filled}자리 입력됨`}>
        {Array.from({ length: PIN_LEN }, (_, i) => (
          <i key={i} className={i < filled ? 'is-on' : undefined} style={{ left: 24 * i }} />
        ))}
      </div>
      <button type="button" className="woori-cert__auto" aria-pressed={autoLogin} onClick={() => setAutoLogin((v) => !v)}>
        <img src={artSrc(autoLogin ? 'launch.check-circle-outline' : 'launch.check-circle-off')} alt="" />
        <span>자동 로그인</span>
      </button>
      <button type="button" className="woori-cert__other" style={wooriPlace(94, 728.667)} onClick={wooriTodo}>
        <span>다른 방법으로 로그인</span>
      </button>

      {showKeypad && (
        <div className="woori-cert__pad" style={wooriPlace(0, PAD_TOP)} role="group" aria-label="보안 키패드">
          {keys.map((k, i) => {
            const style: CSSProperties = { left: COL * k.c, top: ROW * k.r }
            return (
              <button
                key={i}
                type="button"
                className={'woori-cert__key' + (pressed === i ? ' is-pressed' : '')}
                style={style}
                onPointerDown={() => setPressed(i)}
                onPointerLeave={() => setPressed((p) => (p === i ? null : p))}
                onPointerUp={() => onKeyUp(k.kind)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onKeyUp(k.kind)
                  }
                }}
                aria-label={k.kind === 'clear' ? '전체삭제' : k.kind === 'back' ? '지우기' : '숫자'}
              >
                {k.kind === 'digit' && <span className="woori-cert__digit">{k.label}</span>}
                {k.kind === 'clear' && <span className="woori-cert__clear">전체삭제</span>}
                {k.kind === 'back' && <img className="woori-cert__bs" src={artSrc('send-b.keypad-backspace')} alt="" />}
              </button>
            )
          })}
        </div>
      )}

      {showSpinner && <WooriSpinner />}
    </div>
  )
}
