import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { DevPanel } from "../dev-panel/DevPanel";
import { nf } from "./bank";
import { SearchIcon } from "./common";
import { useHanaStatusBar } from "./theme";
import "./hana-home.css";

// 하나원큐 홈 (라이트 스크린샷 9장 + 녹화, 다크 녹화 6초~). 위에서부터:
//   머리줄(MY · 홈|간편 · 지갑/스캔 · 알림) → 대표계좌(가운데 정렬) → 가져오기/보내기 → 1/2 계좌 넘기기 →
//   전체계좌 → 배너 10장(자동 넘김) → 작은 카드 가로 줄 → 메뉴 6개 → 하나금융그룹 → 내 자산 → 홈 설정
// 아래는 검색 칩 줄 + 탭 5개. 내려 스크롤하면 탭이 숨고 ⌄⌄ 버튼, 머리줄은 반투명 흰 막
const BANNERS = [
  ["회화에서 공간까지", "가을 미술관 산책,\n함께 가볼까요?"],
  ["하나 나라사랑카드 이벤트", "나라사랑카드 하나로\n53,000원 혜택 제공!"],
  ["적립식펀드 이벤트", "구독하고 가입하고\n최대 6만머니 혜택"],
  ["모임은 하나로", "하나모임통장\n가입 이벤트"],
  ["모두 다 하나통장 이벤트", "가입하면 전원 혜택!\n갤럭시, 애플워치까지~"],
  ["2026 태권브이의 귀환", "오직 놀이터에서만!\n매주 레전드 영상 보기"],
  ["달컴 하반기-연말결산!", "달컴인을 위한\n특별한 초대장 도착!"],
  ["지갑은 두고 나가요!", "모바일 신분증\n하나원큐에서 발급"],
  ["11월 행운의 동전 찾기", "행운의 동전 찾고\n100% 캐시+선물"],
  ["체험과 즐거움이 가득한", "논산세계딸기산업\n엑스포 사전예매"],
];
const MINI = [
  ["모바일 신분증", "지갑없는 편리함"],
  ["놀이터", "돈 버는 꿀잼!"],
  ["하나모임통장", "파킹금리 혜택"],
  ["나라사랑카드", "군생활필수"],
];
const MENU = ["하나더넥스트", "하나더소호", "하나더퍼스트", "놀이터", "하나원큐 축구게임", "원큐지갑"];
const GROUP = ["하나카드", "하나머니", "하나증권", "하나캐피탈", "하나생명"];
const CHIPS = ["상품", "내 카드", "마이데이터", "평생계좌번호", "환전"];
const TABS = ["홈", "자산", "상품", "투자", "메뉴"] as const;
const BANNER_MS = 3500;

