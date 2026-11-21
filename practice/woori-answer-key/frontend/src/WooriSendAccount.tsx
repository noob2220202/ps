// WooriSendAccount — /send/account 계좌번호를 입력해 주세요 (spec/send-a.md 2.3 · 2.4 · 3.2–3.4 · 9절, 상태 account-*)
//
//   ✕ / 제목 22/700 / 입력칸(값·안내 22/600, 커서, ⓧ, 밑줄 + 포커스 밑줄) / 은행/증권사 선택(⌄, 밑줄 + 포커스 밑줄) / 추천 은행 칩 / [확인]
//   흐름 (v2 63.742–74.214, 들어온 순간 = push 곡선 시작 기준):
//     +360ms 입력칸 자동 포커스: 진한 밑줄이 가운데에서 양쪽으로 easeInOutCubic 404ms · +900ms 삼성 키보드 올라옴(프레임 모드, WooriKeyboard)
//     숫자 → 값 끝에 추가(16자리까지, 영상은 13자리) · ⓧ · 자리수별 추천 칩 (wooriApi.suggestBanks — 영상 순서표 재생, D7)
//     은행/증권사 선택 탭 → 포커스 한 프레임에 풀림 → 키보드 내려감 → +134ms 금융회사 페이지 push (베일 한 프레임에 0.8)
//     은행 고름(금융회사 페이지가 go(-1) instant) → 은행 칸 채움 + [확인] + 281ms 뒤 은행 칸 밑줄 펴짐
//     [확인] 눌림 #185ba4 167ms → +118ms 스피너·은행 칸 밑줄 꺼짐 → 계좌 조회(wooriApi.lookup) → 누름 +1013ms 이 페이지가 한 프레임에 사라지고
//     '어디로 이체' 가 베일 0.8 아래 드러남(reveal, 216ms 뒤 linear 311ms 로 걷힘) → 그 페이지가 509ms 뒤 금액 페이지(/send/amount?bank=<spec 코드 kakao·nh-local>&acct=<숫자>)로.
//   키보드: 프레임 모드에서만 앱이 그린다 (입력칸 inputMode="none"). 실제 폰은 inputMode="numeric" 시스템 키보드 —
//     보이지 않는 입력칸의 캐럿은 늘 값 끝 (그린 커서 자리. 탭·화살표로 옮겨진 캐럿에 숫자가 끼어들지 않게, 설계).
//   설계(영상에 없음): 조회 중 ✕·폰 뒤로 = 조회를 끊고 닫는다 (끊긴 조회는 금액 페이지로 가지 않는다) · 번호를 고치면 조회 오류 글자를 지운다.
// 입력값은 사람이 친 숫자다 — 이 파일에는 계좌번호를 쓰지 않는다 (shot 의 입력값은 자리수만 맞춘 채움 숫자, 비교에서는 개인정보 마스크).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import './WooriSendAccount.css'
import { wooriApi, WooriApiError, type BankChip, type Recipient } from './WooriApi.ts'
import { artSrc } from './WooriArt.ts'
import { WooriButton } from './WooriButton.tsx'
import WooriKeyboard, { type WooriKeyName } from './WooriKeyboard.tsx'
import { WOORI_BOTTOM_FIX } from './WooriLayout.ts'
import { historyIndex, isFrameMode, stepsBackTo, useWooriLayer, useWooriNavigate } from './WooriNav.ts'
import { WooriSendWhereView } from './WooriSend.tsx'
import { amountUrl, bankLogoArt, chipToBank, fbox, SEND_A_MOTION, SEND_SHOT_DIGITS, setSendNext, takePickedBank, textAt } from './WooriSendFlow.ts'
import { useShotReady, useShotState } from './WooriShot.ts'
import { WooriSpinner } from './WooriSpinner.tsx'
import { useWooriBack } from './WooriEnv.ts'

