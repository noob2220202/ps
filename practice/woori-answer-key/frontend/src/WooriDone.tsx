// WooriDone — /send/done 이체 완료 (spec/done.md · done.json)
//   ?tx=<transactionId> (확인 화면이 넘긴다). 없으면(개발·shot) 가장 최근 출금 이체를 보여 준다 (시나리오 v2-start / v2-end).
//   흰 페이지+스피너 → S1 본문(받는 계좌는 번호만) + 체크 원 → S2 은행 이름(길면 두 줄로 꺾여 카드가 늘어남) + 광고 카드 → S3 광고 그림 → 스피너 끔.
//   체크 원: scale 0 → 1.05 → 0.95 → 1 (288ms), 획: 원 +194ms 부터 보이는 길이만 늘어남 (446ms) — 영상 표본 키프레임 (3.2–3.3).
//   [확인] → 스피너 → 거래내역(/history?type=all, 기록을 바꿔 끼움). [공유]·메모·[보기]·더보기·☆·광고 는 영상에 없는 설계(wooriTodo).
//   폰 뒤로 = [확인] (APK). 불러오는 중·떠나는 150ms 동안은 받아서 버리고, 불러오기 오류 화면에서는 [확인] 과 같이 거래내역으로.
//   키가 다른 화면(APK): [공유][확인]은 아래끝 기준(atB), 그 위 내용(체크 원~광고 카드)은 단추 위에서 끝나는 자기 스크롤 영역 —
//   셸이 낮아(≈730dp 아래) 광고 카드가 단추에 닿으면 스크롤된다. 프레임 모드는 넘칠 일이 없어 스크롤 컨테이너가 아니다(영상 자리·AA 그대로).
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { artSrc, type WooriArtName } from './WooriArt.ts'
import { WooriButton } from './WooriButton.tsx'
import { useWooriStages } from './WooriLoadingPage.tsx'
import { WooriOverlay } from './WooriSheet.tsx'
import { WooriSpinner } from './WooriSpinner.tsx'
import { useShotReady, useShotState } from './WooriShot.ts'
import { useWooriLayer, useWooriNavigate } from './WooriNav.ts'
import { wooriBottomTop } from './WooriLayout.ts'
import { wooriApi, type Done } from './WooriApi.ts'
import { useWooriBack, wooriTodo } from './WooriEnv.ts'
import './WooriDone.css'

const r3 = (v: number) => Math.round(v * 1000) / 1000
function at(x: number, y: number, dy = 0): CSSProperties {
  const lx = Math.round(x)
  const ly = Math.round(y)
  const fx = r3(x - lx)
  const fy = r3(y - ly + dy)
  return { left: lx, top: ly, ...(fx || fy ? { translate: `${fx}px ${fy}px` } : {}) }
}
/** at() 의 아래끝 기준판: 영상 top y 인 상자를 페이지 아래끝에서 같은 거리에 (WooriLayout wooriBottomTop — 프레임 모드는 at() 과 같은 자리) */
function atB(x: number, y: number, dy = 0): CSSProperties {
  const p = at(x, y, dy)
  return { ...p, top: wooriBottomTop(p.top as number) }
}
/** 오른쪽 끝 고정 글자 (right = 360 − 오른끝) */
function atRight(rightEdge: number, y: number, dy = 0): CSSProperties {
  const rr = 360 - rightEdge
  const lr = Math.round(rr)
  const ly = Math.round(y)
  const fx = r3(lr - rr)
  const fy = r3(y - ly + dy)
  return { right: lr, top: ly, ...(fx || fy ? { translate: `${fx}px ${fy}px` } : {}) }
}
function MaskIcon({ name, x, y, w, h, color, onClick }: { name: WooriArtName; x: number; y: number; w: number; h: number; color: string; onClick?: () => void }) {
  const url = `url(${artSrc(name)})`
  return (
    <span
      className="woori-done__icon woori-done__mask"
      style={{ ...at(x, y), width: w, height: h, background: color, WebkitMaskImage: url, maskImage: url }}
      aria-hidden
      onClick={onClick}
    />
  )
}

/** 단계 (v1, 흰 화면부터 ms, 3.1): 1 본문 + 체크 원 시작 · 2 은행 이름 + 광고 카드 · 3 광고 그림 · 4 스피너 끔 */
const DONE_STAGES_MS = [234, 293, 393, 794] as const
const STAGE_IDLE = 4
/** 폰 뒤로를 받아서 버린다 (떠나는 중 · 불러오는 중 — WooriSendConfirm 처리 중과 같은 방식) */
const NOOP = () => {}

interface DoneShot {
  stage: number
  spinner?: boolean
  pressed?: boolean
  anim?: boolean
}
const DONE_SHOTS: Readonly<Record<string, DoneShot>> = {
  blank: { stage: 0 },
  render: { stage: 1 },
  idle: { stage: STAGE_IDLE },
  'os-headsup': { stage: STAGE_IDLE },
  'idle-headsup': { stage: STAGE_IDLE, spinner: true },
  'confirm-pressed': { stage: STAGE_IDLE, pressed: true },
  leaving: { stage: STAGE_IDLE, spinner: true },
  'check-anim': { stage: STAGE_IDLE, anim: true },
}

