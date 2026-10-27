import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/mockApi";
import type { HomeData } from "../../api/types";
import { PROFILE } from "../../config/profile";
import { TIMING } from "../../config/timing";
import { useAsync } from "../../hooks/useAsync";
import { useStatusBar } from "../../hooks/useStatusBar";
import { won } from "../../lib/format";
import {
  AiSavingIcon,
  ArcSpinner,
  CardThumb,
  CashbackIcon,
  MiniBIcon,
  NhIcon,
  TmoneyIcon,
} from "../../components/art";
import { Icon } from "../../components/icons/Icon";
import { AiPill } from "./AiPill";
import { AdBanner } from "./AdBanner";
import { BottomNav } from "./BottomNav";
import "./Home.css";

// 앱 켜고 첫 진입일 때만 "1차 화면 → 광고/카드 섹션 끼어들기" 순서로 그린다(영상 11~12초).
// 상세에서 뒤로 왔을 땐 처음부터 완성된 화면.
let booted = false;

const stop = (e: MouseEvent) => e.stopPropagation();

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`collapsible ${open ? "" : "collapsible--closed"}`}>
      <div>{children}</div>
    </div>
  );
}

export function HomeScreen() {
  useStatusBar("var(--dark-bg)", "light");
  const navigate = useNavigate();
  const home = useAsync(api.home, []);

  const [firstLoad] = useState(() => !booted);
  const [wave, setWave] = useState(firstLoad ? 1 : 2);
  const [nhResolved, setNhResolved] = useState(!firstLoad);
  const [adOpen, setAdOpen] = useState(true);
  const [promoOpen, setPromoOpen] = useState(true);
  const [pressing, setPressing] = useState<string | null>(null);

  useEffect(() => {
    if (!firstLoad) return;
    const a = setTimeout(() => {
      setWave(2);
      booted = true;
    }, TIMING.homeSecondWave);
    const b = setTimeout(() => setNhResolved(true), TIMING.balanceResolve);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [firstLoad]);

  // 누르면 행 위에 스피너가 잠깐 돌고 나서 이동 (영상 18초)
  const openWithSpinner = (id: string, to: string) => {
    setPressing(id);
    setTimeout(() => navigate(to), TIMING.pressDelay);
  };

  if (home.status === "loading") return <div className="home" />;
  const data: HomeData = home.data;
  const [mini, main, nh] = data.accounts;
  const full = wave === 2;

  return (
    <div className="home">
      <div className="screen home__scroll">
        <header className="home__header">
          {full ? <AiPill ready={full} /> : <h1 className="home__name">{PROFILE.userName}</h1>}
          <button className="home__bell" aria-label="알림">
            <Icon name="bell" size={24} stroke={1.8} />
            <span className="red-dot home__bell-dot" />
          </button>
        </header>

        <Collapse open={full && adOpen}>
          <AdBanner ad={data.ad} onClose={() => setAdOpen(false)} />
        </Collapse>

        <div className="mini-card pressable" onClick={() => navigate("/mini")}>
          <MiniBIcon />
          <div className="acct__text">
            <strong className="acct__balance">{won(mini.balance)}</strong>
            <span className="acct__sub acct__sub--beige">{mini.label}</span>
          </div>
          <button className="pill-btn pill-btn--beige pressable" onClick={stop}>
            이체
          </button>
        </div>

        <div className="accounts">
          <div className="acct row-press-dark" onClick={() => openWithSpinner(main.id, "/account/main")}>
            <span className="acct__hand">👋</span>
            <div className="acct__text">
              <strong className="acct__balance">{won(main.balance)}</strong>
              <span className="acct__sub">
                <span className="star">★</span>
                <span className="outline-badge">{main.badge}</span>
              </span>
            </div>
            <button className="pill-btn pressable" onClick={stop}>
              이체
            </button>
            {pressing === main.id && (
              <span className="acct__spinner">
                <ArcSpinner size={22} color="#8a8a8a" />
              </span>
            )}
          </div>

          <div className="acct">
            {nhResolved ? <NhIcon /> : <span className="acct__placeholder-icon" />}
            <div className="acct__text">
              <strong className="acct__balance">{nhResolved ? won(nh.balance) : "?원"}</strong>
              <span className="acct__sub">{nh.label}</span>
            </div>
            <button className="pill-btn pressable">이체</button>
          </div>

          <Collapse open={full && promoOpen}>
            <div className="acct">
              <AiSavingIcon />
              <div className="acct__text">
                <strong className="acct__promo-title">{data.aiPromo.title}</strong>
                <span className="acct__sub">{data.aiPromo.desc}</span>
              </div>
              <button className="acct__dismiss" aria-label="닫기" onClick={() => setPromoOpen(false)}>
                <Icon name="close" size={18} stroke={1.6} />
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
        </div>

        <Collapse open={full}>
          <section className="dark-card">
            <h2 className="dark-card__title">
              카드 <Icon name="chevron-right" size={16} stroke={2} />
            </h2>
            <div className="spend">
              <CardThumb />
              <div className="acct__text">
                <strong className="acct__balance">{won(data.monthlyCardSpend)}</strong>
                <span className="acct__sub">이번달 쓴 돈</span>
              </div>
              <button className="pill-btn pressable">내역 보기</button>
            </div>
          </section>

          <section className="dark-card">
            <div className="acct acct--flush">
              <CashbackIcon />
              <div className="acct__text">
                <strong className="acct__promo-title">현금 돌려받을 기회 4건이 있어요</strong>
              </div>
              <Icon name="chevron-right" size={18} stroke={1.8} className="acct__chev" />
            </div>
            <div className="acct acct--flush">
              <TmoneyIcon />
              <div className="acct__text">
                <strong className="acct__promo-title">티머니 잔액</strong>
              </div>
              <button className="pill-btn pill-btn--sm pressable">조회</button>
              <button className="pill-btn pill-btn--sm pressable">충전</button>
            </div>
          </section>
        </Collapse>

        <button className="add-product pressable">
          <Icon name="plus" size={18} stroke={2} /> 상품 추가
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
      </div>

      <BottomNav />
    </div>
  );
}
