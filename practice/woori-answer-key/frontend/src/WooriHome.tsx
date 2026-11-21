// WooriHome — /home 홈 (spec/home.md · home.json, 로그인 로딩은 spec/launch.md 2.3·3.3)
//
// 구성 (앱 dp, frontend/README '렌더 규칙'):
//   .woori-home (height 100%) ─┬ 스크롤 상자 (앱 0–740.667, 자기 스크롤 + useWooriScrollFix) — 내용 높이 1561.667 (page y = 2.1·2.5 표)
//                              ├ 머리 (0–52, 불투명 #eff0f3 — 내용이 그 아래로 들어간다)
//                              ├ 오버레이 스크롤바 (x 356–360, 트랙 10–730.667, 머리 위에도 그림)
//                              ├ 탭바 (WooriTabBar) · 스피너 (홈 위 가운데 (180, 370.854))
//                              └ 프로모션 팝업 (WooriSheet popup, 첫 진입만)
// 첫 진입(인증서 → /home): 로그인 로딩 0–768.5ms (흰 화면+탭바 → 76.3ms 캐릭터 대체 그림) → 홈 단계 그리기 (3.1, 한 프레임 교체 = 타이머)
//   → 공지 줄 가로 정착 (3.2) → 팝업 (3.3, easeOutCubic 176ms) → 딤 뒤 다른 은행 카드·잔액 오도미터 (3.4·3.5) → [닫기] (3.6, linear 160ms).
// 그 밖의 진입(돌아옴·바로 열기)은 떠날 때 모습(scrollTop·배너 n, sessionStorage)으로 바로 그린다 — 3.9·3.10 다시 그리기 단계는 아직 없음.
//   첫 진입은 그 보관을 보지 않는다 (맨 위·배너 1 부터 — 되돌리기 뒤 다시 로그인해도 영상 순서 그대로).
// 데이터는 WooriApi(getAccounts) 로만 받는다. 이름·계좌번호를 코드에 쓰지 않는다.
// 실제 앱(프레임·shot 모드 아님) 몫: 영상에 없어 동작이 없는 곳(머리 아이콘·공지·칩·카드·⋮·배너 그림·추천·탭바 홈 외 탭 …)을 누르면
//   '답지에는 없는 화면이에요' 토스트 (onClickCapture 한 곳에서 누른 자리 아래 요소로 가린다), 탭바 '홈' = 맨 위로.
//   계좌번호 복사 아이콘 = 클립보드 + 토스트 (wooriCopy). 계좌 탭 스피너(643ms) 동안은 다른 누름을 받지 않는다.
//   팝업 '오늘은 그만 보기' = 그날(서울 날짜) 첫 진입에는 팝업을 건너뛴다 (localStorage 'woori.popup.home').
//   폰 뒤로 버튼: 팝업이 떠 있으면 [닫기] 와 같이 닫는다 (팝업이 없으면 WooriLocal 이 '한 번 더 누르면 종료').
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { artSrc, type WooriArtName } from './WooriArt.ts'
import { wooriApi, type Account } from './WooriApi.ts'
import { wooriCopy, wooriFitScale, wooriLiveApp, wooriTodo } from './WooriEnv.ts'
import { useWooriScrollFix, wooriPlace, wooriScrollTo } from './WooriLayout.ts'
import { isFrameMode, useWooriNavigate } from './WooriNav.ts'
import { WooriSheet } from './WooriSheet.tsx'
import { useShotReady, useShotState } from './WooriShot.ts'
import { WooriSpinner } from './WooriSpinner.tsx'
import { WooriTabBar, type WooriTab } from './WooriTabBar.tsx'
import { useWooriBands } from './WooriTheme.ts'
import { useWooriStages } from './WooriLoadingPage.tsx'
import './WooriHome.css'

/* ───────────────────────── 화면 상태 (View) ───────────────────────── */

type Account3 = 'none' | 'skeleton' | 'won-skeleton' | 'won'
type BalanceMode = 'none' | 'unit' | 'final' | 'roll' | 'roll-start'

interface View {
  /** white = 로그인 로딩·홈 첫 스피너(흰 페이지), blank = 홈 바탕만, home = 홈 */
  page: 'white' | 'blank' | 'home'
  loader?: boolean
  header: 'none' | 'pill' | 'icons' | 'full'
  layout1: boolean
  notice: 'none' | 'card' | 'text' | 'full'
  noticeDx: number
  /** 공지 줄 정착 애니메이션 (첫 진입 3.2) */
  noticeSettle?: boolean
  character: boolean
  recCards: boolean
  recIcons: boolean
  banner: boolean
  bannerImg: boolean
  account: Account3
  wonLogo: boolean
  wonUnit: boolean
  balance: BalanceMode
  strip: boolean
  otherBank: 'none' | 'nologos' | 'full'
  spinner: boolean
  popup: 'none' | 'opening' | 'open' | 'pressed' | 'closing'
  popupImage: boolean
}

const READY: View = {
  page: 'home',
  header: 'full',
  layout1: true,
  notice: 'full',
  noticeDx: 0,
  character: true,
  recCards: true,
  recIcons: true,
  banner: true,
  bannerImg: true,
  account: 'won',
  wonLogo: true,
  wonUnit: true,
  balance: 'final',
  strip: true,
  otherBank: 'full',
  spinner: false,
  popup: 'none',
  popupImage: true,
}

const WHITE: View = {
  ...READY,
  page: 'white',
  header: 'none',
  layout1: false,
  notice: 'none',
  character: false,
  recCards: false,
  recIcons: false,
  banner: false,
  bannerImg: false,
  account: 'none',
  wonLogo: false,
  wonUnit: false,
  balance: 'none',
  strip: false,
  otherBank: 'none',
}

/** 첫 진입 (3.1·3.3·3.4) — 단계 n 의 모습. 시각은 FIRST_STAGES_MS */
const LOADING_RENDER: View = {
  ...READY,
  header: 'full',
  notice: 'text',
  account: 'skeleton',
  wonLogo: false,
  wonUnit: false,
  balance: 'none',
  strip: false,
  otherBank: 'none',
  spinner: true,
}
const NAV_BLACK: View = { ...LOADING_RENDER, notice: 'full', noticeDx: -30.795, bannerImg: true, account: 'won', wonLogo: true, spinner: false }
const BALANCE_UNIT: View = { ...NAV_BLACK, noticeDx: -10.631, wonUnit: true, balance: 'unit' }

/** /home 마운트 기준 ms: 로그인 캐릭터 76.3 · 홈 스피너 768.5 (= 3.1 의 0) + 3.1 표 */
const M0 = 768.5
const FIRST_STAGES_MS = [
  76.3, M0, M0 + 50, M0 + 218, M0 + 301, M0 + 451, M0 + 468, M0 + 577, M0 + 636, M0 + 761, M0 + 1054, M0 + 1112, M0 + 1246, M0 + 1460,
  M0 + 1518, M0 + 1622, M0 + 1698, M0 + 1772, M0 + 1798, M0 + 1865, M0 + 1897,
] as const

function firstEntryView(stage: number): View {
  const s = (n: number) => stage >= n
  if (!s(1)) return WHITE
  if (!s(2)) return { ...WHITE, loader: true }
  if (!s(3)) return { ...WHITE, spinner: true }
  if (!s(4)) return { ...WHITE, spinner: true, header: 'pill' }
  const v: View = {
    ...LOADING_RENDER,
    header: s(6) ? 'full' : s(5) ? 'icons' : 'pill',
    notice: s(9) ? 'text' : s(5) ? 'card' : 'none',
    character: s(10),
    recCards: s(5),
    recIcons: s(7),
    banner: s(8),
    bannerImg: s(8),
    account: s(10) ? 'skeleton' : 'none',
  }
  if (!s(11)) return v
  v.noticeSettle = true
  if (s(12)) {
    v.notice = 'full'
    v.account = s(13) ? 'won' : 'won-skeleton'
    v.wonLogo = s(13)
    v.spinner = !s(13)
  }
  if (s(15)) {
    v.wonUnit = true
    v.balance = 'unit'
  }
  if (s(16)) {
    v.popup = 'opening'
    v.popupImage = false
  }
  if (s(17)) v.otherBank = 'nologos'
  if (s(18)) v.otherBank = 'full'
  if (s(19)) v.balance = 'roll'
  if (s(20)) v.strip = true
  if (s(21)) v.popupImage = true
  return v
}

