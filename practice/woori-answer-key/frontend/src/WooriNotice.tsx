// WooriNotice — /notice 알림 (설계: 녹화 영상에 없는 화면 — 홈 머리 종 아이콘을 실제로 연결하면서 최소로 추가)
//   범위: 알림 목록 + 편집(여러 개 선택해 삭제)만. 홈 머리의 지갑·AI·☰(프로필 등)는 그대로 wooriTodo 로 둔다.
//   내용은 영상 속 홈 공지·배너 문구에서 그대로 가져왔다(새로 지어내지 않음) — 이번 행운은.. / 첫 급여 NpayP / 해외결제 적립.
//   목록은 세션 동안만(새로고침·시나리오 되돌리기로 리셋) — 서버에 저장하지 않는다(APK 로컬 데모에 그 이상은 불필요).
import { useState } from 'react'
import { WooriButton } from './WooriButton.tsx'
import { WooriHeader } from './WooriHeader.tsx'
import { WOORI_BOTTOM_FIX } from './WooriLayout.ts'
import { useWooriNavigate } from './WooriNav.ts'
import { useWooriBands } from './WooriTheme.ts'
import './WooriNotice.css'

interface NoticeItem {
  id: string
  title: string
  body: string
  time: string
  unread: boolean
}

const INITIAL_NOTICES: readonly NoticeItem[] = [
  { id: 'n1', title: '이번 행운은 내차례일지도..', body: '우리두근두근행운적금 만나러가기', time: '방금 전', unread: true },
  { id: 'n2', title: '첫 급여 이체하면 NpayP 100% 드림', body: 'WON 통장으로 급여를 받아보세요', time: '오늘', unread: true },
  { id: 'n3', title: '해외결제 적립 이벤트', body: '해외 첫 결제 시 5천 포인트 + 최대 5.3% 적립', time: '어제', unread: false },
  { id: 'n4', title: '안전 거래 안내', body: '비밀번호는 주기적으로 바꿔 주시는 게 안전해요', time: '3일 전', unread: false },
  { id: 'n5', title: '서비스 점검 안내', body: '11.25(수) 00:00~04:00 일부 서비스 이용이 제한돼요', time: '2026.11.18', unread: false },
]

export default function WooriNotice() {
  const go = useWooriNavigate()
  useWooriBands({ statusbar: 'var(--woori-bg)', navbar: 'var(--woori-bg)' })
  const [items, setItems] = useState<NoticeItem[]>(() => INITIAL_NOTICES.map((n) => ({ ...n })))
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const exitEdit = () => {
    setEditing(false)
    setSelected(new Set())
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allSelected = items.length > 0 && selected.size === items.length
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((n) => n.id)))

  const onRowTap = (n: NoticeItem) => {
    if (editing) {
      toggleOne(n.id)
      return
    }
    if (n.unread) setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))
  }

  const deleteSelected = () => {
    setItems((prev) => prev.filter((n) => !selected.has(n.id)))
    exitEdit()
  }

  const showBar = editing && selected.size > 0

  return (
    <div className="woori-notice">
      <WooriHeader
        title="알림"
        onBack={editing ? exitEdit : () => go(-1)}
        rightText={items.length > 0 ? (editing ? '완료' : '편집') : undefined}
        onRight={() => (editing ? exitEdit() : setEditing(true))}
      />
      <div className="woori-notice__scroll">
        {items.length === 0 ? (
          <p className="woori-notice__empty">새로운 알림이 없어요</p>
        ) : (
          <div className="woori-notice__list" style={{ paddingBottom: showBar ? 92 : 0 }}>
            {editing && (
              <button type="button" className="woori-notice__all" onClick={toggleAll}>
                <span className={'woori-notice__check' + (allSelected ? ' is-on' : '')} aria-hidden />
                전체선택
              </button>
            )}
            {items.map((n) => (
              <button key={n.id} type="button" className="woori-notice__row" onClick={() => onRowTap(n)}>
                <span className="woori-notice__lead">
                  {editing ? (
                    <span className={'woori-notice__check' + (selected.has(n.id) ? ' is-on' : '')} aria-hidden />
                  ) : (
                    n.unread && <span className="woori-notice__dot" aria-hidden />
                  )}
                </span>
                <span className="woori-notice__body">
                  <span className="woori-notice__title">{n.title}</span>
                  <span className="woori-notice__desc">{n.body}</span>
                  <span className="woori-notice__time">{n.time}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {showBar && (
        <>
          <div className="woori-notice__bar" />
          <WooriButton variant="primary" className="woori-notice__delete-btn" style={WOORI_BOTTOM_FIX} onClick={deleteSelected}>
            선택한 {selected.size}개 삭제
          </WooriButton>
        </>
      )}
    </div>
  )
}