export function HanaHome() {
  const navigate = useNavigate();
  const home = useApi<HomeData>(paths.home);
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [tabsHidden, setTabsHidden] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const [hidden, setHidden] = useState(false); // 잔액 숨김
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scanIcon, setScanIcon] = useState(false); // 머리줄 셋째 아이콘: 지갑 ↔ 스캔이 번갈아 바뀜
  const [notice, setNotice] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false); // 🔔 관리 패널 (알림 종을 누르면)
  useHanaStatusBar(scrolled ? { light: "#eef7f4", dark: "#1a2b29" } : { light: "#c4f8ec", dark: "#0f3f3a" });

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setSlide((s) => (s + 1) % BANNERS.length), BANNER_MS);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => {
    const t = window.setInterval(() => setScanIcon((s) => !s), 4000);
    return () => clearInterval(t);
  }, []);

  const lastY = useRef(0);
  const onScroll = () => {
    const el = scroller.current!;
    const y = el.scrollTop;
    setScrolled(y > 4);
    setAtBottom(y + el.clientHeight >= el.scrollHeight - 4);
    if (y < 8) setTabsHidden(false);
    else if (y > lastY.current + 2) setTabsHidden(true);
    else if (y < lastY.current - 6) setTabsHidden(false);
    lastY.current = y;
  };

  const account = home.data?.accounts.find((a) => a.id === "main") ?? home.data?.accounts[0];
  const soon = () => setNotice("연습용 앱에서는 준비 중인 메뉴예요.");
  const [title, sub] = [BANNERS[slide][1], BANNERS[slide][0]];

  return (
    <div className="hana hana-home">
      <div className="screen hana-home__scroll" ref={scroller} onScroll={onScroll}>
        <div className="hana-home__bg" aria-hidden>
          <i className="c1" />
          <i className="c2" />
          <i className="c3" />
          <i className="c4" />
        </div>

        <section className="hana-home__acct">
          {account ? (
            <>
              <div className="hana-home__acct-name">
                <span>입출금</span>
                <i />
                <b>{account.label}</b>
                <button className="hana-home__more" onClick={soon} aria-label="더보기">
                  <MoreDots />
                </button>
              </div>
              <button className="hana-home__acct-no" onClick={() => navigate(`/history/${account.id}`)}>
                하나은행 {account.number} <CopyIcon />
              </button>
              <span className="hana-home__limit">
                한도계좌 <SmallChevron />
              </span>
              <div className="hana-home__balance" onClick={() => navigate(`/history/${account.id}`)}>
                <strong>{hidden ? "잔액숨김" : <>{nf.format(account.balance)}<small>원</small></>}</strong>
                <button
                  className="hana-home__hide"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHidden((h) => !h);
                  }}
                >
                  {hidden ? "보기" : "숨김"}
                </button>
              </div>
              <div className="hana-home__btns">
                <button className="hana-home__get" onClick={soon}>
                  가져오기
                </button>
                <button className="hana-home__send" onClick={() => navigate(`/send?from=${account.id}`)}>
                  보내기
                </button>
              </div>
            </>
          ) : (
            <div className="hana-home__acct-skel" />
          )}
          <div className="hana-home__pager">
            <span className="hana-pill">
              <SmallChevron left /> 1 <em>/</em> {Math.max(2, home.data?.accounts.length ?? 2)} <SmallChevron />
            </span>
            <span className="hana-home__gear">
              <GearIcon />
            </span>
          </div>
        </section>

        <div className="hana-home__cards">
          <button className="hana-card hana-home__all" onClick={() => account && navigate(`/history/${account.id}`)}>
            <b>전체계좌</b>
            <span>
              보기 <ArrowRight />
            </span>
          </button>

          <div className="hana-card hana-home__banner" onClick={soon}>
            <p className="hana-home__banner-sub">{sub}</p>
            <p className="hana-home__banner-title">{title}</p>
            <BannerArt n={slide + 1} />
            <div className="hana-home__banner-ctl" onClick={(e) => e.stopPropagation()}>
              <span className="hana-pill hana-pill--gray">
                <button onClick={() => setSlide((s) => (s + BANNERS.length - 1) % BANNERS.length)} aria-label="이전">
                  <SmallChevron left />
                </button>
                <b>{slide + 1}</b>
                <em>/</em>
                {BANNERS.length}
                <button onClick={() => setSlide((s) => (s + 1) % BANNERS.length)} aria-label="다음">
                  <SmallChevron />
                </button>
              </span>
              <button className="hana-home__play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "멈춤" : "재생"}>
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
            </div>
          </div>

          <div className="hana-home__minis">
            {MINI.map(([t, s]) => (
              <button key={t} className="hana-card hana-home__mini" onClick={soon}>
                <b>{t}</b>
                <span>{s}</span>
              </button>
            ))}
          </div>

          <div className="hana-card hana-home__menu">
            {MENU.map((m, i) => (
              <button key={m} onClick={soon}>
                <Pic name={`hana-menu-${i + 1}`} />
                <span>{m}</span>
              </button>
            ))}
            <button onClick={soon}>
              <Pic name="hana-menu-7" />
              <span>메뉴 추가</span>
            </button>
          </div>

          <div className="hana-card hana-home__group">
            <div className="hana-home__card-title">
              <b>하나금융그룹</b>
              <ArrowRight />
            </div>
            <div className="hana-home__group-chips">
              {GROUP.map((g) => (
                <button key={g} onClick={soon}>
                  {g}
                </button>
              ))}
            </div>
            <div className="hana-home__promo" onClick={soon}>
              <span className="hana-home__promo-tag">하나카드</span>
              <p>매일 최대 1만 하나머니</p>
              <b>100% 당첨 보물찾기</b>
              <Pic name="hana-chest" className="hana-home__chest" />
            </div>
          </div>

          <div className="hana-card hana-home__assets">
            <b>내 자산</b>
            <p>
              흩어진 내 자산을
              <br />
              하나로 모아 보세요
            </p>
            <button onClick={soon}>연결</button>
          </div>

          <button className="hana-home__setting" onClick={soon}>
            <GearIcon /> 홈 설정
          </button>
          <button className="hana-home__privacy" onClick={soon}>
            개인정보 처리방침
          </button>
        </div>
      </div>

      <header className={`hana-home__top ${scrolled ? "hana-home__top--scrolled" : ""}`}>
        <button className="hana-home__my" onClick={soon} aria-label="MY">
          <MyIcon />
        </button>
        <span className="hana-home__mode">
          <b>홈</b>
          <span>간편</span>
        </span>
        <button className="hana-home__tool" onClick={soon} aria-label={scanIcon ? "스캔" : "지갑"}>
          {scanIcon ? <ScanIcon /> : <WalletIcon />}
        </button>
        <button className="hana-home__tool hana-home__bell" onClick={() => setPanelOpen(true)} aria-label="알림 (관리 패널)">
          <BellIcon />
          <i>N</i>
        </button>
      </header>

      <nav className={`hana-home__tabs ${tabsHidden ? "hana-home__tabs--hidden" : ""}`}>
        <div className="hana-home__chips">
          <button className="hana-home__search" onClick={soon}>
            <SearchIcon size={19} /> 검색
          </button>
          {CHIPS.map((c) => (
            <button key={c} onClick={soon}>
              {c}
            </button>
          ))}
        </div>
        <div className="hana-home__tabbar">
          {TABS.map((t) => (
            <button key={t} className={t === "홈" ? "on" : ""} onClick={t === "홈" ? () => scroller.current?.scrollTo({ top: 0, behavior: "smooth" }) : soon}>
              <TabIcon name={t} />
              <span>{t}</span>
            </button>
          ))}
        </div>
      </nav>
      {tabsHidden && !atBottom && (
        <button className="hana-home__down" onClick={() => scroller.current?.scrollBy({ top: 420, behavior: "smooth" })} aria-label="아래로">
          <DoubleDown />
        </button>
      )}
      <Dialog message={notice} onClose={() => setNotice(null)} />
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

