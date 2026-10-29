import { useEffect, useRef, useState, type CSSProperties } from "react";
import { paths } from "../api/endpoints";
import type { Account, HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { DevPanel } from "../dev-panel/DevPanel";
import { nhAccountLine } from "./banks";
import { NhAccountIcon, NhMenuIcon } from "./common";
import { useNhGo } from "./loading";
import "./nh-home.css";
import { useNhStatusBar } from "./theme";

// 콕뱅크 '일반' 홈 (다크모드). 녹화3(2026-10-29, 480px = 1dp 1.25px) + 앱스토어 공식 스크린샷(밝은 모드, 계좌 여러 개일 때 모양).
// 위치는 화면 dp (top 0 = 상태바 아래). 녹화의 페이지 y 에서 28 을 뺀 값.
//   맨 위: 큰글 스위치 + MY·검색·알림·메뉴 / NH농협·다른금융 탭, 전체계좌 > / 계좌 카드(옆으로 넘김) / 등록계좌 ⌄
//   콕추천(가로 카드) / 광고 배너(3초마다 넘어감, n/9 ⏸ 전체보기 >) / 금융상품 / 마이데이터 / 아래 탭바
// 아래로 스크롤하면 위 계좌 영역이 작은 카드(번호 ⌄, 잔액 [송금])로 접혀 위에 붙고, 탭바는 숨고 ↑ 버튼이 나옴.
// 그림은 scripts/nh-crops/home-general.py 가 녹화에서 자른 nh-gh-*.png (흰 카드 안 그림이라 바탕 흰색 그대로)

// 콕추천 카드 9장 (녹화: 1번 MY 소비 다이어리, 2번 공공…, 9번 동전 손. 공식 사진: 준조합원 가입, 고향사랑…, 클로버(AD)).
// 나머지 글은 추측
const REC: {
  title: string;
  desc: [string, string];
  img?: string;
  ad?: boolean;
}[] = [
  {
    title: "MY 소비 다이어리",
    desc: ["소중한 추억을 기록하는", "소비 다이어리"],
    img: "nh-gh-rec-diary",
  },
  {
    title: "공공서비스 알림",
    desc: ["다양한 공공서비스를", "한곳에서 확인하세요"],
  },
  {
    title: "준조합원 가입",
    desc: ["예적금 가입 시", "세금우대 혜택이!"],
    img: "nh-gh-rec-tax",
  },
  { title: "고향사랑기부", desc: ["고향에 기부하고", "혜택도 챙기세요"] },
  {
    title: "행운의 이벤트",
    desc: ["매일 출석하고", "행운 포인트 받기"],
    ad: true,
  },
  { title: "내 신용점수", desc: ["신용점수 조회해도", "점수 걱정 없어요"] },
  { title: "환전 서비스", desc: ["여행 가기 전", "미리 환전하세요"] },
  { title: "콕쇼핑 특가", desc: ["농협 우리 농산물", "오늘의 특가"] },
  {
    title: "용돈 받기",
    desc: ["가족에게 콕! 조르고", "용돈 받아요"],
    img: "nh-gh-rec-coin",
  },
];

// 광고 배너 9개 (녹화3 14~50초에 차례로 지나간 것 그대로). cat 색은 녹화에서 잰 글자색
const BANNERS: {
  cat: string;
  color: string;
  title: [string, string];
  link: string;
  img: string;
  ad?: boolean;
}[] = [
  {
    cat: "NH콕! 공동구매",
    color: "#00939f",
    title: ["찬바람 불면 생각나는 맛!", "황금빛 속살 호풍미 고구마"],
    link: "12,900원 공구하기",
    img: "nh-gh-banner-1",
  },
  {
    cat: "증권추천 이벤트",
    color: "#4f5ee6",
    title: ["AI가 콕! 집어주는", "쉬운 투자 시작!"],
    link: "가입 혜택받기",
    img: "nh-gh-banner-2",
    ad: true,
  },
  {
    cat: "제주위미농협",
    color: "#f0730f",
    title: ["제주 서귀포의", "달콤한 황금향"],
    link: "자세히보기",
    img: "nh-gh-banner-3",
  },
  {
    cat: "최대 45% 특가, 농협맛선 김장대첩",
    color: "#e8467c",
    title: ["2026 김장대첩", "직접 담글까? 골라 담을까?"],
    link: "특가 혜택 받기",
    img: "nh-gh-banner-4",
  },
  {
    cat: "[프레샤인]",
    color: "#9654e0",
    title: ["26년 햇사과!", "프레샤인 부사 3kg"],
    link: "자세히보기",
    img: "nh-gh-banner-5",
  },
  {
    cat: "신규가입으로 피싱 예방부터 경품 기회까지!",
    color: "#f2603a",
    title: ["피싱·스미싱 방지서비스", "신규 가입 이벤트"],
    link: "2026.09.14~2026.11.22",
    img: "nh-gh-banner-6",
  },
  {
    cat: "콕뱅크 회원을 위한 혜택",
    color: "#11a06a",
    title: ["휴대용 무선 블렌더", "무료 증정!"],
    link: "응모하기",
    img: "nh-gh-banner-7",
  },
  {
    cat: "한 번 맛보면 정착하는 풍산김치",
    color: "#e8467c",
    title: ["농협 풍산김치 5kg", "런칭특가 31% 29,800"],
    link: "특가 혜택 받기",
    img: "nh-gh-banner-8",
  },
  {
    cat: "국민비서 구삐와 함께하는 일상",
    color: "#3457d5",
    title: ["국민비서", "사용후기·숏폼 이벤트"],
    link: "2026.08.24~2026.10.30",
    img: "nh-gh-banner-9",
  },
];
const DATE_LINK = /^\d{4}\./; // 기간 표시는 > 없음

// 금융상품 큰 카드 (점 4개 = 4장. 녹화엔 1장만 보여서 2~4장은 추측, 그림은 같은 캐릭터)
const SAVINGS = [
  {
    kind: "적금",
    title: [
      "매월 일정한 금액을 예금하시면 만기에",
      "목돈을 드리는 편리한 적금",
    ],
    name: "정기적금",
  },
  {
    kind: "예금",
    title: ["목돈을 한 번에 맡기고", "약정한 이자를 받는 예금"],
    name: "큰만족실세예금",
  },
  {
    kind: "예탁금",
    title: ["이자에 이자를 더하는", "복리식 정기 예탁금"],
    name: "복리식정기예탁금",
  },
  {
    kind: "적금",
    title: ["자유롭게 저축하고", "만기에 목돈을 받는 적금"],
    name: "자유로우대적금",
  },
];

const TILES: {
  sub: string;
  title: string;
  img: string;
  at: [number, number, number, number];
}[] = [
  // at: 그림 자리 (페이지 x, y, 폭, 높이 dp)
  {
    sub: "방방콕콕",
    title: "황금쌀 찾기",
    img: "nh-gh-tile-rice",
    at: [130.4, 1245.6, 44, 34.4],
  },
  {
    sub: "한정수량!",
    title: "특판상품",
    img: "nh-gh-tile-sale",
    at: [308.4, 1245.6, 37.6, 37.6],
  },
  {
    sub: "내게 딱맞는!",
    title: "예·적금 찾기",
    img: "nh-gh-tile-target",
    at: [133.6, 1381.6, 37.6, 37.6],
  },
  {
    sub: "안전한 재테크",
    title: "금융상품몰",
    img: "nh-gh-tile-mall",
    at: [304.4, 1380.8, 44, 39.2],
  },
];

const TABS = ["상품", "마이데이터", "콕팜", "콕쇼핑", "콕혜택"];

const COLLAPSE_AT = 140; // 이만큼 내리면 위 계좌 영역이 작은 카드로 접힘 (녹화: 큰 카드가 반쯤 가려질 때)

export function NhHome() {
  useNhStatusBar("#17161b");
  const go = useNhGo();
  const home = useApi<HomeData>(paths.home);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bigText, setBigText] = useState(false);
  const [other, setOther] = useState(false); // 다른금융 탭
  const [hidden, setHidden] = useState(false); // 잔액 숨김 (🔒)
  const [scrollY, setScrollY] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const accounts = (home.data?.accounts ?? []).filter(
    (a) => a.bank.code === "nh" || a.kind === "main",
  );
  const [index, setIndex] = useState(0);
  const acc = accounts[Math.min(index, accounts.length - 1)];
  const collapsed = scrollY > COLLAPSE_AT;

  return (
    <div className="nh nh-gh-wrap">
      <div
        className="screen nh nh-gh"
        ref={scroller}
        onScroll={(e) => setScrollY(e.currentTarget.scrollTop)}
      >
        <div className="nh-gh__page">
          {/* ---------- 맨 위 영역 (위→아래 밝아지는 바탕, 아래 모서리 둥금) ---------- */}
          <section className="nh-gh__top">
            <div className="nh-gh__tabs">
              <button
                className={other ? "" : "on"}
                onClick={() => setOther(false)}
              >
                NH농협
                {!other && <i />}
              </button>
              <button
                className={other ? "on" : ""}
                onClick={() => setOther(true)}
              >
                다른금융
                {other && <i />}
              </button>
            </div>
            <button className="nh-gh__all" onClick={() => go("/accounts")}>
              전체계좌
              <Chevron />
            </button>
            {other ? (
              <div className="nh-gh__card nh-gh__card--empty">
                <p>
                  다른 금융기관 계좌를
                  <br />
                  콕뱅크에서 한번에 조회하세요
                </p>
                <button onClick={() => go("/accounts")}>계좌 연결하기</button>
              </div>
            ) : (
              <AccountCards
                accounts={accounts}
                index={index}
                onIndex={setIndex}
                hidden={hidden}
                onHide={() => setHidden((h) => !h)}
                go={go}
                onRefresh={home.retry}
              />
            )}
            <button className="nh-gh__reg" onClick={() => go("/accounts")}>
              등록계좌
            </button>
            <TealChevron className="nh-gh__regchev" />
            {!other && accounts.length > 1 && (
              <span className="nh-gh__count">
                <b>{index + 1}</b>/{accounts.length}
              </span>
            )}
          </section>

          {/* ---------- 콕추천 ---------- */}
          <h2 className="nh-gh__h2 nh-gh__h2--kok">콕추천</h2>
          <RecCarousel />

          <Banners />

          {/* ---------- 금융상품 (바탕색이 바뀌는 아래 영역) ---------- */}
          <section className="nh-gh__fin">
            <h2 className="nh-gh__h2" style={{ top: 22.1 }}>
              금융상품
            </h2>
            <button className="nh-gh__wcard nh-gh__notice">
              <Img
                name="nh-gh-fin-notice"
                at={[43.2, 827.6, 52.8, 47.2]}
                base={[24, 800.8]}
              />
              <b>농협 생활 백서</b>
              <span>농협과 함께 든든하게 혜택은 더 크게</span>
            </button>
            <Savings />
            {TILES.map((t, k) => (
              <button
                key={t.title}
                className="nh-gh__wcard nh-gh__tile"
                style={tileBox(k)}
              >
                <span>{t.sub}</span>
                <b>{t.title}</b>
                <Img
                  name={t.img}
                  at={t.at}
                  base={[k % 2 ? 198 : 24, k < 2 ? 1173.6 : 1309.6]}
                />
              </button>
            ))}
            <h2 className="nh-gh__h2" style={{ top: 1464.4 - 739.2 - 9.72 }}>
              마이데이터
            </h2>
            <button className="nh-gh__wcard nh-gh__mydata">
              <span>데이터 분석 기반</span>
              <b>나만을 위한 자산관리 서비스</b>
              <span className="nh-gh__link">
                진단 받고 자산관리 시작
                <Chevron />
              </span>
              <Img
                name="nh-gh-mydata"
                at={[273.2, 1528, 63.2, 64]}
                base={[24, 1493.6]}
              />
            </button>
          </section>
        </div>
      </div>

      {/* ---------- 위 고정: 큰글·아이콘 줄 (+ 접힌 계좌 카드) ---------- */}
      <div
        className={`nh-gh__head${collapsed ? " nh-gh__head--collapsed" : scrollY > 0 ? " nh-gh__head--scrolled" : ""}`}
      >
        {collapsed && acc && (
          <div className="nh-gh__mini">
            <div className="nh-gh__minicard">
              <span className="nh-gh__mini-icon">
                <NhAccountIcon size={29} />
              </span>
              <button
                className="nh-gh__mini-num"
                onClick={() => go(`/history/${acc.id}`)}
              >
                {nhAccountLine(acc.bank, acc.number ?? "")}
                <SmallChevron />
              </button>
              <span className="nh-gh__more nh-gh__more--mini">
                <MoreIcon />
              </span>
              <div className="nh-gh__mini-bal">
                <b>
                  {hidden
                    ? "잔액보기"
                    : `${acc.balance.toLocaleString("ko-KR")}원`}
                </b>
                <button onClick={() => go(`/send?from=${acc.id}`)}>송금</button>
              </div>
            </div>
            <TealChevron className="nh-gh__minichev" />
          </div>
        )}
        <button
          className={`nh-gh__big${bigText ? " on" : ""}`}
          onClick={() => setBigText((v) => !v)}
          aria-pressed={bigText}
        >
          <i />
          큰글
        </button>
        <span className="nh-gh__icon nh-gh__icon--my">
          <MyIcon />
        </span>
        <span className="nh-gh__icon nh-gh__icon--search">
          <SearchIcon />
        </span>
        <button
          className="nh-gh__icon nh-gh__icon--bell"
          aria-label="관리 패널"
          onClick={() => setPanelOpen(true)}
        >
          <BellIcon />
        </button>
        <button
          className="nh-gh__icon nh-gh__icon--menu"
          aria-label="메뉴"
          onClick={() => go("/accounts")}
        >
          <NhMenuIcon />
        </button>
      </div>

      {/* ---------- 아래 탭바 (맨 위에서만) / ↑ 버튼 (내렸을 때) ---------- */}
      <nav
        className={`nh-gh__tabbar${collapsed ? " nh-gh__tabbar--hide" : ""}`}
      >
        {TABS.map((t, k) => (
          <button key={t}>
            <i
              style={{
                ["--m" as string]: `url(${localAsset(`nh-gh-tab-${k + 1}`) ?? ""})`,
              }}
            />
            {t}
          </button>
        ))}
      </nav>
      <button
        className={`nh-gh__top-btn${collapsed ? " on" : ""}`}
        aria-label="맨 위로"
        onClick={() =>
          scroller.current?.scrollTo({ top: 0, behavior: "smooth" })
        }
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <path d="M5 3.5h14M12 21V8.5M6.5 14 12 8.5l5.5 5.5" />
        </svg>
      </button>
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

// 계좌 카드: 계좌가 여러 개면 옆으로 넘김 (공식 사진: 양옆 카드가 13dp 보임). 녹화는 계좌 1개
function AccountCards({
  accounts,
  index,
  onIndex,
  hidden,
  onHide,
  go,
  onRefresh,
}: {
  accounts: Account[];
  index: number;
  onIndex: (i: number) => void;
  hidden: boolean;
  onHide: () => void;
  go: (to: string) => void;
  onRefresh: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!accounts.length)
    return (
      <div className="nh-gh__cards">
        <div className="nh-gh__card nh-gh__card--skel" />
      </div>
    );
  return (
    <div
      className="nh-gh__cards"
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        const i = Math.round(el.scrollLeft / (CARD_W + CARD_GAP));
        if (i !== index) onIndex(Math.max(0, Math.min(accounts.length - 1, i)));
      }}
    >
      {accounts.map((a) => (
        <div key={a.id} className="nh-gh__card">
          <span className="nh-gh__card-icon">
            <NhAccountIcon size={29} />
          </span>
          <button
            className="nh-gh__name"
            onClick={() => go(`/history/${a.id}`)}
          >
            {a.label}
            <SmallChevron />
          </button>
          <span className="nh-gh__num">
            {nhAccountLine(a.bank, a.number ?? "")}
          </span>
          <button
            className="nh-gh__refresh"
            aria-label="새로고침"
            onClick={onRefresh}
          >
            <RefreshIcon />
          </button>
          <span className="nh-gh__more">
            <MoreIcon />
          </span>
          <div className="nh-gh__bal">
            <b onClick={() => go(`/history/${a.id}`)}>
              {hidden ? "잔액보기" : `${a.balance.toLocaleString("ko-KR")}원`}
            </b>
            <button
              className="nh-gh__lock"
              aria-label={hidden ? "잔액 보이기" : "잔액 숨기기"}
              onClick={onHide}
            >
              <LockIcon locked={hidden} />
            </button>
          </div>
          <i className="nh-gh__line" />
          <button
            className="nh-gh__act nh-gh__act--hist"
            onClick={() => go(`/history/${a.id}`)}
          >
            거래내역
          </button>
          <i className="nh-gh__vsep" />
          <button
            className="nh-gh__act nh-gh__act--send"
            onClick={() => go(`/send?from=${a.id}`)}
          >
            송금
          </button>
        </div>
      ))}
    </div>
  );
}
const CARD_W = 336;
const CARD_GAP = 13;

