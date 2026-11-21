// WooriSendBank — /send/account/bank 금융회사를 선택해 주세요 (spec/send-a.md 2.5 · 3.4, 상태 bank-*; 순서·이름·로고는 API = spec/banks.json)
//
//   ✕ / 제목 22/700 / [은행|증권사] 세그먼트(2칸, 알약 158dp) / 3열 21개 타일 (#f6f7fa r12, 101.333×82, 줄 간격 90.167) — 로고 32dp + 이름 13/500
//   push(바텀시트 아님): 계좌번호 페이지의 '은행/증권사 선택' 탭 → 이 페이지가 easeOutCubic 322ms 로 들어옴 (아래 페이지 베일 한 프레임에 0.8).
//   들어오는 동안 제목 + 회색 탭만 → +344ms ✕·선택 알약 → +419ms 그리드(타일·이름·로고 6개) → 로고 단계 +58/+75/+108/+133/+179ms (페이드 없음).
//   타일 탭 → 눌림 없이 한 프레임에 계좌번호 페이지로 (go(-1) instant, 고른 은행은 WooriSendFlow 로 넘긴다). 증권사 탭은 영상에 없음 → 빈 목록(설계).
//   그리드는 탭 아래 자기 스크롤 상자 (실제 앱만, 설계 — 영상은 스크롤하지 않았고 7번째 줄이 셸 아래끝 800.667 에서 잘린다). 키 작은 폰에서도
//   마지막 줄까지 밀어 올려 고를 수 있게. ✕·제목·탭은 그 자리에 남는다. 프레임 모드는 영상처럼 스크롤 없이 페이지에 바로 그린다 (WooriSendBank.css).
import { useCallback, useEffect, useState } from 'react'
import './WooriSendBank.css'
import { wooriApi, type BankChip } from './WooriApi.ts'
import { artSrc } from './WooriArt.ts'
import { useWooriStages } from './WooriLoadingPage.tsx'
import { stepsBackTo, useWooriLayer, useWooriNavigate } from './WooriNav.ts'
import { useWooriBack } from './WooriEnv.ts'
import { WooriSendAccountView, type SendBank } from './WooriSendAccount.tsx'
import { bankLogoArt, fbox, SEND_SHOT_DIGITS, setPickedBank, textAt } from './WooriSendFlow.ts'
import { useShotReady, useShotState } from './WooriShot.ts'

/** 단계 (push 곡선 시작 기준 ms): 1 ✕·알약 · 2 그리드 + 로고 단계 0 · 3–7 로고 단계 1–5 (transitions[bank-logo-stages]) */
const STAGES = [344, 419, 477, 494, 527, 552, 598] as const

/** 로고 단계 (그리드 첫 프레임 기준 +0/+58/+75/+108/+133/+179ms) — API 금융회사 코드 */
const LOGO_STAGE: Readonly<Record<string, number>> = {
  WOORI: 0, NH: 0, KB: 0, KAKAO: 0, IM: 0, SH: 0,
  SHINHAN: 1, HANA: 1, IBK: 1,
  MG: 2, KBANK: 2, BUSAN: 2, SC: 2,
  TOSS: 3, KN: 3, KJ: 3, DEUTSCHE: 3,
  SANLIM: 4, KDB: 4,
  SHC: 5, CU: 5,
}

const COLS = [20, 129.333, 238.667] as const
const TILE_W = 101.333
const TILE_H = 82
const ROW0 = 191.167
const ROW_PITCH = 90.167
/** 이름 글자 상자 top (줄마다, keep.bankGridDp.nameTop) */
const NAME_TOP = [245, 335, 426, 516, 606, 696, 786] as const
/** 그리드 스크롤 상자 위끝 = 탭 바탕 아래끝 167 + 8 (타일 사이 틈만큼, 설계). 안쪽 좌표 = 페이지 dp − GRID_TOP (정수라 소수 자리는 그대로) */
const GRID_TOP = 175
/** 마지막 줄 아래 여백 (설계 — 좌우 여백 20 과 같게) */
const GRID_PAD = 20

interface BankShot {
  stage: number
  push?: boolean
}

const BANK_SHOTS: Readonly<Record<string, BankShot>> = {
  'bank-open': { stage: 0, push: true },
  'bank-render': { stage: 2 },
  'bank-idle': { stage: 7 },
}

type Tab = 'bank' | 'securities'

interface BankViewProps {
  stage: number
  banks: SendBank[] | null
  tab: Tab
  onTab?: (t: Tab) => void
  onClose?: () => void
  onPick?: (b: SendBank) => void
}

