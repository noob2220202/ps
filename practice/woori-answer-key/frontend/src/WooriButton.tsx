// WooriButton — 큰 주 버튼 / 보조 버튼 (주인: send-b 그룹. 눌림 = 면 #185ba4 + 가운데 기준 scale 0.95,
//   누른 뒤 26–34ms 부터 ease-in-out 125ms — spec/send-b.json transitions primary-press-scale).
//   [확인]·[다음]·[이체]·[네, 보낼게요] 등 모든 화면이 이것을 쓴다. 모양·치수는 각 화면이 className/style 로 준다.
//   눌림은 포인터로 잰다 (data-pressed — 터치에서 :active 가 늦거나 빠지는 것을 피한다). shot 에서 눌린 모습은
//   `data-pressed=""` 를 직접 주면 된다. 화면별 색·비활성 색·눌림 곡선은 WooriButton.css 의 CSS 변수로 덮어쓴다.
import { useState, type ButtonHTMLAttributes, type PointerEvent } from 'react'
import './WooriButton.css'

export interface WooriButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function WooriButton({ variant = 'primary', className, disabled, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, ...rest }: WooriButtonProps) {
  const [pressed, setPressed] = useState(false)
  const [prevDisabled, setPrevDisabled] = useState(disabled)
  if (prevDisabled !== disabled) {
    // 누른 채 비활성이 되면 ([이체] → 처리 중) 눌림을 푼다 — 비활성 버튼은 pointerup 을 받지 못한다
    setPrevDisabled(disabled)
    if (disabled) setPressed(false)
  }
  const release = (handler?: (e: PointerEvent<HTMLButtonElement>) => void) => (e: PointerEvent<HTMLButtonElement>) => {
    setPressed(false)
    handler?.(e)
  }
  // 화면이 data-pressed 를 직접 주면(shot 의 눌린 모습) 그것을 쓰고, undefined 면 포인터 상태를 쓴다
  const { 'data-pressed': forced, ...others } = rest as typeof rest & { 'data-pressed'?: string }
  return (
    <button
      type="button"
      disabled={disabled}
      data-pressed={forced !== undefined ? forced : pressed && !disabled ? '' : undefined}
      onPointerDown={(e) => {
        if (!disabled && (e.pointerType !== 'mouse' || e.button === 0)) setPressed(true)
        onPointerDown?.(e)
      }}
      onPointerUp={release(onPointerUp)}
      onPointerCancel={release(onPointerCancel)}
      onPointerLeave={release(onPointerLeave)}
      {...others}
      className={`woori-btn woori-btn--${variant}` + (className ? ' ' + className : '')}
    />
  )
}