// 콕추천: 가운데 카드 248dp, 사이 16, 양옆 카드가 보임. 손으로 넘김(스크롤 스냅). 처음엔 1번이 가운데, 9번이 왼쪽에
function RecCarousel() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(1); // 가운데 카드 (order 의 번호)
  const order = [REC.length - 1, ...REC.keys()]; // 9번을 맨 앞에 하나 더 (왼쪽에 보이게)
  const i = order[pos];
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = REC_STEP; // 1번이 가운데
  }, []);
  return (
    <>
      <span className="nh-gh__kokcount">
        <b>{i + 1}</b>/{REC.length}
      </span>
      <div
        className="nh-gh__rec"
        ref={ref}
        onScroll={(e) => {
          setPos(
            Math.max(
              0,
              Math.min(
                order.length - 1,
                Math.round(e.currentTarget.scrollLeft / REC_STEP),
              ),
            ),
          );
        }}
      >
        {order.map((k, n) => {
          const r = REC[k];
          return (
            <button
              key={n}
              className={`nh-gh__reccard${n === pos ? " on" : ""}`}
            >
              <b>{r.title}</b>
              <span>
                {r.desc[0]}
                <br />
                {r.desc[1]}
              </span>
              {r.ad && <em className="nh-gh__ad">AD</em>}
              {r.img && <RecImg name={r.img} />}
            </button>
          );
        })}
      </div>
    </>
  );
}
const REC_STEP = 248 + 16;
// 콕추천 그림 자리 (카드 왼쪽 위 기준 dp): 녹화에서 자른 자리
const REC_IMG: Record<string, [number, number, number, number]> = {
  "nh-gh-rec-diary": [238 - 68, 452.4 - 410.4, 68, 64],
  "nh-gh-rec-tax": [160, 32, 74.5, 53],
  "nh-gh-rec-coin": [248 - 48, 454.8 - 410.4, 48, 54.4],
};
function RecImg({ name }: { name: string }) {
  const [x, y, w, h] = REC_IMG[name];
  return <Pic name={name} style={{ left: x, top: y, width: w, height: h }} />;
}

