// WooriSheet — 딤 + 아래에서 올라오는 시트 (바텀시트 · 홈 프로모션 팝업). 라우트가 아니라 화면 상태다.
//
//   <WooriSheet open={filterOpen} onClosed={…} label="조회조건 선택">…시트 내용…</WooriSheet>
//   <WooriSheet open={popup} variant="popup" onDimClick={close}>…</WooriSheet>
//
// 그리는 곳: 그 페이지 레이어의 겹침 자리(WooriNav useWooriLayer().overlayHost)로 포털 → 딤이 앱 뷰포트만 덮고(상태바·내비 바 자리는 그대로,
//   units.md 5.3절 sheet-dim) 페이지 전환 때 페이지와 같이 움직인다.
// 움직임 (CSS 애니메이션, woori.css .woori-sheet--*): 기본값은 WooriNav WOORI_MOTION.sheet / popup.
//   sheet  열림: 시트 easeOutCubic 260ms + 딤 0→dimSheet linear 300ms(≈25ms 늦게) · 닫힘: easeInCubic 255ms + 딤 linear 293ms
//   popup  열림 ≈300ms + 딤 0→dimPopup 178ms · 닫힘 ≈150ms, 떠 있는 동안 내비 바 자리 검정 (navbar)
//   화면 스펙이 잰 값은 motion 으로 덮어쓴다: motion={{ open: { duration: 352, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', dimDuration: 303 } }}
// 시트 모양(높이·모서리·내용)은 children 과 className 으로 화면이 정한다. 기본 패널은 흰 바탕 + 위 모서리 --woori-sheet-radius(자리표시 20dp).
// 단계: open 이 true 가 되면 opening → (시트·딤 애니메이션 둘 다 끝) open → false 가 되면 closing → closed(언마운트, onClosed).
//   appear={false} 면 처음 마운트 때 애니메이션 없이 열린 모습 (shot 상태를 바로 그릴 때).
// WooriOverlay: 같은 겹침 자리에 그냥 그린다 (스크롤과 상관없이 고정된 헤더·하단 버튼 등). 페이지 스크롤 내용 상자는 transform 이 있어
//   그 안의 position:fixed 는 내용과 같이 스크롤된다 — 고정 요소는 이것으로 (frontend/README '렌더 규칙').
import { useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useWooriBack, WOORI_BACK_PRIO } from './WooriEnv.ts'
import { useWooriLayer, WOORI_MOTION, type WooriSheetPhaseMotion } from './WooriNav.ts'
import { useWooriBands } from './WooriTheme.ts'

export type WooriSheetVariant = 'sheet' | 'popup'
type Phase = 'closed' | 'opening' | 'open' | 'closing'

