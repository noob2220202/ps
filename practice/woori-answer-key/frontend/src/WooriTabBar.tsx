// WooriTabBar — 하단 탭바 5칸 (주인: home 그룹. spec/home.md 2.1 표 tabbar · tab_* 가 정본)
//   상품 · 자산·소비 · 홈 · 주식 · 혜택(캐릭터 대체 아이콘 home.tab-benefit — character: true, 비교 마스크 454,1132,36,36).
//   다른 화면(로그인 로딩 등)은 이 컴포넌트만 쓴다.
//
// 놓는 법 (frontend/README '렌더 규칙'): 탭바 면은 앱 740.667–800.667dp (#eff0f3, 위 경계선·그림자 없음).
//   bottom 0 · 높이 60 이면 위끝이 x.667 이라 반올림으로 0.333dp 밀린다 → 상자를 bottom 0 · 높이 60.667(위끝 740.000, 정수)로 두고
//   면만 ::before 로 0.667dp 아래(translate)에서 칠한다. 아이콘·글자는 정수 위끝 740 기준 정수 dp (아이콘 748 → 8, 글자 779 → 39).
//   셸 높이가 800.667 이 아닌 실제 앱에서도 같은 상자(아래에 붙음)라 모양은 같다.
import type { CSSProperties } from 'react'
import { artSrc, type WooriArtName } from './WooriArt.ts'
import { wooriPlace } from './WooriLayout.ts'
import './WooriTabBar.css'

export type WooriTab = 'product' | 'asset' | 'home' | 'stock' | 'benefit'

export interface WooriTabBarProps {
  active?: WooriTab
  onSelect?: (tab: WooriTab) => void
}

interface TabSpec {
  key: WooriTab
  label: string
  icon: WooriArtName
  /** 아이콘 상자 (탭 칸 기준 dp, 탭바 위끝 740 기준 y) */
  iconBox: [number, number, number]
  /** 글자 left (탭 칸 기준 dp), 자간, 색 (textfit best — spec/home.json top-banner1 tab_*_label) */
  labelLeft: number
  letterSpacing: string
  color: string
}

/** 칸 폭 72dp. 아이콘 y 748(24dp) / 747(26dp), 글자 top 779 = 탭바 위끝 740 + 39 */
const TABS: readonly TabSpec[] = [
  { key: 'product', label: '상품', icon: 'home.tab-product', iconBox: [24, 8, 24], labelLeft: 26.281, letterSpacing: '0.0175em', color: '#4a4a50' },
  { key: 'asset', label: '자산·소비', icon: 'home.tab-asset', iconBox: [95 - 72, 7, 26], labelLeft: 87.281 - 72, letterSpacing: '0.0125em', color: '#4a4b50' },
  { key: 'home', label: '홈', icon: 'home.tab-home-on', iconBox: [168 - 144, 8, 24], labelLeft: 175.281 - 144, letterSpacing: '0em', color: '#4a4b50' },
  { key: 'stock', label: '주식', icon: 'home.tab-stock', iconBox: [240 - 216, 8, 24], labelLeft: 242.328 - 216, letterSpacing: '0.02em', color: '#494b4f' },
  { key: 'benefit', label: '혜택', icon: 'home.tab-benefit', iconBox: [311 - 288, 7, 26], labelLeft: 314.422 - 288, letterSpacing: '0.0125em', color: '#4b4d52' },
]

/** 선택 탭 글자색 (잰 코어 #316caf — 11dp 라 옅게 찍힘, 설계 #1f67bd) */
const ACTIVE_COLOR = '#1f67bd'

export function WooriTabBar({ active = 'home', onSelect }: WooriTabBarProps) {
  return (
    <nav className="woori-tabbar" aria-label="하단 메뉴">
      {TABS.map((t, i) => {
        const on = t.key === active
        const [ix, iy, isz] = t.iconBox
        const labelStyle: CSSProperties = {
          ...wooriPlace(t.labelLeft, 39),
          letterSpacing: t.letterSpacing,
          color: on ? ACTIVE_COLOR : t.color,
        }
        return (
          <button
            key={t.key}
            type="button"
            className={'woori-tabbar__tab' + (on ? ' is-active' : '')}
            style={{ left: 72 * i }}
            data-tab={t.key}
            aria-current={on ? 'page' : undefined}
            onClick={() => onSelect?.(t.key)}
          >
            <img
              className={'woori-tabbar__icon' + (t.key === 'home' && !on ? ' woori-tabbar__icon--off' : '')}
              src={artSrc(t.icon)}
              alt=""
              draggable={false}
              style={{ left: ix, top: iy, width: isz, height: isz }}
            />
            <span className="woori-tabbar__label" style={labelStyle}>
              {t.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
