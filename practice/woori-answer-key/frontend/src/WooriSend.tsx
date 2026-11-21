// WooriSend — /send 어디로 이체하시겠어요? (spec/send-a.md 2.1 · 2.2 · 3.1, 상태 loading-blank · where-*)
//
//   ‹ (일반 페이지 머리, 주인 history) / 제목 22/700 / 계좌번호 입력 + 카메라 / 밑줄 / [추천|자주|내계좌] 세그먼트 /
//   최근입금계좌 · 편집 / 행: 은행 로고 40dp · 이름 | 날짜 / 은행 계좌 · ☆ / (바닥) ＋ 연락처로 이체하기
//   들어올 때 단계적 그리기 S0–S6 (애니메이션 아니라 한 프레임 교체, 시각은 v2 표 — 3.1): 흰 페이지 → 스피너 → 제목·입력·탭 + 연락처 줄 올라옴
//   → 알약·최근입금계좌·스켈레톤 → ‹·카메라·＋원 → 행 글자 → ☆·로고 → 스피너 꺼짐.
//   계좌번호 입력 줄 탭 → /send/account push(easeOutCubic 322ms) + 이 페이지 흰 베일 0→0.8 linear 326ms (30ms 늦게).
//   최근입금계좌 행 탭 → 눌림 없이 가운데 스피너 → 계좌 조회 → 1.5s 뒤 금액 페이지 (/send/amount?to=<recipientId>, send-b).
//   계좌번호 페이지가 [확인] 뒤 reveal 로 이 페이지를 드러내면 스피너를 이어 돌리고 509ms 뒤 금액 페이지로 (3.4).
// 이름·계좌는 API(최근입금계좌)에서 — 이 파일에는 쓰지 않는다.
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import './WooriSend.css'
import { wooriApi, type Recipient, type RecipientTab } from './WooriApi.ts'
import { artSrc } from './WooriArt.ts'
import { WooriHeader } from './WooriHeader.tsx'
import { WOORI_BOTTOM_FIX } from './WooriLayout.ts'
import { useWooriStages } from './WooriLoadingPage.tsx'
import { historyIndex, useWooriLayer, useWooriNavigate } from './WooriNav.ts'
import { amountUrl, bankLogoArt, fbox, SEND_A_MOTION, takeSendNext, textAt } from './WooriSendFlow.ts'
import { useShotReady, useShotState } from './WooriShot.ts'
import { WooriSpinner } from './WooriSpinner.tsx'
import { wooriTodo } from './WooriEnv.ts'

/** 단계 시각 (흰 페이지 첫 프레임부터 ms, v2 — keep.renderSteps). 단계 0 = S0 흰 페이지 … 7 = S6 */
const STAGES_V2 = [401, 970, 1078, 1187, 1287, 1438, 1455] as const
/** 단계 번호 */
const S = { S0: 0, S0s: 1, S1: 2, S2: 3, S3: 4, S4: 5, S5: 6, S6: 7 } as const

interface WhereShot {
  stage: number
  spinner?: boolean
  veil?: number
}

const WHERE_SHOTS: Readonly<Record<string, WhereShot>> = {
  'loading-blank': { stage: S.S0s },
  'where-render': { stage: S.S3 },
  'where-idle': { stage: S.S6 },
  'where-row-tap-spinner': { stage: S.S6, spinner: true },
  'where-reveal': { stage: S.S6, spinner: true, veil: 0.8 },
}

const TABS: ReadonlyArray<{ id: RecipientTab; label: string; x: number; ls: string }> = [
  { id: 'recommend', label: '추천', x: 62.5, ls: '-0.01em' },
  { id: 'frequent', label: '자주', x: 167.95, ls: '-0.01em' },
  { id: 'mine', label: '내계좌', x: 267.11, ls: '0.005em' },
]

/** 행·스켈레톤 줄 간격 (스켈레톤 잰 75.83dp) */
const ROW_PITCH = 75.833

export interface WooriSendWhereViewProps {
  stage: number
  recipients: Recipient[] | null
  tab?: RecipientTab
  onTab?: (t: RecipientTab) => void
  onBack?: () => void
  onInput?: () => void
  onRow?: (r: Recipient) => void
  spinner?: boolean
  /** 페이지 위 흰 베일 (shot where-reveal 등 — 평소 베일은 페이지 스택이 그린다) */
  veil?: number
  /** 연락처 줄 올라옴 애니메이션 (S1 부터) */
  animateContact?: boolean
  /** 스피너를 이 상자에 그린다 (reveal 때 페이지 스택 베일 위 — 영상 74.214 에서 스피너는 베일 아래로 흐려지지 않는다) */
  spinnerHost?: Element | null
  rootRef?: (el: HTMLDivElement | null) => void
}