export interface WooriSheetProps {
  open: boolean
  variant?: WooriSheetVariant
  /** 곡선 덮어쓰기 (화면 스펙 값). 생략한 칸은 WOORI_MOTION[variant] */
  motion?: { open?: Partial<WooriSheetPhaseMotion>; close?: Partial<WooriSheetPhaseMotion> }
  /** 딤 불투명도 (0–1 또는 CSS 값). 생략하면 토큰 (sheet: --woori-dim-sheet-alpha, popup: --woori-dim-popup-alpha) */
  dim?: number | string
  /** 떠 있는 동안(닫히는 중 포함) 프레임 띠 색. popup 은 내비 바 기본 검정. null = 바라지 않음 */
  navbar?: string | null
  statusbar?: string | null
  /** 처음 마운트 때 열림 애니메이션 (기본 true) */
  appear?: boolean
  onOpened?: () => void
  onClosed?: () => void
  /** 딤을 누름 (없으면 딤은 누름을 막기만 한다) */
  onDimClick?: () => void
  /** 폰 뒤로 버튼 (APK): 떠 있는 동안(닫히는 중 빼고) 페이지 뒤로보다 먼저 받는다. 보통 ✕ 와 같은 닫기 */
  onBack?: () => void
  /** 접근성 이름 */
  label?: string
  /** 시트 패널 클래스·스타일 (높이·모서리·바탕) */
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

const ms = (v: number) => `${v}ms`

function phaseVars(m: WooriSheetPhaseMotion): Record<string, string> {
  return {
    '--woori-sheet-duration': ms(m.duration),
    '--woori-sheet-easing': m.easing,
    '--woori-sheet-dim-duration': ms(m.dimDuration),
    '--woori-sheet-dim-easing': m.dimEasing,
    '--woori-sheet-dim-delay': ms(m.dimDelay),
  }
}

/** 이 단계에서 끝나기를 기다리는 애니메이션 이름 (woori.css) */
const END_NAMES: Partial<Record<Phase, { panel: string; dim: string }>> = {
  opening: { panel: 'woori-sheet-in', dim: 'woori-sheet-dim-in' },
  closing: { panel: 'woori-sheet-out', dim: 'woori-sheet-dim-out' },
}

/** 이 페이지 레이어의 겹침 자리(앱 뷰포트를 덮는 상자, 스크롤 밖)에 그린다. 자식은 position:absolute 로 놓는다 */
export function WooriOverlay({ children }: { children?: ReactNode }) {
  const { overlayHost } = useWooriLayer()
  return overlayHost ? createPortal(children, overlayHost) : null
}

export function WooriSheet({
  open,
  variant = 'sheet',
  motion,
  dim,
  navbar,
  statusbar = null,
  appear = true,
  onOpened,
  onClosed,
  onDimClick,
  onBack,
  label,
  className,
  style,
  children,
}: WooriSheetProps) {
  const [phase, setPhase] = useState<Phase>(open ? (appear ? 'opening' : 'open') : 'closed')
  const [prevOpen, setPrevOpen] = useState(open)
  // open 이 바뀌면 렌더 중에 단계를 바꾼다 (이전 값 비교 패턴)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setPhase(open ? 'opening' : phase === 'closed' ? 'closed' : 'closing')
  }
  const ended = useRef<{ phase: Phase; panel: boolean; dim: boolean }>({ phase: 'closed', panel: false, dim: false })
  const { overlayHost, top } = useWooriLayer()
  useWooriBack(top && onBack && (phase === 'opening' || phase === 'open') ? onBack : null, WOORI_BACK_PRIO.sheet)

  const base = WOORI_MOTION[variant]
  const navbarBand = navbar === undefined ? (variant === 'popup' ? WOORI_MOTION.popup.navbar : null) : navbar
  const mounted = phase !== 'closed'
  useWooriBands(mounted && (navbarBand || statusbar) ? { navbar: navbarBand ?? undefined, statusbar: statusbar ?? undefined } : null)

  if (!mounted || !overlayHost) return null

  const m: WooriSheetPhaseMotion = phase === 'closing' ? { ...base.close, ...motion?.close } : { ...base.open, ...motion?.open }
  const vars = {
    ...phaseVars(m),
    '--woori-sheet-dim': dim == null ? base.dim : String(dim),
  } as CSSProperties

  // 시트·딤 애니메이션이 둘 다 끝나면 다음 단계로 (어느 쪽인지는 data-part)
  const onEnd = (e: AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return
    const role = e.currentTarget.dataset.part === 'dim' ? 'dim' : 'panel'
    const want = END_NAMES[phase]
    if (!want || e.animationName !== want[role]) return
    if (ended.current.phase !== phase) ended.current = { phase, panel: false, dim: false }
    ended.current[role] = true
    if (!ended.current.panel || !ended.current.dim) return
    if (phase === 'opening') {
      setPhase('open')
      onOpened?.()
    } else if (phase === 'closing') {
      setPhase('closed')
      onClosed?.()
    }
  }

  return createPortal(
    <div className={`woori-sheet woori-sheet--${variant} woori-sheet--${phase}`} style={vars}>
      <div className="woori-sheet__dim" data-part="dim" onAnimationEnd={onEnd} onClick={onDimClick} aria-hidden />
      <div
        className={`woori-sheet__panel${className ? ' ' + className : ''}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-part="panel"
        onAnimationEnd={onEnd}
      >
        {children}
      </div>
    </div>,
    overlayHost,
  )
}