export interface SendBank {
  code: string
  name: string
  short: string
  logo: string | null
}

/** 입력 자리수 상한 (설계 — 영상은 13자리에서 멈춤). 실제 계좌번호는 14자리(국민·지역농축협 등)·16자리도 있어 backend 조회(6–16자리)와 같게 */
const MAX_DIGITS = 16

/** 흐름 시각 (ms, push 곡선 시작 기준 — 3.2·3.3·9.7) */
const T_FOCUS = 360
const T_KEYBOARD = 900
/** 은행/증권사 선택 탭 → 금융회사 push 시작 (71.412 → 71.546) */
const T_BANK_PUSH = 134
/** 은행 고른 뒤 은행 칸 밑줄 (72.467 → 72.7475) */
const T_BANK_LINE = 281
/** [확인]: 눌림 색 167ms, 스피너 +118ms, 페이지 닫힘 +1013ms */
const T_PRESS = 167
const T_SPINNER = 118
const T_CLOSE = 1013

/** 칩 폭 (dp, 글자에 맞춘 잰 값 2.4) — 없는 은행은 글자 수로 */
const CHIP_W: Readonly<Record<string, number>> = { WOORI: 65.833, KAKAO: 104.667, NH: 65.667, KB: 65.667, SH: 65.667, CITI: 91.7 }
const CHIP_LS: Readonly<Record<string, string>> = { KAKAO: '-0.005em', NH: '0.005em' }
const chipWidth = (c: BankChip) => CHIP_W[c.code] ?? 39.5 + c.name.length * 13.2

interface AccountShot {
  digits: number
  caret?: boolean
  focusLine?: boolean
  keyboard?: 'up' | 'open' | false
  bank?: boolean
  bankFocus?: boolean
  pressed?: boolean
  spinner?: boolean
  /** push 중 모습 (아래 '어디로 이체' + 베일, shots.d t=110) */
  push?: boolean
}

const ACCOUNT_SHOTS: Readonly<Record<string, AccountShot>> = {
  'account-push': { digits: 0, push: true },
  'account-empty': { digits: 0, caret: true },
  'account-focus': { digits: 0, caret: true, focusLine: true },
  'account-focused': { digits: 0, caret: true, focusLine: true },
  'account-keyboard-up': { digits: 0, caret: true, focusLine: true, keyboard: 'up' },
  'account-keyboard': { digits: 0, caret: true, focusLine: true, keyboard: 'open' },
  'account-typing': { digits: 6, caret: true, focusLine: true, keyboard: 'open' },
  'account-typed': { digits: 13, focusLine: true, keyboard: 'open' },
  'account-bank-selected': { digits: 13, bank: true },
  'account-ready': { digits: 13, bank: true, bankFocus: true },
  'account-confirm-pressed': { digits: 13, bank: true, bankFocus: true, pressed: true },
  'account-confirm-spinner': { digits: 13, bank: true, spinner: true },
}

/** shot 의 고른 은행 (v2: 카카오뱅크) */
const SHOT_BANK_CODE = 'KAKAO'

export interface WooriSendAccountViewProps {
  value: string
  caret?: boolean
  clear?: boolean
  focusLine?: boolean
  bank?: SendBank | null
  bankFocus?: boolean
  chips?: BankChip[]
  confirm?: boolean
  pressed?: boolean
  spinner?: boolean
  error?: string | null
  onClose?: () => void
  onClear?: () => void
  onInputTap?: () => void
  onBankTap?: () => void
  onChip?: (c: BankChip) => void
  onConfirm?: () => void
  onConfirmDown?: () => void
  /** 입력칸(보이지 않는 input) — 화면이 넣는다 */
  input?: ReactNode
  /** 키보드 등 위에 겹칠 것 */
  children?: ReactNode
}

