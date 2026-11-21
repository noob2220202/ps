// WooriLoadingPage — "흰 페이지 + 스피너 → 단계적 그리기" (영상의 페이지 이동 대부분, inventory 2절)
//
//   예) 거래내역 진입 (v1 30.683–33.404): 흰 페이지 + 가운데 스피너 → +1.05s 제목·관리 → +0.08 ‹·스켈레톤 → +0.75 내용 → 토글 켬 → 아이콘 → 스피너 꺼짐
//   const stage = useWooriStages(HISTORY_STAGES_MS, { shotStage: shot ? 6 : null })   // HISTORY_STAGES_MS = [1053, 1137, …] (모듈 상수)
//   return <WooriLoadingPage spinner={stage < 6 ? 'page' : false}>{stage >= 1 && <Title/>}{stage >= 2 && <Skeleton/>}…</WooriLoadingPage>
//
// 단계 사이는 애니메이션이 아니라 한 프레임 교체다 (영상: 단계마다 한 프레임에 바뀜). 시각은 setTimeout 이라 shot.cjs --t 로 멈출 수 없다 →
// shot 상태는 shotStage 로 단계를 바로 고른다. 녹화(record)는 시작 시각(startAt)을 맞춰 단계 시각이 영상과 같게 한다.
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { WooriSpinner, type WooriSpinnerAt } from './WooriSpinner.tsx'

export interface WooriLoadingPageProps {
  /** 스피너 자리 (기본 'page' = 앱 뷰포트 정중앙). false 면 스피너 없음 */
  spinner?: WooriSpinnerAt | false
  /** 바탕 (기본 --woori-bg 흰색) */
  background?: string
  className?: string
  style?: CSSProperties
  /** 단계별로 그릴 내용 (스피너 아래에 깔린다) */
  children?: ReactNode
  label?: string
}

/** 레이어 페이지 상자를 덮는 흰 페이지 + (선택) 스피너 */
export function WooriLoadingPage({ spinner = 'page', background, className, style, children, label }: WooriLoadingPageProps) {
  return (
    <div
      className={`woori-loading-page${className ? ' ' + className : ''}`}
      style={{ ...(background ? { background } : {}), ...style }}
      aria-busy={spinner ? true : undefined}
    >
      {children}
      {spinner ? <WooriSpinner at={spinner} label={label} /> : null}
    </div>
  )
}

export interface WooriStagesOptions {
  /** false 면 시작하지 않는다 (단계 0). true 가 되는 순간이 기준 (startAt 이 없으면) */
  start?: boolean
  /** shot 모드 등: 이 단계에 바로 멈춘다 (타이머 없음) */
  shotStage?: number | null
  /** 기준 시각 (performance.now() 기준 ms). 누른 순간 등에 맞출 때. 생략하면 시작한 순간 */
  startAt?: number
}

/**
 * 단계 번호: 0 (시작 전·첫 단계 전) → times[i] ms 가 지나면 i + 1. times 는 기준 시각부터 잰 누적 ms (오름차순, 모듈 상수로 넘긴다).
 * 각 단계는 기준 시각에서 따로 잰다 (앞 단계 타이머가 늦어도 밀리지 않는다). 단계는 앞으로만 간다 — 처음부터 다시 하려면 key 를 바꿔 다시 마운트.
 */
export function useWooriStages(times: readonly number[], { start = true, shotStage = null, startAt }: WooriStagesOptions = {}): number {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (!start || shotStage != null) return
    const t0 = startAt ?? performance.now()
    const timers = times.map((t, i) =>
      window.setTimeout(() => setStage((s) => Math.max(s, i + 1)), Math.max(0, t0 + t - performance.now())),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [times, start, shotStage, startAt])
  if (shotStage != null) return shotStage
  return start ? stage : 0
}
