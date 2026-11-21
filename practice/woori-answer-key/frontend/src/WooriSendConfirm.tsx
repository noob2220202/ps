// WooriSendConfirm — /send/confirm 이체 확인 (spec/send-b.md 2.7–2.8 · 3.8–3.11 · send-b.json)
//   ?ticket=<tk-…> (금액 화면이 비밀번호 확인 뒤 넘긴다) · 개발/shot: ?bank=<spec 코드>&acct=<숫자>&amount=<원> 이면 검사(check)로 ticket 을 만든다
//   흰 페이지+스피너 → 머리 → [이체] 비활성 → 금액 화면과 같은 계좌 2줄 → 로고 헤더 모핑(easeInOutCubic 805ms, 로고 24→48dp)
//   + 로고 사이 → 반복(800ms) → [이체] 활성 + 안내 → [이체] = 버튼 안 흰 스피너 → POST /api/transfers → /send/done?tx=…
// 키가 다른 화면(APK): 안내 문구·[이체]는 아래끝 기준(atB — 프레임 모드는 영상 자리 그대로), 위 내용은 424dp 에서 끝나 640dp 셸에서도 겹치지 않는다.
// 처리 중(버튼 안 스피너)에는 ‹·취소·폰 뒤로를 받지 않는다 — 돈은 이미 나가는 중이라 떠나도 완료 화면이 뒤따라 왔다 (설계).
// [이체] 오류는 네이티브 alert 대신 안내 시트(WooriSendAlert). 다시 눌러도 안 되는 오류(4xx)면 [확인] 뒤 금액 화면으로.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { artSrc, bankArtName, hasArt, type WooriArtName } from './WooriArt.ts'
import { WooriButton } from './WooriButton.tsx'
import { WooriHeader } from './WooriHeader.tsx'
import { useWooriStages } from './WooriLoadingPage.tsx'
import { WooriOverlay } from './WooriSheet.tsx'
import { WooriSpinner } from './WooriSpinner.tsx'
import { useShotReady, useShotState } from './WooriShot.ts'
import { useWooriNavigate } from './WooriNav.ts'
import { wooriBottomTop } from './WooriLayout.ts'
import { wooriApi, WooriApiError, type Ticket } from './WooriApi.ts'
import { WooriSendAlert } from './WooriSendAmount.tsx'
import './WooriSendConfirm.css'

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
const NOOP = () => {}
function txt(x: number, y: number, size: number, weight: number, extra: CSSProperties = {}, dy = 0): CSSProperties {
  return { ...at(x, y, dy), fontSize: size, fontWeight: weight, ...extra }
}
function Icon({ name, x, y, w, h, color, inline, style }: { name: WooriArtName; x?: number; y?: number; w: number; h: number; color?: string; inline?: boolean; style?: CSSProperties }) {
  const pos = inline || x == null || y == null ? {} : at(x, y)
  const base: CSSProperties = { width: w, height: h, ...pos, ...style }
  if (color) {
    const url = `url(${artSrc(name)})`
    return <span className="woori-cf__icon woori-cf__mask" style={{ ...base, background: color, WebkitMaskImage: url, maskImage: url }} aria-hidden />
  }
  return <img className="woori-cf__icon" src={artSrc(name)} alt="" style={base} draggable={false} />
}

/** 백엔드 logo ('bank-nh') → 확인 머리 48dp 그림 (없으면 banks.* 를 키운다) */
function bigLogo(logo: string): WooriArtName | undefined {
  const code = logo.replace(/^bank-/, '')
  const big = `send-b.confirm-logo-${code}`
  return hasArt(big) ? big : bankArtName(code)
}
const apiBankCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** 단계 (v1, 흰 화면부터 ms, 3.8): 1 머리 · 2 [이체] 비활성 · 3 계좌 2줄 · 4 모핑 시작 · 5 스피너 끔 · 6 스피너 다시 · 7 [이체] 활성+안내 · 8 스피너 끔 */
const CONFIRM_STAGES_MS = [167, 251, 318, 399, 661, 962, 1146, 1679] as const
const STAGE_DONE = 8

interface ConfirmShot {
  stage: number
  pressed?: boolean
  processing?: boolean
}
const CONFIRM_SHOTS: Readonly<Record<string, ConfirmShot>> = {
  'confirm-blank': { stage: 0 },
  'confirm-render': { stage: 3 },
  'confirm-idle': { stage: STAGE_DONE },
  'confirm-transfer-pressed': { stage: STAGE_DONE, pressed: true },
  'confirm-processing': { stage: STAGE_DONE, processing: true },
}

async function loadTicket(params: URLSearchParams): Promise<Ticket> {
  const id = params.get('ticket')
  if (id) return wooriApi.getTicket(id)
  const accounts = await wooriApi.getAccounts()
  return wooriApi.checkTransfer({
    fromAccountId: accounts[0].id,
    bankCode: apiBankCode(params.get('bank') ?? ''),
    accountNumber: (params.get('acct') ?? '').replace(/\D/g, ''),
    amount: Number(params.get('amount') ?? 0),
  })
}