/** 계좌번호 페이지 모습 (금융회사 push shot 의 아래 페이지로도 쓴다) */
export function WooriSendAccountView({
  value,
  caret,
  clear,
  focusLine,
  bank,
  bankFocus,
  chips = [],
  confirm,
  pressed,
  spinner,
  error,
  onClose,
  onClear,
  onInputTap,
  onBankTap,
  onChip,
  onConfirm,
  onConfirmDown,
  input,
  children,
}: WooriSendAccountViewProps) {
  const bankLogo = bank ? bankLogoArt(bank.logo) : undefined
  const chipBoxes = chips.map((c, i) => ({
    c,
    x: chips.slice(0, i).reduce((x, p) => x + chipWidth(p) + 8, 20.333),
    w: chipWidth(c),
    first: i === 0,
  }))
  return (
    <div className="woori-send-account">
      <button type="button" className="woori-send-account__close" aria-label="닫기" style={fbox(320, 11.333, 24, 24)} onClick={onClose}>
        <img src={artSrc('send-a.close')} alt="" width={24} height={24} />
      </button>
      <h1 className="woori-send-account__title" style={textAt(19.94, 72)}>
        계좌번호를 입력해 주세요
      </h1>

      <div className="woori-send-account__field" onClick={onInputTap}>
        {value ? (
          <div className="woori-send-account__value" style={textAt(19.97, 137)}>
            <span>{value}</span>
            {caret && <span className="woori-send-account__caret woori-send-account__caret--inline" />}
          </div>
        ) : (
          <>
            <span className="woori-send-account__placeholder" style={textAt(19.94, 137)}>
              입력
            </span>
            {caret && <span className="woori-send-account__caret" style={fbox(20, 135, 1, 26.333)} />}
          </>
        )}
        {input}
      </div>
      {clear && (
        <button type="button" className="woori-send-account__clear" aria-label="지우기" style={fbox(320, 138.5, 20, 20)} onClick={onClear} onMouseDown={(e) => e.preventDefault()}>
          <img src={artSrc('send-a.clear-circle')} alt="" width={20} height={20} />
        </button>
      )}
      <div className="woori-send-account__line" style={fbox(20, 171.667, 320, 2)} />
      {focusLine && <div className="woori-send-account__line woori-send-account__line--focus" style={fbox(20, 171.667, 320, 2)} />}

      <button type="button" className="woori-send-account__bank" onClick={onBankTap} onMouseDown={(e) => e.preventDefault()}>
        {bank ? (
          <>
            {bankLogo && <img className="woori-send-account__bank-logo" src={artSrc(bankLogo)} alt="" style={fbox(20, 201, 28, 28)} />}
            <span className="woori-send-account__bank-name" style={textAt(55.8, 203.25)}>
              {bank.name}
            </span>
          </>
        ) : (
          <span className="woori-send-account__placeholder" style={textAt(19.97, 203.25)}>
            은행/증권사 선택
          </span>
        )}
        <img className="woori-send-account__chevron" src={artSrc('send-a.chevron-down')} alt="" style={fbox(320, 204.833, 20, 20)} />
      </button>
      <div className="woori-send-account__line woori-send-account__line--bank" style={fbox(20, 238.333, 320, 2)} />
      {bankFocus && <div className="woori-send-account__line woori-send-account__line--focus" style={fbox(20, 238.333, 320, 2)} />}

      {chipBoxes.map(({ c, x, w, first }) => {
        const logo = bankLogoArt(c.logo)
        return (
          <div key={c.code} className="woori-send-account__chip-wrap">
            <button
              type="button"
              className="woori-send-account__chip"
              style={fbox(x, 256.5, w, 40)}
              onClick={() => onChip?.(c)}
              onMouseDown={(e) => e.preventDefault()}
              aria-label={c.name}
            />
            {logo && <img className="woori-send-account__chip-logo" src={artSrc(logo)} alt="" style={fbox(x + (first ? 9.667 : 10), 268.5, 16, 16)} />}
            <span className="woori-send-account__chip-text" style={{ ...textAt(x + (first ? 29.607 : 29.9), 269.25), letterSpacing: CHIP_LS[c.code] ?? 0 }}>
              {c.name}
            </span>
          </div>
        )
      })}

      {error && (
        <p className="woori-send-account__error" style={textAt(20, 306)}>
          {error}
        </p>
      )}

      {confirm && (
        <WooriButton
          className={`woori-send-account__confirm${pressed ? ' woori-send-account__confirm--pressed' : ''}`}
          style={WOORI_BOTTOM_FIX}
          onPointerDown={onConfirmDown}
          onClick={onConfirm}
        >
          <span className="woori-send-account__confirm-text" style={textAt(149.19, 19.333)}>
            확인
          </span>
        </WooriButton>
      )}
      {children}
      {spinner && <WooriSpinner />}
    </div>
  )
}

