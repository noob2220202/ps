import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { Account, HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { DevPanel } from "../dev-panel/DevPanel";
import { ibkNumber, nf } from "./bank";
import { IbkBankLogo, IbkHeader, IbkHeaderIcon, IbkHomeSkeleton, IbkIcon, IbkTabBar } from "./common";
import { holdIbkSpinner } from "./loading";
import { IBK_PAGE, useIbkGo } from "./nav";
import { useIbkStatusBar } from "./theme";
import "./ibk-home.css";

// i-ONE Bank 홈 (spec/home.md, 녹화 82d59fba 4.3~9.2 · 43.8~46.9 · 89.3~95.3 · 145.7~153초). 위에서부터:
//   머리줄(할 일 · 종 · 상담 · ≡) → 큰 배너(문구 2줄 + 그림) → 기업은행|다른금융 폴더 탭 + 쉬운뱅킹 칩 →
//   계좌 카드(이름·번호⧉·⋮·잔액 원 ↻·이체/ATM출금, 옆으로 밀면 다음 계좌) → 페이지 점 → 최근 이체내역|신분증·지갑 →
//   나만의 맞춤메뉴 타일 4개 → 프로모 배너(5장 자동 넘김, 위 40dp 만 보이고 나머지는 탭바 밑) → 아래 탭바(공용)
// 좌표는 클론 좌표 (x = (녹화 x − 0.35) / 1.0242, 앱 영역 y = 녹화 y − 29.4). 값은 ibk-home.css 에 녹화 위치와 같이 적음

// 홈이 나타나는 세 가지 (spec 6-2 · 6-3 · 6-5)
//  first    : 앱을 처음 켤 때 (시작화면이 뼈대를 이미 보여 줌) → 바로 내용, 잔액 0 부터 카운트업
//  return   : 다른 화면에서 돌아올 때 → 빈 껍데기(#fafafa + 탭바, 가운데 버튼 로티) 300ms → 내용 → 점 잠깐 → 잔액 0 부터 카운트업
//  skeleton : 이체 완료 '확인' 뒤 → 흰 1프레임 → 껍데기 + 점 → 뼈대 → 내용, 잔액은 이전 값 → 새 값 (2프레임)
type Mode = "first" | "return" | "skeleton";
// return: 내용 a 4.300→4.667 · b 43.767→44.067 · c 89.267→89.533 (267~367ms) → 300.
//   점: 내용 뒤 0.24~0.56초에 떠서 0.14~0.43초 (b 44.63~44.77, c 89.77~90.07, a 5.07~5.5) → +400 ~ +700.
//   카운트업 시작: 내용 뒤 0.80~0.87초 (b 44.933, c 90.333) → +800, ↻ 는 한 프레임(33ms) 먼저
const RETURN_AT = { content: 300, spinOn: 700, spinOff: 1000, spin: 1067, count: 1100 };
// skeleton: 녹화 145.700 흰 1프레임 → 145.767 #fafafa → 145.867 점 → 148.200 뼈대 → 149.53 점 끔 → 150.667 내용 (5초).
//   기다림은 통신 시간이라 시작화면(IbkSplash)과 같은 비율로 줄임
const SKELETON_AT = { white: 67, spinOn: 170, skeleton: 500, spinOff: 1830, content: 2970 };
// 잔액 카운트업 (6-3): 화면 값 = min(목표, k × ⌈목표/50⌉), k = 1…50 이 시간에 선형. b 0.53초 · c 0.66초 → 600ms.
// 완료 → 홈은 이전 값 → 새 값 2단계 (14,560,905 → …850 → …805, 2프레임 = 67ms)
const COUNT = { steps: 50, ms: 600 };
const COUNT_AFTER_TRANSFER = { steps: 2, ms: 67 };
// ↻ 한 바퀴 800ms(24프레임) 선형, 시계 방향 (b 44.90 20° → 45.633 350°)
const REFRESH_SPIN_MS = 800;

// 처음 켤 때인지 (StrictMode 가 초기값 함수를 두 번 불러도 같게 — 값은 effect 에서 바꿈)
let booted = false;
// 계좌마다 마지막으로 보여 준 잔액 (완료 → 홈 때 이전 값에서 새 값으로)
const lastShown = new Map<string, number>();

// 나만의 맞춤메뉴 (spec 3-8): 클론 x 34.0 / 121.7 / 209.6 / 297.3
const TILES = [
  { label: "전체계좌조회", x: 34.0, art: "ibk-menu-allacct" },
  { label: "IBK포인트", x: 121.7, art: "ibk-menu-point" },
  { label: "i-ONE 가드", x: 209.6, art: "ibk-menu-guard" },
  { label: "추가", x: 297.3 },
];
// 프로모 배너 5장 (spec 3-9, 녹화에 나온 순서): 바탕 · 제목 · 글자색 · 부제 · 오른쪽 그림
const PROMOS = [
  { bg: "#141414", color: "#fff", title: "2026 더아트프라자", art: "ibk-promo-2026" },
  { bg: "#fa6e3c", color: "#fff", title: "계좌개설하고 주식받자!", sub: "IBK기업은행 x IBK투자증권", art: "ibk-promo-gift" },
  { bg: "#dbf6d7", color: "#111", title: "Npay 포인트 전환 EVENT", art: "ibk-promo-npay" },
  { bg: "#fbe5fc", color: "#111", title: "모으기 신청하고 커피 받자♥", art: "ibk-promo-pig" },
  { bg: "#d9f4fd", color: "#111", title: "키자니아 기업은행OPEN", art: "ibk-promo-kidzania" },
];
// 자동 넘김: 한 장이 멈춘 뒤 약 3.3초 (3.27 / 3.23 / 2.9s) 뒤 다음 장, 넘김 270ms
const PROMO_MS = 3300;
const PROMO_SLIDE_MS = 270;

export function IbkHome() {
  useIbkStatusBar();
  const go = useIbkGo();
  const location = useLocation();
  const navType = useNavigationType();
  const home = useApi<HomeData>(paths.home);
  const [mode] = useState<Mode>(() => {
    const st = location.state as { ibkHome?: string; ibkAnim?: string } | null;
    if (!booted) return "first";
    if (st?.ibkHome === "skeleton" || (navType === "REPLACE" && !st?.ibkAnim && !st?.ibkHome)) return "skeleton";
    return "return";
  });
  useEffect(() => {
    booted = true;
  }, []);

  // 화면 단계: white(흰 1프레임) → shell(빈 껍데기) → skeleton(뼈대) → ready(내용)
  const [phase, setPhase] = useState<"white" | "shell" | "skeleton" | "ready">(
    mode === "first" ? "ready" : mode === "skeleton" ? "white" : "shell",
  );
  const [waited, setWaited] = useState(mode === "first"); // 껍데기·뼈대 시간이 다 지났는지
  const loaded = home.data !== undefined;
  const ready = phase === "ready" && loaded;

  const [notice, setNotice] = useState<string | null>(null);
  const soon = () => setNotice("연습용 앱에서는 준비 중인 메뉴예요.");
  const [panelOpen, setPanelOpen] = useState(false); // 종 → 관리 패널

  // 계좌: 기업은행 계좌만 (다른 은행 계좌는 '다른금융' 몫). 대표 main 이 첫 장
  const all = home.data?.accounts ?? [];
  const mine = all.filter((a) => a.bank?.code === "ibk");
  const accounts = (mine.length ? mine : all).toSorted((a, b) => Number(b.id === "main") - Number(a.id === "main"));
  const [page, setPage] = useState(0);
  const idx = Math.min(page, Math.max(accounts.length - 1, 0));
  const account: Account | undefined = accounts[idx];

  // 잔액 카운트업 · ↻ 돌기
  const [count, setCount] = useState<{ id: string; value: number } | null>(null);
  const [spinKey, setSpinKey] = useState(0); // 바뀌면 ↻ 한 바퀴
  const countRaf = useRef(0);
  const runCount = (acc: Account, from: number, o: { steps: number; ms: number }) => {
    cancelAnimationFrame(countRaf.current);
    const to = acc.balance;
    const d = to - from;
    if (!d) {
      setCount(null);
      return;
    }
    const unit = Math.ceil(Math.abs(d) / o.steps);
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(o.steps, Math.floor(((now - t0) / o.ms) * o.steps) + 1);
      const value = from + Math.sign(d) * Math.min(Math.abs(d), k * unit);
      if (value === to) {
        setCount(null);
        return;
      }
      setCount({ id: acc.id, value });
      countRaf.current = requestAnimationFrame(tick);
    };
    tick(t0);
  };
  useEffect(() => () => cancelAnimationFrame(countRaf.current), []);

  // 껍데기 · 뼈대 시간표
  useEffect(() => {
    if (mode === "first") return;
    const at = mode === "skeleton" ? SKELETON_AT : null;
    let release: (() => void) | null = null;
    const t: number[] = [];
    if (at) {
      t.push(window.setTimeout(() => setPhase("shell"), at.white));
      t.push(window.setTimeout(() => (release = holdIbkSpinner()), at.spinOn));
      t.push(window.setTimeout(() => setPhase("skeleton"), at.skeleton));
      t.push(window.setTimeout(() => (release?.(), (release = null)), at.spinOff));
      t.push(window.setTimeout(() => setWaited(true), at.content));
    } else {
      t.push(window.setTimeout(() => setWaited(true), RETURN_AT.content));
    }
    return () => {
      t.forEach(clearTimeout);
      release?.();
    };
  }, [mode]);
  useEffect(() => {
    if (waited) setPhase("ready");
  }, [waited]);
  // 자료를 아직 못 받았으면 받을 때까지 점 (껍데기 위)
  useEffect(() => (waited && !loaded ? holdIbkSpinner() : undefined), [waited, loaded]);

  // 내용이 나타난 뒤: 잔액 새로고침 (6-3)
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !account || startedFor.current) return;
    startedFor.current = account.id;
    const acc = account;
    if (mode === "skeleton") {
      runCount(acc, lastShown.get(acc.id) ?? 0, COUNT_AFTER_TRANSFER);
      return;
    }
    if (mode === "first") {
      setSpinKey((k) => k + 1);
      runCount(acc, 0, COUNT);
      return;
    }
    let release: (() => void) | null = null;
    const base = RETURN_AT.content;
    const t = [
      window.setTimeout(() => (release = holdIbkSpinner()), RETURN_AT.spinOn - base),
      window.setTimeout(() => (release?.(), (release = null)), RETURN_AT.spinOff - base),
      window.setTimeout(() => setSpinKey((k) => k + 1), RETURN_AT.spin - base),
      window.setTimeout(() => runCount(acc, 0, COUNT), RETURN_AT.count - base),
    ];
    return () => {
      t.forEach(clearTimeout);
      release?.();
    };
    // 한 번만 (내용이 처음 나타날 때)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, account?.id]);
  // 보여 준 잔액 기억
  useEffect(() => {
    if (ready) for (const a of accounts) lastShown.set(a.id, a.balance);
  });

  // ↻ 누름: 잔액 다시 받고(점 300ms) → 0 부터 카운트업 + ↻ 한 바퀴 (녹화엔 직접 누른 장면 없음 → 홈 복귀 때와 같게)
  const refresh = async () => {
    if (!account) return;
    const acc = account;
    const release = holdIbkSpinner();
    home.retry();
    await new Promise((r) => setTimeout(r, 300));
    release();
    await new Promise((r) => setTimeout(r, 100));
    setSpinKey((k) => k + 1);
    runCount(acc, 0, COUNT);
  };

  const copy = (acc: Account) => {
    const text = ibkNumber(acc.bank, acc.number ?? "");
    navigator.clipboard?.writeText(text).catch(() => {});
    setNotice("계좌번호가 복사되었어요.");
  };

  const toSend = () => account && go(`/send?from=${encodeURIComponent(account.id)}`, IBK_PAGE);
  const toHistory = (acc: Account) => go(`/history/${encodeURIComponent(acc.id)}`, IBK_PAGE);

  const shell = phase === "white" || phase === "shell" || (phase === "ready" && !loaded);
  return (
    <div className={`ibk ibh ${shell ? "ibh--shell" : ""} ${phase === "white" ? "ibh--white" : ""}`}>
      {phase === "skeleton" && <IbkHomeSkeleton />}
      {ready && (
        <div className="ibh-scroll">
          <div className="ibh-page">
            <IbkHeader
              className="ibh-header"
              bg="transparent"
              left={
                <button className="ibh-todo" onClick={soon}>
                  <span className="ibk-bl">할 일</span>
                  <IbkIcon name="todo" />
                </button>
              }
              right={
                <>
                  <IbkHeaderIcon name="bell" cx={276.0} onClick={() => setPanelOpen(true)} label="알림 (관리 패널)" />
                  <IbkHeaderIcon name="headset" cx={317.1} onClick={soon} label="상담" />
                  <IbkHeaderIcon name="menu" cx={358.1} onClick={() => go("/menu", { anim: "menu-in" })} label="전체메뉴" />
                </>
              }
            />

            <button className="ibh-banner" onClick={soon}>
              <span className="ibk-bl ibh-banner__l1">IBK 단독 포켓몬 굿즈와</span>
              <span className="ibk-bl ibh-banner__l2">I-포켓몬(신용) 구경가자!</span>
              <Pic name="ibk-home-banner-art" className="ibh-banner__art" />
            </button>

            <div className="ibh-card">
              <div className="ibh-card__body">
                <AccountPager
                  accounts={accounts}
                  idx={idx}
                  onPage={setPage}
                  render={(acc, on) => (
                    <div className="ibh-acct" onClick={() => toHistory(acc)}>
                      <b className="ibk-bl ibh-acct__name">{acc.label}</b>
                      <span className="ibk-bl ibh-acct__no">
                        {ibkNumber(acc.bank, acc.number ?? "")}
                        <button
                          className="ibh-acct__copy"
                          onClick={(e) => {
                            e.stopPropagation();
                            copy(acc);
                          }}
                          aria-label="계좌번호 복사"
                        >
                          <IbkIcon name="copy" scale={0.95} sw={1.1} />
                        </button>
                      </span>
                      <button
                        className="ibh-acct__more"
                        onClick={(e) => {
                          e.stopPropagation();
                          soon();
                        }}
                        aria-label="더보기"
                      >
                        <IbkIcon name="more" />
                      </button>
                      <strong className="ibk-bl ibh-acct__bal">{nf.format(on && count?.id === acc.id ? count.value : acc.balance)}</strong>
                      <span className="ibk-bl ibh-acct__won">원</span>
                      <button
                        className="ibh-acct__refresh"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (on) void refresh();
                        }}
                        aria-label="잔액 새로고침"
                      >
                        <IbkIcon key={on ? spinKey : 0} name="refresh" className={on && spinKey ? "ibh-spin" : ""} />
                      </button>
                      <button
                        className="ibh-acct__btn ibh-acct__send"
                        onClick={(e) => {
                          e.stopPropagation();
                          toSend();
                        }}
                      >
                        <span className="ibk-bl">이체</span>
                      </button>
                      <button
                        className="ibh-acct__btn ibh-acct__atm"
                        onClick={(e) => {
                          e.stopPropagation();
                          soon();
                        }}
                      >
                        <span className="ibk-bl">ATM출금</span>
                      </button>
                    </div>
                  )}
                />
              </div>
              <FolderTabs />
              <button className="ibh-tab ibh-tab--ibk">
                <IbkBankLogo bank={{ code: "ibk" }} size={23.7} className="ibh-tab__logo" />
                <span className="ibk-bl">기업은행</span>
              </button>
              <button className="ibh-tab ibh-tab--other" onClick={soon}>
                <span className="ibk-bl">다른금융</span>
              </button>
              <button className="ibh-easy" onClick={soon}>
                <span className="ibk-bl ibh-easy__s">가</span>
                <span className="ibk-bl ibh-easy__b">가</span>
                <span className="ibk-bl ibh-easy__t">쉬운뱅킹</span>
              </button>
            </div>

            <div className="ibh-dots" aria-hidden>
              {accounts.map((a, i) => (
                <i key={a.id} className={i === idx ? "on" : ""} />
              ))}
            </div>

            <div className="ibh-quick">
              <button className="ibh-quick__item" onClick={() => go("/results", IBK_PAGE)}>
                <Pic name="ibk-home-recent" className="ibh-quick__recent" />
                <span className="ibk-bl ibh-quick__t1">최근 이체내역</span>
                <IbkIcon name="chevron-right" w={4.4} h={9} sw={1.4} className="ibh-quick__go1" />
              </button>
              <button className="ibh-quick__item ibh-quick__item--r" onClick={soon}>
                <Pic name="ibk-home-idcard" className="ibh-quick__id" />
                <span className="ibk-bl ibh-quick__t2">신분증·지갑</span>
                <IbkIcon name="chevron-right" w={4.4} h={9} sw={1.4} className="ibh-quick__go2" />
              </button>
            </div>

            <b className="ibk-bl ibh-my">나만의 맞춤메뉴</b>
            {TILES.map((t) => (
              <button key={t.label} className={`ibh-tile ${t.art ? "" : "ibh-tile--add"}`} style={{ left: t.x }} onClick={soon}>
                <i className="ibh-tile__box">{t.art ? <Pic name={t.art} className="ibh-tile__art" /> : <IbkIcon name="plus" className="ibh-tile__plus" />}</i>
                <span className="ibk-bl">{t.label}</span>
              </button>
            ))}

            <PromoCarousel onOpen={soon} />
          </div>
        </div>
      )}
      <IbkTabBar
        center={<TalkButton play={mode !== "first"} />}
        onTab={(label) => (label === "톡톡송금" ? go(account ? `/send?from=${encodeURIComponent(account.id)}` : "/send", IBK_PAGE) : soon())}
      />
      <Dialog message={notice} onClose={() => setNotice(null)} />
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

