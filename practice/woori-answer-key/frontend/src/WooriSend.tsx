// WooriSend — /send 어디로 이체하시겠어요? (spec/send-a.md 2.1 · 2.2 · 3.1, 상태 loading-blank · where-*)
//
//   ‹ (일반 페이지 머리, 주인 history) / 제목 22/700 / 계좌번호 입력 + 카메라 / 밑줄 / [추천|자주|내계좌] 세그먼트 /
//   최근입금계좌 · 편집 / 행: 은행 로고 40dp · 이름 | 날짜 / 은행 계좌 · ☆ / (바닥) ＋ 연락처로 이체하기
//   들어올 때 단계적 그리기 S0–S6 (애니메이션 아니라 한 프레임 교체, 시각은 v2 표 — 3.1): 흰 페이지 → 스피너 → 제목·입력·탭 + 연락처 줄 올라옴
//   → 알약·최근입금계좌·스켈레톤 → ‹·카메라·＋원 → 행 글자 → ☆·로고 → 스피너 꺼짐.
//   계좌번호 입력 줄 탭 → /send/account push(easeOutCubic 322ms) + 이 페이지 흰 베일 0→0.8 linear 326ms (30ms 늦게).
//   최근입금계좌 행 탭 → 눌림 없이 가운데 스피너 → 계좌 조회 → 1.5s 뒤 금액 페이지 (/send/amount?to=<recipientId>, send-b).
//     스피너 동안 다른 누름은 받지 않는다. ‹ · 폰 뒤로는 기다리던 이동을 취소하고 나간다 (페이지가 내려가도 취소).
//   계좌번호 페이지가 [확인] 뒤 reveal 로 이 페이지를 드러내면 스피너를 이어 돌리고 509ms 뒤 금액 페이지로 (3.4).
// 설계 (영상에서 누르지 않음 — spec/send-a.md 4 동작. 실제 앱만: 프레임·shot 모드에서는 누름이 아무것도 바꾸지 않는다):
//   편집 → 그 자리에서 편집 모드 (글자 '완료' 파랑). 행의 ☆ 자리에 [삭제] 알약 → 바로 지운다 (화면 먼저, 다음 DELETE — 저장된다).
//     자주 탭의 [삭제] = 자주에서 빼기 (☆ 끔). 완료 · ‹ · 폰 뒤로 · 탭 바꿈 · 계좌번호 입력 줄 탭은 편집 모드부터 끝낸다. 다 지우면 저절로 끝.
//   ☆ → 즐겨찾기 켬/끔 (채운 별 = --woori-primary). 자주 탭 = 즐겨찾기한 계좌. 내계좌 탭에는 ☆·편집이 없다.
//   내계좌 행 탭: 첫 줄은 출금계좌(금액 페이지가 첫 계좌에서 보낸다)라 토스트, 다른 내 계좌는 은행·계좌번호로 금액 페이지.
//   머리말은 탭마다 (최근입금계좌 · 자주 쓰는 계좌 · 내 계좌), 빈 목록이면 안내 글자.
//   카메라 · ＋ 연락처로 이체하기 = '답지에는 없는 화면이에요' (wooriTodo).
//   행 목록은 자기 스크롤 상자(머리말 아래 ~ 연락처 줄 위) — 키 작은 폰(APK 640dp~)에서 행이 연락처 줄 밑으로 숨지 않게. 영상 자리는 그대로.
// 이름·계좌는 API(최근입금계좌)에서 — 이 파일에는 쓰지 않는다.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import './WooriSend.css'
import { wooriApi, WooriApiError, type Recipient, type RecipientTab } from './WooriApi.ts'
import { artSrc } from './WooriArt.ts'
import { WooriHeader } from './WooriHeader.tsx'
import { useWooriScrollFix, WOORI_BOTTOM_FIX } from './WooriLayout.ts'
import { useWooriStages } from './WooriLoadingPage.tsx'
import { historyIndex, useWooriLayer, useWooriNavigate } from './WooriNav.ts'
import { amountUrl, bankLogoArt, fbox, SEND_A_MOTION, takeSendNext, textAt } from './WooriSendFlow.ts'
import { useShotReady, useShotState } from './WooriShot.ts'
import { WooriSpinner } from './WooriSpinner.tsx'
import { wooriLiveApp, wooriToast, wooriTodo } from './WooriEnv.ts'

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

