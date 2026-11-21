// WooriKeyboard — 삼성 키보드(노란 테마) 숫자 자판 (spec/send-a.md 9절, BRIEF D5). OS 키보드지만 영상과 겹쳐 보려고 앱이 그린다.
//
//   ┌ 도구줄 44dp #161518: = @ + ) ( .  (칸 316/6 = 52.667dp) + ⋯ (마지막 44dp 칸)
//   ├ 검정 11dp
//   ├ 키 4×4 (80 × 58.333/58/58/58.333dp, 모서리 5, 열 x 8.667/96.333/183.667/271.333): 1 2 3 ⌫ / 4 5 6 이동 / 7 8 9 .- / (빈) 0 (빈) ,
//   │   숫자 키 노랑 #eee13f, 기능·빈 키 흰색, 눌림 = 키 면 #808080 한 프레임 (전환 없음, 미리보기 풍선 없음)
//   └ 검정 12dp → 화면 아래 OS 내비 줄 48dp (앱 밖: 프레임 아래 스페이서 띠를 검정으로만 바란다 — 아이콘은 기본 마스크 자리라 그리지 않는다)
//   창 = 화면 dp 508–880 (앱 476.667 부터 372dp, 셸 아래끝 800.667 에서 잘린다). 앱 페이지 위에 겹쳐 그린다 (페이지는 밀리거나 줄지 않는다).
//   올라옴 translateY 372 → 0 fast-out-slow-in-emph (0.2,0,0,1) 380ms · 내려감 0 → 372 같은 곡선 348ms (20ms 늦게), 페이드 없음 (9.7).
//
// 그리는 법: 키·도구줄 바탕은 SVG 하나(소수 dp 좌표가 레이아웃 반올림 없이 그대로 그려진다). 숫자·'이동' 글자는 Pretendard 600/25 · 700/22
// (스펙 L·T), '2'·'.-'·','·도구줄 기호는 글자 그림 PNG 를 '정수 상자 + transform scale' 로 (spec 6.3 — 소수 크기 img 는 기기 px 로 일그러진다).
// 프레임 모드(?frame=1)에서만 그린다. 실제 폰(프레임 아님)에서는 그리지 않고 입력칸이 inputMode="numeric" 으로 시스템 키보드를 쓴다 (force 면 늘 그림: /dev/keyboard).
// 키 누름 위치는 저장소에 적지 않는다 (D15) — 눌림 재현은 pressed prop(더미 번호의 숫자)로만.
import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import './WooriKeyboard.css'
import { artSrc, type WooriArtName } from './WooriArt.ts'
import { isFrameMode } from './WooriNav.ts'
import { fbox, textAt } from './WooriSendFlow.ts'
import { useWooriBands } from './WooriTheme.ts'

export type WooriKeyName =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'backspace' | 'go' | 'dotdash' | 'comma' | 'blank-l' | 'blank-r'
  | 'tb-eq' | 'tb-at' | 'tb-plus' | 'tb-rparen' | 'tb-lparen' | 'tb-dot' | 'more'

export interface WooriKeyboardProps {
  /** 떠 있음. false 가 되면 내려가는 애니메이션 뒤 사라진다 */
  open: boolean
  /** 키 누름 (누르는 순간 — 손 떼기 전, 9.9) */
  onKey?: (key: WooriKeyName) => void
  /** 처음 마운트 때 열려 있으면 올라오는 애니메이션 (기본 true). shot 은 false 로 바로 정착 */
  appear?: boolean
  /** 정착 대신 이 자리(translateY dp)에 멈춘 모습 (shot account-keyboard-up = 80) */
  offsetDp?: number | null
  /** 눌린 모습으로 그릴 키 (녹화·shot). 손으로 누른 키보다 우선 */
  pressed?: WooriKeyName | null
  /** 다 내려간 뒤 */
  onClosed?: () => void
  /** 프레임 모드가 아니어도 그린다 (/dev/keyboard) */
  force?: boolean
  className?: string
}

/* 치수 (창 기준 dp: 창 위끝 = 앱 476.667 = 화면 508). spec/send-a.json keyboard.designDp · 9.2–9.4 */
const PANEL_H = 372
const TOOLBAR_H = 44
const COLS = [8.667, 96.333, 183.667, 271.333] as const
const KEY_W = 80
const ROWS = [55, 121.333, 187.667, 253.667] as const
const ROW_H = [58.333, 58, 58, 58.333] as const
const KEY_R = 5

const FILL = { number: '#eee13f', function: '#ffffff', pressed: '#808080' } as const

const LAYOUT: readonly (readonly WooriKeyName[])[] = [
  ['1', '2', '3', 'backspace'],
  ['4', '5', '6', 'go'],
  ['7', '8', '9', 'dotdash'],
  ['blank-l', '0', 'blank-r', 'comma'],
]

const isDigit = (k: WooriKeyName) => k.length === 1

/** Pretendard 글자 (스펙 L·T, 앱 y − 476.667). '0' 은 T 749 −0.25px */
const LABELS: ReadonlyArray<{ key: WooriKeyName; text: string; x: number; y: number; cls?: string }> = [
  { key: '1', text: '1', x: 43.59, y: 73.333 },
  { key: '3', text: '3', x: 215.75, y: 72.333 },
  { key: '4', text: '4', x: 41.02, y: 138.333 },
  { key: '5', text: '5', x: 128.56, y: 139.333 },
  { key: '6', text: '6', x: 216.09, y: 139.333 },
  { key: '7', text: '7', x: 41.7, y: 205.333 },
  { key: '8', text: '8', x: 128.56, y: 205.333 },
  { key: '9', text: '9', x: 215.92, y: 205.333 },
  { key: '0', text: '0', x: 128.3, y: 272.083 },
  { key: 'go', text: '이동', x: 292.73, y: 139.333, cls: 'woori-kb__label--go' },
]

