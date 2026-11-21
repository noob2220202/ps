// WooriSpinner — 로딩 스피너: 남색·하늘색 원호 두 개가 마주 보고 시계 방향으로 돌며 커졌다 줄었다 한다 (영상 공통)
//
// 영상 근거 (1단계 timeline-v2 spinnerStyle, 1단계에서 다시 잼):
//   - 중심: 페이지 (262, 628) frame px = 앱 뷰포트 정중앙 (180, 400.333)dp (실측 262.07, 627.97 → 180.03, 400.40)
//           홈 위 (262, 585) frame px = (180, 370.854)dp 앱 기준 (탭바 위 영역 가운데로 보임 — 홈 스펙에서 확정)
//   - 상자 ≈68x68px. 반지름 방향 잉크 50% 경계 24.9–33.3px (v2 #3203–#3250 47장) → 원호 중심선 r ≈ 29.1px = 20dp, 굵기 ≈ 8.4px ≈ 6dp(1단계 근사 — history 4.5 가 각도 단면으로 다시 재서 5.36dp → 5.333dp, WooriSpinner.css)
//   - 색: 토큰 spinnerArcDark(#052291)·spinnerArcLight(#17c3f6) (spec/tokens.json)
//   - 움직임: 반 주기 0.798s(표본 맞춤, 타임라인 글은 ≈0.81s) 동안 두 원호가 180° 나아가 서로 자리를 바꾼다 — 같은 색이 같은 모양으로 돌아오는
//     한 주기는 1.596s. 반 주기 안: 원호 ≈20°→80° 커짐 ≈175ms → 80°→22° 줄어듦 ≈170ms → 점(≈20°) 상태로 ≈40° 기어감 ≈430ms.
//     키프레임(woori.css @keyframes woori-spinner-arc)은 v2 #3203–#3290 원호 표본(머리·꼬리 각도, 두 원호·두 반 주기 평균)을 그대로 옮긴 것
//     (rms 꼬리 1.9° · 머리 1.8°). 각도에 둥근 끝(굵기/2 = 3dp → 8.59°)을 뺀 길이를 stroke-dasharray 로.
//   - 페이드 없이 한 프레임에 나타나고 사라진다 → 조건부 렌더 그대로.
// 위치는 transform 으로 놓는다 (레이아웃 위치는 정수 dp 로 반올림되지만 transform 은 그대로라 소수 중심이 정확, frontend/README '렌더 규칙').
// shot 모드(?shot=)에서는 0 위상에 멈춘다 (--woori-spinner-shot-delay 로 위상 지정, 예: '-0.4s'). 비교 기준 프레임은 스피너 자리를 마스크한다.
import type { CSSProperties } from 'react'
import './WooriSpinner.css'

/** 스피너 치수·시간 (dp, ms) — 화면 스펙이 다시 재면 여기를 고친다 (woori.css 의 같은 값도) */
export const WOORI_SPINNER = {
  /** SVG 상자 (dp). 원호 바깥 지름 r·2 + 굵기 = 46 */
  box: 48,
  r: 20,
  /** history 4.5 재측정 5.36dp → 16 기기px (WooriSpinner.css 가 woori.css 의 6px 를 덮어쓴다) */
  stroke: 5.333,
  /** 같은 색이 같은 모양으로 돌아오는 한 주기 (반 주기 798ms × 2) */
  periodMs: 1596,
  halfPeriodMs: 798,
  /** 중심 (앱 뷰포트 기준 dp). page 는 늘 뷰포트 정중앙이라 CSS 가 계산한다 (프레임 모드 400.333) */
  centers: {
    home: { x: 180, y: 370.854 },
  },
} as const

/** 'page' = 앱 뷰포트(레이어 페이지 상자) 정중앙 · 'home' = 홈 위 스피너 자리 · {x,y} = 앱 뷰포트 기준 dp 중심 */
export type WooriSpinnerAt = 'page' | 'home' | { x: number; y: number }

export interface WooriSpinnerProps {
  at?: WooriSpinnerAt
  /** 시작 위상 (ms). 0 = 커지기 시작하는 순간 (원호가 점에서 늘어나기 시작) */
  phaseMs?: number
  className?: string
  style?: CSSProperties
  /** 접근성 라벨 */
  label?: string
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/**
 * 로딩 스피너. 부모(레이어 페이지 상자 등 position 이 있는 상자)의 왼쪽 위 기준으로 놓인다.
 * <WooriSpinner /> 페이지 가운데 · <WooriSpinner at="home" /> 홈 위 · <WooriSpinner at={{ x: 180, y: 300 }} />
 */
export function WooriSpinner({ at = 'page', phaseMs = 0, className, style, label = '불러오는 중' }: WooriSpinnerProps) {
  const half = WOORI_SPINNER.box / 2
  const point = at === 'page' ? null : at === 'home' ? WOORI_SPINNER.centers.home : at
  const pos: CSSProperties = point ? { transform: `translate(${round3(point.x - half)}px, ${round3(point.y - half)}px)` } : {}
  const vars = (phaseMs ? { '--woori-spinner-delay': `${-phaseMs}ms` } : {}) as CSSProperties
  const c = WOORI_SPINNER.box / 2
  return (
    <svg
      className={`woori-spinner${point ? '' : ' woori-spinner--page'}${className ? ' ' + className : ''}`}
      style={{ ...pos, ...vars, ...style }}
      viewBox={`0 0 ${WOORI_SPINNER.box} ${WOORI_SPINNER.box}`}
      width={WOORI_SPINNER.box}
      height={WOORI_SPINNER.box}
      role="progressbar"
      aria-label={label}
    >
      <circle className="woori-spinner__arc woori-spinner__arc--dark" cx={c} cy={c} r={WOORI_SPINNER.r} />
      <g transform={`rotate(180 ${c} ${c})`}>
        <circle className="woori-spinner__arc woori-spinner__arc--light" cx={c} cy={c} r={WOORI_SPINNER.r} />
      </g>
    </svg>
  )
}