/* ───────────────────────── shot 상태 표 (spec/home.json states + launch 로그인 로딩) ───────────────────────── */

interface HomeShot {
  view: View
  scroll?: number
  banner?: number
  /** 배너 줄 움직임: 줄이 이 dp 만큼 오른쪽(= 앞 장 쪽)에서 0 으로 ease 300ms (shots.d 의 t 위상) */
  bannerFrom?: number
  ai?: 'ai' | 'lines'
  scrollbar?: boolean
  /** shots.d 에 t 가 있다: 애니메이션을 처음 위상에 세워 두고(playbackRate 0) shot.cjs 가 t 로 옮긴다 */
  freeze?: boolean
  /** 오도미터 변수 (첫 진입 v1 / 돌아옴 v2) */
  odo?: 'v1' | 'v2'
  navbarBlack?: boolean
}

const S = (view: View, extra: Omit<HomeShot, 'view'> = {}): HomeShot => ({ view, ...extra })
const SWIPE_RELEASE_DP: Record<number, number> = { 3: 45.61, 4: 58.39, 5: 58.85, 6: 58.88, 7: 30.49, 8: 45.79, 9: 42.07, 10: 62.73 }
const POPUP_BASE: View = { ...READY, popup: 'open' }

const HOME_SHOTS: Readonly<Record<string, HomeShot>> = (() => {
  const t: Record<string, HomeShot> = {
    'login-loading-blank': S(WHITE),
    'login-loading-character': S({ ...WHITE, loader: true }, { freeze: true }),
    'loading-spinner': S({ ...WHITE, spinner: true }),
    'loading-header-pill': S({ ...WHITE, spinner: true, header: 'pill' }),
    'loading-render': S(LOADING_RENDER, { ai: 'ai' }),
    'loading-nav-black': S(NAV_BLACK, { navbarBlack: true }),
    'loading-balance-unit': S(BALANCE_UNIT, { navbarBlack: true }),
    'loading-refresh': S({ ...READY, otherBank: 'none' }, { banner: 2, scrollbar: true }),
    'loading-blank': S({ ...WHITE, page: 'blank' }),
    'loading-drop-other-bank': S({ ...READY, otherBank: 'none' }, { banner: 2 }),
    'loading-no-account': S({ ...READY, otherBank: 'none', account: 'none' }, { banner: 2 }),
    'loading-panel-shrink': S({ ...READY, otherBank: 'none', account: 'none' }, { banner: 2 }),
    'loading-skeleton': S({ ...READY, otherBank: 'none', account: 'skeleton' }, { banner: 2 }),
    'loading-account-no-balance': S({ ...READY, otherBank: 'none', balance: 'unit', strip: false }, { banner: 2 }),
    'loading-other-bank-back': S({ ...READY, balance: 'unit', strip: false }, { banner: 2 }),
    'popup-open': S({ ...BALANCE_UNIT, noticeDx: -5.281, popup: 'opening', popupImage: false }, { freeze: true }),
    'popup-behind-update': S({ ...BALANCE_UNIT, noticeDx: -0.754, otherBank: 'full', balance: 'roll-start', popup: 'open', popupImage: false }, { odo: 'v1' }),
    'popup-balance-roll': S({ ...POPUP_BASE, balance: 'roll' }, { freeze: true, odo: 'v1' }),
    'popup-idle': S(POPUP_BASE),
    'popup-close-pressed': S({ ...POPUP_BASE, popup: 'pressed' }),
    'popup-close-released': S(POPUP_BASE),
    'popup-close': S({ ...POPUP_BASE, popup: 'closing' }, { freeze: true }),
    settle: S(READY, { ai: 'lines' }),
    'top-banner1': S(READY, { ai: 'lines' }),
    'banner-auto-2': S(READY, { banner: 2, ai: 'lines' }),
    'top-banner2': S(READY, { banner: 2, ai: 'lines' }),
    'banner-auto-2b': S(READY, { banner: 2, scroll: 53.333, scrollbar: true, ai: 'lines' }),
    'return-cached': S(READY, { banner: 2, scroll: 53.333 }),
    'top-banner3': S(READY, { banner: 3, ai: 'lines' }),
    'banner-auto-4': S(READY, { banner: 4, scroll: 178.667, scrollbar: true }),
    cached: S(READY, { banner: 2 }),
    'balance-roll': S({ ...READY, balance: 'roll' }, { banner: 2, freeze: true, odo: 'v2' }),
    'banner-2to3': S(READY, { banner: 3 }),
    'banner-3': S(READY, { banner: 3 }),
    'account-tap-spinner': S({ ...READY, spinner: true }, { banner: 3 }),
    'page-full': S(READY, { banner: 2 }),
    'scroll-206': S(READY, { banner: 2, scroll: 97.667, scrollbar: true }),
    'scrolled-206': S(READY, { banner: 2, scroll: 141.667 }),
    banner3: S(READY, { banner: 3, scroll: 141.667 }),
    banner4: S(READY, { banner: 4, scroll: 141.667 }),
    scroll: S(READY, { banner: 10, scroll: 486, scrollbar: true }),
    marquee: S(READY, { banner: 1, scroll: 821 }),
    'scrolled-78': S(READY, { banner: 2, scroll: 53.333, ai: 'lines' }),
    'account-tap-spinner-s78': S({ ...READY, spinner: true }, { banner: 2, scroll: 53.333, ai: 'lines' }),
    'scrolled-260': S(READY, { banner: 4, scroll: 178.667, scrollbar: true }),
    'scrolled-380': S(READY, { banner: 4, scroll: 261 }),
    'account-tap-spinner-s380': S({ ...READY, spinner: true }, { banner: 10, scroll: 261 }),
  }
  for (let n = 3; n <= 10; n++) t[`banner-swipe-${n}`] = S(READY, { banner: n, scroll: 141.667, bannerFrom: 348 - SWIPE_RELEASE_DP[n], freeze: true })
  for (let n = 5; n <= 10; n++) {
    t[`banner-next-${n}`] = S(READY, { banner: n, scroll: 261, bannerFrom: 348, freeze: true, ai: n >= 9 ? 'lines' : 'ai' })
    t[`banner${n}`] = S(READY, { banner: n, scroll: 261, ai: n === 9 ? 'lines' : 'ai' })
  }
  return t
})()

/* ───────────────────────── 중간 배너 10장 (2.7) ───────────────────────── */

interface BannerLine {
  text: string
  size: number
  weight: number
  ls: string
  /** 카드 위끝 기준 top (dp) */
  top: number
  color: string
}
interface BannerSpec {
  bg: string
  lines: BannerLine[]
  img: WooriArtName
  character?: WooriArtName
}
const L = (text: string, size: number, weight: number, ls: string, top: number, color: string): BannerLine => ({ text, size, weight, ls, top, color })

