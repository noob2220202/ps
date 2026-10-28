import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { paths } from "../../api/endpoints";
import type { HomeData } from "../../api/types";
import { TIMING } from "../../config/timing";
import { ErrorState } from "../../components/ErrorState";
import { useStatusBar } from "../../hooks/useStatusBar";
import { useScrollFrame } from "../../hooks/useScrollTop";
import { OS } from "../../platform/platform";
import { won } from "../../lib/format";
import { THEME } from "../../platform/theme";
import { Asset, localAsset } from "../../assets/Asset";
import { Icon } from "../../components/icons/Icon";
import { Spinner } from "../../components/Spinner";
import { BMark } from "../../components/art";
import { BankIcon } from "../../components/BankIcon";
import { AiPill } from "./AiPill";
import { BannerCarousel } from "./BannerCarousel";
import { DevPanel } from "../../dev-panel/DevPanel";
import { BottomNav } from "./BottomNav";
import "./Home.css";

// 앱 켜고 첫 진입일 때만 "1차 화면 → 광고/카드 섹션 끼어들기" 순서로 그린다(영상 11~12초).
// 상세에서 뒤로 왔을 땐 처음부터 완성된 화면.
let booted = false;

// 행 안의 "이체" 버튼: 행 클릭(상세로 이동)으로 번지지 않게 막고 이체 화면으로
const adLogo = localAsset("ad-logo"); // 광고 출처 앞의 작은 로고 (있을 때만)

const stopThen = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`collapsible ${open ? "" : "collapsible--closed"}`}>
      <div>{children}</div>
    </div>
  );
}