// 광고 배너: 3초마다 다음 장 (왼쪽으로 밀림), ⏸ 누르면 멈춤
function Banners() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, [paused]);
  const n = BANNERS.length;
  return (
    <>
      <div className="nh-gh__banner">
        <div
          className="nh-gh__banner-track"
          style={{ transform: `translateX(${-(i % n) * 100}%)` }}
        >
          {BANNERS.map((b) => (
            <button key={b.img} className="nh-gh__banner-item">
              <Img name={b.img} at={BANNER_IMG[b.img]} base={[24, 547.2]} />
              <span className="nh-gh__banner-cat" style={{ color: b.color }}>
                {b.cat}
              </span>
              <b>
                {b.title[0]}
                <br />
                {b.title[1]}
              </b>
              <span className="nh-gh__link">
                {b.link}
                {!DATE_LINK.test(b.link) && <Chevron />}
              </span>
              {b.ad && <em className="nh-gh__ad nh-gh__ad--banner">AD</em>}
            </button>
          ))}
        </div>
      </div>
      <div className="nh-gh__pager">
        <span>
          <b>{(i % n) + 1}</b>/{n}
        </span>
        <button
          aria-label={paused ? "재생" : "일시정지"}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? (
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
              <path d="M3 1.5v9l7.5-4.5Z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
              <rect
                x="2.4"
                y="1.6"
                width="2.6"
                height="8.8"
                rx="1"
                fill="currentColor"
              />
              <rect
                x="7"
                y="1.6"
                width="2.6"
                height="8.8"
                rx="1"
                fill="currentColor"
              />
            </svg>
          )}
        </button>
      </div>
      <button className="nh-gh__seeall">
        전체보기
        <Chevron />
      </button>
    </>
  );
}
// 배너 그림 자리 (녹화 페이지 dp: x, y, 폭, 높이) — home-general.py 출력
const BANNER_IMG: Record<string, [number, number, number, number]> = {
  "nh-gh-banner-1": [196.8, 568.2, 163.2, 116],
  "nh-gh-banner-2": [220.8, 568.2, 139.2, 105.6],
  "nh-gh-banner-3": [230.4, 568.2, 129.6, 104.8],
  "nh-gh-banner-4": [196, 568.2, 164, 100],
  "nh-gh-banner-5": [198.4, 553, 161.6, 131.2],
  "nh-gh-banner-6": [197.6, 568.2, 162.4, 116],
  "nh-gh-banner-7": [244.8, 561, 115.2, 116],
  "nh-gh-banner-8": [196, 568.2, 164, 100],
  "nh-gh-banner-9": [196, 568.2, 164, 101.6],
};