function Pic({ name, className = "" }: { name: string; className?: string }) {
  const src = localAsset(name);
  return src ? <img className={className} src={src} alt="" draggable={false} /> : <i className={`${className} ibh-pic--empty`} />;
}

// 기업은행 | 다른금융 폴더 탭 (spec 3-4): 흰 탭은 카드와 한 몸, 회색 탭(#e0e5eb)은 같은 모양을 91.1 오른쪽으로 옮겨 흰 탭 뒤에.
// 흰 탭 오른쪽 윤곽(녹화 y → 클론 x): 194→114.6 · 200→124.8 · 210→130.5 · 222→131.4 · 230→135.5 · 234→142.0
//  = 볼록 원 r22 (중심 109.2, 215.9) → 세로 131.2 → 오목 원 r15 (중심 146.2, 219.8) → 카드 윗변 234.8. 왼쪽 위 r12.5(가로 12.2)
// 좌표: 카드 왼쪽 위(클론 18.5, 녹화 193.9) 기준
const TAB_PATH = "M0,40.9 V12.5 A12.2,12.5 0 0 1 12.2,0 H90.7 A22,22 0 0 1 112.7,22 V25.9 A15,15 0 0 0 127.7,40.9 Z";
function FolderTabs() {
  return (
    <svg className="ibh-tabs" width="347" height="41" viewBox="0 0 347 41" aria-hidden>
      <path d={TAB_PATH} transform="translate(91.1 0)" fill="#e0e5eb" />
      <path d={TAB_PATH} fill="#fff" />
    </svg>
  );
}