/** 받는 계좌 값 칸 폭 (설계 188.56dp, 2.5) — 넘으면 은행 / 번호 두 줄 */
const VALUE_COL_DP = 188.56
const FONT_VALUE = '500 15px "Pretendard Variable"'

async function measure(text: string): Promise<number> {
  try {
    await document.fonts.load(FONT_VALUE, text)
  } catch {
    /* 글꼴을 못 불러도 대체 글꼴로 잰다 */
  }
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return 0
  ctx.font = FONT_VALUE
  return ctx.measureText(text).width
}

interface DoneData {
  done: Done
  twoLine: boolean
}

async function loadDone(tx: string | null): Promise<DoneData> {
  const id = tx
  if (!id) {
    const accounts = await wooriApi.getAccounts()
    const page = await wooriApi.getTransactions(accounts[0].id, { type: 'out', limit: 5 })
    for (const item of page.items) {
      try {
        const done = await wooriApi.getDone(item.id)
        return { done, twoLine: (await measure(done.display.account)) > VALUE_COL_DP }
      } catch {
        /* 이체가 아닌 출금은 건너뛴다 */
      }
    }
    throw new Error('최근 이체 내역이 없습니다')
  }
  const done = await wooriApi.getDone(id)
  return { done, twoLine: (await measure(done.display.account)) > VALUE_COL_DP }
}