// 금융상품 큰 카드 + 점 4개 (손으로 넘김)
function Savings() {
  const [i, setI] = useState(0);
  return (
    <>
      <div
        className="nh-gh__savings"
        onScroll={(e) =>
          setI(
            Math.round(
              e.currentTarget.scrollLeft / e.currentTarget.clientWidth,
            ),
          )
        }
      >
        {SAVINGS.map((s, k) => (
          <button key={k} className="nh-gh__wcard nh-gh__saving">
            <span>{s.kind}</span>
            <b>
              {s.title[0]}
              <br />
              {s.title[1]}
            </b>
            <span className="nh-gh__saving-name">{s.name}</span>
            <Img
              name="nh-gh-fin-saving"
              at={[237.6, 1017.2, 111.2, 97.6]}
              base={[24, 920.8]}
            />
          </button>
        ))}
      </div>
      <div className="nh-gh__dots">
        {SAVINGS.map((_, k) => (
          <i key={k} className={k === i ? "on" : ""} />
        ))}
      </div>
    </>
  );
}

const tileBox = (k: number): CSSProperties => ({
  left: k % 2 ? 198 : 24,
  top: (k < 2 ? 1173.6 : 1309.6) - 739.2,
});

// 녹화 페이지 좌표(at)로 잘라 온 그림을, 부모 상자(base = 부모의 페이지 x, y) 안 같은 자리에
function Img({
  name,
  at: [x, y, w, h],
  base: [bx, by],
}: {
  name: string;
  at: [number, number, number, number];
  base: [number, number];
}) {
  return (
    <Pic
      name={name}
      style={{ left: x - bx, top: y - by, width: w, height: h }}
    />
  );
}
function Pic({ name, style }: { name: string; style: CSSProperties }) {
  const src = localAsset(name);
  if (!src) return null;
  return (
    <img
      className="nh-gh__pic"
      src={src}
      alt=""
      style={style}
      draggable={false}
    />
  );
}

