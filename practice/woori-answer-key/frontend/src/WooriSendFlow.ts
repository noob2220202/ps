// WooriSendFlow — 이체 앞부분(send-a: /send · /send/account · /send/account/bank) 화면끼리 나누는 작은 도우미
//
//   fbox(x, y, w, h)   소수 dp 상자: 정수 left/top/width/height + 남는 소수는 translate, 크기 차는 scale (origin 0 0).
//                      레이아웃 위치·크기는 그리기 전에 정수 dp 로 반올림되고 transform 은 그대로라(frontend/README 렌더 규칙 1),
//                      소수 크기 그림(키보드 글자 PNG 등)은 이렇게 놓아야 Chromium 이 기기 px 로 맞추며 일그러뜨리지 않는다 (spec/send-a.md 6.3).
//   textAt(x, y)       글자 상자(position:absolute; line-height:1) 왼쪽 위 = 스펙의 'L · T (+px)' 값
//   bankLogoArt(logo)  API 의 로고 이름('bank-kakao') → 에셋 이름('banks.kakao')
//   흐름 메모: 계좌번호 페이지가 [확인] 뒤 '어디로 이체' 로 reveal 하고, 그 페이지가 잠시 뒤 금액 페이지로 간다 (spec/send-a.md 3.4).
//             금융회사 페이지에서 고른 은행을 계좌번호 페이지로 돌려준다 (go(-1) instant).
import type { CSSProperties } from 'react'
import { bankArtName, type WooriArtName } from './WooriArt.ts'
import type { Bank, BankChip, LookupResult } from './WooriApi.ts'

const r4 = (v: number) => Math.round(v * 10000) / 10000
const r6 = (v: number) => Math.round(v * 1e6) / 1e6

/** 소수 dp 상자 (position:absolute). 정수 크기 + scale, 정수 위치 + translate */
export function fbox(x: number, y: number, w: number, h: number): CSSProperties {
  const X = Math.floor(x)
  const Y = Math.floor(y)
  const W = Math.max(1, Math.round(w))
  const H = Math.max(1, Math.round(h))
  const fx = r4(x - X)
  const fy = r4(y - Y)
  const sx = r6(w / W)
  const sy = r6(h / H)
  const s: CSSProperties = { position: 'absolute', left: X, top: Y, width: W, height: H }
  if (fx || fy) s.translate = `${fx}px ${fy}px`
  if (sx !== 1 || sy !== 1) {
    s.scale = `${sx} ${sy}`
    s.transformOrigin = '0 0'
  }
  return s
}

/** 글자 상자 왼쪽 위 (스펙 L · T, '+0.25px' 는 y 에 더한다) */
export function textAt(x: number, y: number): CSSProperties {
  const X = Math.floor(x)
  const Y = Math.floor(y)
  const fx = r4(x - X)
  const fy = r4(y - Y)
  return fx || fy ? { left: X, top: Y, translate: `${fx}px ${fy}px` } : { left: X, top: Y }
}

/** API 로고 이름 → 은행 로고 에셋 ('bank-nh' → 'banks.nh'). 없으면 undefined */
export function bankLogoArt(logo: string | null | undefined): WooriArtName | undefined {
  if (!logo) return undefined
  return bankArtName(logo.replace(/^bank-/, ''))
}

/** API 금융회사 코드 → 금액 페이지 주소의 spec 코드 (KAKAO → kakao, NHLOCAL → nh-local).
 *  send-b 는 대문자 + 하이픈 제거로 API 코드로 되돌리므로, 그 밖의 코드는 소문자 그대로 (MG → mg → MG 로 돌아온다) */
const SPEC_BANK_CODE: Readonly<Record<string, string>> = { NHLOCAL: 'nh-local' }
export function specBankCode(apiCode: string): string {
  return SPEC_BANK_CODE[apiCode] ?? apiCode.toLowerCase()
}

/** 금액 페이지 주소 (send-b WooriSendAmount): 최근입금계좌 줄 → ?to=<recipientId>, 직접 입력 → ?bank=<spec 코드>&acct=<숫자만> */
export function amountUrl(p: { recipientId: number } | { bankCode: string; accountNumber: string }): string {
  const q = new URLSearchParams()
  if ('recipientId' in p) q.set('to', String(p.recipientId))
  else {
    q.set('bank', specBankCode(p.bankCode))
    q.set('acct', p.accountNumber.replace(/\D/g, ''))
  }
  return `/send/amount?${q.toString()}`
}

/** shot 입력값 (자리수만 맞춘 채움 숫자 — 실제·더미 계좌가 아니다. 비교에서는 개인정보 마스크 26,244,262,32) */
export const SEND_SHOT_DIGITS = '1234567890123'

/* ── 페이지 사이 메모 (같은 JS 안, 새로고침이면 사라져도 된다) ── */

let nextAfterReveal: { url: string; state: { lookup?: LookupResult } } | null = null

/** 계좌번호 페이지 [확인]: '어디로 이체' 페이지가 드러난 뒤 갈 곳 */
export function setSendNext(url: string, state: { lookup?: LookupResult } = {}) {
  nextAfterReveal = { url, state }
}

export function takeSendNext(): { url: string; state: { lookup?: LookupResult } } | null {
  const v = nextAfterReveal
  nextAfterReveal = null
  return v
}

let pickedBank: Pick<Bank, 'code' | 'name' | 'short' | 'logo'> | null = null

/** 금융회사 페이지에서 고른 은행 (계좌번호 페이지가 맨 위로 돌아올 때 읽는다) */
export function setPickedBank(b: Pick<Bank, 'code' | 'name' | 'short' | 'logo'>) {
  pickedBank = b
}

export function takePickedBank(): Pick<Bank, 'code' | 'name' | 'short' | 'logo'> | null {
  const v = pickedBank
  pickedBank = null
  return v
}

/** 추천 칩 → 은행 (칩 탭 = 그 은행을 고른 것과 같음, 설계) */
export function chipToBank(c: BankChip): Pick<Bank, 'code' | 'name' | 'short' | 'logo'> {
  return { code: c.code, name: c.name, short: c.name, logo: c.logo }
}

/* ── 곡선 (spec/send-a.md 3절) ── */
export const SEND_A_MOTION = {
  /** 계좌번호·금융회사 페이지 push: easeOutCubic 322ms */
  push: { duration: 322, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' },
  /** 첫 push 베일: linear 0 → 0.8, 326ms, 30ms 늦게 */
  pushVeil: { from: 0, to: 0.8, duration: 326, easing: 'linear', delay: 30 },
  /** 금융회사 push 베일: 한 프레임에 0.8 */
  bankVeil: { from: 0.8, to: 0.8, duration: 0, easing: 'linear', delay: 0 },
  /** [확인] → 페이지가 한 프레임에 사라지고 베일 0.8 이 216ms 뒤 linear 311ms 로 걷힘 */
  revealVeil: { from: 0.8, to: 0, duration: 311, easing: 'linear', delay: 216 },
  /** reveal 뒤 금액 페이지까지 (74.214 → 74.723) */
  revealToAmountMs: 509,
} as const
