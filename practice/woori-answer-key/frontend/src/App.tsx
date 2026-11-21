// 앱 뼈대 + 라우트 (inventory 6.1절)
//   /                    WooriSplash        스플래시 → /cert
//   /cert                WooriCert          우리WON인증서 6자리
//   /home                WooriHome          홈
//   /history             WooriHistory       거래내역조회 (?type=all|in|out&period=3m). 조회조건 시트는 화면 상태
//   /history/:txId       WooriHistoryDetail 거래내역 상세 — 목록 위 오버레이 (rise 로 열면 목록이 아래에 마운트된 채 남는다)
//   /send                WooriSend          어디로 이체하시겠어요?
//   /send/account        WooriSendAccount   계좌번호 입력 (push + 아래 페이지 흰 베일)
//   /send/account/bank   WooriSendBank      금융회사 선택 (push)
//   /send/amount         WooriSendAmount    금액 (중복 경고·비밀번호 시트는 화면 상태)
//   /send/confirm        WooriSendConfirm   이체 확인
//   /send/done           WooriDone          이체 완료
//   /dev/keyboard · /dev/keypad · /dev/frame   개발용 (삼성 키보드 · 섞인 키패드 · 뼈대 기하 확인)
//   그 밖                /home
// 페이지 전환은 WooriNav 의 페이지 스택이 정한다 (덮는 전환 아래 페이지는 마운트된 채 남고, 전환 중에는 모든 레이어가 inert).
// 프레임 모드(?frame=1)의 위·아래 스페이서와 셸 보정 transform 은 WooriFrame (woori.css '프레임 · 셸').
import { useLayoutEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, type Location } from 'react-router-dom'
import WooriCert from './WooriCert.tsx'
import WooriDevFrame from './WooriDevFrame.tsx'
import WooriDevKeyboard from './WooriDevKeyboard.tsx'
import WooriDevKeypad from './WooriDevKeypad.tsx'
import WooriDone from './WooriDone.tsx'
import WooriHistory from './WooriHistory.tsx'
import WooriHistoryDetail from './WooriHistoryDetail.tsx'
import WooriHome from './WooriHome.tsx'
import {
  isFrameMode,
  readShot,
  setNextTransition,
  useWooriPageStack,
  veilVars,
  WooriLayerContext,
  type WooriPageLayer,
  type WooriTransition,
  type WooriTransitionKind,
} from './WooriNav.ts'
import WooriSend from './WooriSend.tsx'
import WooriSendAccount from './WooriSendAccount.tsx'
import WooriSendAmount from './WooriSendAmount.tsx'
import WooriSendBank from './WooriSendBank.tsx'
import WooriSendConfirm from './WooriSendConfirm.tsx'
import WooriSplash from './WooriSplash.tsx'
import { useWooriToast } from './WooriEnv.ts'
import { setTopBandLayer, useWooriFrameBands, WooriBandLayerContext } from './WooriTheme.ts'

