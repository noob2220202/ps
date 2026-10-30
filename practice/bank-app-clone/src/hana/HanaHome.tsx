import { useEffect, useRef, useState } from "react";
import { paths } from "../api/endpoints";
import type { HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { DevPanel } from "../dev-panel/DevPanel";
import { nf } from "./bank";
import { Ic } from "./common";
import { useHanaGo } from "./loading";
import { HANA_LIGHT, useHanaStatusBar } from "./theme";
import "./hana-home.css";

// 하나원큐 홈 (라이트 스크린샷 8dd6d3c1·d3850f0b·069b9ebb + 배너별 9장, 다크 녹화 D/0013~0035). 위에서부터:
//   머리줄(MY · 홈|간편 · 지갑/스캔 · 알림) → 대표계좌(가운데 정렬) → 가져오기/보내기 → 1/2 계좌 넘기기 →
//   전체계좌 → 배너 10장(자동 넘김) → 작은 카드 가로 줄 → 메뉴 6개 → 하나금융그룹 → 내 자산 → 홈 설정
// 아래는 검색 칩 줄 + 탭 5개. 내려 스크롤하면 탭이 숨고 ⌄⌄ 버튼, 머리줄은 반투명 회백 막
// 배경은 실제 화면에서 글자·카드 자리를 메운 그림(hana-home-bg-light/dark, scripts/hana-crops/icons.py). 콘텐츠와 같이 스크롤됨
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
const TABS = [
  ["홈", "tab-home", 20.8, 20.3],
  ["자산", "tab-asset", 21.9, 21.9],
  ["상품", "tab-product", 19.7, 19.7],
  ["투자", "tab-invest", 20.8, 20.3],
  ["메뉴", "tab-menu", 18.1, 15.5],
] as const;
// 배너 자동 넘김: 다크 녹화에서 '1 / 10' 이 5.4초(글자 뜸)부터 10.5초(D/0022)까지 남고 13.5초(D/0028)엔 '2 / 10' → 5.1~8.1초 사이
const BANNER_MS = 6000;
// 머리줄 셋째 아이콘: 스캔으로 떴다가(≈1초) 지갑으로 바뀌고, 지갑이 되면 0.6초 뒤 '원큐지갑' 말풍선이 2.5초 (다크 녹화 5.4~11.3초)
const ICON_CYCLE = { scan: 1000, wallet: 4500, tipAt: 600, tipMs: 2500 };
// 탭이 숨는 조건: 바로 숨지 않고 아래로 60dp 넘게 내려가면 숨고, 위로 20dp 올리면 다시 (L/0004·D/0020 은 조금 내려간 상태에서도 탭이 보임)
const TAB_HIDE = { down: 60, up: 20 };

export function HanaHome() {
  const go = useHanaGo();
  const home = useApi<HomeData>(paths.home);
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [tabsHidden, setTabsHidden] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const [settled, setSettled] = useState(true); // 스크롤이 멈춘 뒤에만 ⌄⌄ 버튼 (플링 중엔 안 보임 — 다크 녹화 10.3~13.5초)
  const [hidden, setHidden] = useState(false); // 잔액 숨김
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [wallet, setWallet] = useState(false); // 머리줄 셋째 아이콘: 스캔 ↔ 지갑
  const [tip, setTip] = useState(false); // '원큐지갑' 말풍선
  const [notice, setNotice] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false); // 🔔 관리 패널 (알림 종을 누르면)
  // 상태바: 맨 위는 배경 그림 위 색, 스크롤하면 머리줄 막 색 (069b9ebb #d3efe8 / D/0021 #2f4341)
  useHanaStatusBar(scrolled ? { light: "#d3efe8", dark: "#2f4341" } : { light: "#c4f8ec", dark: "#174844" });

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setSlide((s) => (s + 1) % BANNERS.length), BANNER_MS);
    return () => clearInterval(t);
  }, [playing]);
  useEffect(() => {
    const timers: number[] = [];
    let on = false;
    const flip = () => {
      on = !on;
      setWallet(on);
      setTip(false);
      if (on) {
        timers.push(window.setTimeout(() => setTip(true), ICON_CYCLE.tipAt));
        timers.push(window.setTimeout(() => setTip(false), ICON_CYCLE.tipAt + ICON_CYCLE.tipMs));
      }
      timers.push(window.setTimeout(flip, on ? ICON_CYCLE.wallet : ICON_CYCLE.scan));
    };
    timers.push(window.setTimeout(flip, ICON_CYCLE.scan));
    return () => timers.forEach(clearTimeout);
  }, []);

  const lastY = useRef(0);
  const run = useRef(0); // 한 방향으로 누적된 스크롤 양
  const settleTimer = useRef(0);
  const onScroll = () => {
    const el = scroller.current!;
    const y = el.scrollTop;
    const dy = y - lastY.current;
    lastY.current = y;
    setScrolled(y > 4);
    setAtBottom(y + el.clientHeight >= el.scrollHeight - 4);
    run.current = Math.sign(dy) === Math.sign(run.current) ? run.current + dy : dy;
    if (y < 8 || run.current < -TAB_HIDE.up) setTabsHidden(false);
    else if (run.current > TAB_HIDE.down) setTabsHidden(true);
    setSettled(false);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettled(true), 160);
  };

  // 대표계좌 자리: 내 하나은행 계좌들을 < n / 전체 > 로 넘김 (대표 'main' 이 첫 장). 계좌를 지워 장 수가 줄면 마지막 장으로
  const accounts = [...(home.data?.accounts ?? [])].sort((a, b) => Number(b.id === "main") - Number(a.id === "main"));
  const [page, setPage] = useState(0);
  const idx = Math.min(page, Math.max(accounts.length - 1, 0));
  const account = accounts[idx];
  const turn = (d: number) => accounts.length > 1 && setPage((idx + d + accounts.length) % accounts.length);
  // 실제 앱은 계좌가 하나여도 '1 / 2' (두 번째 장은 자료가 없음) → 그땐 화살표를 누르면 안내만
  const arrow = (d: number) => (accounts.length > 1 ? turn(d) : setNotice("계좌가 하나뿐이에요.\n🔔 → 계좌 탭에서 하나은행 계좌를 추가하면 넘겨 볼 수 있어요."));
  // 계좌 카드를 옆으로 밀어도 넘어감 (가로로 40px 넘게, 세로보다 많이). 민 뒤엔 손을 뗀 자리의 버튼이 눌리지 않게
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const soon = () => setNotice("연습용 앱에서는 준비 중인 메뉴예요.");
  const [title, sub] = [BANNERS[slide][1], BANNERS[slide][0]];
  const bg = localAsset(HANA_LIGHT ? "hana-home-bg-light" : "hana-home-bg-dark");
  const openHistory = () => account && go(`/history/${account.id}`);

  return (
    <div className="hana hana-home">
      <div className="screen hana-home__scroll" ref={scroller} onScroll={onScroll}>
        {/* 다크는 글자가 먼저 뜨고 배경이 0.5초 안에 나타남 (D/0013 → D/0014) */}
        {bg ? <img className="hana-home__bg" src={bg} alt="" draggable={false} /> : <div className="hana-home__bg hana-home__bg--plain" />}

        <section
          className="hana-home__acct"
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY };
            swiped.current = false;
          }}
          onPointerUp={(e) => {
            const s = swipe.current;
            swipe.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) {
              swiped.current = true;
              turn(dx < 0 ? 1 : -1);
            }
          }}
          onClickCapture={(e) => {
            if (!swiped.current) return;
            swiped.current = false;
            e.stopPropagation();
          }}
        >
          <div className="hana-home__acct-name">
            <span>입출금</span>
            <i />
            <b>{account?.label ?? "영하나플러스통장"}</b>
            <button className="hana-home__more" onClick={soon} aria-label="더보기">
              <Ic name="more" w={5.9} h={17.6} />
            </button>
          </div>
          <button className="hana-home__acct-no" onClick={openHistory}>
            하나은행 {account?.number ?? ""} <Ic name="copy" w={17.1} h={17.1} />
          </button>
          <span className="hana-home__limit">
            한도계좌 <SmallChevron />
          </span>
          <div className="hana-home__balance" onClick={openHistory}>
            {/* 잔액을 아직 못 받았으면 실제처럼 그 자리에 '금액 조회 중' (L/0241). 실패하면 그 자리에서 다시 시도 */}
            {!account ? (
              home.status === "error" ? (
                <button
                  className="hana-home__retry"
                  onClick={(e) => {
                    e.stopPropagation();
                    home.retry();
                  }}
                >
                  잔액을 불러오지 못했어요 · 다시 시도
                </button>
              ) : (
                <span className="hana-home__loading">금액 조회 중</span>
              )
            ) : (
              <>
                <strong>
                  {hidden ? (
                    "잔액숨김"
                  ) : (
                    <>
                      {nf.format(account.balance)}
                      <small>원</small>
                    </>
                  )}
                </strong>
                <button
                  className="hana-home__hide"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHidden((h) => !h);
                  }}
                >
                  {hidden ? "보기" : "숨김"}
                </button>
              </>
            )}
          </div>
          <div className="hana-home__btns">
            <button className="hana-home__get" onClick={soon}>
              가져오기
            </button>
            <button className="hana-home__send" onClick={() => account && go(`/send?from=${account.id}`)}>
              보내기
            </button>
          </div>
          <div className="hana-home__pager">
            <span className="hana-pill">
              <button onClick={() => arrow(-1)} aria-label="이전 계좌">
                <SmallChevron left />
              </button>{" "}
              {idx + 1} <em>/</em> {Math.max(2, accounts.length)}{" "}
              <button onClick={() => arrow(1)} aria-label="다음 계좌">
                <SmallChevron />
              </button>
            </span>
            <span className="hana-home__gear">
              <Ic name="gear" w={13.9} h={14.9} />
            </span>
          </div>
        </section>

        <div className="hana-home__cards">
          <button className="hana-card hana-home__all" onClick={openHistory}>
            <b>전체계좌</b>
            <span>
              보기 <Ic name="view-arrow" w={9.1} h={14.9} />
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
              <Ic name="view-arrow" w={9.1} h={14.9} />
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
            <Ic name="gear" w={15.2} h={16} /> 홈 설정
          </button>
          <button className="hana-home__privacy" onClick={soon}>
            개인정보 처리방침
          </button>
        </div>
      </div>

      <header className={`hana-home__top ${scrolled ? "hana-home__top--scrolled" : ""}`}>
        <button className="hana-home__my" onClick={soon} aria-label="MY">
          <Ic name="my" w={25.6} h={26.7} />
        </button>
        <span className="hana-home__mode">
          <b>홈</b>
          <span>간편</span>
        </span>
        <button className="hana-home__tool" onClick={soon} aria-label={wallet ? "원큐지갑" : "스캔"}>
          <span className={`hana-home__morph ${wallet ? "hana-home__morph--wallet" : ""}`}>
            <Ic name="scan" w={28.8} h={26.1} className="hana-home__morph-scan" />
            <Ic name="wallet" w={26.7} h={26.7} className="hana-home__morph-wallet" />
          </span>
          {tip && <span className="hana-home__tip">원큐지갑</span>}
        </button>
        <button className="hana-home__tool hana-home__bell" onClick={() => setPanelOpen(true)} aria-label="알림 (관리 패널)">
          <Ic name="bell" w={23.5} h={25.6} />
          <i className="hana-home__badge">N</i>
        </button>
      </header>

      <nav className={`hana-home__tabs ${tabsHidden ? "hana-home__tabs--hidden" : ""}`}>
        <div className="hana-home__chips">
          <button className="hana-home__search" onClick={soon}>
            <Ic name="search-white" w={17.1} h={16} /> 검색
          </button>
          {CHIPS.map((c) => (
            <button key={c} onClick={soon}>
              {c}
            </button>
          ))}
        </div>
        <div className="hana-home__tabbar">
          {TABS.map(([t, icon, w, h]) => (
            <button key={t} className={t === "홈" ? "on" : ""} onClick={t === "홈" ? () => scroller.current?.scrollTo({ top: 0, behavior: "smooth" }) : soon}>
              <span className="hana-home__tab-ic">
                <Ic name={icon} w={w} h={h} />
              </span>
              <span>{t}</span>
            </button>
          ))}
        </div>
      </nav>
      {tabsHidden && !atBottom && settled && (
        <button className="hana-home__down" onClick={() => scroller.current?.scrollBy({ top: 420, behavior: "smooth" })} aria-label="아래로">
          <Ic name="double-down" w={18.1} h={19.7} />
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

// ---------- 작은 아이콘 (잘라 쓰기엔 너무 작아서 그림) ----------
// 페이저 쉐브론: 8dd6d3c1 ‹ 5.8 × 11.2dp, 굵기 ≈1.6
function SmallChevron({ left = false }: { left?: boolean }) {
  return (
    <svg width="13.5" height="13.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={left ? "M7.8 1.5 3.3 6l4.5 4.5" : "m4.2 1.5 4.5 4.5-4.5 4.5"} />
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