function BankView({ stage, banks, tab, onTab, onClose, onPick }: BankViewProps) {
  const sel = tab === 'bank' ? 0 : 1
  return (
    <div className="woori-send-bank">
      {stage >= 1 && (
        <button type="button" className="woori-send-bank__close" aria-label="닫기" style={fbox(320, 11.333, 24, 24)} onClick={onClose}>
          <img src={artSrc('send-a.close')} alt="" width={24} height={24} />
        </button>
      )}
      <h1 className="woori-send-bank__title" style={textAt(20.02, 72)}>
        금융회사를 선택해 주세요
      </h1>
      <div className="woori-send-bank__tabs" role="tablist">
        {stage >= 1 && <div className="woori-send-bank__pill" style={fbox(22 + sel * 158, 125, 158, 40)} />}
        <span className={`woori-send-bank__tab-text${sel === 0 ? ' woori-send-bank__tab-text--on' : ''}`} style={{ ...textAt(88.91, 137.25), letterSpacing: '-0.01em' }} aria-hidden>
          은행
        </span>
        <span className={`woori-send-bank__tab-text${sel === 1 ? ' woori-send-bank__tab-text--on' : ''}`} style={{ ...textAt(240.64, 137.25), letterSpacing: '0.005em' }} aria-hidden>
          증권사
        </span>
        <button type="button" role="tab" aria-selected={sel === 0} aria-label="은행" className="woori-send-bank__tab" style={{ left: 22, top: 125, width: 158, height: 40 }} onClick={() => onTab?.('bank')} />
        <button type="button" role="tab" aria-selected={sel === 1} aria-label="증권사" className="woori-send-bank__tab" style={{ left: 180, top: 125, width: 158, height: 40 }} onClick={() => onTab?.('securities')} />
      </div>
      {stage >= 2 && tab === 'bank' && banks?.length ? <BankGrid stage={stage} banks={banks} onPick={onPick} /> : null}
    </div>
  )
}

/** 3열 타일 — 탭 아래 스크롤 상자 (위끝 GRID_TOP, 아래끝 페이지 아래끝. 안쪽 높이 = 마지막 줄 아래끝 + GRID_PAD) */
function BankGrid({ stage, banks, onPick }: { stage: number; banks: SendBank[]; onPick?: (b: SendBank) => void }) {
  const rows = Math.ceil(banks.length / 3)
  const height = Math.ceil(ROW0 + (rows - 1) * ROW_PITCH + TILE_H + GRID_PAD) - GRID_TOP
  return (
    <div className="woori-send-bank__grid">
      <div className="woori-send-bank__grid-content" style={{ height }}>
        {banks.map((b, i) => {
          const col = i % 3
          const row = Math.floor(i / 3)
          const x = COLS[col]
          const y = ROW0 + row * ROW_PITCH
          const logo = bankLogoArt(b.logo)
          const showLogo = logo && stage >= 2 + (LOGO_STAGE[b.code] ?? 0)
          return (
            <div key={b.code} className="woori-send-bank__cell">
              <button type="button" className="woori-send-bank__tile" style={fbox(x, y - GRID_TOP, TILE_W, TILE_H)} onClick={() => onPick?.(b)} aria-label={b.name} />
              {showLogo && <img className="woori-send-bank__logo" src={artSrc(logo)} alt="" style={fbox(x + 34.667, y + 11.667 - GRID_TOP, 32, 32)} />}
              <span className="woori-send-bank__name" style={textAt(x + TILE_W / 2, (NAME_TOP[row] ?? y + 54) - GRID_TOP)}>
                {b.name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function WooriSendBank() {
  const shot = useShotState('send-bank', BANK_SHOTS)
  const s = shot?.state ?? null
  const go = useWooriNavigate()
  const [banks, setBanks] = useState<SendBank[] | null>(null)
  const [tab, setTab] = useState<Tab>('bank')
  const stage = useWooriStages(STAGES, { shotStage: s ? s.stage : null })

  useEffect(() => {
    const ac = new AbortController()
    wooriApi
      .getBanks(tab, ac.signal)
      .then((b) => setBanks(b.map(({ code, name, short, logo }) => ({ code, name, short, logo }))))
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setBanks([])
      })
    return () => ac.abort()
  }, [tab])

  // push shot 의 아래 페이지(계좌번호 13자리 + 칩)
  const [underChips, setUnderChips] = useState<BankChip[] | null>(null)
  useEffect(() => {
    if (!s?.push) return
    const ac = new AbortController()
    wooriApi.suggestBanks(SEND_SHOT_DIGITS.length, ac.signal).then(setUnderChips).catch(() => setUnderChips([]))
    return () => ac.abort()
  }, [s?.push])

  const onPick = useCallback(
    (b: SendBank) => {
      setPickedBank(b)
      if (stepsBackTo('/send/account') === 1) go(-1, { transition: 'instant' })
      else go('/send/account', { replace: true })
    },
    [go],
  )
  const onClose = useCallback(() => {
    if (stepsBackTo('/send/account') === 1) go(-1, { transition: { kind: 'pop' } })
    else go('/send/account', { replace: true })
  }, [go])

  useShotReady(banks != null && (!s?.push || underChips != null))
  // 폰 뒤로 버튼 = ✕
  const { top } = useWooriLayer()
  useWooriBack(top && !s ? onClose : null)

  const view = <BankView stage={stage} banks={banks} tab={tab} onTab={setTab} onClose={onClose} onPick={onPick} />
  if (!s?.push) return view
  return (
    <div className="woori-send-bank__push">
      <WooriSendAccountView value={SEND_SHOT_DIGITS} chips={underChips ?? []} />
      <div className="woori-send-bank__push-veil" aria-hidden />
      <div className="woori-send-bank__push-page">{view}</div>
    </div>
  )
}