/** 어디로 이체 페이지 모습 (계좌번호 페이지 push shot 의 아래 페이지로도 쓴다) */
export function WooriSendWhereView({
  stage,
  recipients,
  tab = 'recommend',
  onTab,
  onBack,
  onInput,
  onRow,
  spinner,
  veil,
  animateContact = true,
  spinnerHost,
  rootRef,
}: WooriSendWhereViewProps) {
  const sel = TABS.findIndex((t) => t.id === tab)
  // 비선택 탭 사이에만 1dp 세로선 (선택 0 → 2·3 사이 232.667, 선택 2 → 1·2 사이 127.333)
  const sepX = sel === 0 ? 232.667 : sel === 2 ? 127.333 : null
  const rows = stage >= S.S4 && recipients ? recipients : null
  return (
    <div className="woori-send" data-stage={stage} ref={rootRef}>
      {stage >= S.S3 && <WooriHeader className="woori-send__header" onBack={onBack} />}
      {stage >= S.S1 && (
        <>
          <h1 className="woori-send__title" style={textAt(20.03, 72)}>
            어디로 이체하시겠어요?
          </h1>
          <button type="button" className="woori-send__input" onClick={onInput} aria-label="계좌번호 입력">
            <span className="woori-send__placeholder" style={textAt(19.97, 128.25)}>
              계좌번호 입력
            </span>
            {stage >= S.S3 && <img className="woori-send__icon" src={artSrc('send-a.camera')} alt="" style={fbox(316, 128.5, 24, 24)} onClick={wooriTodo} />}
          </button>
          <div className="woori-send__underline" style={fbox(20, 163.833, 320, 2)} />
          <div className="woori-send__tabs" role="tablist">
            {stage >= S.S2 && <div className="woori-send__pill" style={fbox(22 + sel * 105.333, 192, 105.333, 40)} />}
            {sepX != null && <div className="woori-send__sep" style={fbox(sepX, 203.5, 1, 16)} />}
            {TABS.map((t, i) => (
              <span
                key={t.id}
                className={`woori-send__tab-text${i === sel ? ' woori-send__tab-text--on' : ''}`}
                style={{ ...textAt(t.x, 204), letterSpacing: t.ls }}
                aria-hidden
              >
                {t.label}
              </span>
            ))}
            {TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={i === sel}
                aria-label={t.label}
                className="woori-send__tab"
                style={{ position: 'absolute', left: 22 + Math.round(i * 105.333), top: 192, width: 105, height: 40 }}
                onClick={() => onTab?.(t.id)}
              />
            ))}
          </div>
        </>
      )}
      {stage >= S.S2 && (
        <>
          <h2 className="woori-send__recent" style={textAt(19.97, 261)}>
            최근입금계좌
          </h2>
          <button type="button" className="woori-send__edit" style={textAt(314.12, 262.75)} onClick={wooriTodo}>
            편집
          </button>
        </>
      )}
      {stage >= S.S2 && !rows && (
        <div className="woori-send__skeleton" aria-hidden>
          {[0, 1, 2].map((i) => {
            const y = 315.333 + i * ROW_PITCH
            return (
              <div key={i}>
                <div className="woori-send__sk" style={fbox(20, y, 40, 40)} />
                <div className="woori-send__sk" style={fbox(76, y, 202.5, 16)} />
                <div className="woori-send__sk" style={fbox(76, y + 24.333, 180.333, 16)} />
              </div>
            )
          })}
        </div>
      )}
      {rows?.map((r, i) => {
        const dy = i * ROW_PITCH
        const logo = bankLogoArt(r.logo)
        return (
          <div key={r.id} className="woori-send__row-wrap">
            <button type="button" className="woori-send__row" style={{ top: Math.floor(297 + dy) }} onClick={() => onRow?.(r)} aria-label={`${r.name} ${r.bankName} ${r.accountNumber}`} />
            {stage >= S.S5 && logo && <img className="woori-send__avatar" src={artSrc(logo)} alt="" style={fbox(20, 305.333 + dy, 40, 40)} />}
            <div className="woori-send__row-line1" style={textAt(75.88, 307 + dy)}>
              <span className="woori-send__name">{r.name}</span>
              <span className="woori-send__bar" />
              <span className="woori-send__date">{r.date}</span>
            </div>
            <div className="woori-send__acct" style={textAt(75.97, 330 + dy)}>
              {r.bankName} {r.accountNumber}
            </div>
            {stage >= S.S5 && (
              <img className="woori-send__icon woori-send__star" src={artSrc('send-a.star-outline')} alt="" style={fbox(316, 303.167 + dy, 24, 24)} />
            )}
          </div>
        )
      })}
      {stage >= S.S1 && (
        <div className={`woori-send__contact${animateContact ? ' woori-send__contact--in' : ''}`} style={WOORI_BOTTOM_FIX}>
          {stage >= S.S3 && (
            <>
              <div className="woori-send__contact-circle" />
              <img className="woori-send__icon" src={artSrc('send-a.plus')} alt="" style={fbox(28, 8, 24, 24)} />
            </>
          )}
          <span className="woori-send__contact-text" style={textAt(76, 12.333)}>
            연락처로 이체하기
          </span>
        </div>
      )}
      {veil != null && <div className="woori-send__veil" style={{ opacity: veil } as CSSProperties} aria-hidden />}
      {spinner &&
        (spinnerHost
          ? createPortal(
              <div className="woori-send__top">
                <WooriSpinner />
              </div>,
              spinnerHost,
            )
          : <WooriSpinner />)}
    </div>
  )
}