export default function WooriDone() {
  const [params] = useSearchParams()
  const go = useWooriNavigate()
  const shot = useShotState('done', DONE_SHOTS)
  const s = shot?.state ?? null
  const tx = params.get('tx')

  const [data, setData] = useState<DoneData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    loadDone(tx).then(
      (d) => alive && setData(d),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      alive = false
    }
  }, [tx])

  const stage = useWooriStages(DONE_STAGES_MS, { start: data != null, shotStage: s ? s.stage : null })
  const st = s ? s.stage : stage
  useShotReady(data != null || s?.stage === 0)

  const [leaving, setLeaving] = useState(false)
  const leaveTimer = useRef(0)
  const onConfirm = useCallback(() => {
    // 한 번만 ([확인] 연타 · 뒤로 + [확인] — 거래내역으로 두 번 바꿔 끼우지 않게)
    if (leaveTimer.current) return
    setLeaving(true)
    leaveTimer.current = window.setTimeout(() => go('/history?type=all', { replace: true, state: { from: 'done' } }), 150)
  }, [go])
  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])
  // 폰 뒤로 버튼 = [확인] (이미 끝난 이체의 확인·금액 화면으로 돌아가지 않게). 떠나는 150ms 와 불러오는 동안은 받아서 버린다
  // (안 받으면 WooriLocal 이 history.back() → 끝난 이체의 금액 화면이 열린다). 불러오기 실패(오류 글자만, [확인] 없음)면 뒤로 = [확인] — 갇히지 않게
  const { top } = useWooriLayer()
  useWooriBack(top && !s ? (leaving || (data == null && error == null) ? NOOP : onConfirm) : null)

  const spinner = s ? st < STAGE_IDLE || !!s.spinner : st < STAGE_IDLE || leaving
  const d = data?.done
  // S1 은 번호만 한 줄, S2 부터 은행 이름 (길면 두 줄)
  const two = st >= 2 && !!data?.twoLine
  const v = (one: number, twoV: number) => (two ? twoV : one)
  const anim = s ? !!s.anim : true
  const showBadge = st >= 1 && !(s && s.stage === 1)
  const [title1, title2] = (d?.display.title ?? '').split('\n')
  // 단추 위 스크롤 영역의 내용 높이 = 광고 카드 아래끝 + 16 (설계)
  const contentH = Math.ceil(v(624.667, 647.333)) + 16

  return (
    <div className="woori-done">
      {/* 단추 위 내용: 실제 앱에서 자기 스크롤 영역 (프레임 모드는 그냥 상자 — WooriDone.css) */}
      <div className="woori-done__scroll">
        <div className="woori-done__content" style={{ height: contentH }}>
          {error && (
            <p className="woori-done__t" style={at(20, 80)}>
              {error}
            </p>
          )}

          {d && st >= 1 && (
            <>
              {showBadge && (
                <div className={anim ? 'woori-done-check--anim' : undefined}>
                  <svg className="woori-done-check__badge" viewBox="0 0 60 60" aria-hidden>
                    <circle cx="30" cy="30" r="30" fill="var(--woori-primary)" />
                    <path className="woori-done-check__path" d="M18.27 28.56 L27.05 37.47 L41.7 22.62" />
                  </svg>
                </div>
              )}
              <p className="woori-done__center" style={at(0, 192)}>
                {title1}
              </p>
              <p className="woori-done__center" style={at(0, 223, -0.25)}>
                {title2}
              </p>

              <div className="woori-done__card" style={{ ...at(20, 281.667), height: v(215, 237.667) }} />
              <p className="woori-done__t woori-done__label" style={at(40.84, v(309, 320))}>
                받는 계좌
              </p>
              {st >= 2 && !two ? (
                <p className="woori-done__t woori-done__right" style={atRight(293.05, 309)}>
                  {d.display.account}
                </p>
              ) : two ? (
                <>
                  <p className="woori-done__t woori-done__right" style={{ ...atRight(293.05, 309), letterSpacing: '-0.005em' }}>
                    {d.to.bankName}
                  </p>
                  <p className="woori-done__t woori-done__right" style={atRight(293.05, 331, 0.25)}>
                    {d.to.accountNumber}
                  </p>
                </>
              ) : (
                <p className="woori-done__t woori-done__right" style={atRight(293.05, 309)}>
                  {d.to.accountNumber}
                </p>
              )}
              <img
                className="woori-done__icon"
                src={artSrc('send-a.star-outline')}
                alt=""
                style={{ ...at(298.94, v(304.48, 315.82)), width: 20, height: 20 }}
                draggable={false}
                onClick={wooriTodo}
              />

              <p className="woori-done__t woori-done__label" style={at(40.94, v(343, 366))}>
                이체금액
              </p>
              <p className="woori-done__t woori-done__right" style={{ ...atRight(318.85, v(343, 366)), letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                {d.display.amount}
              </p>

              <p className="woori-done__t woori-done__label" style={{ ...at(40.84, v(377, 400), two ? 0 : 0.25), letterSpacing: '0.01em' }}>
                메모
              </p>
              <p
                className="woori-done__t woori-done__right"
                style={{ ...atRight(303.05, v(377, 400), two ? 0 : 0.25), letterSpacing: '-0.0325em', color: d.memo ? undefined : 'var(--woori-placeholder)' }}
                onClick={wooriTodo}
              >
                {d.memo || '내용을 입력할 수 있어요'}
              </p>
              <MaskIcon name="history.chevron-right-12" x={310.48} y={v(378.6, 400.93)} w={12} h={12} color="#76777a" onClick={wooriTodo} />

              <p className="woori-done__t woori-done__label" style={at(40.94, v(414, 436), 0.25)}>
                이체확인증
              </p>
              <div className="woori-done__pill" style={at(271, v(407.667, 430.333))} onClick={wooriTodo}>
                <span style={{ top: v(8, 7.667) }}>보기</span>
              </div>
              <div className="woori-done__line" style={{ top: Math.round(v(446.667, 469.333)), translate: `0 ${r3(v(446.667, 469.333) - Math.round(v(446.667, 469.333)))}px` }} />
              <p className="woori-done__t" style={{ ...at(151.78, v(464, 487)), fontSize: 14, fontWeight: 600, letterSpacing: '0.005em', color: '#6d6e71' }} onClick={wooriTodo}>
                더보기
              </p>
              <MaskIcon name="history.chevron-down-12" x={193.98} y={v(465.83, 488.16)} w={12} h={12} color="#737477" onClick={wooriTodo} />

              {/* 광고 카드: 글자·그림은 누름을 카드로 지나보낸다 */}
              {st >= 2 && (
                <>
                  <div className="woori-done__ad" style={at(20, v(528.667, 551.333))} onClick={wooriTodo} />
                  <p className="woori-done__t woori-done__pass" style={{ ...at(44, v(559, 581), -0.25), fontSize: 16, fontWeight: 600, color: '#2e353e' }}>
                    빌려준 돈, 차용증은 쓰셨나요?
                  </p>
                  <p className="woori-done__t woori-done__pass" style={{ ...at(44.03, v(583, 606)), fontSize: 13, fontWeight: 500, color: '#7a818b' }}>
                    비대면으로 5분만에 작성하기
                  </p>
                </>
              )}
              {st >= 3 && (
                <img className="woori-done__icon woori-done__pass" src={artSrc('done.ad-iou-illust')} alt="" style={{ ...at(256, v(544.333, 567)), width: 64, height: 64 }} draggable={false} />
              )}
            </>
          )}
        </div>
      </div>

      {/* [공유][확인]: 아래끝 기준 */}
      {d && st >= 1 && (
        <>
          <WooriButton variant="secondary" className="woori-done__btn" style={{ ...atB(16, 726.667), width: 102.4 }} onClick={wooriTodo}>
            공유
          </WooriButton>
          <WooriButton
            className="woori-done__btn woori-done__confirm"
            style={{ ...atB(126.4, 726.667), width: 217.6, ...(s?.pressed ? ({ '--woori-btn-press-scale': 1 } as CSSProperties) : {}) }}
            data-pressed={s?.pressed ? '' : undefined}
            onClick={onConfirm}
          >
            확인
          </WooriButton>
        </>
      )}

      {spinner && (
        <WooriOverlay>
          <div className="woori-done__spinner-top">
            <WooriSpinner />
          </div>
        </WooriOverlay>
      )}
    </div>
  )
}