const BANNERS: readonly BannerSpec[] = [
  {
    bg: '#fbedfa',
    img: 'home.banner-img-01',
    lines: [
      L('오늘의 행운을 받아가세요', 16, 600, '0em', 20.333, '#39313a'),
      L('최고 연13.0%', 16, 600, '0em', 43.34, '#38323a'),
      L('(기본 연3.0%,세전)', 13, 500, '0em', 68.34, '#867d88'),
      L('우리 두근두근 행운적금', 13, 600, '0.0025em', 86.34, '#867b87'),
    ],
  },
  {
    bg: '#f7f0fe',
    img: 'home.banner-img-02',
    lines: [
      L('첫 결제 5,000P +', 16, 600, '0em', 30, '#363240'),
      L('최대 5.3% 적립', 16, 600, '0em', 52, '#373340'),
      L('해외여행은 삼성월렛머니로!', 13, 500, '0em', 78, '#827e8b'),
    ],
  },
  {
    bg: '#e9f7f3',
    img: 'home.banner-img-03',
    lines: [
      L('11월 한정 통신비 특가', 16, 600, '0em', 21, '#2c3737'),
      L('최종혜택가 0원', 15.5, 600, '0.0225em', 43, '#2c3636'),
      L('깜짝 놀랄 가격!', 13, 500, '0em', 69, '#798383'),
      L('블랙프라이데이 파격세일', 13, 500, '0em', 87, '#7a8584'),
    ],
  },
  {
    bg: '#e2f2fb',
    img: 'home.banner-img-04',
    character: 'home.banner-img-04-character',
    lines: [
      L('환전주머니 채우면', 16, 600, '0em', 21, '#273640'),
      L('eSIM 100%당첨', 16, 600, '0em', 43, '#273640'),
      L('선착순 2만명 1GB 무료', 13, 500, '0em', 69, '#73838c'),
      L('130개국 사용 가능', 13, 500, '0em', 87, '#71818a'),
    ],
  },
  {
    bg: '#e9f7f3',
    img: 'home.banner-img-05',
    lines: [
      L('Fill Up to 1억', 16, 600, '0em', 21.333, '#2a3736'),
      L('Pick Up the 꿀머니 이벤트', 16, 600, '0em', 44.333, '#2a3736'),
      L('우리은행 VIP고객님 되시면', 13, 500, '0em', 68.333, '#778583'),
      L('꿀머니 100만원 당첨 기회!', 13, 500, '0em', 87.333, '#768382'),
    ],
  },
  {
    bg: '#ebf3fc',
    img: 'home.banner-img-06',
    lines: [
      L('우리 함께 多多 이벤트', 16, 600, '0em', 32.333, '#2e353e'),
      L('우리은행으로 자금 모으시면', 13, 500, '0em', 57.333, '#79818a'),
      L('선착순 꿀머니부터 혜택 팡팡!', 13, 500, '0em', 75.333, '#7a828b'),
    ],
  },
  {
    bg: '#f8f1e1',
    img: 'home.banner-img-07',
    lines: [
      L('가볍게 뽑아보세요', 16, 600, '0em', 32.333, '#36332e'),
      L('간식 뽑고', 13, 500, '0em', 57.333, '#847f73'),
      L('선물 기회 더하기', 13, 500, '0em', 75.333, '#847f76'),
    ],
  },
  {
    bg: '#f4f2fe',
    img: 'home.banner-img-08',
    lines: [
      L('CU에서 틴틴카드 쓰면', 16, 600, '0em', 30.333, '#34313e'),
      L('CU포인트가 쏟아진다', 16, 600, '0em', 52.333, '#34323e'),
      L('우리틴틴xCU', 13, 500, '0em', 77.333, '#807e8a'),
    ],
  },
  {
    bg: '#e9f7f3',
    img: 'home.banner-img-09',
    lines: [
      L('올해의 마지막 카운트다운', 16, 600, '0em', 30.333, '#2a3737'),
      L('함께할 준비됐나요?', 16, 600, '0em', 52.333, '#2a3738'),
      L('투더문에서 예매하기', 13, 500, '0em', 77.333, '#788584'),
    ],
  },
  {
    bg: '#f8f1e1',
    img: 'home.banner-img-10',
    lines: [
      L('내 보험 맞춤 진단 신청하면', 16, 600, '0em', 30.333, '#36332d'),
      L('네이버페이 포인트 만원!', 16, 600, '0em', 52.333, '#36332f'),
      L('[선착순 300명 증정]', 13, 500, '0em', 77.333, '#848077'),
    ],
  },
]

/** 우리금융그룹 서비스 마키 카드 (2.8 — 보인 6장, 보험·저축은행 둘째 줄은 잘려 보인 그대로) */
const MARQUEE_CARDS: readonly { title: string; color: string; lines: [string, string]; icon?: WooriArtName }[] = [
  { title: '꿀머니', color: '#af641b', lines: ['우리금융그룹', '통합 포인트'] },
  { title: '카드', color: '#3f929f', lines: ['생활 속', '모든 혜택'] },
  { title: '보험', color: '#9b47c5', lines: ['나를 …', '든든 …'] },
  { title: '캐피탈', color: '#186b54', lines: ['내 자동차', '대출 한도'], icon: 'home.grp-capital-car' },
  { title: '증권', color: '#2c5996', lines: ['새로운', '투자의 시작'], icon: 'home.grp-securities-chart' },
  { title: '저축은행', color: '#c23a8e', lines: ['나에게', '꼭 맞는 대출…'] },
]

/* ───────────────────────── 작은 부품 ───────────────────────── */

interface TextProps {
  x: number
  y: number
  size: number
  weight: number
  color: string
  ls?: string
  ty?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}
/** textfit best 그대로: position:absolute; line-height:1; left·top (정수 + 소수 translate), translateY(±0.25px) */
function T({ x, y, size, weight, color, ls = '0em', ty = 0, className, style, children }: TextProps) {
  return (
    <span
      className={'woori-home__t' + (className ? ' ' + className : '')}
      style={{ ...wooriPlace(x, y), fontSize: size, fontWeight: weight, letterSpacing: ls, color, transform: ty ? `translateY(${ty}px)` : undefined, ...style }}
    >
      {children}
    </span>
  )
}

/** 그림: 정수 상자 + 소수는 transform (assets.json css 그대로) */
function Art({ name, x, y, w, h, transform, className, style }: { name: WooriArtName; x: number; y: number; w: number; h: number; transform?: string; className?: string; style?: CSSProperties }) {
  return (
    <img
      className={'woori-home__art' + (className ? ' ' + className : '')}
      src={artSrc(name)}
      alt=""
      draggable={false}
      style={{ left: x, top: y, width: w, height: h, transform, transformOrigin: transform ? '0 0' : undefined, ...style }}
    />
  )
}

function Box({ x, y, w, h, className, style, children }: { x: number; y: number; w: number; h: number; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={'woori-home__box' + (className ? ' ' + className : '')} style={{ ...wooriPlace(x, y), width: w, height: h, ...style }}>
      {children}
    </div>
  )
}

/* ───────────────────────── 잔액 오도미터 (3.5) ───────────────────────── */

const ODO = {
  /** 첫 진입 (딤 뒤): 시작 숫자 2, 열 시작 위치 */
  v1: { start: 2, p0: [0, 0.148, 0.148] },
  /** 돌아온 홈: 시작 숫자 5 */
  v2: { start: 5, p0: [-0.123, 0.246, 0.246] },
} as const
/** 숫자 줄 피치 28dp (line-height), 창 = 518.667–546.667 (글자 top 522 = 창 + 3.333) */
const ODO_PITCH = 28

function Balance({ amount, mode, odo, onRolled }: { amount: number; mode: BalanceMode; odo: 'v1' | 'v2'; onRolled?: () => void }) {
  const text = amount.toLocaleString('ko-KR')
  if (mode === 'none') return null
  const won = (
    <span className="woori-home__won-unit" style={{ letterSpacing: '0em', color: '#212022' }}>
      원
    </span>
  )
  if (mode === 'unit') {
    // 숫자 없이 "원"만 (loading-balance-unit · loading-account-no-balance): 잉크 x 179px = 122.8dp 자리
    return (
      <span className="woori-home__balance" style={{ ...wooriPlace(106.813, 103.667), fontSize: 20, fontWeight: 700 }}>
        {won}
      </span>
    )
  }
  if (mode === 'final') {
    return (
      <span className="woori-home__balance" style={{ ...wooriPlace(67.891, 103.667), fontSize: 20, fontWeight: 700 }}>
        <span style={{ letterSpacing: '-0.025em', color: '#201f22' }}>{text}</span>
        <span style={{ marginLeft: 1.952 }}>{won}</span>
      </span>
    )
  }
  // 굴림: 숫자 열마다 0–9 띠, 같은 진행률 E (md-decelerate 620ms), 칸 수 = 한 바퀴 + (목표 − 시작)
  const cfg = ODO[odo]
  const chars = [...text]
  let col = 0
  return (
    <span className="woori-home__balance woori-home__balance--roll" style={{ ...wooriPlace(68, 100.334), fontSize: 20, fontWeight: 700 }}>
      {chars.map((ch, i) => {
        if (!/\d/.test(ch)) {
          return (
            <span key={i} className="woori-home__odo-static">
              {ch}
            </span>
          )
        }
        const c = col++
        const target = Number(ch)
        const n = 10 + target - cfg.start
        const p0 = cfg.p0[Math.min(c, cfg.p0.length - 1)]
        const digits = Array.from({ length: n + 1 }, (_, k) => (cfg.start + k) % 10)
        const vars = {
          '--odo-from': `${-p0 * ODO_PITCH}px`,
          '--odo-to': `${-n * ODO_PITCH}px`,
        } as CSSProperties
        return (
          <span key={i} className="woori-home__odo-col">
            <span
              className={'woori-home__odo-strip' + (mode === 'roll' ? ' is-rolling' : '')}
              style={vars}
              // 굴림(620ms)이 끝날 때만 — 같이 도는 페이드(460ms)가 먼저 끝나므로 이름으로 가린다 (영상: 끝까지 굴러 자리잡음, 3.5 v1 표)
              onAnimationEnd={c === 0 ? (e) => e.animationName === 'woori-home-odo-roll' && onRolled?.() : undefined}
            >
              {digits.map((d, k) => (
                <span key={k} className="woori-home__odo-digit">
                  {d}
                </span>
              ))}
            </span>
          </span>
        )
      })}
      <span className="woori-home__odo-static" style={{ marginLeft: 1.952 }}>
        {won}
      </span>
    </span>
  )
}