/** heading · empty 는 설계 (영상은 추천 탭만 — '최근입금계좌') */
const TABS: ReadonlyArray<{ id: RecipientTab; label: string; x: number; ls: string; heading: string; empty: string }> = [
  { id: 'recommend', label: '추천', x: 62.5, ls: '-0.01em', heading: '최근입금계좌', empty: '최근 입금한 계좌가 없어요' },
  { id: 'frequent', label: '자주', x: 167.95, ls: '-0.01em', heading: '자주 쓰는 계좌', empty: '별을 눌러 자주 쓰는 계좌를 추가해 보세요' },
  { id: 'mine', label: '내계좌', x: 267.11, ls: '0.005em', heading: '내 계좌', empty: '계좌가 없어요' },
]

/** 행·스켈레톤 줄 간격 (스켈레톤 잰 75.83dp) */
const ROW_PITCH = 75.833
/** 행 목록 스크롤 상자 위끝 (페이지 dp, 정수 — 안쪽 상자들의 소수 자리가 그대로 남게). 아래끝은 CSS (연락처 줄 위 12dp) */
const LIST_TOP = 290

export interface WooriSendWhereViewProps {
  stage: number
  recipients: Recipient[] | null
  tab?: RecipientTab
  onTab?: (t: RecipientTab) => void
  onBack?: () => void
  onInput?: () => void
  onRow?: (r: Recipient) => void
  /** 편집 모드 (☆ 자리에 [삭제]) — 설계 */
  editing?: boolean
  onEdit?: () => void
  onDelete?: (r: Recipient) => void
  onStar?: (r: Recipient) => void
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
  editing = false,
  onEdit,
  onDelete,
  onStar,
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
  // 편집: 내계좌 탭(내 계좌는 지울 수 없다)·빈 목록에는 없다. 불러오는 동안(스켈레톤)은 영상처럼 보인다
  const canEdit = tab !== 'mine' && rows?.length !== 0
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
            {stage >= S.S3 && <img className="woori-send__icon" src={artSrc('send-a.camera')} alt="" style={fbox(316, 128.5, 24, 24)} />}
          </button>
          {/* 카메라 누름 자리 (입력 줄 오른끝 56x56 — 입력 줄 단추 위). 계좌번호 촬영은 답지 밖 */}
          {stage >= S.S3 && <button type="button" className="woori-send__camera" aria-label="계좌번호 촬영" onClick={wooriTodo} />}
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
            {TABS[sel].heading}
          </h2>
          {canEdit && (
            // '편집'·'완료' 둘 다 두 글자라 오른끝(340)이 같다
            <button type="button" className={`woori-send__edit${editing ? ' woori-send__edit--on' : ''}`} style={textAt(314.12, 262.75)} onClick={onEdit}>
              {editing ? '완료' : '편집'}
            </button>
          )}
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
      {rows?.length === 0 && (
        <p className="woori-send__empty" style={textAt(20, 307)}>
          {TABS[sel].empty}
        </p>
      )}
      {rows && rows.length > 0 && (
        <WooriSendRows rows={rows} stage={stage} star={tab !== 'mine'} editing={editing} onRow={onRow} onDelete={onDelete} onStar={onStar} />
      )}
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
          <button type="button" className="woori-send__contact-btn" aria-label="연락처로 이체하기" onClick={wooriTodo} />
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

interface WooriSendRowsProps {
  rows: Recipient[]
  stage: number
  /** ☆ 를 그릴지 (내계좌 탭은 없음) */
  star: boolean
  editing: boolean
  onRow?: (r: Recipient) => void
  onDelete?: (r: Recipient) => void
  onStar?: (r: Recipient) => void
}

/** 채운 별 (즐겨찾기 켬 — 설계 색 --woori-primary). 길 = send-a.star-outline 그림과 같다 */
const STAR_PATH =
  'M11.1668 3.9214A0.9521 0.9521 0 0 1 12.8634 3.9242L14.8934 7.9250A1.0234 1.0234 0 0 0 15.6444 8.4725L20.0745 9.1812A0.9521 0.9521 0 0 1 20.5961 10.7956L17.4184 13.9626A1.0234 1.0234 0 0 0 17.1298 14.8460L17.8247 19.2783A0.9521 0.9521 0 0 1 16.4505 20.2733L12.4565 18.2298A1.0234 1.0234 0 0 0 11.5272 18.2283L7.5266 20.2588A0.9521 0.9521 0 0 1 6.1556 19.2593L6.8649 14.8294A1.0234 1.0234 0 0 0 6.5792 13.9450L3.4118 10.7677A0.9521 0.9521 0 0 1 3.9387 9.1550L8.3710 8.4607A1.0234 1.0234 0 0 0 9.1238 7.9156L11.1668 3.9214Z'

/**
 * 최근입금계좌 행들 — 자기 스크롤 상자 안 (위끝 LIST_TOP, 아래끝 연락처 줄 위). 안쪽 좌표 = 페이지 dp − LIST_TOP.
 * 프레임 모드에서는 useWooriScrollFix 가 상자 원점을 기기 화소에 맞춰 행이 영상 자리(페이지에 바로 그리던 자리) 그대로 그려진다.
 * 마운트와 함께 맞추도록 따로 컴포넌트다 (행이 생길 때 상자가 생긴다).
 */
function WooriSendRows({ rows, stage, star, editing, onRow, onDelete, onStar }: WooriSendRowsProps) {
  const ref = useRef<HTMLDivElement>(null)
  useWooriScrollFix(ref)
  const y = (pageY: number) => pageY - LIST_TOP
  const height = Math.floor(297 + (rows.length - 1) * ROW_PITCH) + 64 - LIST_TOP
  return (
    <div ref={ref} className="woori-send__list woori-scroll-fix">
      <div className="woori-scroll-fix__content woori-send__list-content" style={{ height }}>
        {rows.map((r, i) => {
          const dy = i * ROW_PITCH
          const logo = bankLogoArt(r.logo)
          return (
            <div key={r.id} className="woori-send__row-wrap">
              <button
                type="button"
                className="woori-send__row"
                style={{ top: Math.floor(297 + dy) - LIST_TOP }}
                onClick={editing ? undefined : () => onRow?.(r)}
                aria-label={`${r.name} ${r.bankName} ${r.accountNumber}`}
              />
              {stage >= S.S5 && logo && <img className="woori-send__avatar" src={artSrc(logo)} alt="" style={fbox(20, y(305.333 + dy), 40, 40)} />}
              <div className="woori-send__row-line1" style={textAt(75.88, y(307 + dy))}>
                <span className="woori-send__name">{r.name}</span>
                <span className="woori-send__bar" />
                <span className="woori-send__date">{r.date}</span>
              </div>
              <div className="woori-send__acct" style={textAt(75.97, y(330 + dy))}>
                {r.bankName} {r.accountNumber}
              </div>
              {/* 편집: ☆ 자리 [삭제] 알약 296–340 × 28 (☆ 가운데 y 315.167 에 맞춤). 누름 자리는 ::before 로 넓힌다 */}
              {editing && (
                <button type="button" className="woori-send__del" style={fbox(296, y(301.167 + dy), 44, 28)} aria-label={`${r.name} 삭제`} onClick={() => onDelete?.(r)}>
                  삭제
                </button>
              )}
              {!editing && star && stage >= S.S5 && (
                <>
                  {r.favorite ? (
                    <svg className="woori-send__star-on" viewBox="0 0 24 24" style={fbox(316, y(303.167 + dy), 24, 24)} aria-hidden>
                      <path d={STAR_PATH} />
                    </svg>
                  ) : (
                    <img className="woori-send__icon woori-send__star" src={artSrc('send-a.star-outline')} alt="" style={fbox(316, y(303.167 + dy), 24, 24)} />
                  )}
                  {/* ☆ 누름 자리 48x48 (가운데 = ☆ 가운데). 행 단추 뒤에 그려 행 탭(이체 시작)보다 먼저 받는다 */}
                  <button
                    type="button"
                    className="woori-send__star-btn"
                    style={{ top: Math.floor(291.167 + dy) - LIST_TOP }}
                    aria-label={`${r.name} 자주 쓰는 계좌`}
                    aria-pressed={r.favorite}
                    onClick={() => onStar?.(r)}
                  />
                </>
              )}
            </div>
          )
        })}
      </div>
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

/** [삭제] 연타 막기 (ms) — 지운 줄 자리로 다음 줄이 올라온다 */
const DELETE_GAP_MS = 350

/** 행 탭 뒤 기다리는 금액 페이지 이동 (뒤로·내려감이면 취소) */
interface RowNav {
  timer: number
  cancelled: boolean
}

export default function WooriSend() {
  const shot = useShotState('send-where', WHERE_SHOTS)
  const go = useWooriNavigate()
  const navigate = useNavigate()
  const { top } = useWooriLayer()
  // 목록은 어느 탭 것인지와 함께 (탭을 바꾸면 새 목록이 올 때까지 스켈레톤 — 지난 탭 행을 새 탭 행으로 다루지 않게)
  const [list, setList] = useState<{ tab: RecipientTab; rows: Recipient[] } | null>(null)
  const [tab, setTab] = useState<RecipientTab>('recommend')
  const [reloadSeq, setReloadSeq] = useState(0)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const stage = useWooriStages(STAGES_V2, { shotStage: shot ? shot.state.stage : null })
  const rowNav = useRef<RowNav | null>(null)
  const recipients = list?.tab === tab ? list.rows : null

  useEffect(() => {
    const ac = new AbortController()
    wooriApi
      .getRecipients(tab, ac.signal)
      .then((rows) => setList({ tab, rows }))
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setList({ tab, rows: [] })
      })
    return () => ac.abort()
  }, [tab, reloadSeq])

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

  // 기다리던 행 이동 취소 (뒤로 · 페이지 내려감). 그 사이 다른 페이지가 위에 덮였으면(브라우저 앞으로 등) 떠나지 않는다
  const topRef = useRef(top)
  useEffect(() => {
    topRef.current = top
  })
  const cancelRow = useCallback(() => {
    const p = rowNav.current
    if (!p) return
    p.cancelled = true
    window.clearTimeout(p.timer)
    rowNav.current = null
    setBusy(false)
  }, [])
  useEffect(
    () => () => {
      const p = rowNav.current
      if (p) {
        p.cancelled = true
        window.clearTimeout(p.timer)
      }
    },
    [],
  )

  const onRow = useCallback(
    (r: Recipient) => {
      if (busy || editing || !list) return
      let url: string
      if (list.tab === 'mine') {
        // 내계좌 첫 줄 = 출금계좌 (금액 페이지는 첫 계좌에서 보낸다 — 같은 계좌로는 못 보낸다, 백엔드 SAME_ACCOUNT)
        if (r.id === list.rows[0]?.id) return wooriToast('출금계좌와 같은 계좌예요')
        url = amountUrl({ bankCode: r.bankCode, accountNumber: r.accountNumber })
      } else url = amountUrl({ recipientId: r.id })
      setBusy(true)
      const pending: RowNav = { timer: 0, cancelled: false }
      rowNav.current = pending
      const t0 = performance.now()
      wooriApi
        .lookup(r.bankCode, r.accountNumber)
        .then((lookup) => ({ lookup }))
        .catch(() => ({ lookup: undefined }))
        .then((state) => {
          if (pending.cancelled) return
          const wait = Math.max(0, ROW_TO_AMOUNT_MS - (performance.now() - t0))
          pending.timer = window.setTimeout(() => {
            rowNav.current = null
            if (topRef.current) go(url, { state })
            else setBusy(false)
          }, wait)
        })
    },
    [busy, editing, list, go],
  )

  const onBack = useCallback(() => {
    cancelRow()
    if (historyIndex() > 0) navigate(-1)
    else go('/home', { replace: true })
  }, [cancelRow, navigate, go])

  /* ── 편집 · ☆ (설계, 실제 앱만) ── */
  const live = !shot && wooriLiveApp()
  const exitEdit = useCallback(() => setEditing(false), [])
  const reload = useCallback(() => setReloadSeq((n) => n + 1), [])

  const onEdit = () => {
    if (!live || busy || !recipients?.length) return
    setEditing((v) => !v)
  }

  // 화면 먼저 지우고 저장 (404 = 이미 없음 → 지운 것). 자주 탭은 자주에서 빼기.
  // 아래 행이 한 프레임에 같은 자리로 올라오므로 [삭제] 연타(DELETE_GAP_MS 안)는 한 번만 받는다 — 두 줄이 지워지지 않게
  const lastDelete = useRef(-Infinity)
  const onDelete = (r: Recipient) => {
    if (!live || busy || !list) return
    const now = performance.now()
    if (now - lastDelete.current < DELETE_GAP_MS) return
    lastDelete.current = now
    const listTab = list.tab
    setList((p) => (p?.tab === listTab ? { tab: listTab, rows: p.rows.filter((x) => x.id !== r.id) } : p))
    if (list.rows.every((x) => x.id === r.id)) setEditing(false)
    const save = listTab === 'frequent' ? wooriApi.setRecipientFavorite(r.id, false) : wooriApi.deleteRecipient(r.id)
    save.catch((e: unknown) => {
      if (e instanceof WooriApiError && e.status === 404) return
      wooriToast('삭제하지 못했어요. 다시 시도해 주세요')
      reload()
    })
  }

  // 화면 먼저 바꾸고 저장 (값을 정해 보낸다 — 연타해도 마지막 누름 값). 자주 탭에서 끄면 목록에서 빠진다
  const onStar = (r: Recipient) => {
    if (!live || busy || !list) return
    const next = !r.favorite
    const listTab = list.tab
    setList((p) =>
      p?.tab === listTab
        ? { tab: listTab, rows: listTab === 'frequent' && !next ? p.rows.filter((x) => x.id !== r.id) : p.rows.map((x) => (x.id === r.id ? { ...x, favorite: next } : x)) }
        : p,
    )
    wooriApi.setRecipientFavorite(r.id, next).catch(() => {
      wooriToast('자주 쓰는 계좌를 바꾸지 못했어요')
      reload()
    })
  }

  const ready = recipients != null
  useShotReady(ready)

  const spinner = shot ? !!shot.state.spinner || (stage >= S.S0s && stage < S.S6) : busy || (stage >= S.S0s && stage < S.S6)
  return (
    <WooriSendWhereView
      stage={stage}
      recipients={recipients}
      tab={tab}
      onTab={(t) => {
        if (busy) return
        setEditing(false)
        setTab(t)
      }}
      onBack={editing ? exitEdit : onBack}
      onInput={() => {
        if (busy) return
        setEditing(false)
        go('/send/account', { transition: PUSH_ACCOUNT })
      }}
      onRow={onRow}
      editing={editing}
      onEdit={onEdit}
      onDelete={onDelete}
      onStar={onStar}
      spinner={spinner}
      veil={shot?.state.veil}
      rootRef={setRoot}
      spinnerHost={!shot && root ? root.closest('.woori-layer__page') : null}
    />
  )
}
