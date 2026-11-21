// WooriDevFrame — /dev/frame 뼈대 확인용 개발 화면 (영상에 없는 화면)
//
// shot 상태:
//   geometry  ?frame=1 기하: tools/selftest.cjs 의 frame.html 과 같은 1dp 선(y 100/400/700, x 16/20/100/260/340/344)과 상자
//             (20–340dp·top 200·높이 48, 16–344dp·top 300·높이 56). 띠는 #f1f1f1 이라 상태바·내비 경계가 보인다.
//             → 찍은 524x1280 에서 경계 45.576 / 1210.182px, 선·상자 가장자리가 D1 식과 맞는지 잰다 (frontend/README '검증')
//   nested    같은 선·상자를 화면 안의 스크롤 컨테이너(top 10dp, 스크롤 가능)에 — WooriLayout.useWooriScrollFix 로 맞춤
//   nested-nofix  같은 것을 맞춤 없이 (Chromium 의 기기 화소 반올림으로 밀리는 것을 보여 줌)
//   scrolled  같은 선·상자를 100dp 아래에 두고 페이지 스크롤 컨테이너를 wooriScrollTo(100) — 기기 화소 배수가 아닌 스크롤 위치
//   bottom    아래에 붙는 버튼 (bottom 18 · 높이 56, WOORI_BOTTOM_FIX) → 영상 1102.55–1184.0px · 소수 자리 상자 wooriPlace(20.5, 100.25)
//   spinner   페이지 가운데 스피너 + 홈 위 스피너 자리 (0 위상)
//   sheet     바텀시트(열린 모습) — 딤이 앱 뷰포트만 덮고 띠는 그대로인지
//   popup     팝업 시트(열린 모습) — 내비 바 자리 검정
// shot 이 없으면 위쪽에 [시트] [팝업] 단추: 열고 닫는 애니메이션(WOORI_MOTION.sheet / popup)을 눈으로 확인 (딤을 누르면 닫힘)
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useWooriScrollFix, WOORI_BOTTOM_FIX, wooriPlace, wooriScrollTo } from './WooriLayout.ts'
import { WooriSheet } from './WooriSheet.tsx'
import { useShotReady, useShotState } from './WooriShot.ts'
import { WooriSpinner } from './WooriSpinner.tsx'
import { useWooriBands } from './WooriTheme.ts'

const DEV_FRAME_SHOTS = {
  geometry: 'geometry',
  nested: 'nested',
  'nested-nofix': 'nested-nofix',
  scrolled: 'scrolled',
  bottom: 'bottom',
  spinner: 'spinner',
  sheet: 'sheet',
  popup: 'popup',
} as const
type Mode = (typeof DEV_FRAME_SHOTS)[keyof typeof DEV_FRAME_SHOTS]

const GRAY_BANDS = { statusbar: '#f1f1f1', navbar: '#f1f1f1' }

/** 기하 시험 선·상자 (dy 만큼 위로: 안쪽 스크롤 컨테이너 안에 그릴 때 그 컨테이너 위치를 뺀다) */
function Geometry({ dy = 0 }: { dy?: number }) {
  return (
    <>
      {[100, 400, 700].map((y) => (
        <div key={`h${y}`} className="woori-dev-frame__h" style={{ top: y - dy }} />
      ))}
      {[16, 20, 100, 260, 340, 344].map((x) => (
        <div key={`v${x}`} className="woori-dev-frame__v" style={{ left: x, top: 450 - dy }} />
      ))}
      <div className="woori-dev-frame__box" data-ref="box20" style={{ left: 20, top: 200 - dy, width: 320, height: 48 }} />
      <div className="woori-dev-frame__box" data-ref="box16" style={{ left: 16, top: 300 - dy, width: 328, height: 56 }} />
    </>
  )
}

/** 화면 안의 스크롤 컨테이너 (top 10dp: 원점이 소수 기기 px) — 기기 화소 맞춤(useWooriScrollFix) 있음/없음 */
const NESTED_STYLE: CSSProperties = { position: 'absolute', left: 0, top: 10, width: 360, height: 700, overflowY: 'auto', scrollbarWidth: 'none' }

function Nested({ fix, children }: { fix: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useWooriScrollFix(fix ? ref : NO_REF)
  return (
    <div ref={ref} className={fix ? 'woori-scroll-fix' : undefined} style={NESTED_STYLE}>
      <div className={fix ? 'woori-scroll-fix__content' : undefined} style={{ position: 'relative', height: 2000 }}>
        {children}
      </div>
    </div>
  )
}
const NO_REF = { current: null }

/** 페이지 스크롤 컨테이너를 100dp 내린다 (100 × 16/11 = 145.45 기기 px — 정수가 아님) */
function Scrolled({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>('.woori-layer__scroll')
    if (scroller) wooriScrollTo(scroller, 100)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative', height: 2000 }}>
      {children}
    </div>
  )
}

const DEMO_BUTTONS: CSSProperties = { position: 'absolute', left: 20, top: 20, display: 'flex', gap: 8, zIndex: 1 }
const DEMO_BUTTON: CSSProperties = { height: 40, padding: '0 16px', borderRadius: 8, background: 'var(--woori-primary)', color: 'var(--woori-text-on-primary)' }

export default function WooriDevFrame() {
  const shot = useShotState('dev-frame', DEV_FRAME_SHOTS)
  const mode: Mode = shot?.state ?? 'geometry'
  const [demo, setDemo] = useState<'sheet' | 'popup' | null>(null)
  useShotReady(shot != null)
  useWooriBands(mode === 'geometry' || mode === 'scrolled' || mode === 'bottom' || mode.startsWith('nested') ? GRAY_BANDS : null)
  return (
    <div className="woori-dev-frame" data-mode={mode}>
      {mode === 'geometry' && <Geometry />}
      {mode === 'scrolled' && (
        <Scrolled>
          <Geometry dy={-100} />
        </Scrolled>
      )}
      {mode === 'bottom' && (
        <>
          <div className="woori-dev-frame__box" data-ref="bottom56" style={{ left: 16, width: 328, bottom: 18, height: 56, ...WOORI_BOTTOM_FIX }} />
          <div className="woori-dev-frame__box" data-ref="place" style={{ ...wooriPlace(20.5, 100.25), width: 100, height: 40 }} />
        </>
      )}
      {(mode === 'nested' || mode === 'nested-nofix') && (
        <Nested fix={mode === 'nested'}>
          <Geometry dy={10} />
        </Nested>
      )}
      {mode === 'spinner' && (
        <>
          <WooriSpinner />
          <WooriSpinner at="home" />
        </>
      )}
      {!shot && (
        <div style={DEMO_BUTTONS}>
          <button type="button" style={DEMO_BUTTON} data-demo="sheet" onClick={() => setDemo('sheet')}>
            시트
          </button>
          <button type="button" style={DEMO_BUTTON} data-demo="popup" onClick={() => setDemo('popup')}>
            팝업
          </button>
        </div>
      )}
      <WooriSheet
        open={mode === 'sheet' || demo === 'sheet'}
        appear={!shot}
        label="시험 시트"
        style={{ height: 300 }}
        onDimClick={() => setDemo(null)}
      />
      <WooriSheet
        open={mode === 'popup' || demo === 'popup'}
        variant="popup"
        appear={!shot}
        label="시험 팝업"
        style={{ height: 236.667 }}
        onDimClick={() => setDemo(null)}
      />
    </div>
  )
}