/* ───────────────────────── 중간 배너 줄 (2.7 · 3.12–3.14) ───────────────────────── */

interface BannerAnim {
  id: number
  from: number
}

function BannerCard({ b, x, showImage }: { b: BannerSpec; x: number; showImage: boolean }) {
  return (
    <div className="woori-home__banner-card" style={{ left: x, background: b.bg }}>
      {showImage && <Art name={b.img} x={184} y={0} w={144} h={120} />}
      {b.character && <Art name={b.character} x={224} y={30} w={72} h={58} />}
      {b.lines.map((l) => (
        <T key={l.text} x={24} y={l.top} size={l.size} weight={l.weight} ls={l.ls} color={l.color}>
          {l.text}
        </T>
      ))}
    </div>
  )
}

function BannerStrip({
  top,
  index,
  anim,
  showImage,
  paused,
  onNext,
  onPrev,
  onPause,
  onAnimEnd,
  onDrag,
  dragDx,
}: {
  top: number
  index: number
  anim: BannerAnim | null
  showImage: boolean
  paused: boolean
  onNext: () => void
  onPrev: () => void
  onPause: () => void
  onAnimEnd: () => void
  onDrag: (dx: number | null, release?: boolean) => void
  dragDx: number
}) {
  const at = (k: number) => BANNERS[(k + 10) % 10]
  const start = useRef<{ x: number; id: number } | null>(null)
  const cards = [-1, 0, 1].map((o) => ({ o, b: at(index + o) }))
  const trackStyle = {
    '--banner-from': `${anim?.from ?? 0}px`,
    transform: dragDx ? `translateX(${dragDx}px)` : undefined,
  } as CSSProperties
  return (
    <div
      className="woori-home__banner"
      style={wooriPlace(0, top)}
      onPointerDown={(e) => {
        start.current = { x: e.clientX / wooriFitScale(), id: e.pointerId }
      }}
      onPointerMove={(e) => {
        if (start.current && start.current.id === e.pointerId) onDrag(e.clientX / wooriFitScale() - start.current.x)
      }}
      onPointerUp={(e) => {
        if (start.current) onDrag(e.clientX / wooriFitScale() - start.current.x, true)
        start.current = null
      }}
      onPointerCancel={() => {
        start.current = null
        onDrag(null, true)
      }}
    >
      <div
        key={anim?.id ?? 0}
        className={'woori-home__banner-track' + (anim ? ' is-moving' : '')}
        style={trackStyle}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) onAnimEnd()
        }}
      >
        {cards.map(({ o, b }) => (
          <BannerCard key={o} b={b} x={16 + 348 * o} showImage={showImage} />
        ))}
      </div>
      {/* 카운터 알약·⏸ 는 고정 오버레이 (카드가 넘어가도 제자리) */}
      <div className="woori-home__banner-pill" style={wooriPlace(214.333, 88)}>
        <button type="button" className="woori-home__icon-btn" style={wooriPlace(5.667, 4)} aria-label="이전 배너" onClick={onPrev}>
          <img src={artSrc('home.counter-prev')} alt="" width={12} height={12} />
        </button>
        <span className="woori-home__banner-count">
          {index + 1 < 10 ? (
            <>
              <T x={25.417} y={4.333} size={11.5} weight={500} ls="-0.03em" color="#4f4f52">
                {index + 1}
              </T>
              <T x={37.245} y={5.333} size={10.75} weight={500} ls="0.035em" color="#747376">
                /
              </T>
              <T x={45.745} y={4.333} size={11} weight={500} ls="-0.005em" color="#6d6c6f">
                10
              </T>
            </>
          ) : (
            <span className="woori-home__banner-count10">
              <span style={{ color: '#4f4f52' }}>10</span>
              <span style={{ color: '#747376', fontSize: 10.75, letterSpacing: '0.035em', margin: '0 4.5px' }}>/</span>
              <span style={{ color: '#6d6c6f' }}>10</span>
            </span>
          )}
        </span>
        <button type="button" className="woori-home__icon-btn" style={wooriPlace(65.667, 4)} aria-label="다음 배너" onClick={onNext}>
          <img src={artSrc('home.counter-next')} alt="" width={12} height={12} />
        </button>
      </div>
      <button type="button" className="woori-home__banner-pause" style={wooriPlace(308, 88)} aria-label={paused ? '자동 넘김 재생' : '자동 넘김 멈춤'} onClick={onPause}>
        {paused ? <span className="woori-home__play" /> : <img src={artSrc('home.counter-pause')} alt="" width={12} height={12} />}
      </button>
    </div>
  )
}

/** wooriScrollTo + 실측 보정: 내용 상자의 실제 자리(셸 기준)를 재서 원하는 dp 와의 차를 나머지 변수로 옮긴다 (프레임 모드만) */
function scrollToExact(el: HTMLElement, want: number) {
  wooriScrollTo(el, want)
  const content = el.firstElementChild as HTMLElement | null
  if (!content || !isFrameMode()) return
  el.style.removeProperty('--woori-scroll-residual')
  const fy = parseFloat(el.style.getPropertyValue('--woori-fix-y')) || 0
  const actual = el.getBoundingClientRect().top - content.getBoundingClientRect().top - fy
  // 그릴 때는 스크롤 위치가 정수 기기 화소로 반올림된다 (frontend/README 렌더 규칙 3) → 그 위치 기준으로 나머지를 잡는다
  const k = window.devicePixelRatio || 1
  const painted = Math.round(actual * k) / k
  const r = Math.round((want - painted) * 10000) / 10000
  if (Math.abs(r) > 1e-3) el.style.setProperty('--woori-scroll-residual', `${r}px`)
}

/* ───────────────────────── 오버레이 스크롤바 (3.18) ───────────────────────── */

/** 트랙 = 스크롤 상자 위아래 10dp 안쪽 (영상 셸: 상자 0–740.667 → 트랙 10–730.667) */
const SB_TRACK_TOP = 10
const SCROLL_VIEW = 740.667

/* ───────────────────────── AI 아이콘 전역 시계 (3.8) ───────────────────────── */

const AI_PERIOD_MS = 7982
const AI_EPOCH_KEY = 'woori.home.aiEpoch'
function aiEpoch(): number {
  try {
    const v = Number(sessionStorage.getItem(AI_EPOCH_KEY))
    if (v > 0) return v
    const now = Date.now()
    sessionStorage.setItem(AI_EPOCH_KEY, String(now))
    return now
  } catch {
    return 0
  }
}

/* ───────────────────────── 세션 보관 (떠날 때 모습) ───────────────────────── */

const ENTRY_KEY = 'woori.home.entry'
const CACHE_KEY = 'woori.home.cache'
interface HomeCache {
  scroll: number
  banner: number
}
function readCache(): HomeCache | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null') as HomeCache | null
    return v && typeof v.scroll === 'number' ? v : null
  } catch {
    return null
  }
}
function writeCache(c: HomeCache) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* 저장 못 함 */
  }
}
/** 인증서 → 홈 첫 진입인가 (WooriCert 가 'login' 을 남긴다). 지우는 것은 마운트 뒤 effect 에서 */
function readFirstEntry(): boolean {
  try {
    return sessionStorage.getItem(ENTRY_KEY) === 'login'
  } catch {
    return false
  }
}
/** 첫 진입 표시와 지난 로그인의 떠날 때 모습을 함께 지운다 (첫 진입 중 새로고침해도 옛 스크롤로 열리지 않게) */
function clearFirstEntry() {
  try {
    sessionStorage.removeItem(ENTRY_KEY)
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    /* 없음 */
  }
}

/* ───────────────────────── 팝업 '오늘은 그만 보기' (설계 — 실제 앱만) ───────────────────────── */