/**
 * 보이지 않는 입력칸의 캐럿을 값 끝으로 (시스템 키보드·데스크톱 타이핑). 그린 커서는 늘 끝에 있는데, 탭·화살표로 캐럿이 숫자 사이에 가면
 * 다음 숫자가 보이지 않는 자리에 끼어든다. 끌어서 고른 범위(복사·붙여넣기)는 그대로 둔다
 */
function caretToEnd(el: HTMLInputElement) {
  const n = el.value.length
  if (el.selectionStart === el.selectionEnd && el.selectionStart !== n) el.setSelectionRange(n, n)
}

/** 금융회사 페이지 push (베일은 한 프레임에 0.8) */
const PUSH_BANK = {
  kind: 'push',
  duration: SEND_A_MOTION.push.duration,
  easing: SEND_A_MOTION.push.easing,
  veil: SEND_A_MOTION.bankVeil,
} as const

/** [확인] 뒤: 한 프레임에 사라지고 아래 페이지 베일 0.8 → 216ms 뒤 linear 311ms */
const REVEAL = { kind: 'reveal', veil: SEND_A_MOTION.revealVeil } as const

function useBanks(on: boolean) {
  const [banks, setBanks] = useState<SendBank[] | null>(null)
  useEffect(() => {
    if (!on) return
    const ac = new AbortController()
    wooriApi
      .getBanks('bank', ac.signal)
      .then((b) => setBanks(b.map(({ code, name, short, logo }) => ({ code, name, short, logo }))))
      .catch(() => setBanks([]))
    return () => ac.abort()
  }, [on])
  return banks
}

