// WooriPlaceholder — 화면 자리표시 (화면 작업이 Woori<Screen>.tsx 를 채우면 그 화면에서 이것을 지운다)
//
// 흰 페이지에 화면 이름·라우트만. shot 상태 'blank' 하나를 등록하고 바로 준비 표시를 한다:
//   /home?frame=1&shot=blank → 빈 페이지 + 프레임 스페이서 (tools/shot.cjs 로 524x1280 · 띠 위치 확인용)
import { useShotReady, useShotState } from './WooriShot.ts'

const PLACEHOLDER_SHOTS = { blank: true } as const

export interface WooriPlaceholderProps {
  /** 화면 그룹·상태 이름 (spec 그룹: launch · home · history · history-detail · send-a · send-b · done) */
  screen: string
  route: string
  title: string
}

export function WooriPlaceholder({ screen, route, title }: WooriPlaceholderProps) {
  const shot = useShotState(screen, PLACEHOLDER_SHOTS)
  useShotReady(shot != null)
  return (
    <div className="woori-placeholder" data-screen={screen}>
      <p className="woori-placeholder__label">
        {title}
        <span className="woori-placeholder__route">
          {route} · 자리표시 ({screen})
        </span>
      </p>
    </div>
  )
}