// 계좌 카드 안 내용을 옆으로 밀어 다음 계좌 (녹화에 넘기는 장면은 없음 → 안드로이드 ViewPager 처럼 손을 따라가다 놓으면 붙음).
// 카드 몸통(폭 347) 안에서만 보임. 가로로 8px 넘게 움직이면 밀기, 놓을 때 50px 넘게 밀었거나 빠르게 튕겼으면 넘김
const PAGE_W = 347;
function AccountPager({
  accounts,
  idx,
  onPage,
  render,
}: {
  accounts: Account[];
  idx: number;
  onPage: (i: number) => void;
  render: (acc: Account, on: boolean) => ReactNode;
}) {
  const drag = useRef<{ x: number; y: number; t: number; id: number; on: boolean } | null>(null);
  const moved = useRef(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const n = accounts.length;
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (n < 2) return;
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, on: false };
    moved.current = false;
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.on) {
      if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) {
        d.on = true;
        moved.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      } else if (Math.abs(my) > 8) drag.current = null;
      return;
    }
    const edge = (idx === 0 && mx > 0) || (idx === n - 1 && mx < 0);
    setDx(edge ? mx * 0.3 : mx);
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on) return;
    const mx = e.clientX - d.x;
    const fast = Math.abs(mx) / Math.max(1, performance.now() - d.t) > 0.5;
    if ((mx < -50 || (fast && mx < -15)) && idx < n - 1) onPage(idx + 1);
    else if ((mx > 50 || (fast && mx > 15)) && idx > 0) onPage(idx - 1);
    setDragging(false);
    setDx(0);
  };
  return (
    <div
      className={`ibh-pager ${dragging ? "ibh-pager--drag" : ""}`}
      style={{ transform: `translateX(${-idx * PAGE_W + dx}px)` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(e) => {
        if (!moved.current) return;
        moved.current = false;
        e.stopPropagation();
      }}
    >
      {accounts.map((a, i) => (
        <div key={a.id} className="ibh-pager__page" style={{ left: i * PAGE_W }}>
          {render(a, i === idx)}
        </div>
      ))}
    </div>
  );
}

