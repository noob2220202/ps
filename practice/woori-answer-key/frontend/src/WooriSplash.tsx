// WooriSplash — / 스플래시 (spec/launch.md 2.1·3.2)
//   흰 바탕 + WON 로고 세 겹(회색 트랙 → 하늘색 그라데이션 채움 → 남색 원) + 'WON' · iF · MA · '우리은행' 그림.
//   움직임: 마운트 84.1ms 뒤 원이 +24.42dp 오른쪽으로 265.7ms cubic-bezier(1, 0.967, 0.663, 0.931), 채움은 같은 시간·곡선으로 원 중심까지 드러남.
//   마운트 1092.7ms 뒤 /cert 로 replace (한 프레임 교체). 터치 반응 없음.
//   shot: splash-logo-start(시작 모습) · splash-logo-end(끝 모습) · splash-anim(마운트부터 애니메이션 — shots.d 의 t 186.9 / 295.0)
import { useEffect, useLayoutEffect, useRef } from 'react'
import { artSrc } from './WooriArt.ts'
import { useWooriNavigate } from './WooriNav.ts'
import { useShotReady, useShotState } from './WooriShot.ts'
import { useWooriBands } from './WooriTheme.ts'
import './WooriSplash.css'

type SplashPhase = 'start' | 'end' | 'anim'
const SPLASH_SHOTS: Readonly<Record<string, SplashPhase>> = {
  'splash-logo-start': 'start',
  'splash-logo-end': 'end',
  'splash-anim': 'anim',
}

/** 스플래시 첫 프레임에서 /cert 까지 (영상 #52 1.748 → #92 2.841) */
const SPLASH_TO_CERT_MS = 1092.7
const BANDS = { statusbar: '#eff0f3', navbar: '#eff0f3' }

export default function WooriSplash() {
  const shot = useShotState('launch', SPLASH_SHOTS)
  const phase: SplashPhase = shot?.state ?? 'anim'
  const go = useWooriNavigate()
  useWooriBands(BANDS)
  useShotReady(shot != null)

  useEffect(() => {
    if (shot) return
    const id = window.setTimeout(() => go('/cert', { replace: true }), SPLASH_TO_CERT_MS)
    return () => window.clearTimeout(id)
  }, [shot, go])

  // shot 'splash-anim': 애니메이션을 0 위상에 세워 둔다 (shot.cjs 가 t 로 옮긴다 — 끝나 버리기 전에)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (shot?.state !== 'anim' || !ref.current) return
    for (const a of ref.current.getAnimations({ subtree: true })) {
      a.currentTime = 0
      a.playbackRate = 0
    }
  }, [shot])

  return (
    <div ref={ref} className={`woori-splash woori-splash--${phase}`} aria-label="우리WON뱅킹">
      <img className="woori-splash__track" src={artSrc('launch.splash-logo-track')} alt="" />
      <div className="woori-splash__fill">
        <img src={artSrc('launch.splash-logo-fill')} alt="" />
      </div>
      <img className="woori-splash__circle" src={artSrc('launch.splash-logo-circle')} alt="" />
      <img className="woori-splash__won" src={artSrc('launch.splash-won-wordmark')} alt="WON" />
      <img className="woori-splash__if" src={artSrc('launch.splash-if-award')} alt="iF DESIGN AWARD 2026" />
      <img className="woori-splash__ma" src={artSrc('launch.splash-ma-cert')} alt="모바일 접근성 인증" />
      <img className="woori-splash__woori" src={artSrc('launch.splash-woori-wordmark')} alt="우리은행" />
    </div>
  )
}
