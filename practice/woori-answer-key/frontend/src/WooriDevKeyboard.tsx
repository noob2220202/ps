// WooriDevKeyboard — /dev/keyboard 삼성 키보드(노란 테마) 단독 확인 (개발용, spec/send-a.md 9절 · BRIEF D5)
//   WooriKeyboard 를 늘 그린다(force — 프레임 모드가 아니어도). 누른 키를 위에 적는다. [올리기/내리기] 로 올라옴(380ms)·내려감(348ms) 확인.
//   shot: ?shot=open (정착) · ?shot=up (translateY 80dp, account-keyboard-up 자리)
import { useState } from 'react'
import WooriKeyboard, { type WooriKeyName } from './WooriKeyboard.tsx'
import { useShotReady, useShotState } from './WooriShot.ts'

const DEV_KB_SHOTS: Readonly<Record<string, { offset: number | null }>> = {
  open: { offset: null },
  up: { offset: 80 },
}

export default function WooriDevKeyboard() {
  const shot = useShotState('dev-keyboard', DEV_KB_SHOTS)
  const [open, setOpen] = useState(true)
  const [log, setLog] = useState<WooriKeyName[]>([])
  useShotReady(true)
  return (
    <div style={{ position: 'relative', height: '100%', background: 'var(--woori-bg)' }}>
      <div style={{ position: 'absolute', left: 20, top: 24, right: 20, fontSize: 15, lineHeight: 1.5, color: 'var(--woori-text)' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>삼성 키보드 (개발용)</div>
        <div style={{ wordBreak: 'break-all', minHeight: 48 }}>{log.join(' ') || '키를 눌러 보세요'}</div>
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 8, background: 'var(--woori-bg-gray)' }}>
          {open ? '내리기' : '올리기'}
        </button>{' '}
        <button type="button" onClick={() => setLog([])} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 8, background: 'var(--woori-bg-gray)' }}>
          지우기
        </button>
      </div>
      <WooriKeyboard
        force
        open={shot ? true : open}
        appear={!shot}
        offsetDp={shot?.state.offset ?? null}
        onKey={(k) => setLog((l) => [...l.slice(-40), k])}
      />
    </div>
  )
}
