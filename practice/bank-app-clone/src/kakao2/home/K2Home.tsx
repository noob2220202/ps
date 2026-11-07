import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { prefetch, useApi } from "../../api/useApi";
import { paths } from "../../api/endpoints";
import type { HomeData } from "../../api/types";
import { ErrorState } from "../../components/ErrorState";
import { BMark } from "../../components/art";
import { BankIcon } from "../../components/BankIcon";
import { DevPanel } from "../../dev-panel/DevPanel";
import { useStatusBar } from "../../hooks/useStatusBar";
import { useScrollFrame } from "../../hooks/useScrollTop";
import { won } from "../../lib/format";
import { useLayerActive } from "../../platform/LayerContext";
import cardQuestion from "../../assets/local/k2-home-card-q.png";
import creditGauge from "../../assets/local/k2-home-gauge.png";
import { K2Bell, K2Chevron } from "../art";
import { cutK2Dim, K2_SPIN_ON_DARK, leaveK2Dim, showK2Dim } from "../dim";
import { LAUNCH, useLaunchAt } from "../launch";
import { useK2Once } from "../nav";
import { CHIPS, K2_HOME, PILL_MESSAGES, PROMOS, SHORTCUTS } from "./content";
import { K2AiPill } from "./K2AiPill";
import { K2Banner } from "./K2Banner";
import { K2FloatingAd } from "./K2FloatingAd";
import { K2TabBar } from "./K2TabBar";
import { K2Plus, K2SerifT, K2Sliders } from "./icons";
import "./K2Home.css";

// kakao2 홈 (녹화 0.42 – 7초 · 27.4 – 28.4초, home.md + critic.md). 테마와 상관없이 늘 어두운 화면, 처음부터 다 그려진 채 (1차 · 2차 화면 없음).
// 방문 = 홈 층이 맨 위가 될 때마다. 켤 때(launch.ts)는 켜진 때 기준으로, 이체 모달을 닫고 돌아오면 그때 기준으로 알약 · 홍보 줄 · 배너가 움직임.
// 알약 문구 · 홍보 줄 번호 · 지금 방문은 모듈 변수 (통장에서 뒤로 와 홈이 새로 그려져도 이어짐)
let pillShown = 0;
let promoShown = 0;
let launchSeen: number | null = null;
let visitNow: Visit | null = null;
let visitSeq = 0;
const visitListeners = new Set<() => void>();
const setVisitNow = (v: Visit | null) => {
  visitNow = v;
  visitListeners.forEach((fn) => fn());
};
const subscribeVisit = (fn: () => void) => (visitListeners.add(fn), () => void visitListeners.delete(fn));

type Visit = {
  id: number;
  launch: boolean;
  pillAt: number; // 알약 지우기 시작
  prev: string;
  next: string;
  promoAt: number; // 홍보 줄 바뀌는 때
  promoFrom: number;
  bannerAt: number; // 배너 첫 자동 넘김
};

const msg = (i: number) => PILL_MESSAGES[i % PILL_MESSAGES.length];

function useVisit(active: boolean, launchAt: number | null) {
  const visit = useSyncExternalStore(subscribeVisit, () => visitNow);
  const seen = useRef({ active: false, launchAt: null as number | null });
  useLayoutEffect(() => {
    const s = seen.current;
    const fresh = (active && !s.active) || (active && launchAt !== s.launchAt);
    s.active = active;
    s.launchAt = launchAt;
    // 녹화 인트로가 켜짐을 잡아 둔 동안: 켜지기 전 모습 (첫 문구 · 첫 홍보 줄)
    if (launchAt === null) {
      pillShown = 0;
      promoShown = 0;
      launchSeen = null;
      setVisitNow(null);
      return;
    }
    if (!fresh) return;
    const now = performance.now();
    if (launchAt !== launchSeen && now - launchAt < 3000) {
      launchSeen = launchAt;
      pillShown = 1;
      promoShown = 0;
      setVisitNow({
        id: ++visitSeq,
        launch: true,
        pillAt: launchAt + LAUNCH.pillCollapse,
        prev: msg(0),
        next: msg(1),
        promoAt: launchAt,
        promoFrom: 0,
        bannerAt: launchAt + LAUNCH.bannerFirst,
      });
      return;
    }
    launchSeen = launchAt;
    const from = pillShown++;
    const promoFrom = promoShown;
    promoShown = (promoShown + 1) % PROMOS.length;
    setVisitNow({
      id: ++visitSeq,
      launch: false,
      pillAt: now + K2_HOME.returnPill,
      prev: msg(from),
      next: msg(from + 1),
      promoAt: now + K2_HOME.returnPromo,
      promoFrom,
      bannerAt: now + K2_HOME.bannerInterval,
    });
  }, [active, launchAt]);
  return visit;
}