export default function WooriSendConfirm() {
  const [params] = useSearchParams()
  const go = useWooriNavigate()
  const shot = useShotState('send-confirm', CONFIRM_SHOTS)
  const s = shot?.state ?? null
  const paramKey = params.toString()

  const [tk, setTk] = useState<Ticket | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    loadTicket(new URLSearchParams(paramKey)).then(
      (t) => alive && setTk(t),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      alive = false
    }
  }, [paramKey])

  const stage = useWooriStages(CONFIRM_STAGES_MS, { start: tk != null, shotStage: s ? s.stage : null })
  const st = s ? s.stage : stage
  useShotReady(tk != null)

  const [processing, setProcessing] = useState(false)
  const [bigSpinner, setBigSpinner] = useState(false)
  const busy = s ? !!s.processing : processing
  // 오류 안내 시트 (window.alert 대신). leave = 닫은 뒤 금액 화면으로
  const [alert, setAlert] = useState<{ text: string; open: boolean; leave: boolean } | null>(null)

  // 처리 타이머는 페이지가 내려가면 지운다 (내려간 뒤 완료 화면으로 끌고 가지 않게)
  const mounted = useRef(true)
  const timers = useRef<number[]>([])
  useEffect(() => {
    mounted.current = true
    const list = timers.current
    return () => {
      mounted.current = false
      list.forEach((t) => window.clearTimeout(t))
    }
  }, [])
  const later = (ms: number, f: () => void) => {
    const id = window.setTimeout(f, ms)
    timers.current.push(id)
    return id
  }

  const onTransfer = () => {
    if (!tk || processing) return
    setProcessing(true)
    const t0 = performance.now()
    const big = later(500, () => setBigSpinner(true))
    wooriApi.executeTransfer(tk.ticket).then(
      (res) => {
        if (!mounted.current) return
        const wait = Math.max(0, 900 - (performance.now() - t0))
        later(wait, () => {
          window.clearTimeout(big)
          go(`/send/done?tx=${encodeURIComponent(res.done.transactionId)}`, { replace: true })
        })
      },
      (e: unknown) => {
        if (!mounted.current) return
        window.clearTimeout(big)
        setBigSpinner(false)
        setProcessing(false)
        // 4xx (이미 처리됨 · 한도 · 잔액 등)는 다시 눌러도 같다 → [확인] 뒤 금액 화면으로 돌아가 다시
        const leave = e instanceof WooriApiError && e.status >= 400 && e.status < 500
        setAlert({ text: e instanceof Error ? e.message : String(e), open: true, leave })
      },
    )
  }

  const onBack = useCallback(() => go(-1), [go])
  const onCancel = useCallback(() => go('/home', { replace: true }), [go])

  const spinner = s ? st < 5 || (st >= 6 && st < STAGE_DONE) : (st < 5 || (st >= 6 && st < STAGE_DONE) || bigSpinner)
  const morph = st >= 4
  const shotStill = s != null
  const rootClass = 'woori-cf' + (st === 3 ? ' woori-cf--pre' : morph && !shotStill ? ' woori-cf--morph' : '')
  const showLines = st >= 3 && !(shotStill && morph)
  const fromLogo = tk ? bigLogo(tk.from.logo) : undefined
  const toLogo = tk ? bigLogo(tk.to.logo) : undefined
  const amountText = tk?.display.amount ?? ''
  const askRest = tk ? tk.display.confirmAmount.slice(amountText.length) : ''
  const toRest = tk ? tk.display.confirmTo.slice(tk.holderName.length) : ''

  return (
    <div className={rootClass}>
      {/* 처리 중에는 ‹·취소·폰 뒤로를 받지 않는다 (모습은 그대로) */}
      {st >= 1 && <WooriHeader onBack={processing ? NOOP : onBack} rightText="취소" onRight={processing ? NOOP : onCancel} />}
      {error && (
        <p className="woori-cf__t" style={txt(20, 80, 15, 500)}>
          {error}
        </p>
      )}

      {tk && st >= 3 && (
        <>
          {fromLogo && <img className="woori-cf__logo woori-cf__logo--from" src={artSrc(fromLogo)} alt="" draggable={false} />}
          {toLogo && <img className="woori-cf__logo woori-cf__logo--to" src={artSrc(toLogo)} alt="" draggable={false} />}
        </>
      )}

      {tk && showLines && (
        <>
          <div className="woori-cf__line woori-cf__line--from-title">
            <div className="woori-cf__row" style={txt(49.94, 71, 17, 500, {}, 0.25)}>
              <span>
                <b style={{ fontWeight: 700 }}>{tk.from.bankName} 계좌</b>에서
              </span>
              <Icon name="history.chevron-down-small" w={16} h={16} inline color="#4a4b4e" style={{ marginLeft: 6.14, marginTop: 0.45 }} />
            </div>
          </div>
          <div className="woori-cf__line woori-cf__line--from-sub">
            <p className="woori-cf__t" style={txt(19.97, 102, 14, 500, { color: 'var(--woori-text-tertiary)' })}>
              {tk.from.product} {tk.from.number}
            </p>
          </div>
          <div className="woori-cf__line woori-cf__line--to-title">
            <div className="woori-cf__row" style={txt(49.98, 148, 17, 500)}>
              <span>
                <b style={{ fontWeight: 700 }}>{tk.to.bankName} 계좌</b>로
              </span>
              <Icon name="history.chevron-down-small" w={16} h={16} inline color="#4a4b4e" style={{ marginLeft: 6.5, marginTop: 0.5 }} />
            </div>
          </div>
          <div className="woori-cf__line woori-cf__line--to-sub">
            <p className="woori-cf__t" style={txt(19.98, 178, 14, 500, { color: 'var(--woori-text-tertiary)' })}>
              {tk.to.bankName} {tk.to.accountNumber}
            </p>
          </div>
        </>
      )}

      {tk && morph && (
        <>
          <span className={'woori-cf__arrow woori-cf__mask ' + (shotStill ? 'woori-cf__arrow--still' : 'woori-cf__arrow--loop')} style={{ background: '#8a8a8b', WebkitMaskImage: `url(${artSrc('send-b.confirm-arrow')})`, maskImage: `url(${artSrc('send-b.confirm-arrow')})` }} aria-hidden />
          <div className="woori-cf__body">
            <p className="woori-cf__t" style={txt(19.95, 168, 22, 700)}>
              <span className="woori-cf__blue">{tk.holderName}</span>
              {toRest}
            </p>
            <p className="woori-cf__t" style={txt(19.94, 198, 22, 700, {}, 0.25)}>
              <span className="woori-cf__blue">{amountText}</span>
              {askRest}
            </p>
            <p className="woori-cf__t" style={txt(20.05, 240, 14, 500, { color: 'var(--woori-text-tertiary)' })}>
              {tk.display.confirmSub}
            </p>
            <div className="woori-cf__box" style={{ top: 289, translate: '0 0.333px' }} />
            <p className="woori-cf__t" style={txt(39.95, 315, 15, 500, { color: '#6c6e72' }, 0.25)}>
              수수료
            </p>
            <p className="woori-cf__val" style={{ ...at(0, 315, 0.25), left: undefined, letterSpacing: '-0.035em' }}>
              {tk.display.fee}
            </p>
            <p className="woori-cf__t" style={txt(39.86, 349, 15, 500, { color: '#6c6e72' })}>
              받는 분 통장표기
            </p>
            <p className="woori-cf__val" style={{ ...at(0, 350), left: undefined, letterSpacing: '-0.0325em' }}>
              {tk.recipientLabel}
            </p>
            <p className="woori-cf__t" style={txt(39.97, 384, 15, 500, { color: '#6c6e72' })}>
              내 통장표기
            </p>
            <p className="woori-cf__val" style={{ ...at(0, 384), left: undefined, letterSpacing: '-0.0325em' }}>
              {tk.myLabel}
            </p>
          </div>
        </>
      )}

      {/* 안내 · [이체]: 아래끝 기준 */}
      {tk && st >= 7 && (
        <p className="woori-cf__center" style={{ ...atB(0, 694), fontSize: 14, fontWeight: 500, color: 'var(--woori-blue-text)' }}>
          {tk.display.footnote}
        </p>
      )}

      {st >= 2 && (
        <WooriButton
          className="woori-cf__transfer"
          style={{ ...atB(16, 726.667), ...(s?.pressed ? ({ '--woori-btn-press-scale': 1 } as CSSProperties) : {}) }}
          disabled={st < 7 || busy || !tk}
          data-pressed={s?.pressed ? '' : undefined}
          onClick={onTransfer}
        >
          {busy && (
            <span className="woori-cf__btn-spin">
              <div>
                <WooriSpinner at={{ x: 24, y: 24 }} label="이체 중" />
              </div>
            </span>
          )}
          <span>이체</span>
        </WooriButton>
      )}

      {spinner && (
        <WooriOverlay>
          <div className="woori-cf__spinner-top">
            <WooriSpinner />
          </div>
        </WooriOverlay>
      )}

      {/* [이체] 오류 안내 (설계) */}
      {alert && (
        <WooriSendAlert
          text={alert.text}
          open={alert.open}
          onClose={() => setAlert((a) => (a ? { ...a, open: false } : a))}
          onClosed={() => {
            setAlert(null)
            if (alert.leave) go(-1)
          }}
        />
      )}
    </div>
  )
}
