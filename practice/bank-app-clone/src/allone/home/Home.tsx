// NH올원뱅크 홈 (home.md §2, plan §1.5 · §7.3). 화면 사이 이동은 모두 로딩 막 뒤의 CUT (flow.ts).
//  - 머리줄(쪽 59–108)은 고정, 오늘 운세 말풍선은 그 밑에 걸려 있음. 🔔 = 관리 패널, ≡ = 전체메뉴 (menu 프로필)
//  - 새로 불러온 홈(로그인 · 취소 · 이체 완료): 막이 걷힌 뒤 뼈대 H1 → +33 알약 → +117 배너 H2 → +350 카드 H3 → +550 아래 칸 H4, +583 정기점검 시트
//    (C1 12.150 막 걷힘 → 12.183 알약 · 12.267 배너 · 12.500 카드 · 12.700 아래 칸 · 12.733 시트, 프레임마다 잼)
//    그냥 뒤로 돌아온 홈은 그대로 (뼈대 · 시트 없음)
//  - 아래 탭 바: 맨 위를 떠나면 숨고, 맨 위와 맨 끝(+14)에서만 다시 나옴 (§2.16)
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useApi } from "../../api/useApi";
import { DevPanel } from "../../dev-panel/DevPanel";
import { useStatusBar } from "../../hooks/useStatusBar";
import { useLayerActive } from "../../platform/LayerContext";
import { aoPaths, isAoNh, type AoHome } from "../api";
import { useAoFlow, useAoHomeFresh } from "../flow";
import { isAoLoadingUp, onAoLoadingHidden } from "../loading";
import { AO_NOTICE, AO_SKELETON_STEPS } from "../motion";
import { aoPrefs, useAoPrefs } from "../prefs";
import { aoToast } from "../toast";
import { AoBellIcon, AoMenuSearchIcon, AoTabIcon, AoWalletIcon } from "../ui";
import { Accounts } from "./Accounts";
import { Art } from "./art";
import { HOME_BANNER, HOME_TABS } from "./content";
import { Lower } from "./Lower";
import { LowerActive } from "./lowerActive";
import { NoticeSheet } from "./NoticeSheet";
import "./home.css";

// 뼈대 단계: 0 H1 (배너 없음 · 뼈대 카드) · 1 알약까지 · 2 H2 배너 · 3 H3 카드 · 4 H4 아래 칸까지
type Step = 0 | 1 | 2 | 3 | 4;
type Bar = "top" | "mid" | "bottom";

// 뼈대 단계 시각 (막이 걷힌 뒤 ms, motion.ts AO_SKELETON_STEPS: 알약 +33 · 배너 +117 · 카드 +350 · 아래 칸 +550)
const STEP_AT = {
  pill: AO_SKELETON_STEPS[1],
  banner: AO_SKELETON_STEPS[2],
  card: AO_SKELETON_STEPS[3],
  lower: AO_SKELETON_STEPS[4],
};
// 로그인 뒤 처음 그릴 때만 배너 그림이 늦게 뜸 (C1 13.000 = 막 걷힘 +850). 취소 · 이체 완료로 다시 그릴 때는 바로 (C3 22.250)
const BANNER_ART_FIRST = 850;
const ASSET_TITLE_TOP = 1718.67; // 내 자산 제목 잉크 위 (쪽 y) — 알약을 누르면 머리줄 밑 20pt 로
const HEADER_BOTTOM = 108;

