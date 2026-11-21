// WooriHeader — 일반 페이지 머리 (주인: history 그룹. spec/history.md 의 머리 절이 정본)
//   ‹ 뒤로 · 가운데 제목 · 오른쪽 글자 버튼(예: 관리·취소) 또는 ✕ 닫기.
//   다른 화면은 이 컴포넌트만 쓴다(직접 그리지 않는다).
//   값 (앱 dp): 높이 52 흰색 · ‹ 24 상자 (16,14) 그림 history.back-chevron · 제목 17/600 #33353a 가운데 top 18(line-height 1, 기준선 32)
//   · 오른쪽 글자 16/500 --woori-blue-text 오른끝 340 top 18(기준선 31) · ✕ 24 상자 (320,14) 그림 history-detail.close-x.
//   머리는 스크롤 영역 밖(화면 루트의 첫 줄)에 둔다 — 레이아웃 위치가 정수 dp 라 D1 자리에 그대로 그려진다.
//   폰 뒤로 버튼(APK): 맨 위 페이지의 머리면 ‹(onBack) — 없으면 ✕(onClose) — 와 같은 동작 (WooriEnv useWooriBack, 페이지 우선순위).
//   열린 시트·팝업은 더 높은 우선순위로 먼저 받는다 (WooriSheet onBack).
import type { ReactNode } from 'react'
import { useWooriBack, WOORI_BACK_PRIO } from './WooriEnv.ts'
import { useWooriLayer } from './WooriNav.ts'
import './WooriHeader.css'

export interface WooriHeaderProps {
  title?: string
  /** 있으면 왼쪽 ‹ 표시 */
  onBack?: () => void
  /** 있으면 오른쪽 ✕ 표시 (onRight 보다 우선) */
  onClose?: () => void
  /** 오른쪽 파란 글자 버튼 (예: '관리', '취소') */
  rightText?: string
  onRight?: () => void
  /** 그 밖의 오른쪽 내용 */
  right?: ReactNode
  className?: string
}

export function WooriHeader({ title, onBack, onClose, rightText, onRight, right, className }: WooriHeaderProps) {
  const { top } = useWooriLayer()
  useWooriBack(top ? (onBack ?? onClose) : null, WOORI_BACK_PRIO.page)
  return (
    <header className={'woori-header' + (className ? ' ' + className : '')}>
      {onBack && <button type="button" className="woori-header__back" aria-label="뒤로" onClick={onBack} />}
      {title && <h1 className="woori-header__title">{title}</h1>}
      {onClose ? (
        <button type="button" className="woori-header__close" aria-label="닫기" onClick={onClose} />
      ) : rightText ? (
        <button type="button" className="woori-header__right" onClick={onRight}>
          {rightText}
        </button>
      ) : right ? (
        <div className="woori-header__extra">{right}</div>
      ) : null}
    </header>
  )
}