const POPUP_HIDE_KEY = 'woori.popup.home'
/** 오늘 날짜 'YYYY-MM-DD' (서울 기준 — 기기 시간대와 상관없이 한국 하루로 센다) */
function seoulToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}
/** 오늘 '오늘은 그만 보기' 를 눌렀나. 프레임·shot 모드는 늘 false (영상의 첫 진입은 팝업이 뜬다) */
function popupHiddenToday(): boolean {
  if (!wooriLiveApp()) return false
  try {
    return localStorage.getItem(POPUP_HIDE_KEY) === seoulToday()
  } catch {
    return false
  }
}
function hidePopupToday() {
  if (!wooriLiveApp()) return
  try {
    localStorage.setItem(POPUP_HIDE_KEY, seoulToday())
  } catch {
    /* 저장 못 함 — 이번만 닫힌다 */
  }
}

/* ───────────────────────── 화면 ───────────────────────── */

/** 프레임 띠 (OS 상태바·내비 바): 홈·로그인 로딩 #eff0f3, 첫 진입 11.471–13.016 내비 검정 (3.7) */
const BANDS_HOME = { statusbar: '#eff0f3', navbar: '#eff0f3' }
const BANDS_NAV_BLACK = { statusbar: '#eff0f3', navbar: '#000000' }