// 프로모 배너 (spec 3-9): 왼쪽으로 밀며 다음 장 (피치 366 = 배너 346.9 + 사이 19, 270ms 감속). 끝에서 첫 장으로는 이어서 돎
function PromoCarousel({ onOpen }: { onOpen: () => void }) {
  const [p, setP] = useState(0);
  const [jump, setJump] = useState(false); // 마지막(첫 장 사본) → 첫 장으로 순간 이동
  useEffect(() => {
    const t = window.setTimeout(() => {
      setJump(false);
      setP((v) => v + 1);
    }, PROMO_MS);
    return () => clearTimeout(t);
  }, [p]);
  useEffect(() => {
    if (p < PROMOS.length) return;
    const t = window.setTimeout(() => {
      setJump(true);
      setP(0);
    }, PROMO_SLIDE_MS);
    return () => clearTimeout(t);
  }, [p]);
  return (
    <div className="ibh-promo">
      <div className={`ibh-promo__track ${jump ? "ibh-promo__track--jump" : ""}`} style={{ transform: `translateX(${-p * 366}px)` }}>
        {[...PROMOS, PROMOS[0]].map((b, i) => (
          <button key={i} className="ibh-promo__card" style={{ left: 18.2 + i * 366, background: b.bg, color: b.color }} onClick={onOpen}>
            {b.sub && <span className="ibk-bl ibh-promo__sub">{b.sub}</span>}
            <b className="ibk-bl ibh-promo__title">{b.title}</b>
            <Pic name={b.art} className="ibh-promo__art" />
          </button>
        ))}
      </div>
    </div>
  );
}