// ---------- 아이콘 (선 굵기·크기는 녹화에서 잰 값) ----------
function Chevron() {
  return (
    <svg
      className="nh-gh__chev"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="m5.6 2.4 5.6 5.6-5.6 5.6" />
    </svg>
  );
}
function SmallChevron() {
  return (
    <svg
      className="nh-gh__schev"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="m2.4 5.4 5.6 5.6 5.6-5.6" />
    </svg>
  );
}
function TealChevron({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 8"
      width="20"
      height="8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.6 1.4 10 6.4l8.4-5" />
    </svg>
  );
}
function MyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden>
      <circle
        cx="11.6"
        cy="5.6"
        r="3.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M14.8 12.2H9.4a4.85 4.85 0 0 0-4.85 4.85v.84c0 .85.69 1.54 1.54 1.54h2.18"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        x="10.4"
        y="20.5"
        fill="currentColor"
        fontWeight="800"
        fontSize="6.95"
        letterSpacing="-0.1"
      >
        MY
      </text>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7.6" />
      <path d="m16.6 16.6 4.6 4.6" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6.7 9.4a5.3 5.3 0 0 1 10.6 0v2.9l2.4 5.4H4.3l2.4-5.4Z" />
      <path d="M9.2 18.5a2.8 2.25 0 0 0 5.6 0" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M19.9 13.8A8.2 8.2 0 1 1 18.7 8.4" />
      <path d="M19.4 4.4v4.3h-4.3" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg
      viewBox="0 0 4 18"
      width="4"
      height="18"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="2" cy="2.4" r="1.5" />
      <circle cx="2" cy="9" r="1.5" />
      <circle cx="2" cy="15.6" r="1.5" />
    </svg>
  );
}
function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="5.2" y="10.6" width="13.6" height="9.4" rx="2.7" />
      <path
        d={
          locked
            ? "M8.6 10.6V8a3.4 3.4 0 0 1 6.8 0v2.6"
            : "M8.6 10.6V8.3a3.4 3.4 0 0 1 6.65-1"
        }
      />
      <path d="M12 13.8v3" />
    </svg>
  );
}