export function HomeScreen() {
  useStatusBar("var(--home-bg)", THEME === "dark" ? "light" : "dark");
  const navigate = useNavigate();
  const home = useApi<HomeData>(paths.home);
  const [panelOpen, setPanelOpen] = useState(false);

  const [firstLoad] = useState(() => !booted);
  const [wave, setWave] = useState(firstLoad ? 1 : 2);
  const [banksResolved, setBanksResolved] = useState(!firstLoad);
  const [promoOpen, setPromoOpen] = useState(true);
  const [pressing, setPressing] = useState<string | null>(null);

  // iOS 26+ 탭바: 아래로 스크롤하면 작은 캡슐로 줄고, 위로 올리면 다시 펼쳐진다
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const lastTop = useRef(0);
  const [navMin, setNavMin] = useState(false);
  // 값이 실제로 바뀔 때만 리렌더된다 (같은 값으로 setState 하면 React가 건너뜀)
  useScrollFrame(scrollEl, (top) => {
    if (OS !== "ios") return;
    const delta = top - lastTop.current;
    if (Math.abs(delta) < 6) return; // 손떨림 수준의 작은 움직임은 무시
    lastTop.current = top;
    setNavMin(delta > 0 && top > 80);
  });

  useEffect(() => {
    if (!firstLoad) return;
    const a = setTimeout(() => {
      setWave(2);
      booted = true;
    }, TIMING.homeSecondWave);
    const b = setTimeout(() => setBanksResolved(true), TIMING.balanceResolve);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [firstLoad]);

  const toTransfer = (from: string) => stopThen(() => navigate(`/transfer?from=${from}`));

  // 누르면 행 위에 스피너가 잠깐 돌고 나서 이동 (영상 18초)
  const openWithSpinner = (id: string, to: string) => {
    setPressing(id);
    setTimeout(() => navigate(to), TIMING.pressDelay);
  };

  if (home.status === "error")
    return (
      <div className="home">
        <ErrorState error={home.error} onRetry={home.retry} />
      </div>
    );
  if (home.status === "loading") return <div className="home" />;
  const data = home.data;
  // 계좌 종류별로 나눠서 그린다 (다른 은행 계좌는 몇 개든 가능)
  const main = data.accounts.find((a) => a.kind === "main")!;
  const externals = data.accounts.filter((a) => a.kind === "external");
  const full = wave === 2;

  return (
    <div className="home">
      <div className="screen home__scroll" ref={setScrollEl}>
        <header className="home__header">
          {full ? <AiPill ready={full} /> : <h1 className="home__name">{data.profile.userName}</h1>}
          {/* 실제 앱에선 알림함. 여기선 연습용 개발자 패널(기기/테마 전환, 데이터 편집, API 로그) */}
          <button className="home__bell" aria-label="개발자 패널" onClick={() => setPanelOpen(true)}>
            <Icon name="bell" size={24} stroke={1.8} />
            <span className="red-dot home__bell-dot" />
          </button>
        </header>

        <Collapse open={full}>
          <BannerCarousel banners={data.banners} />
        </Collapse>

        {/* 카카오뱅크 3333 통장: 노랑→민트 그라데이션 카드 (실제 앱 스크린샷) */}
        <div className="main-card" onClick={() => openWithSpinner(main.id, "/account/main")}>
          <div className="main-card__row">
            <span className="main-card__icon">
              <BMark size={17} color="#1c1c1c" hole="var(--yellow)" />
            </span>
            <div className="acct__text">
              <strong className="acct__balance">{won(main.balance)}</strong>
              <span className="acct__sub">{main.label}</span>
            </div>
            <button className="pill-btn main-card__btn pressable" onClick={toTransfer(main.id)}>
              이체
            </button>
          </div>
          <div className="main-card__chips">
            <button className="main-card__chip" onClick={stopThen(() => {})}>
              세이프박스 <span>{won(main.safebox ?? 0)}</span>
            </button>
            <button className="main-card__chip" onClick={stopThen(() => {})}>
              저금통 <span className="main-card__cup">☕</span>
            </button>
          </div>
          {pressing === main.id && (
            <span className="acct__spinner">
              <Spinner size={22} color="#8a8a8a" />
            </span>
          )}
        </div>

        <section className="home-card accounts">
          {/* 다른 은행 계좌들 (🔔 패널에서 추가/삭제). 첫 진입 땐 영상처럼 잠깐 "?원" 후 잔액 표시 */}
          {externals.map((acc) => (
            <div key={acc.id} className="acct row-press-home" onClick={() => navigate(`/bank/${acc.id}`)}>
              {banksResolved && acc.bank ? <BankIcon bank={acc.bank} /> : <span className="acct__placeholder-icon" />}
              <div className="acct__text">
                <strong className="acct__balance">{banksResolved ? won(acc.balance) : "?원"}</strong>
                <span className="acct__sub">{acc.label}</span>
              </div>
              <button className="pill-btn pressable" onClick={toTransfer(acc.id)}>
                이체
              </button>
            </div>
          ))}

          <Collapse open={full && promoOpen}>
            <div className="acct">
              <Asset slot="ai-saving" />
              <div className="acct__text">
                <strong className="acct__balance acct__balance--promo">{data.aiPromo.title}</strong>
                <span className="acct__sub">{data.aiPromo.desc}</span>
              </div>
              <button className="acct__dismiss" aria-label="닫기" onClick={() => setPromoOpen(false)}>
                <Icon name="close" size={20} stroke={1.6} />
              </button>
            </div>
          </Collapse>

          <div className="chips">
            <button className="chip pressable">
              내 계좌 <Icon name="chevron-right" size={14} stroke={2} />
            </button>
            <span className="chips__divider" />
            {["통장", "저축", "다른 금융 계좌"].map((label) => (
              <button key={label} className="chip pressable">
                <Icon name="plus" size={14} stroke={2} /> {label}
              </button>
            ))}
          </div>
        </section>

        <Collapse open={full}>
          {/* 스크린샷 기준: 카드 · 현금 돌려받을 기회 · 티머니가 한 카드 안에 있다.
              카드 썸네일에 달린 끈(::after)이 아래 "현금 돌려받을" 줄까지 내려온다 */}
          <section className="home-card card-section">
            <h2 className="card-section__title">
              카드 <Icon name="chevron-right" size={17} stroke={2} />
            </h2>
            <div className="spend">
              <span className="spend__thumb">
                <Asset slot="card" />
              </span>
              <div className="acct__text">
                <strong className="acct__balance">{won(data.monthlyCardSpend)}</strong>
                <span className="acct__sub">이번달 쓴 돈</span>
              </div>
              <button className="pill-btn pressable">내역 보기</button>
            </div>
            {/* 영상: 약 10초마다 노랑→초록→하늘 색 띠가 글자 위를 지나간다 (background-clip: text) */}
            <p className="cashback">
              <span className="cashback__sweep">현금 돌려받을 기회 {data.cashbackCount}건</span>이 있어요
            </p>
            <div className="tmoney">
              <Asset slot="tmoney" />
              <strong className="tmoney__title">티머니 잔액</strong>
              <button className="pill-btn pressable">조회</button>
              <button className="pill-btn pressable">충전</button>
            </div>
          </section>
        </Collapse>

        <button className="add-product pressable">
          <Icon name="plus" size={20} stroke={2} /> 상품 추가
        </button>

        <div className="home__footer">
          <button>
            <Icon name="text" size={16} /> 간편 홈
          </button>
          <span className="home__footer-divider" />
          <button>
            <Icon name="sliders" size={16} stroke={2} /> 화면 편집
          </button>
        </div>

        {/* 영상 아래쪽: 바로가기 카드 + 네이티브 광고 */}
        <section className="home-card shortcuts">
          {data.shortcuts.map((s) => (
            <button key={s.id} className="shortcuts__row row-press-home">
              <Asset slot={s.icon} />
              {s.label}
            </button>
          ))}
        </section>

        <section className="native-ad">
          <div className="native-ad__text">
            <span className="native-ad__source">
              {adLogo && <img className="native-ad__logo" src={adLogo} alt="" />}
              {data.nativeAd.source} ›
            </span>
            <strong className="native-ad__title">{data.nativeAd.title}</strong>
            <span className="native-ad__sponsor">
              <span className="native-ad__badge">AD</span> {data.nativeAd.sponsor}
            </span>
          </div>
          <Asset slot="ad-product" className="native-ad__image" />
          <span className="native-ad__info" aria-label="광고 정보">?</span>
        </section>
      </div>

      <BottomNav minimized={navMin} />
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