export default function WooriHome() {
  const shot = useShotState('home', HOME_SHOTS)
  const go = useWooriNavigate()
  const [first] = useState(() => (shot ? false : readFirstEntry()))
  useEffect(() => {
    if (first) clearFirstEntry()
  }, [first])
  // 첫 진입은 떠날 때 모습을 보지 않는다 (맨 위·배너 1 에서 3.1 단계부터)
  const [cache] = useState(() => (shot || first ? null : readCache()))
  const stage = useWooriStages(FIRST_STAGES_MS, { start: first, shotStage: first ? null : FIRST_STAGES_MS.length })
  // '오늘은 그만 보기' 를 누른 날은 팝업 단계를 건너뛴다 (팝업 몫의 내비 검정도 함께 — navBlack)
  const [popupDone, setPopupDone] = useState(() => first && popupHiddenToday())
  const [popupPressed, setPopupPressed] = useState(false)
  const [popupClosing, setPopupClosing] = useState(false)
  const [rolled, setRolled] = useState(false)
  const [tapSpinner, setTapSpinner] = useState(false)
  // shot 'popup-close': 열린 시트를 그린 뒤 한 프레임 뒤에 닫아 closing 단계를 만든다 (애니메이션은 freeze 가 0 위상에 세운다)
  const [shotClosing, setShotClosing] = useState(false)
  useEffect(() => {
    if (shot?.state.view.popup !== 'closing') return
    const id = requestAnimationFrame(() => setShotClosing(true))
    return () => cancelAnimationFrame(id)
  }, [shot])

  // 지금 모습
  let view: View
  if (shot) view = shot.state.view
  else if (first) {
    view = firstEntryView(stage)
    if (popupDone) view = { ...view, popup: 'none' }
    else if (popupClosing) view = { ...view, popup: 'closing' }
    else if (popupPressed && view.popup !== 'none') view = { ...view, popup: 'pressed' }
    if (view.balance === 'roll' && rolled) view = { ...view, balance: 'final' }
  } else view = READY
  if (tapSpinner) view = { ...view, spinner: true }

  // 계좌 (API)
  const [account, setAccount] = useState<Account | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    const ac = new AbortController()
    wooriApi
      .getAccounts(ac.signal)
      .then((list) => setAccount(list[0] ?? null))
      .catch((e: unknown) => {
        if (!ac.signal.aborted) setLoadError(e instanceof Error ? e.message : String(e))
      })
    return () => ac.abort()
  }, [])

  // 띠 색: 홈·로그인 로딩 #eff0f3 (OS). 팝업 동안 내비 검정은 WooriSheet 가 바란다
  const navBlack = shot?.state.navbarBlack || view.popup !== 'none' || (first && stage >= 14 && !popupDone)
  useWooriBands(navBlack ? BANDS_NAV_BLACK : BANDS_HOME)

  // 배너
  const [banner, setBanner] = useState(() => (shot?.state.banner ?? cache?.banner ?? 1) - 1)
  const [bannerAnim, setBannerAnim] = useState<BannerAnim | null>(() => (shot?.state.bannerFrom != null ? { id: 1, from: shot.state.bannerFrom } : null))
  const [dragDx, setDragDx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [autoKick, setAutoKick] = useState(0)
  const animId = useRef(1)
  const step = useCallback((dir: 1 | -1, fromDx = 0) => {
    setBanner((b) => (b + dir + 10) % 10)
    animId.current += 1
    setBannerAnim({ id: animId.current, from: dir * 348 + fromDx })
  }, [])
  // 자동 넘김: 앞 넘김이 끝난 뒤 3.0s (Swiper autoplay delay 3000 · speed 300)
  const bannerVisible = view.banner && view.page === 'home'
  useEffect(() => {
    if (shot || !bannerVisible || paused || bannerAnim || dragDx) return
    const id = window.setTimeout(() => step(1), 3000)
    return () => window.clearTimeout(id)
  }, [shot, bannerVisible, paused, bannerAnim, dragDx, step, autoKick])

  // 스크롤
  const scrollRef = useRef<HTMLDivElement>(null)
  useWooriScrollFix(scrollRef)
  const [scrollTop, setScrollTop] = useState(shot?.state.scroll ?? cache?.scroll ?? 0)
  const [sb, setSb] = useState<'hidden' | 'shown' | 'fading'>(shot?.state.scrollbar ? 'shown' : 'hidden')
  const sbTimer = useRef(0)
  // 스크롤 상자 높이: 영상 셸 740.667. 실제 앱은 셸 높이가 폰마다 달라(640–900) 스크롤할 때 잰 값으로 스크롤바 트랙을 맞춘다
  const [viewH, setViewH] = useState(SCROLL_VIEW)

  // 레이아웃 (page y, 2.1·2.5 — 보이는 블록에 따라 아래가 붙는다)
  const lay = useMemo(() => {
    const otherH = view.otherBank === 'full' ? 154 : view.otherBank === 'nologos' ? 122 : 0
    const accTop = otherH ? 252 + otherH + 12.333 : 252
    let accBottom = accTop
    let wonTop: number | null = null
    let skelTop: number | null = null
    let skelBlocks = 0
    if (view.account === 'won' || view.account === 'won-skeleton') {
      wonTop = accTop
      accBottom = accTop + (view.strip ? 180.333 : 146.667)
      if (view.account === 'won-skeleton') {
        skelTop = accBottom + 12
        skelBlocks = 1
        accBottom = skelTop + 123.333
      }
    } else if (view.account === 'skeleton') {
      skelTop = accTop + 12.333
      skelBlocks = 2
      accBottom = skelTop + 259.333
    }
    const allTop = view.account === 'none' ? 281 : accBottom + 12
    const bannerTop = allTop + 88
    const recHead = (view.banner ? bannerTop + 120 : allTop + 48) + 44.333
    const recCard = recHead + 35.667
    const grpHead = recCard + 235 + 43.333
    const marquee = grpHead + 44.333
    const notice = marquee + 164 + 48.333
    const end = notice + 60 + 68
    const panelEnd = view.account === 'none' ? allTop - 12 : accBottom
    return { otherH, wonTop, skelTop, skelBlocks, allTop, bannerTop, recHead, recCard, grpHead, marquee, notice, end, panelEnd }
  }, [view.otherBank, view.account, view.strip, view.banner])

  // 바탕 그라데이션 (2.1 표: 위쪽은 고정, 아래쪽 흰색으로 바뀌는 곳은 계좌 묶음 끝을 따른다)
  const panelBg = useMemo(() => {
    const e = lay.panelEnd
    const st = (c: string, y: number) => `${c} ${Math.round(y * 1000) / 1000}px`
    return `linear-gradient(180deg, ${[
      st('#eff0f3', 71.8),
      st('#eaf1f7', 97.9),
      st('#e9f3fb', 111.7),
      st('#e3f1fd', 124),
      st('#e2effd', 219.2),
      st('#d9e8f6', 219.4),
      st('#d9e8f6', 223.1),
      st('#dcecf8', 233.4),
      st('#dfeefc', 247.8),
      st('#e2f0fc', 258.8),
      st('#e3f1fd', 269.8),
      st('#e3f1fd', Math.max(270, e - 48.4)),
      st('#e9f5fe', Math.max(271, e - 22.3)),
      st('#eff7fe', Math.max(272, e + 6.6)),
      st('#f6fafe', Math.max(273, e + 31.4)),
      st('#fafafd', Math.max(274, e + 56.1)),
      st('#ffffff', Math.max(275, e + 64.3)),
    ].join(', ')})`
  }, [lay.panelEnd])

  const contentH = Math.round(lay.end * 1000) / 1000
  const maxScroll = Math.max(0, contentH - viewH)
  const sbTrack = viewH - 2 * SB_TRACK_TOP
  const sbLen = (sbTrack * viewH) / contentH
  const sbTop = SB_TRACK_TOP + (maxScroll ? ((sbTrack - sbLen) * Math.min(scrollTop, maxScroll)) / maxScroll : 0)

  // shot·돌아옴 스크롤 위치: 둔 뒤 실제 위치를 재서 남는 소수를 --woori-scroll-residual 로 (이 상자는 정수 CSS px 로 저장되는 경우가 있다)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || view.page !== 'home') return
    const want = shot?.state.scroll ?? cache?.scroll ?? 0
    if (want) scrollToExact(el, want)
  }, [shot, cache, view.page])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setScrollTop(el.scrollTop)
    if (shot) return
    if (wooriLiveApp()) setViewH(el.clientHeight)
    setSb('shown')
    window.clearTimeout(sbTimer.current)
    sbTimer.current = window.setTimeout(() => setSb('fading'), 390)
  }
  useEffect(() => () => window.clearTimeout(sbTimer.current), [])

  // 떠날 때 모습 보관
  const bannerRef = useRef(banner)
  const scrollTopRef = useRef(scrollTop)
  useEffect(() => {
    bannerRef.current = banner
    scrollTopRef.current = scrollTop
  }, [banner, scrollTop])
  useEffect(() => {
    if (shot) return
    return () => writeCache({ scroll: scrollTopRef.current, banner: bannerRef.current + 1 })
  }, [shot])

  // shot: t 위상을 고르는 상태는 애니메이션을 처음 위상에 세운다 (playbackRate 0 — shot.cjs 가 t 로 옮긴다)
  const rootRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!shot?.state.freeze) return
    const root = rootRef.current?.closest('.woori-layer__page') ?? document
    const freeze = () => {
      for (const a of (root as Element | Document).getAnimations({ subtree: true } as GetAnimationsOptions)) {
        if (a.playbackRate !== 0) {
          a.currentTime = 0
          a.playbackRate = 0
        }
      }
    }
    freeze()
    const id = requestAnimationFrame(freeze)
    return () => cancelAnimationFrame(id)
  })

  // 계좌 탭 → 홈 위 스피너 643ms → 거래내역 (3.11). 그새 홈이 내려가면 타이머를 지운다 (묵은 이동이 다음 화면에서 거래내역으로 보내지 않게)
  const tapTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(tapTimer.current), [])
  const onAccountTap = () => {
    if (tapSpinner || shot) return
    setTapSpinner(true)
    tapTimer.current = window.setTimeout(() => go('/history?type=all'), 643)
  }

  // 영상에 없는 곳 누름 → 토스트 (실제 앱만). 배너는 끌어 넘긴 직후의 click 은 빼다
  const swipedAt = useRef(-Infinity)
  const onTodoCapture = (e: ReactMouseEvent) => {
    // 계좌 탭 스피너 동안은 다른 누름(종·이체·탭바 …)을 받지 않는다 — 곧 거래내역으로 간다
    if (tapSpinner) {
      e.stopPropagation()
      return
    }
    if (shot || !wooriLiveApp()) return
    const hit = homeTapKind(e.clientX, e.clientY)
    if (hit === 'banner' && performance.now() - swipedAt.current < 400) return
    if (hit === 'todo-stop') e.stopPropagation()
    if (hit === 'todo' || hit === 'todo-stop' || hit === 'banner') wooriTodo()
  }
  const onTab = (tab: WooriTab) => {
    if (tab !== 'home') return wooriTodo()
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 팝업 [닫기] (3.6): 누르는 동안 회색, 떼면 25ms 뒤 linear 160ms
  const closePopup = () => {
    setPopupPressed(false)
    window.setTimeout(() => setPopupClosing(true), 25)
  }

  // shot 준비: 데이터(홈 내용이 보이는 상태) · 그림
  const needData = view.page === 'home' && view.account !== 'none' && view.account !== 'skeleton'
  useShotReady(shot != null && (!needData || account != null || loadError != null) && (shot.state.view.popup !== 'closing' || shotClosing))

  // AI 아이콘
  const [aiDelay] = useState(() => (shot ? 0 : -((Date.now() - aiEpoch()) % AI_PERIOD_MS)))
  const aiMode = shot ? (shot.state.ai ?? 'ai') : 'cycle'

  const balance = account?.balance ?? 0
  const odo = shot?.state.odo ?? (first ? 'v1' : 'v2')

  const white = view.page === 'white'
  return (
    <div ref={rootRef} className={'woori-home' + (white ? ' woori-home--white' : '')} onClickCapture={onTodoCapture}>
      {/* 스크롤 상자 */}
      {view.page === 'home' && (
        <div ref={scrollRef} className="woori-home__scroll woori-scroll-fix" onScroll={onScroll}>
          <div className="woori-home__content woori-scroll-fix__content" style={{ height: contentH, background: view.layout1 ? panelBg : '#eff0f3' }}>
            {/* 공지 카드 줄 (가로 캐러셀 1/5) */}
            {view.notice !== 'none' && (
              <div className="woori-home__notice-clip">
                <div className={'woori-home__notice-track' + (view.noticeSettle && !shot ? ' is-settling' : '')} style={{ transform: view.noticeSettle && !shot ? undefined : view.noticeDx ? `translateX(${view.noticeDx}px)` : undefined }}>
                  <div className="woori-home__notice-card" style={{ left: 16 }}>
                    {view.notice === 'full' && (
                      <>
                        <div className="woori-home__notice-tile" />
                        <Art name="home.notice-bell" x={24} y={24} w={24} h={24} />
                        <Art name="home.close-x-small" x={300} y={12} w={16} h={16} />
                      </>
                    )}
                    {view.notice !== 'card' && (
                      <>
                        <T x={67.953} y={18} size={15} weight={600} color="#363639" ty={0.25}>
                          이번 행운은 내차례일지도..
                        </T>
                        <T x={68.047} y={40} size={15} weight={600} color="#363639">
                          우리두근두근행운적금 만나러가기
                        </T>
                      </>
                    )}
                  </div>
                  {view.notice === 'full' && <div className="woori-home__notice-card" style={{ left: 16 + 344 }} />}
                </div>
              </div>
            )}
            {view.character && (
              <>
                <Art name="home.home-character-room" x={49} y={130} w={252} h={110} transform="translate(0.6735px, 0.9167px) scale(1.001569, 1)" />
                <Art name="home.home-character-banner" x={122} y={154} w={150} h={87} className="woori-home__character" />
              </>
            )}
            {view.notice !== 'none' && view.notice !== 'card' && (
              <div className="woori-home__dots" aria-hidden>
                <i className="is-on" />
                <i style={{ left: 22 }} />
                <i style={{ left: 34 }} />
                <i style={{ left: 46 }} />
                <i style={{ left: 58 }} />
              </div>
            )}
            {view.layout1 && (
              <>
                <Box x={16} y={211.667} w={94} h={24} className="woori-home__chip" />
                <Art name="home.gear" x={24} y={215} w={16} h={16} style={{ translate: '0 0.667px' }} />
                <T x={43.938} y={217} size={13} weight={600} color="#6b6f75" ty={0.25}>
                  홈계좌설정
                </T>
                <Box x={250} y={211.667} w={94} h={24} className="woori-home__chip" />
                <T x={260.078} y={217} size={13} weight={600} color="#6c6d73" ty={0.25}>
                  잔액숨김
                </T>
                <Box x={309} y={215} w={26.667} h={16} className="woori-home__toggle">
                  <i />
                </Box>
              </>
            )}

            {/* 다른 은행 계좌 카드 */}
            {view.otherBank !== 'none' && (
              <div className="woori-home__card" style={{ left: 16, top: 252, width: 328, height: lay.otherH }}>
                {view.otherBank === 'full' && <Art name="home.other-bank-logos" x={99} y={15} w={129} h={36} transform="translate(0.5157px, 0.0417px) scale(0.999543, 0.993056)" />}
                <Art name="home.close-x-small" x={300} y={12} w={16} h={16} />
                <div style={{ position: 'absolute', inset: 0, top: view.otherBank === 'full' ? 0 : -32 }}>
                  <T x={42.813} y={59} size={15} weight={500} color="#4c4d4f" ty={0.25}>
                    다른 은행 계좌도 홈에서 확인할 수 있어요
                  </T>
                  <T x={65.922} y={81} size={15} weight={500} color="#4b4d4f">
                    필요한 계좌를 홈에 추가해 보세요
                  </T>
                  <Box x={96.667} y={106} w={134.667} h={32.333} className="woori-home__add-btn" />
                  <T x={108.719} y={115} size={13} weight={600} color="#ffffff" ty={0.25}>
                    + 다른 은행 계좌 추가
                  </T>
                </div>
              </div>
            )}

            {/* WON 통장 카드 (파란 띠를 품은 바탕 + 흰 카드) */}
            {lay.wonTop != null && (
              <div
                className={'woori-home__won' + (view.strip ? ' has-strip' : '')}
                style={{ ...wooriPlace(16, lay.wonTop), height: view.strip ? 180.333 : 146.667 }}
                role="button"
                tabIndex={0}
                onClick={onAccountTap}
              >
                <div className="woori-home__won-card" style={{ height: view.strip ? 144.333 : 146.667 }}>
                  {view.wonLogo && <Art name="home.woori-logo-40" x={14} y={17} w={43} h={43} transform="translate(0.4695px, 0.1459px) scale(0.988909, 0.991279)" />}
                  <T x={68.031} y={19.667} size={16} weight={600} color="#343539" ty={-0.25}>
                    {account?.product ?? 'WON 통장'}
                  </T>
                  {account && (
                    <span className="woori-home__won-acct" style={wooriPlace(67.984, 44.667)}>
                      <span>
                        {account.bankShort} {account.number}
                      </span>
                      {view.wonUnit && (
                        <img
                          src={artSrc('home.copy')}
                          alt="계좌번호 복사"
                          role="button"
                          width={16}
                          height={16}
                          onClick={(e) => {
                            // 실제 앱만 (프레임 모드는 예전처럼 카드 탭으로 번진다)
                            if (!wooriLiveApp()) return
                            e.stopPropagation()
                            wooriCopy(account.number)
                          }}
                        />
                      )}
                    </span>
                  )}
                  {view.wonUnit && <Art name="home.kebab" x={296} y={14} w={24} h={24} className="woori-home__kebab" />}
                  {account?.badge && (
                    <>
                      <Box x={68} y={70.334} w={53.333} h={20} className="woori-home__limit-chip" />
                      <T x={74.031} y={74.667} size={12} weight={600} color="#46484b">
                        {account.badge}
                      </T>
                    </>
                  )}
                  {account && <Balance amount={balance} mode={view.balance} odo={odo} onRolled={() => setRolled(true)} />}
                  <button
                    type="button"
                    className="woori-home__transfer"
                    style={wooriPlace(264, 98.334)}
                    onClick={(e) => {
                      e.stopPropagation()
                      go('/send')
                    }}
                  >
                    <T x={11.484} y={8.333} size={13} weight={600} color="#494b4e">
                      이체
                    </T>
                  </button>
                </div>
                {view.strip && (
                  <>
                    <Art name="home.strip-arrow" x={34} y={154} w={16} h={16} style={{ translate: '0 0.334px' }} />
                    <T x={60} y={156.667} size={12} weight={600} ls="-0.025em" color="#ffffff">
                      첫 급여받으면 NpayP 100% 드림
                    </T>
                  </>
                )}
              </div>
            )}

            {/* 계좌 자리 스켈레톤 (2.3 loading-render) */}
            {lay.skelTop != null && (
              <div className="woori-home__card" style={{ ...wooriPlace(16, lay.skelTop), width: 328, height: lay.skelBlocks === 2 ? 259.333 : 123.333 }}>
                {Array.from({ length: lay.skelBlocks }, (_, i) => (
                  <div key={i} style={{ position: 'absolute', left: 0, top: 136 * i, width: 328, height: 136 }}>
                    <Box x={20} y={19.417} w={39.85} h={40} className="woori-home__skel woori-home__skel--sq" />
                    <Box x={76} y={19.667} w={112} h={16} className="woori-home__skel" />
                    <Box x={76.333} y={44} w={151.85} h={13.6} className="woori-home__skel" />
                    <Box x={76} y={81.667} w={127.8} h={22} className="woori-home__skel" />
                  </div>
                ))}
              </div>
            )}

            {/* 전체계좌보기 */}
            {view.layout1 && (
              <div className="woori-home__all" style={wooriPlace(16, lay.allTop)}>
                <T x={119.953} y={15.333} size={17} weight={600} color="#494a4e" ty={0.25}>
                  전체계좌보기
                </T>
              </div>
            )}

            {/* 중간 배너 */}
            {view.banner && (
              <BannerStrip
                top={lay.bannerTop}
                index={banner}
                anim={bannerAnim}
                showImage={view.bannerImg}
                paused={paused}
                dragDx={dragDx}
                onNext={() => step(1)}
                onPrev={() => step(-1)}
                onPause={() => {
                  setPaused((p) => !p)
                  setAutoKick((k) => k + 1)
                }}
                onAnimEnd={() => setBannerAnim(null)}
                onDrag={(dx, release) => {
                  if (shot) return
                  if (!release) {
                    if (dx != null && Math.abs(dx) > 4) setDragDx(dx)
                    return
                  }
                  const d = dx ?? 0
                  setDragDx(0)
                  if (Math.abs(d) > 12) {
                    swipedAt.current = performance.now()
                    step(d < 0 ? 1 : -1, d)
                  }
                }}
              />
            )}

            {/* 추천서비스 */}
            {view.layout1 && (
              <T x={15.984} y={lay.recHead} size={17} weight={600} color="#353538" ty={-0.25}>
                추천서비스
              </T>
            )}
            {view.recCards && (
              <div className="woori-home__rec" style={wooriPlace(0, lay.recCard)}>
                <div className="woori-home__rec-track">
                  <div className="woori-home__rec-card" style={{ left: 16, background: '#f7ebfb' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="woori-home__rec-circle" style={{ top: 21 + 73 * i }} />
                    ))}
                    {view.recIcons && (
                      <>
                        <Art name="home.svc-won-mobile" x={26} y={27} w={27} h={34} transform="translate(0.129px, 0.1247px) scale(0.990681, 1.011029)" />
                        <Art name="home.svc-exchange-pocket" x={22} y={103} w={36} h={28} transform="translate(0.6998px, 0.4372px) scale(0.990683, 1.006696)" />
                        <Art name="home.svc-won-wallet" x={25} y={177} w={30} h={28} transform="translate(0.4432px, 0px) scale(1.005923, 0.982143)" />
                      </>
                    )}
                    <T x={72} y={27.333} size={16} weight={600} color="#36303f">
                      우리WON모바일
                    </T>
                    <T x={71.953} y={49.333} size={13} weight={400} color="#877e8e" ty={0.25}>
                      우리은행이 만든 알뜰한 통신
                    </T>
                    <T x={71.969} y={100.333} size={16} weight={600} color="#37303f">
                      환전주머니
                    </T>
                    <T x={71.984} y={122.333} size={13} weight={400} color="#89808f" ty={0.25}>
                      여행 환전을 손쉽게 준비하기
                    </T>
                    <T x={71.969} y={173.333} size={16} weight={600} color="#372f3f" ty={-0.25}>
                      우리WON지갑
                    </T>
                    <T x={71.969} y={196.333} size={13} weight={400} color="#887f8f">
                      국민비서 등 유용한 생활 서비스
                    </T>
                  </div>
                  <div className="woori-home__rec-card" style={{ left: 320, background: '#e2ecfe' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="woori-home__rec-circle" style={{ top: 21 + 73 * i }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 우리금융그룹 서비스 (마키) */}
            {view.layout1 && (
              <>
                <T x={15.969} y={lay.grpHead} size={17} weight={600} color="#36363a">
                  우리금융그룹 서비스
                </T>
                <div className="woori-home__marquee" style={wooriPlace(0, lay.marquee - 8)}>
                  <div className="woori-home__marquee-track">
                    {[...MARQUEE_CARDS, ...MARQUEE_CARDS, ...MARQUEE_CARDS].map((c, i) => (
                      <div key={i} className={'woori-home__mq-card' + (i % 2 ? ' is-odd' : '')} style={{ left: 16 + 152 * i }}>
                        <span className="woori-home__mq-title" style={{ color: c.color }}>
                          {c.title}
                        </span>
                        <span className="woori-home__mq-line" style={{ top: 51 }}>
                          {c.lines[0]}
                        </span>
                        <span className="woori-home__mq-line" style={{ top: 73 }}>
                          {c.lines[1]}
                        </span>
                        {c.icon === 'home.grp-capital-car' && <Art name={c.icon} x={73} y={97} w={48} h={30} />}
                        {c.icon === 'home.grp-securities-chart' && <Art name={c.icon} x={83} y={97} w={38} h={30} />}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 공지 줄 */}
            {view.recCards && (
              <div className="woori-home__notice-line" style={wooriPlace(16, lay.notice)}>
                <div className="woori-home__notice-chip" style={wooriPlace(21, 18.666)}>
                  <T x={5.969} y={3.667} size={12} weight={600} ls="0.0025em" color="#f6fbff">
                    공지
                  </T>
                </div>
                <T x={61.719} y={23.333} size={14} weight={400} color="#535354" className="woori-home__ellipsis">
                  현금카드 및 모바일현금카드 일시중단 안내
                </T>
                <Art name="home.chevron-right" x={296} y={22} w={16} h={16} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 머리 (고정) */}
      {view.header !== 'none' && (
        <header className="woori-home__header">
          <div className="woori-home__mode" role="tablist">
            <span className="woori-home__mode-on" />
            <T x={8.047} y={8} size={13} weight={600} color="#4a4b4e" ty={0.25}>
              일반홈
            </T>
            <T x={53.766} y={8} size={13} weight={600} ls="-0.01em" color="#ffffff" ty={0.25}>
              쉬운
            </T>
          </div>
          {view.header !== 'pill' && (
            <>
              <Art name="home.wallet" x={196} y={14} w={24} h={24} />
              <span className={'woori-home__ai' + (aiMode === 'cycle' ? ' is-cycling' : '')} style={{ '--ai-delay': `${aiDelay}ms` } as CSSProperties}>
                <img src={artSrc('home.ai-chat-bubble')} alt="" />
                {aiMode !== 'lines' && <img className="woori-home__ai-ai" src={artSrc('home.ai-chat-ai')} alt="" />}
                {aiMode !== 'ai' && <img className="woori-home__ai-lines" src={artSrc('home.ai-chat-lines')} alt="" />}
                <span className="woori-home__ai-sparkle">
                  <img src={artSrc('home.ai-chat-sparkle')} alt="" />
                </span>
              </span>
              {view.header === 'full' && (
                <button type="button" className="woori-home__icon-btn woori-home__bell" style={wooriPlace(276, 14)} aria-label="알림" onClick={() => go('/notice')}>
                  <img src={artSrc('home.bell-dot')} alt="" width={24} height={24} draggable={false} />
                </button>
              )}
              <Art name="home.menu" x={316} y={14} w={24} h={24} />
            </>
          )}
        </header>
      )}

      {/* 로그인 로딩 캐릭터 대체 그림 (launch.md 2.3·3.3, character: true) */}
      {view.loader && (
        <div className="woori-home__loader" aria-label="로그인 중">
          <div className="woori-home__loader-hexes" />
          <div className="woori-home__loader-bob">
            <img className="woori-home__loader-wings" src={artSrc('launch.login-loader-wings')} alt="" />
            <img src={artSrc('launch.login-loader-body')} alt="" />
          </div>
        </div>
      )}

      {/* 오버레이 스크롤바 */}
      {view.page === 'home' && sb !== 'hidden' && (
        <div
          className={'woori-home__scrollbar' + (sb === 'fading' ? ' is-fading' : '')}
          style={{ height: sbLen, transform: `translateY(${Math.round(sbTop * 1000) / 1000}px)` }}
          onAnimationEnd={() => setSb('hidden')}
        />
      )}

      <WooriTabBar active="home" onSelect={onTab} />

      {view.spinner && <WooriSpinner at="home" />}

      {loadError && view.page === 'home' && <p className="woori-home__error">{loadError}</p>}

      {/* 프로모션 팝업 (첫 진입만) */}
      <WooriSheet
        open={view.popup === 'opening' || view.popup === 'open' || view.popup === 'pressed' || (view.popup === 'closing' && shot != null && !shotClosing)}
        variant="popup"
        appear={view.popup === 'opening'}
        motion={POPUP_MOTION}
        label="프로모션"
        className="woori-home__popup"
        style={{ height: 236.667 }}
        onClosed={() => setPopupDone(true)}
        onBack={closePopup}
      >
        <T x={19.333} y={59} size={14} weight={500} color="#fcecfe" ty={0.25}>
          해외에서도 놓칠 수 없는 혜택
        </T>
        <T x={19.328} y={85} size={20} weight={600} ls="-0.025em" color="#ffffff">
          가방과 결제는 가볍게!
        </T>
        <T x={19.453} y={113} size={20} weight={600} ls="-0.025em" color="#ffffff">
          포인트 적립은 무겁게!
        </T>
        {view.popupImage && <Art name="home.home-popup-image" x={214} y={34} w={130} h={131} transform="translate(0.965px, 0.4167px) scale(1.002406, 1.002385)" />}
        <div className="woori-home__popup-bar">
          <button
            type="button"
            className="woori-home__popup-btn"
            style={{ left: 0, width: 120 }}
            onClick={() => {
              hidePopupToday()
              closePopup()
            }}
          >
            <T x={15.969} y={15} size={14} weight={500} ls="-0.01em" color="#727274" ty={0.25}>
              오늘은 그만 보기
            </T>
          </button>
          <button
            type="button"
            className="woori-home__popup-btn"
            style={{ left: 300, width: 60 }}
            onPointerDown={() => setPopupPressed(true)}
            onPointerLeave={() => setPopupPressed(false)}
            onClick={closePopup}
          >
            {view.popup === 'pressed' && <Box x={19.95} y={14} w={24.06} h={16.6} className="woori-home__popup-pressed" />}
            <T x={19.938} y={15} size={14} weight={500} color="#737274" ty={0.25}>
              닫기
            </T>
          </button>
        </div>
      </WooriSheet>
    </div>
  )
}

/** 팝업: 열림 easeOutCubic 176ms (시트·딤 같이) · 닫힘 linear 160ms (3.3·3.6) */
const POPUP_MOTION = {
  open: { duration: 176, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', dimDuration: 176, dimEasing: 'cubic-bezier(0.33, 1, 0.68, 1)', dimDelay: 0 },
  close: { duration: 160, easing: 'linear', dimDuration: 160, dimEasing: 'linear', dimDelay: 0 },
}

/* ───────────────────────── 영상에 없는 곳 (실제 앱 토스트) ───────────────────────── */

/** 누르면 '답지에는 없는 화면이에요' 인 자리 (누른 자리 아래 쌓인 요소 중) */
const HOME_TODO = [
  '.woori-home__notice-card',
  '.woori-home__chip',
  '.woori-home__toggle',
  '.woori-home__card',
  '.woori-home__all',
  '.woori-home__rec-card',
  '.woori-home__mq-card',
  '.woori-home__notice-line',
  '.woori-home__mode',
  '.woori-home__ai',
  '.woori-home__header > .woori-home__art',
  '.woori-home__popup',
].join(', ')
/** WON 카드(누르면 거래내역) 안이지만 따로 동작 없는 것: ⋮ (CSS 가 이것만 누를 수 있게 둔다). 복사 아이콘은 자기 onClick (wooriCopy) */
const HOME_TODO_IN_CARD = '.woori-home__kebab'
/** 여기 닿으면 그 아래는 보지 않는다 (머리·탭바·시트가 내용을 덮는다) */
const HOME_STOP = '.woori-home__header, .woori-home__content, .woori-sheet, .woori-tabbar, .woori-home'

type HomeTap = 'none' | 'control' | 'todo' | 'todo-stop' | 'banner'

function homeTapKind(x: number, y: number): HomeTap {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.matches(HOME_TODO_IN_CARD)) return 'todo-stop'
    if (el.matches('button, [role="button"], a, input')) return 'control'
    if (el.matches('.woori-home__banner')) return 'banner'
    if (el.matches(HOME_TODO)) return 'todo'
    if (el.matches(HOME_STOP)) return 'none'
  }
  return 'none'
}