export default function WooriSendAccount() {
  const shot = useShotState('send-account', ACCOUNT_SHOTS)
  const s = shot?.state ?? null
  const go = useWooriNavigate()
  const { top } = useWooriLayer()
  const frame = isFrameMode()
  const inputRef = useRef<HTMLInputElement>(null)

  const [value, setValue] = useState(() => (s ? SEND_SHOT_DIGITS.slice(0, s.digits) : ''))
  const [active, setActive] = useState(true) // 입력칸 활성 (커서·ⓧ)
  const [focusLine, setFocusLine] = useState(false)
  const [kbOpen, setKbOpen] = useState(false)
  const [bank, setBank] = useState<SendBank | null>(null)
  const [bankFocus, setBankFocus] = useState(false)
  const [chips, setChips] = useState<BankChip[] | null>(s ? null : [])
  const [pressed, setPressed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // [확인] 누름부터 금액 페이지로 갈 때까지의 조회 (그 사이 타이머들). ✕·폰 뒤로·페이지 내림이 끊는다
  const lookingUp = useRef<{ timers: number[] } | null>(null)

  // shot: 고른 은행(카카오뱅크)·push 아래 페이지 데이터
  const banks = useBanks(!!s?.bank)
  const [under, setUnder] = useState<Recipient[] | null>(null)
  useEffect(() => {
    if (!s?.push) return
    const ac = new AbortController()
    wooriApi.getRecipients('recommend', ac.signal).then(setUnder).catch(() => setUnder([]))
    return () => ac.abort()
  }, [s?.push])

  // 추천 칩: 자리수 → 영상 순서표 (API)
  const digits = value.length
  useEffect(() => {
    const ac = new AbortController()
    wooriApi
      .suggestBanks(digits, ac.signal)
      .then(setChips)
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setChips([])
      })
    return () => ac.abort()
  }, [digits])

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // 들어온 뒤 자동 포커스(+360ms) · 키보드(+900ms)
  useEffect(() => {
    if (shot) return
    const t1 = window.setTimeout(() => {
      setFocusLine(true)
      focusInput()
    }, T_FOCUS)
    const t2 = window.setTimeout(() => setKbOpen(true), T_KEYBOARD)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [shot, focusInput])

  // 금융회사 페이지에서 돌아옴: 은행 채움 → 281ms 뒤 은행 칸 밑줄
  useEffect(() => {
    if (!top || shot) return
    const picked = takePickedBank()
    if (!picked) return
    const t0 = window.setTimeout(() => {
      setBank(picked)
      setError(null)
    }, 0)
    const t1 = window.setTimeout(() => setBankFocus(true), T_BANK_LINE)
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
    }
  }, [top, shot])

  const blur = useCallback(() => {
    setActive(false)
    setFocusLine(false)
    setKbOpen(false)
    inputRef.current?.blur()
  }, [])

  const activate = useCallback(() => {
    if (lookingUp.current) return
    setActive(true)
    setFocusLine(true)
    setBankFocus(false)
    setKbOpen(true)
    focusInput()
  }, [focusInput])

  // 번호를 고치면(숫자·⌫·ⓧ·시스템 키보드) 지난 조회 오류는 지운다 — 오류는 그때 번호에 대한 것이다
  const edit = useCallback((next: (v: string) => string) => {
    setValue(next)
    setError(null)
  }, [])

  const onKey = useCallback(
    (k: WooriKeyName) => {
      if (k.length === 1) edit((v) => (v.length >= MAX_DIGITS ? v : v + k))
      else if (k === 'backspace') edit((v) => v.slice(0, -1))
      else if (k === 'go') blur()
    },
    [edit, blur],
  )

  const openBanks = useCallback(() => {
    if (lookingUp.current) return
    blur()
    setBankFocus(false)
    window.setTimeout(() => go('/send/account/bank', { transition: PUSH_BANK }), T_BANK_PUSH)
  }, [blur, go])

  const pickChip = useCallback(
    (c: BankChip) => {
      if (lookingUp.current) return
      blur()
      setBank(chipToBank(c))
      setError(null)
      window.setTimeout(() => setBankFocus(true), T_BANK_LINE)
    },
    [blur],
  )

  /** 진행 중인 조회를 끊는다: 남은 타이머(눌림·스피너·금액 페이지로 가기)를 지우고 [확인] 을 처음 모습으로 */
  const cancelLookup = useCallback(() => {
    const p = lookingUp.current
    if (!p) return
    lookingUp.current = null
    for (const t of p.timers) window.clearTimeout(t)
    setPressed(false)
    setBusy(false)
  }, [])
  // 페이지가 내려가면(✕ 의 pop 이 끝남 등) 끊긴 조회가 나중에 금액 페이지로 가지 않게
  useEffect(() => cancelLookup, [cancelLookup])

  const onClose = useCallback(() => {
    cancelLookup()
    if (stepsBackTo('/send') === 1) go(-1, { transition: { kind: 'pop' } })
    else if (historyIndex() > 0) go(-1)
    else go('/send', { replace: true })
  }, [cancelLookup, go])

  // 폰 뒤로 버튼 = ✕ (조회 중에도 — 조회를 끊고 닫는다. 시스템 키보드가 떠 있으면 Android 가 먼저 키보드를 내린다)
  useWooriBack(top && !s ? onClose : null)

  const onConfirm = useCallback(() => {
    if (lookingUp.current || !bank) return
    const p: { timers: number[] } = { timers: [] }
    lookingUp.current = p
    // 이 조회가 끊기지 않았을 때만 돈다
    const later = (run: () => void, ms: number) => {
      p.timers.push(window.setTimeout(() => lookingUp.current === p && run(), ms))
    }
    const t0 = performance.now()
    setPressed(true)
    later(() => setPressed(false), T_PRESS)
    later(() => {
      setBusy(true)
      setBankFocus(false)
    }, T_SPINNER)
    wooriApi
      .lookup(bank.code, value)
      .then((lookup) => {
        later(() => {
          const url = amountUrl({ bankCode: lookup.bankCode, accountNumber: lookup.accountNumber })
          if (stepsBackTo('/send') === 1) {
            setSendNext(url, { lookup })
            go(-1, { transition: REVEAL })
          } else go(url, { replace: true, state: { lookup } })
        }, Math.max(0, T_CLOSE - (performance.now() - t0)))
      })
      .catch((e: unknown) => {
        later(() => {
          lookingUp.current = null
          setBusy(false)
          setError(e instanceof WooriApiError && e.status === 404 ? '계좌번호를 다시 확인해 주세요' : '잠시 후 다시 시도해 주세요')
        }, Math.max(0, T_SPINNER + 50 - (performance.now() - t0)))
      })
  }, [bank, value, go])

  const shotBank = s?.bank ? (banks?.find((b) => b.code === SHOT_BANK_CODE) ?? null) : null
  const ready = chips != null && (!s?.bank || banks != null) && (!s?.push || under != null)
  useShotReady(ready)

  if (s) {
    const view = (
      <WooriSendAccountView
        value={value}
        caret={!!s.caret}
        clear={!!s.focusLine && s.digits > 0}
        focusLine={!!s.focusLine}
        bank={shotBank}
        bankFocus={!!s.bankFocus || !!s.pressed}
        chips={chips ?? []}
        confirm={!!s.bank}
        pressed={!!s.pressed}
        spinner={!!s.spinner}
      >
        {s.keyboard && <WooriKeyboard open appear={false} offsetDp={s.keyboard === 'up' ? 80 : null} />}
      </WooriSendAccountView>
    )
    if (!s.push) return view
    return (
      <div className="woori-send-account__push">
        <WooriSendWhereView stage={7} recipients={under} animateContact={false} />
        <div className="woori-send-account__push-veil" aria-hidden />
        <div className="woori-send-account__push-page">{view}</div>
      </div>
    )
  }

  const hidden = (
    <input
      ref={inputRef}
      className="woori-send-account__input"
      value={value}
      inputMode={frame ? 'none' : 'numeric'}
      autoComplete="off"
      aria-label="계좌번호"
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS)
        edit(() => v)
      }}
      onSelect={(e) => caretToEnd(e.currentTarget)}
      onFocus={(e) => {
        caretToEnd(e.currentTarget)
        setActive(true)
        setFocusLine(true)
        setBankFocus(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') blur()
      }}
    />
  )
  return (
    <WooriSendAccountView
      value={value}
      caret={active && !busy}
      clear={active && focusLine && value.length > 0}
      focusLine={focusLine}
      bank={bank}
      bankFocus={bankFocus}
      chips={chips ?? []}
      confirm={!!bank}
      pressed={pressed}
      spinner={busy}
      error={error}
      onClose={onClose}
      onClear={() => {
        edit(() => '')
        focusInput()
      }}
      onInputTap={activate}
      onBankTap={openBanks}
      onChip={pickChip}
      onConfirm={onConfirm}
      input={hidden}
    >
      <WooriKeyboard open={kbOpen && !busy} onKey={onKey} />
    </WooriSendAccountView>
  )
}
