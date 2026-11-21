// WooriHistoryDetail — /history/:txId 거래내역 상세 (spec/history-detail.md · history-detail.json)
//   목록 위 오버레이: 목록에서 rise 로 열고 뒤로(sink)·✕·[확인] 으로 닫는다. 목록은 아래에 마운트된 채 남는다.
//
// 레이아웃 (앱 dp, 2.0절):
//   머리 52 (WooriHeader: "거래내역 상세" + ✕ (320,14))
//   이름 22/700 (20, 88) · 금액 22/700 (20, 119) — 입금도 검정
//   항목 표: 첫 행 위끝 171.667, 행 높이 46.333 (2줄 값 69 · 알약 행 51) + 1dp 구분선 #f2f2f2 (마지막 행 아래 없음)
//     라벨 15/500 --woori-text-secondary 왼쪽 20 · 값 15/500 자간 −0.5px tabular 오른끝 340 · 글자 top = 행 위끝 + 16.333
//   마지막 행 아래끝 + 46: '…' 검색하기 16/500 + › (333, 글자 top + 1, 8×13)
//   하단 바 726–800.667 흰색: [공유] x16 w102.333 · [확인] x126.333 w217.667, top 728.667 h56 r12
// 열기 3.1: translateY 100dp → 0 + opacity 0 → 1, 둘 다 cubic-bezier(0,0,0.2,1) 265ms.
// 닫기 3.3: translateY 0 → 96dp cubic-bezier(0,0,0.2,1) 240ms + opacity 1 → 0 같은 곡선 260ms.
//   목록 위 흰 막(열기 0 → 0.69 linear 330ms · 닫기 0.69 → 0 linear 271ms +30ms)은 목록(WooriHistory)이 그린다 — WooriNav 의 rise/sink 에는 베일이 없다.
// 출금·이체(②, 3.2): 열 때 6행으로 그리고 +221ms 에 받는 분·통장표기·이체확인증 3행을 끼운다. 가운데 스피너는 +708ms 까지.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { wooriApi, type TxDetail, type TxDetailField } from './WooriApi.ts'
import { WooriButton } from './WooriButton.tsx'
import { WooriHeader } from './WooriHeader.tsx'
import { WOORI_BOTTOM_FIX, useWooriScrollFix, wooriPlace } from './WooriLayout.ts'
import { useWooriStages } from './WooriLoadingPage.tsx'
import { useBackTo, type WooriTransition } from './WooriNav.ts'
import { wooriTodo } from './WooriEnv.ts'
import { useShotReady, useShotState } from './WooriShot.ts'
import { WooriSpinner } from './WooriSpinner.tsx'
import { useWooriBands } from './WooriTheme.ts'
import './WooriHistoryDetail.css'

// 열기 (3.1) 전환 값은 목록(WooriHistory 의 DETAIL_RISE)이 넘긴다: rise dy 100 · 265ms · 이동·페이드 둘 다 cubic-bezier(0,0,0.2,1)

/** 닫기 (3.3) — ✕ · [확인] */
const DETAIL_SINK: WooriTransition = {
  kind: 'sink',
  dy: 96,
  duration: 240,
  easing: 'cubic-bezier(0, 0, 0.2, 1)',
  fadeDuration: 260,
  fadeEasing: 'cubic-bezier(0, 0, 0.2, 1)',
  fadeDelay: 0,
}

interface DetailShot {
  pressed?: boolean
}

const DETAIL_SHOTS: Readonly<Record<string, DetailShot>> = {
  deposit: {},
  'deposit-first': {},
  withdraw: {},
  'confirm-pressed': { pressed: true },
}

/** 출금·이체 3행 끼움 · 스피너 끝 (열기 시작 기준 ms, 3.2) */
const WITHDRAW_STAGES = [221, 708] as const
/** 늦게 끼우는 행 (출금·이체) */
const LATE_KEYS = new Set(['recipient', 'recipientLabel', 'receipt'])

const HEADER_H = 52
const FIRST_ROW_TOP = 171.667
const ROW_H = 46.333
const ROW_2LINE_H = 69
const ROW_PILL_H = 51

/**
 * 글자 top 의 textfit 실측 위치 (기기 행 양자화 — 영상의 글자 줄은 행 위끝 + 16.333 에서 ±0.42dp 흔들린다, 2.1·2.2 표의 T 값).
 * 표에 없으면 계산값 그대로.
 */
const TEXT_FIT: Readonly<Record<string, number>> = {
  '235.333': 235,
  '282.667': 282.25,
  '305.333': 305,
  '352.667': 353,
  '377.333': 377.25,
  '424.667': 425,
  '499.333': 499,
  '546.667': 546.25,
}

const r3 = (v: number) => Math.round(v * 1000) / 1000
const fitTop = (v: number) => TEXT_FIT[r3(v).toFixed(3)] ?? r3(v)

interface RowBox {
  field: TxDetailField
  top: number
  h: number
  textTop: number
  subTop: number | null
}

function layoutRows(fields: readonly TxDetailField[]) {
  const rows: RowBox[] = []
  const dividers: number[] = []
  let y = FIRST_ROW_TOP
  fields.forEach((field, i) => {
    const h = field.sub ? ROW_2LINE_H : field.button ? ROW_PILL_H : ROW_H
    // 알약 행: 가운데(+18)보다 영상 글자가 0.58dp 아래 (shot 대조 −1.28px → 402.25)
    const textTop = field.button ? y + 18.583 : y + 16.333
    rows.push({ field, top: y, h, textTop: fitTop(textTop), subTop: field.sub ? fitTop(y + 39) : null })
    y = r3(y + h)
    if (i < fields.length - 1) {
      dividers.push(y)
      y = r3(y + 1)
    }
  })
  return { rows, dividers, end: y }
}