export function K2Home() {
  useStatusBar("#1f1f1f", "light");
  const navigate = useNavigate();
  const once = useK2Once(); // 카드 · 다른 은행 줄: 빠르게 두 번 눌러도 한 번만 쌓임
  const home = useApi<HomeData>(paths.home);
  const active = useLayerActive();
  const launchAt = useLaunchAt();
  const visit = useVisit(active, launchAt);
  const [panelOpen, setPanelOpen] = useState(false);

  // 홍보 줄: 다시 온 지 465ms 에 다음 것으로 (그 전엔 이전 것)
  const [promoDue, setPromoDue] = useState<number | null>(null); // 홍보 줄을 바꾼 방문 id
  const promoWait = visit && !visit.launch && promoDue !== visit.id ? visit.promoAt - performance.now() : 0;
  useEffect(() => {
    if (!visit || promoWait <= 0) return;
    const id = setTimeout(() => setPromoDue(visit.id), promoWait);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit]);
  const promo = PROMOS[visit && promoWait > 0 ? visit.promoFrom : promoShown];

  // 스크롤: 55 넘으면 상태바 밑 회색 띠. 떠 있는 광고는 목록 끝 아래에 붙어 스크롤과 같이 움직임 (맨 끝에서 제자리).
  // 광고가 올라오며 탭바 뒤를 지나면 탭바가 잠깐 밝은 쪽으로 기울고, 다시 내려가며 지나면 밝은 유리로 (방문마다 처음부터).
  // 스크롤 막대는 처음 움직인 프레임부터 이번 방문 내내. 광고 · 막대 자리는 매 프레임 DOM 에 바로
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState(false);
  const [ad, setAd] = useState<"below" | "up" | "gone">("below");
  const [ind, setInd] = useState(false);
  const indRef = useRef<HTMLDivElement>(null);
  const adRef = useRef<HTMLElement>(null);
  const lastTop = useRef(0);
  useScrollFrame(scrollEl, (top) => {
    setEdge(top > K2_HOME.edgeAt);
    const d = top - lastTop.current;
    lastTop.current = top;
    if (d !== 0) setInd(true);
    if (!scrollEl) return;
    const { clientHeight: h, scrollHeight: all } = scrollEl;
    const max = Math.max(0, all - h);
    const bar = indRef.current;
    if (bar) {
      const track = h - K2_HOME.indTop - K2_HOME.indBottom;
      const len = (track * h) / all;
      bar.style.height = `${len}px`;
      bar.style.transform = `translateY(${max > 0 ? ((track - len) * Math.min(1, Math.max(0, top / max))).toFixed(2) : 0}px)`;
    }
    const el = adRef.current;
    if (el) {
      const below = Math.max(0, max - top);
      el.style.transform = `translate3d(0,${below.toFixed(2)}px,0)`;
      el.style.visibility = below < h - el.offsetTop ? "visible" : "";
      if (ad === "below" && d > 0 && below < K2_HOME.adPulseAt) setAd("up");
      else if (ad === "up" && d < 0 && below > K2_HOME.adLightAt) setAd("gone");
    }
  });

  // 이체: 누른 프레임에 버튼이 밝게 번쩍이고 로딩 막 + 스피너. 1650ms (받는 분 목록을 더 늦게 받으면 그때) 뒤 막이 흐려지기 시작하고
  // 50ms 뒤 이체 모달이 올라오기 시작, 남은 막은 모달의 첫 프레임에 한 번에 걷힘 (critic.md C6 · G5)
  const [flash, setFlash] = useState<string | null>(null);
  const sending = useRef<number[] | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (sending.current) {
        sending.current.forEach(clearTimeout);
        sending.current = null;
        cutK2Dim();
      }
    };
  }, []);
  // 새 방문: 광고 · 탭바 색 · 번쩍임 처음부터 (렌더 중에 바로 — 이전 방문 모습이 한 프레임도 안 남게)
  const [visitSeen, setVisitSeen] = useState(visit?.id);
  if (visit && visit.id !== visitSeen) {
    setVisitSeen(visit.id);
    setAd("below");
    setFlash(null);
    setInd(false);
  }

  // 이체 모달 층이 들어온 커밋 = 홈 층이 밑으로 (active false) → 같은 커밋에 막을 걷어 모달 첫 프레임에 사라지게 (녹화 8.190초).
  // 이동과 같은 일에서 걷으면 막이 먼저 사라지고 이체 화면을 그리는 동안(개발 빌드 ≈ 45ms) 홈이 맨얼굴로 보였음
  const navigated = useRef(false);
  const dropDim = () => {
    if (!sending.current) return;
    sending.current.forEach(clearTimeout);
    sending.current = null;
    navigated.current = false;
    cutK2Dim();
  };
  useLayoutEffect(() => {
    if (!active && navigated.current) dropDim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const toTransfer = (from: string) => (e: MouseEvent) => {
    e.stopPropagation();
    if (sending.current) return;
    const timers: number[] = [];
    sending.current = timers;
    showK2Dim({ spinnerColor: K2_SPIN_ON_DARK });
    setFlash(from);
    const start = performance.now();
    void prefetch(paths.recipients(from)).then(() => {
      if (!alive.current || sending.current !== timers) return;
      timers.push(
        window.setTimeout(
          () => {
            leaveK2Dim();
            timers.push(
              window.setTimeout(() => {
                navigate(`/transfer?from=${encodeURIComponent(from)}`);
                navigated.current = true;
                // 남은 막은 모달 층이 실제로 그려지는 커밋에 걷음 (아래 useLayoutEffect). 그 커밋이 끝내 안 오면 그냥 걷음
                timers.push(window.setTimeout(dropDim, 400));
              }, K2_HOME.transferNav),
            );
          },
          Math.max(0, start + K2_HOME.transferLoad - performance.now()),
        ),
      );
    });
  };

  if (home.status === "error")
    return (
      <div className="k2-home-wait">
        <ErrorState error={home.error} onRetry={home.retry} />
      </div>
    );
  if (home.status === "loading") return <div className="k2-home-wait" />;
  const data = home.data;
  const main = data.accounts.find((a) => a.kind === "main")!;
  const externals = data.accounts.filter((a) => a.kind === "external");
  const pillIdle = msg(pillShown);

  return (
    <div className="k2-home">
      <div className="k2-home__scroll" ref={setScrollEl}>
        <header className="k2-home__head">
          {visit ? (
            <K2AiPill key={visit.id} at={visit.pillAt} prev={visit.prev} next={visit.next} />
          ) : (
            <K2AiPill at={null} prev={pillIdle} next={pillIdle} />
          )}
          {/* 실제 앱에선 알림함. 여기선 연습용 🔔 패널 (데이터 편집 · API 로그) */}
          <button className="k2-home__bell" aria-label="개발자 패널" onClick={() => setPanelOpen(true)}>
            <K2Bell width={18} height={21.65} />
            <span className="k2-home__bell-dot" />
          </button>
        </header>

        <K2Banner visit={visit} held={launchAt === null} active={active} />

        {/* 카카오뱅크 통장: 살구색 카드 (녹화엔 세이프박스 · 저금통 칩 없음). 누르면 바로 통장으로 (누름 표시 · 스피너 없음) */}
        <div className="k2-home__main" onClick={() => once(() => navigate(`/account/${main.id}`, { state: { label: main.label } }))}>
          <span className="k2-home__b">
            <BMark size={11} color="#fff" hole="#d8b9aa" />
          </span>
          <div className="k2-home__main-text">
            <strong className="k2-home__main-balance">{won(main.balance)}</strong>
            <span className="k2-home__main-label">
              <span className="k2-home__main-name">{main.label}</span>
            </span>
          </div>
          <button className={`k2-home__send${flash === main.id ? " k2-home__send--flash" : ""}`} onClick={toTransfer(main.id)}>
            이체
          </button>
        </div>

        <section className="k2-home__card k2-home__accts">
          {/* 다른 은행 계좌 (🔔 패널에서 추가 · 삭제, 녹화엔 없음 — 홍보 줄과 같은 치수로) */}
          {externals.map((acc) => (
            <div key={acc.id} className="k2-home__row k2-home__ext" onClick={() => once(() => navigate(`/bank/${acc.id}`))}>
              <BankIcon bank={acc.bank} size={36} />
              <div className="k2-home__ext-text">
                <strong className="k2-home__ext-balance">{won(acc.balance)}</strong>
                <span className="k2-home__ext-label">{acc.label}</span>
              </div>
              <button className={`k2-home__btn k2-home__ext-send${flash === acc.id ? " k2-home__btn--flash" : ""}`} onClick={toTransfer(acc.id)}>
                이체
              </button>
            </div>
          ))}
          <div className="k2-home__row k2-home__promo">
            <img className="k2-home__avatar" src={promo.icon} alt="" draggable={false} />
            <div className="k2-home__promo-text">
              <strong className="k2-home__promo-title">{promo.title}</strong>
              <span className="k2-home__promo-desc">{promo.desc}</span>
            </div>
          </div>
          <div className="k2-home__chips">
            <button className="k2-home__chip k2-home__chip--mine">
              내 계좌 <K2Chevron width={5} height={9} stroke={1.5} color="#fff" />
            </button>
            <span className="k2-home__chips-divider" />
            {CHIPS.map((label) => (
              <button key={label} className="k2-home__chip">
                <K2Plus />
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="k2-home__card k2-home__cards">
          <h2 className="k2-home__cards-title">
            카드 <K2Chevron width={6.3} height={11} stroke={1.7} color="#5a5a5a" />
          </h2>
          <img className="k2-home__card-q" src={cardQuestion} alt="" draggable={false} />
          <strong className="k2-home__line k2-home__cards-line">보유 카드가 없어요</strong>
          <button className="k2-home__btn k2-home__cards-btn">발급하기</button>
        </section>

        <section className="k2-home__card k2-home__credit">
          <img className="k2-home__avatar" src={creditGauge} alt="" draggable={false} />
          <strong className="k2-home__line">내 신용정보</strong>
          <button className="k2-home__btn k2-home__credit-btn">확인하기</button>
        </section>

        <button className="k2-home__card k2-home__add">
          <K2Plus width={11.7} height={12} stroke={1.8} color="#ececec" />
          상품 추가
        </button>

        <div className="k2-home__footer">
          <button>
            <K2SerifT />
            <span>간편 홈</span>
          </button>
          <span className="k2-home__footer-divider" />
          <button>
            <K2Sliders />
            <span>화면 편집</span>
          </button>
        </div>

        <section className="k2-home__card k2-home__list">
          {SHORTCUTS.map((s) => (
            <button key={s.id} className="k2-home__list-row">
              <img src={s.icon} alt="" draggable={false} />
              {s.label}
            </button>
          ))}
        </section>
      </div>

      <div className={`k2-home__edge${edge ? " k2-home__edge--on" : ""}`} />
      <div className="k2-home__edge-bottom" />
      <div ref={indRef} className={`k2-home__ind${ind ? " k2-home__ind--on" : ""}`} />
      <K2FloatingAd adRef={adRef} />
      <K2TabBar tone={ad === "gone" ? "light" : "dark"} pulse={ad === "up"} />
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