/** 계좌번호 페이지 push (+ 아래 페이지 베일 0→0.8) */
const PUSH_ACCOUNT = {
  kind: 'push',
  duration: SEND_A_MOTION.push.duration,
  easing: SEND_A_MOTION.push.easing,
  veil: SEND_A_MOTION.pushVeil,
} as const

/** 행 탭 → 금액 페이지까지 (v1 180.302 → 181.801) */
const ROW_TO_AMOUNT_MS = 1499

export default function WooriSend() {
  const shot = useShotState('send-where', WHERE_SHOTS)
  const go = useWooriNavigate()
  const navigate = useNavigate()
  const { top } = useWooriLayer()
  const [recipients, setRecipients] = useState<Recipient[] | null>(null)
  const [tab, setTab] = useState<RecipientTab>('recommend')
  const [busy, setBusy] = useState(false)
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const stage = useWooriStages(STAGES_V2, { shotStage: shot ? shot.state.stage : null })

  useEffect(() => {
    const ac = new AbortController()
    wooriApi
      .getRecipients(tab, ac.signal)
      .then(setRecipients)
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setRecipients([])
      })
    return () => ac.abort()
  }, [tab])

  // 계좌번호 페이지가 [확인] 뒤 이 페이지를 드러냈다: 스피너를 이어 돌리고 509ms 뒤 금액 페이지로
  useEffect(() => {
    if (!top || shot) return
    const next = takeSendNext()
    if (!next) return
    const on = window.setTimeout(() => setBusy(true), 0)
    const t = window.setTimeout(() => go(next.url, { state: next.state }), SEND_A_MOTION.revealToAmountMs)
    return () => {
      window.clearTimeout(on)
      window.clearTimeout(t)
    }
  }, [top, shot, go])

  const onRow = useCallback(
    (r: Recipient) => {
      if (busy) return
      setBusy(true)
      const t0 = performance.now()
      wooriApi
        .lookup(r.bankCode, r.accountNumber)
        .then((lookup) => ({ lookup }))
        .catch(() => ({ lookup: undefined }))
        .then((state) => {
          const wait = Math.max(0, ROW_TO_AMOUNT_MS - (performance.now() - t0))
          window.setTimeout(() => go(amountUrl({ recipientId: r.id }), { state }), wait)
        })
    },
    [busy, go],
  )

  const onBack = useCallback(() => {
    if (historyIndex() > 0) navigate(-1)
    else go('/home', { replace: true })
  }, [navigate, go])

  const ready = recipients != null
  useShotReady(ready)

  const spinner = shot ? !!shot.state.spinner || (stage >= S.S0s && stage < S.S6) : busy || (stage >= S.S0s && stage < S.S6)
  return (
    <WooriSendWhereView
      stage={stage}
      recipients={recipients}
      tab={tab}
      onTab={setTab}
      onBack={onBack}
      onInput={() => go('/send/account', { transition: PUSH_ACCOUNT })}
      onRow={onRow}
      spinner={spinner}
      veil={shot?.state.veil}
      rootRef={setRoot}
      spinnerHost={!shot && root ? root.closest('.woori-layer__page') : null}
    />
  )
}