export function Home() {
  useStatusBar("#ffffff", "dark");
  const home = useApi<AoHome>(aoPaths.home);
  const flow = useAoFlow();
  const active = useLayerActive();
  const [panel, setPanel] = useState(false);
  const [step, setStep] = useState<Step>(0);
  const [fresh, setFresh] = useState(0); // 새로 불러올 때마다 +1 (카드 넘기기 · 글줄 처음으로)
  const [notice, setNotice] = useState(false);
  const [bannerArt, setBannerArt] = useState(false);
  const [bar, setBar] = useState<Bar>("top");
  const [barStill, setBarStill] = useState(true);
  const scroll = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const homeRef = useRef(home.data);
  useEffect(() => {
    homeRef.current = home.data;
  });
  const bigText = useAoPrefs(aoPrefs.bigText);
  // 아래 칸은 홈이 처음 그려진 뒤에 따로 (startTransition — 잘게 나눠 그림): 로그인 cut(+2033) 에 홈 전체를 한 번에 그리면 70ms 남짓 걸려
  // 막 밑의 홈이 4프레임쯤 늦게 보이고 스피너가 멈칫했음. 숨긴 채 다 그려 두는 것은 같아서 H4 는 여전히 한 프레임에 보이기만 함
  const [lowerReady, setLowerReady] = useState(false);
  useEffect(() => startTransition(() => setLowerReady(true)), []);

  // ---- 새로 불러온 홈: 뼈대 단계 + 정기점검 시트 ----
  const waitDim = useRef<(() => void) | null>(null); // 막이 걷히길 기다리는 중이면 그 구독 끊기
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    waitDim.current?.();
    waitDim.current = null;
  };
  // 막이 걷히는 순간부터 단계 시계 (로그인 · 취소 · 이체 완료 모두 막 밑에서 홈이 그려짐). 막이 없으면 바로
  const startSteps = useCallback(() => {
    clearTimers();
    const start = () => {
      // 단계는 그 시각에 바로 그림 (flushSync — React 의 다음 차례를 기다리면 한 프레임쯤 늦어짐)
      const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(() => flushSync(fn), ms));
      at(STEP_AT.pill, () => setStep(1));
      at(STEP_AT.banner, () => setStep(2));
      at(STEP_AT.card, () => setStep(3));
      at(STEP_AT.lower, () => setStep(4));
      at(AO_NOTICE.afterDim, () => {
        const on = homeRef.current?.ao?.notice?.on ?? homeRef.current?.profile.noticeOn ?? true;
        if (on && !aoPrefs.isNoticeSnoozed()) setNotice(true);
      });
      at(BANNER_ART_FIRST, () => setBannerArt(true));
    };
    if (!isAoLoadingUp()) return start();
    const off = onAoLoadingHidden(() => {
      off();
      waitDim.current = null;
      start();
    });
    waitDim.current = off;
  }, []);
  // 처음 그릴 때는 상태가 이미 H1 이라 시계만
  useEffect(() => {
    startSteps();
    return clearTimers;
  }, [startSteps]);
  // 취소 · 이체 완료로 새로 불러온 홈: H1 로 되돌리고 다시
  const runFresh = () => {
    setBannerArt(true);
    setStep(0);
    setNotice(false);
    setFresh((n) => n + 1);
    setBar("top");
    setBarStill(true);
    if (scroll.current) scroll.current.scrollTop = 0;
    startSteps();
  };
  useAoHomeFresh(runFresh);

  // ---- 탭 바 · 알약 (움직임은 home.css) ----
  const onScroll = () => {
    const el = scroll.current;
    if (!el) return;
    const st = el.scrollTop;
    const max = el.scrollHeight - el.clientHeight;
    setBarStill(false);
    if (st <= 0) {
      setBar("top");
    } else if (max > 0 && st >= max - 1) {
      setBar("bottom"); // 맨 끝: +14.33 까지 (곡선 · 지연은 CSS)
    } else {
      setBar("mid");
    }
  };
  const scrollTo = (top: number) => scroll.current?.scrollTo({ top, behavior: "smooth" });

  const data = home.data;
  const name = data?.profile.userName ?? "";
  const mainNh = data?.accounts.find(isAoNh)?.id ?? "main";
  // 토스트: 탭 바 위 16 (탭 바가 숨었으면 웹뷰 아래끝 위 16)
  const toastBottom = bar === "top" ? 727 : bar === "bottom" ? 741.3 : 802;
  const copy = (text: string) => {
    try {
      void navigator.clipboard?.writeText(text).catch(() => {});
    } catch {
      /* 복사 못 해도 알림은 보임 */
    }
    aoToast("계좌번호가 복사되었어요", { bottom: toastBottom });
  };

  return (
    <div className="ao-home">
      <div className="ao-home__scroll" ref={scroll} onScroll={onScroll}>
        <div className="ao-home__content">
          {step >= 2 && (
            <div className="ao-home-banner" role="presentation">
              <p className="ao-home-abs ao-home-banner__sub">{HOME_BANNER.sub}</p>
              <p className="ao-home-abs ao-home-banner__title">{HOME_BANNER.title}</p>
              {bannerArt && <Art name={HOME_BANNER.art} x={263.85} y={19.25} />}
            </div>
          )}
          <Accounts
            key={fresh}
            accounts={data?.accounts}
            filled={step >= 3 && !!data}
            open={step < 4}
            mainNh={mainNh}
            onCopy={copy}
            onHistory={(id) => void flow.goHistory(id)}
            onSend={(id) => void flow.goSend({ from: id, origin: "home" })}
            onTopup={(id) => void flow.goTopup({ to: mainNh, from: id, origin: "card" })}
            onRetry={home.retry}
          />
          {/* 아래 칸은 처음부터 숨겨 그려 둠 (H4 에서 한 프레임에 보이기만 — 무거운 그림 준비가 +583 정기점검 시트를 늦추지 않게) */}
          <div className="ao-home-lowerwrap" hidden={step < 4}>
            {lowerReady && (
              <LowerActive.Provider value={active && step >= 4}>
                <Lower freshKey={fresh} />
              </LowerActive.Provider>
            )}
          </div>
        </div>
      </div>

      <header className="ao-home-hdr">
        <button type="button" className="ao-home-hdr__name">
          {name && (
            <>
              <b>{name}</b>
              <span>님</span>
            </>
          )}
        </button>
        <button type="button" className={`ao-home-big${bigText ? " ao-home-big--on" : ""}`} aria-pressed={bigText} onClick={() => aoPrefs.setBigText(!bigText)}>
          <span className="ao-home-big__knob" />
          <span className="ao-home-big__label">큰글</span>
        </button>
        <button type="button" className="ao-home-hdr__icon ao-home-hdr__icon--wallet" aria-label="지갑">
          <AoWalletIcon color="#000" />
        </button>
        <button type="button" className="ao-home-hdr__icon ao-home-hdr__icon--bell" aria-label="알림 (관리 패널)" onClick={() => setPanel(true)}>
          <AoBellIcon color="#000" />
        </button>
        <button type="button" className="ao-home-hdr__icon ao-home-hdr__icon--menu" aria-label="전체메뉴" onClick={() => void flow.goMenu()}>
          <AoMenuSearchIcon color="#000" />
        </button>
        <button type="button" className="ao-home-bubble">
          <span className="ao-home-bubble__text">오늘 운세</span>
          <Art name="allone-home-clover" />
        </button>
      </header>

      {step >= 1 && (
        <button
          type="button"
          className={`ao-home-pill ao-home-pill--${bar}${barStill ? " ao-home-pill--still" : ""}`}
          onClick={() => scrollTo(ASSET_TITLE_TOP - HEADER_BOTTOM - 20)}
        >
          <span className="ao-home-pill__text">내 자산 확인</span>
          <svg width="13.33" height="7.67" viewBox="0 0 13.33 7.67" aria-hidden>
            <path d="M1 1l5.67 5.67L12.33 1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 1l5.67 5.67L12.33 1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <nav className={`ao-home-bar ao-home-bar--${bar}${barStill ? " ao-home-bar--still" : ""}`} aria-label="탭">
        {HOME_TABS.map((t, i) => (
          <button key={t.key} type="button" className="ao-home-bar__tab" style={{ left: 16 + i * 72.2 }} onClick={t.key === "home" ? () => scrollTo(0) : undefined}>
            <AoTabIcon name={t.key} color="#000" style={{ left: TAB_ICON_X[i] - 16 - i * 72.2 }} />
            <span className="ao-home-bar__label">{t.label}</span>
          </button>
        ))}
      </nav>

      <NoticeSheet open={notice && active} items={data?.ao?.notice?.items ?? data?.profile.noticeItems ?? null} onClose={() => setNotice(false)} />
      <DevPanel open={panel} onClose={() => setPanel(false)} />
    </div>
  );
}

// 탭 아이콘 잉크 왼쪽 (C2 7.000): 홈 39.97 · 금융상품 113.24 · 내 자산 184.51 · 포인트쌓기 256.79 · 생활혜택 329.06
const TAB_ICON_X = [39.97, 113.24, 184.51, 256.79, 329.06];