// 가운데 톡톡송금 버튼 + 로티 (spec 6-4, 녹화 145.700 기준 30fps): 파란 원판이 세로로 선 채 돌며 나타남(0~233ms) →
// 흰 말풍선이 오른쪽으로 빠져나감(200~333) → 왼쪽에서 들어와 제자리(367~533) → 뾰족한 끝이 왼쪽 아래 꼬리로, 속도선 2개가 자람(533~767).
// 정지 모습은 공용 IbkTalkButton 과 같은 도형
function TalkButton({ play }: { play: boolean }) {
  return (
    <svg className={`ibk-tabbar__talk ibh-talk ${play ? "ibh-talk--play" : ""}`} width="44.5" height="44.5" viewBox="0 0 44.5 44.5" aria-hidden>
      <defs>
        <linearGradient id="ibh-talk-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c85ee" />
          <stop offset="1" stopColor="#2977e5" />
        </linearGradient>
        <clipPath id="ibh-talk-clip">
          <circle cx="22.25" cy="22.25" r="22.25" />
        </clipPath>
      </defs>
      <g className="ibh-talk__disc">
        <circle cx="22.25" cy="22.25" r="22.25" fill="url(#ibh-talk-g)" />
        <g clipPath="url(#ibh-talk-clip)">
          <g className="ibh-talk__bubble">
            <circle cx="23.2" cy="21.9" r="9.9" fill="#fff" />
            <path className="ibh-talk__point" d="M9.6 21.9 15.9 15.3v13.2Z" fill="#fff" />
            <path className="ibh-talk__tail" d="M15 25.5 12.6 30.6l6.3-2.2Z" fill="#fff" />
            <path
              d="M18.4 19.4l1.75 5.6 2.5-5.1 2.5 5.1 1.75-5.6M17.6 21.3h11.2"
              fill="none"
              stroke="#2b72d6"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </g>
          <path className="ibh-talk__lines" d="M8.4 25.4h4.4M9.3 29h3.9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