function Pic({ name, className = "" }: { name: string; className?: string }) {
  const src = localAsset(name);
  return src ? <img className={`hana-pic ${className}`} src={src} alt="" draggable={false} /> : <span className={`hana-pic hana-pic--empty ${className}`} />;
}

// 배너 그림: 스크린샷에서 자른 상자(138.7 × 149.3dp)를 카드 오른쪽 같은 자리에. 바뀔 때 살짝 겹쳐 사라짐
function BannerArt({ n }: { n: number }) {
  return <Pic key={n} name={`hana-banner-${n}`} className="hana-home__banner-art" />;
}

// ---------- 아이콘 ----------
function MyIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden>
      <circle cx="13.5" cy="10" r="6" />
      <path d="M3.5 28c.4-6.6 4.6-10.4 10-10.4 2.4 0 4.6.7 6.2 2.1" strokeLinecap="round" />
      <text x="16.2" y="30.5" fill="currentColor" stroke="none" fontSize="9.6" fontWeight="800" fontFamily="inherit" letterSpacing="-0.3">
        MY
      </text>
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5c0-2 1.2-3 3-3.6l11.5-3.4v4" />
      <rect x="4" y="6.5" width="20.5" height="17" rx="3.2" />
      <path d="M24.5 12.5h-5a2.75 2.75 0 0 0 0 5.5h5" />
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M3.5 9V6.5a3 3 0 0 1 3-3H9M19 3.5h2.5a3 3 0 0 1 3 3V9M24.5 19v2.5a3 3 0 0 1-3 3H19M9 24.5H6.5a3 3 0 0 1-3-3V19M3 14h22" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" aria-hidden>
      <path d="M6.5 20V12.8a7.5 7.5 0 0 1 15 0V20l2 2.2h-19Z" />
      <path d="M11 25.2c.7.9 1.7 1.3 3 1.3s2.3-.4 3-1.3" strokeLinecap="round" />
    </svg>
  );
}
function MoreDots() {
  return (
    <svg width="6" height="22" viewBox="0 0 6 22" fill="currentColor" aria-hidden>
      <circle cx="3" cy="3.5" r="2" />
      <circle cx="3" cy="11" r="2" />
      <circle cx="3" cy="18.5" r="2" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="5.5" y="5.5" width="10" height="10.5" rx="2.5" />
      <path d="M12.5 3.2A2.5 2.5 0 0 0 10.3 2H4.5A2.5 2.5 0 0 0 2 4.5v6a2.5 2.5 0 0 0 1.2 2.1" />
    </svg>
  );
}
function SmallChevron({ left = false }: { left?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={left ? "M7.8 2 3.8 6l4 4" : "m4.2 2 4 4-4 4"} />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6.5 3 6 6-6 6" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.9 2h-3.8l-.6 2.9a8 8 0 0 0-1.9 1.1L4.8 5l-1.9 3.3 2.2 2a8 8 0 0 0 0 2.2l-2.2 2L4.8 19l2.8-1a8 8 0 0 0 1.9 1.1l.6 2.9h3.8l.6-2.9a8 8 0 0 0 1.9-1.1l2.8 1 1.9-3.3-2.2-2a8 8 0 0 0 0-2.2l2.2-2L19.2 5l-2.8 1a8 8 0 0 0-1.9-1.1ZM12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8Z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <rect x="2" y="1.5" width="2" height="7" rx="0.6" />
      <rect x="6" y="1.5" width="2" height="7" rx="0.6" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <path d="M2.5 1.2v7.6L8.8 5Z" />
    </svg>
  );
}
function DoubleDown() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 5 6 5.5L17 5M5 11.5l6 5.5 6-5.5" />
    </svg>
  );
}
function TabIcon({ name }: { name: (typeof TABS)[number] }) {
  const p = { width: 26, height: 26, viewBox: "0 0 26 26", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "홈":
      return (
        <svg {...p}>
          <path d="M4 8.5C4 5.5 8 3 13 3s9 2.5 9 5.5V20a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" fill="currentColor" />
          <path d="M4.5 13.5h17" stroke="var(--hn-card)" strokeWidth="2.2" />
        </svg>
      );
    case "자산":
      return (
        <svg {...p}>
          <circle cx="13" cy="13" r="10" />
          <path d="m7.5 9.5 2.2 7 3.3-6.3 3.3 6.3 2.2-7M7 12.6h12" strokeLinecap="round" strokeWidth="1.5" />
        </svg>
      );
    case "상품":
      return (
        <svg {...p}>
          <path d="M5.5 6.5h15l-1 15a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4Z" />
          <path d="M9.5 10a3.5 3.5 0 0 0 7 0" strokeLinecap="round" />
        </svg>
      );
    case "투자":
      return (
        <svg {...p}>
          <rect x="3.5" y="3.5" width="19" height="19" rx="4" />
          <path d="m7.5 16 4-4.5 3 3 4.5-5.5M15.5 9H19v3.5" strokeLinecap="round" />
        </svg>
      );
    case "메뉴":
      return (
        <svg {...p}>
          <path d="M4 6.5h18M4 13h18M4 19.5h18" strokeLinecap="round" />
        </svg>
      );
  }
}