/** 그림 글자 (WooriArtbox 상자 → 창 기준: 화면 y − 508) */
const GLYPHS: ReadonlyArray<{ art: WooriArtName; x: number; y: number; w: number; h: number }> = [
  { art: 'send-a.kb-glyph-2', x: 127.861, y: 73.625, w: 17.146, h: 22.688 },
  { art: 'send-a.kb-glyph-dotdash', x: 302.069, y: 214.563, w: 19.204, h: 15.125 },
  { art: 'send-a.kb-glyph-comma', x: 306.87, y: 287.438, w: 8.23, h: 11 },
  { art: 'send-a.kb-backspace', x: 295.333, y: 72.166, w: 32, h: 24 },
  { art: 'send-a.kb-tb-eq', x: 20.867, y: 17.938, w: 11.66, h: 8.938 },
  { art: 'send-a.kb-tb-at', x: 69.563, y: 13.813, w: 19.204, h: 19.25 },
  { art: 'send-a.kb-tb-plus', x: 125.804, y: 16.563, w: 11.66, h: 11.688 },
  { art: 'send-a.kb-tb-rparen', x: 179.986, y: 13.125, w: 8.23, h: 20.625 },
  { art: 'send-a.kb-tb-lparen', x: 233.483, y: 13.125, w: 8.23, h: 20.625 },
  { art: 'send-a.kb-tb-dot', x: 286.98, y: 24.813, w: 5.487, h: 5.5 },
]

/** 도구줄 칸 (누름 영역): 6칸 52.667dp + ⋯ 44dp */
const TOOLBAR_SLOTS: ReadonlyArray<{ key: WooriKeyName; x: number; w: number }> = [
  { key: 'tb-eq', x: 0, w: 52.667 },
  { key: 'tb-at', x: 52.667, w: 52.667 },
  { key: 'tb-plus', x: 105.333, w: 52.667 },
  { key: 'tb-rparen', x: 158, w: 52.667 },
  { key: 'tb-lparen', x: 210.667, w: 52.667 },
  { key: 'tb-dot', x: 263.333, w: 52.667 },
  { key: 'more', x: 316, w: 44 },
]

/** ⋯ 점 3개 (지름 2.667dp, 중심 x 332.82/338.33/343.82, 도구줄 가운데 y 22, #414043) */
const MORE_DOTS = [332.82, 338.33, 343.82] as const

type Phase = 'closed' | 'opening' | 'open' | 'closing'

export default function WooriKeyboard({ open, onKey, appear = true, offsetDp = null, pressed = null, onClosed, force = false, className }: WooriKeyboardProps) {
  const [phase, setPhase] = useState<Phase>(open ? (appear ? 'opening' : 'open') : 'closed')
  const [prevOpen, setPrevOpen] = useState(open)
  const [held, setHeld] = useState<WooriKeyName | null>(null)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setPhase(open ? 'opening' : phase === 'closed' ? 'closed' : 'closing')
  }
  const visible = phase !== 'closed'
  const draws = force || isFrameMode()
  // 키보드가 떠 있는 동안 OS 내비 줄은 검정 (9.5)
  useWooriBands(visible && isFrameMode() ? { navbar: '#000000' } : null)
  if (!visible || !draws) return null

  const down = pressed ?? held
  const press = (k: WooriKeyName) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault() // 입력칸 포커스를 뺏지 않는다
    setHeld(k)
    onKey?.(k)
  }
  const release = () => setHeld(null)

  const style: CSSProperties = offsetDp != null && phase === 'open' ? { transform: `translateY(${offsetDp}px)` } : {}
  return (
    <div
      className={`woori-kb woori-kb--${phase}${className ? ' ' + className : ''}`}
      style={style}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return
        if (phase === 'opening') setPhase('open')
        else if (phase === 'closing') {
          setPhase('closed')
          onClosed?.()
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onMouseDown={(e) => e.preventDefault()}
      role="group"
      aria-label="키보드"
    >
      <svg className="woori-kb__bg" width={360} height={PANEL_H} viewBox={`0 0 360 ${PANEL_H}`} aria-hidden>
        <rect x={0} y={0} width={360} height={TOOLBAR_H} fill="#161518" />
        <rect x={0} y={TOOLBAR_H} width={360} height={PANEL_H - TOOLBAR_H} fill="#000000" />
        {TOOLBAR_SLOTS.map((s) => (
          <rect key={s.key} x={s.x} y={0} width={s.w} height={TOOLBAR_H} fill="transparent" onPointerDown={press(s.key)} />
        ))}
        {MORE_DOTS.map((cx) => (
          <circle key={cx} cx={cx} cy={22} r={1.3335} fill="#414043" />
        ))}
        {LAYOUT.map((row, r) =>
          row.map((k, c) => (
            <rect
              key={k}
              data-key={k}
              x={COLS[c]}
              y={ROWS[r]}
              width={KEY_W}
              height={ROW_H[r]}
              rx={KEY_R}
              ry={KEY_R}
              fill={down === k ? FILL.pressed : isDigit(k) ? FILL.number : FILL.function}
              onPointerDown={press(k)}
            />
          )),
        )}
      </svg>
      {LABELS.map((l) => (
        <span key={l.key} className={`woori-kb__label${l.cls ? ' ' + l.cls : ''}`} style={textAt(l.x, l.y)} aria-hidden>
          {l.text}
        </span>
      ))}
      {GLYPHS.map((g) => (
        <img key={g.art} className="woori-kb__glyph" src={artSrc(g.art)} alt="" draggable={false} style={fbox(g.x, g.y, g.w, g.h)} />
      ))}
    </div>
  )
}