/** 스크롤 내용 상자 안 자리 (머리 아래 기준) */
const at = (x: number, y: number): CSSProperties => wooriPlace(x, r3(y - HEADER_H))

export default function WooriHistoryDetail() {
  const { txId = '' } = useParams()
  const location = useLocation()
  const shot = useShotState('history-detail', DETAIL_SHOTS)
  const [detail, setDetail] = useState<TxDetail | null>(null)
  const [closing, setClosing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  useWooriScrollFix(scrollRef)
  useWooriBands({ statusbar: 'var(--woori-bg)', navbar: 'var(--woori-bg)' })
  const close = useBackTo('/history', DETAIL_SINK)

  useEffect(() => {
    const ac = new AbortController()
    wooriApi
      .getTransaction(txId, ac.signal)
      .then(setDetail)
      .catch((e: unknown) => {
        if (!ac.signal.aborted) console.error('[history-detail]', e)
      })
    return () => ac.abort()
  }, [txId])

  // 목록이 넘겨 준 행 종류 (스피너를 데이터가 오기 전부터 띄우려고)
  const listType = (location.state as { type?: string } | null)?.type
  const isWithdraw = detail ? detail.kind !== 'deposit' : listType === 'out'
  const stage = useWooriStages(WITHDRAW_STAGES, { start: isWithdraw, shotStage: shot ? 2 : null })
  useShotReady(shot != null && detail != null)

  const fields = detail ? detail.display.fields.filter((f) => stage >= 1 || detail.kind !== 'withdraw-transfer' || !LATE_KEYS.has(f.key)) : []
  const { rows, dividers, end } = layoutRows(fields)
  const searchTop = r3(end + 46)
  const showHiddenBox = detail?.kind === 'withdraw-transfer' && stage >= 1
  const showSpinner = !shot && (isWithdraw ? stage < 2 : false)
  // [확인] 눌림 색은 닫히는 동안 그대로 (3.3 ③)
  const confirmPressed = shot?.state.pressed === true || closing

  return (
    <div className="woori-hd">
      <div ref={scrollRef} className="woori-hd__scroll woori-scroll-fix">
        <div className="woori-hd__content woori-scroll-fix__content" style={{ height: Math.max(674, Math.ceil(searchTop + 108 - HEADER_H)) }}>
          {detail && (
            <>
              <p className="woori-hd__name" style={at(20, 88)}>
                {detail.display.title}
              </p>
              <p className="woori-hd__amount" style={at(20, 119)}>
                {detail.display.amount}
              </p>
              {rows.map((row) => (
                <DetailRow key={row.field.key} row={row} />
              ))}
              {dividers.map((y) => (
                <div key={y} className="woori-hd__divider" style={at(20, y)} />
              ))}
              <p className="woori-hd__search" style={at(20, searchTop)} onClick={wooriTodo}>
                {detail.display.search}
              </p>
              <img className="woori-hd__search-chevron" src="/woori/history-detail/chevron-search.svg" alt="" style={at(333, searchTop + 1)} />
              {showHiddenBox && <div className="woori-hd__outline-box" style={at(20, searchTop + 50.667)} />}
            </>
          )}
        </div>
      </div>
      <WooriHeader className="woori-hd__header" title="거래내역 상세" onClose={close} />
      <div className="woori-hd__bar" />
      <WooriButton variant="secondary" className="woori-hd__btn woori-hd__btn--share" style={WOORI_BOTTOM_FIX} onClick={wooriTodo}>
        공유
      </WooriButton>
      <WooriButton
        className="woori-hd__btn woori-hd__btn--confirm"
        style={{ translate: '0.333px var(--woori-bottom-fix)' }}
        {...(confirmPressed ? { 'data-pressed': '' } : {})}
        onClick={() => {
          setClosing(true)
          close()
        }}
      >
        확인
      </WooriButton>
      {showSpinner && <WooriSpinner />}
    </div>
  )
}

function DetailRow({ row }: { row: RowBox }) {
  const { field, textTop, subTop, top } = row
  return (
    <>
      <p className="woori-hd__label" style={at(20, textTop)}>
        {field.label}
      </p>
      {field.link ? (
        <>
          <p className="woori-hd__memo" style={at(0, textTop + 0.25)} onClick={wooriTodo}>
            {field.value}
          </p>
          <img className="woori-hd__memo-chevron" src="/woori/history-detail/chevron-memo.svg" alt="" style={at(334, top + 18.333)} />
        </>
      ) : field.button ? (
        <>
          <span className="woori-hd__pill" style={at(301, top + 12)} onClick={wooriTodo} />
          <p className="woori-hd__pill-text" style={at(301.333, textTop + 1)} onClick={wooriTodo}>
            {field.value}
          </p>
        </>
      ) : (
        <p className="woori-hd__value" style={at(0, textTop)}>
          {field.value}
        </p>
      )}
      {subTop != null && (
        <p className="woori-hd__value" style={at(0, subTop)}>
          {field.sub}
        </p>
      )}
    </>
  )
}