function WooriRoutes({ location }: { location: Location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<WooriSplash />} />
      <Route path="/cert" element={<WooriCert />} />
      <Route path="/home" element={<WooriHome />} />
      <Route path="/history" element={<WooriHistory />} />
      <Route path="/history/:txId" element={<WooriHistoryDetail />} />
      <Route path="/send" element={<WooriSend />} />
      <Route path="/send/account" element={<WooriSendAccount />} />
      <Route path="/send/account/bank" element={<WooriSendBank />} />
      <Route path="/send/amount" element={<WooriSendAmount />} />
      <Route path="/send/confirm" element={<WooriSendConfirm />} />
      <Route path="/send/done" element={<WooriDone />} />
      <Route path="/dev/keyboard" element={<WooriDevKeyboard />} />
      <Route path="/dev/keypad" element={<WooriDevKeypad />} />
      <Route path="/dev/frame" element={<WooriDevFrame />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

/** ?shot= 을 <html data-shot> 으로 반영 (woori.css 가 트랜지션·캐럿·스피너를 고정) */
function useShotAttribute(search: string) {
  useLayoutEffect(() => {
    const shot = readShot(search)
    const root = document.documentElement
    if (shot) root.dataset.shot = shot
    else delete root.dataset.shot
  }, [search])
}

/** 도구용: wooriDebug.navigate('/send/account', 'push') · wooriDebug.navigate(-1, { kind: 'reveal' }) */
function useDebugNavigate() {
  const navigate = useNavigate()
  const { key } = useLocation()
  useLayoutEffect(() => {
    if (!window.wooriDebug) return
    window.wooriDebug.navigate = (to: string | number, transition?: WooriTransition | WooriTransitionKind, options?: { replace?: boolean }) => {
      setNextTransition(key, transition)
      if (typeof to === 'number') navigate(to)
      else navigate(to, options)
    }
  }, [navigate, key])
}

/**
 * 페이지 레이어 하나 = 라우트 페이지 + 겹침 자리(시트 포털) + 베일.
 * 들어오는/나가는 레이어의 애니메이션이 모두 끝나면 onFinish (rise·sink 는 이동·페이드 두 애니메이션).
 */
function PageLayer({ layer, inert, onFinish }: { layer: WooriPageLayer; inert: boolean; onFinish: (key: string) => void }) {
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null)
  // 위치가 같으면 페이지를 다시 그리지 않는다 (레이어 클래스·베일만 바뀔 때)
  const page = useMemo(() => <WooriRoutes location={layer.location} />, [layer.location])
  const info = useMemo(
    () => ({ key: layer.key, overlayHost, arrivedByPop: layer.arrivedByPop, top: layer.top }),
    [layer.key, overlayHost, layer.arrivedByPop, layer.top],
  )
  return (
    <div
      className={layer.className}
      style={layer.style}
      inert={inert || layer.covered}
      data-page={layer.location.pathname}
      onAnimationEnd={(e) => {
        if (!layer.animating || e.target !== e.currentTarget) return
        if (e.currentTarget.getAnimations().every((a) => a.playState === 'finished')) onFinish(layer.key)
      }}
    >
      <div className="woori-layer__page">
        <WooriLayerContext value={info}>
          <WooriBandLayerContext value={layer.key}>
            <div className="woori-layer__scroll" data-woori-scroll="page">
              <div className="woori-layer__content">{page}</div>
            </div>
            <div className="woori-layer__overlays" ref={setOverlayHost} />
          </WooriBandLayerContext>
        </WooriLayerContext>
        {layer.veil && <div key={layer.veil.id} className="woori-layer__veil" style={veilVars(layer.veil)} aria-hidden />}
      </div>
    </div>
  )
}

/** 프레임(?frame=1: 위 31dp · 셸 · 아래 48dp) — 실제 앱에서는 셸만 화면을 채운다 */
function WooriFrame({ children }: { children: ReactNode }) {
  const bands = useWooriFrameBands()
  const frame = isFrameMode()
  const style = { '--woori-band-statusbar': bands.statusbar, '--woori-band-navbar': bands.navbar } as CSSProperties
  return (
    <div className="woori-frame" style={style}>
      {frame && <div className="woori-frame__sb" aria-hidden />}
      <main className="woori-shell">{children}</main>
      {frame && <div className="woori-frame__nav" aria-hidden />}
    </div>
  )
}

/** 짧은 알림 (WooriEnv wooriToast) — 셸 안 아래 가운데, 페이지 레이어 위. 프레임·shot 모드에서는 wooriToast 가 아무것도 만들지 않는다 */
function WooriToastHost() {
  const toast = useWooriToast()
  if (!toast) return null
  return (
    <div key={toast.id} className="woori-toast" role="status" aria-live="polite" data-testid="woori-toast">
      {toast.text}
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const { layers, finish, busy, topKey } = useWooriPageStack()
  useShotAttribute(location.search)
  useDebugNavigate()
  // 띠 색은 맨 위 레이어의 요청만 (덮인 페이지의 요청이 새지 않게)
  useLayoutEffect(() => setTopBandLayer(topKey), [topKey])
  return (
    <WooriFrame>
      {layers.map((layer) => (
        <PageLayer key={layer.key} layer={layer} inert={busy} onFinish={finish} />
      ))}
      <WooriToastHost />
    </WooriFrame>
  )
}
