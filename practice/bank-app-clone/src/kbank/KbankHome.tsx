import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { formatAccountNumber, paths } from "../api/endpoints";
import type { Account, HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { DevPanel } from "../dev-panel/DevPanel";
import { useLayerActive } from "../platform/LayerContext";
import { RESTART_EVENT } from "../platform/recorder";
import { HAS_INTRO, currentProfileId } from "../profile/session";
import { KbankAdSheet, type KbankAdStage } from "./KbankAdSheet";
import { KbankCopyIcon, KbankDigits } from "./common";
import { useKbankGo } from "./nav";
import { useKbankSent } from "./notice";
import { kbBackLevel } from "./sendback";
import { kbAdCloseForLaunch, kbAdHideWeek, kbAdShouldShow, kbLaunchVariant } from "./prefs";
import { KbankTabBar } from "./tabbar";
import { kbNf, noop, useKbankStatusBar } from "./theme";
import "./kbank-home.css";

// 케이뱅크 홈 (녹화 9.47~19.5초 프레임 284~585, 이체 뒤 돌아온 42~43초 1250~1300).
// 바탕은 화면에 고정된 파랑 그라데이션, 머리줄(홈 · '● 사장님' 알약 · 종)도 고정(반투명 + 흐림), 카드들만 스크롤, 아래 탭바.
// 카드: 계좌(듀얼K · 잔액 · 가져오기/이체하기 + 'ONE n월 쓴 돈' 넘김) → 안전한 금융거래 안내 → 바로가기 4개 → 내 자산 → 흩어진 계좌 →
//       실시간 추천(가로 카드) → 새로워진 케이뱅크 홈 의견 → 간편 홈 모드 | 홈 화면 설정.
// 위치는 녹화 px ÷ 1.53646 (앱 y 는 − 33.2), kbank-home.css 에 값마다 녹화 숫자.

// 처음 들어올 때 (녹화 284 = 0): 흰 화면 284~288 → 뼈대 289~291 → 내용 292 (= C).
const FIRST_AT = { skeleton: 167, content: 267 };
// 내용(C) 뒤 시간표 (ms) — 처음 들어올 때 (녹화 프레임을 하나씩 재서 고침)
//   잔액 흐린 회색 292~305 → 306 검정 (+467), 바로가기·카드 그림 294 (+67)
//   알약: 작은 '● ㅅ'(폭 29.0) 292~305 → 305.5~316 펼침(350ms ease, 회색) → 318.5~327 파랑으로(300ms) → 406.5~418 접힘(380ms, 회색) '● 사장님'
//   'ONE 11월 쓴 돈' 넘김 칸은 319 에 끼어듦(움직임 없이) (+900)
//   309~328 동안 카드 전체가 12.1dp 아래로 내려가 있다가 329 에 제자리 (+567 ~ +1233, 둘 다 한 번에)
//   두 번째 녹화: 지난번에 보여 준 잔액을 회색으로 → +467 검정 → +567(녹화 236) 새 값과 다르면 굴림 (219~245, 광고 막 아래)
const FRESH = { balance: 467, roll: 567, pillOpen: 450, pillBlue: 880, carousel: 900, bump: 567, bumpEnd: 1233, pillClose: 3817 };
// 광고 바텀시트 (두 번째 녹화 230~236, 원본 pts): 막이 한 프레임에 깔림 +358 → 시트가 올라오기 시작 +430 (KbankAdSheet)
const AD = { dim: 358, up: 430 };
// 돌아왔을 때 (이체 완료 → 홈, 녹화 1255.5 화면이 밀려 들어오기 시작 = 0): 1268~1269 잔액 연회색(+417, 67ms) ·
//   1271.3~1298 숫자가 위에서 내려오며 바뀜(+527 → 첫 움직임이 한 프레임 늦어 +500, 850ms, 옛 숫자는 아래로 빠짐)
//   자물쇠 1269.5~1272 파랑(+467) · 1274~1276 열림(+617) = 자물쇠 한 바퀴가 −133 에서 시작한 것과 같음
const BACK = { gray: 417, grayMs: 67, roll: 500, lock: -133 };
// 자물쇠는 4.6초마다 되풀이 (녹화: 파랑 310 · 448 · 587, 회색으로 430~433 · 567~569): 잠긴 회색 → +600 파랑(100ms) → +720 열림 → 4.6초에 다시 회색
// (처음 들어올 땐 내용과 같이 시작: 310 = +600, 313~316 = +700~)
const LOCK = { blue: 600, open: 720, period: 4600 };
const ROLL_MS = 850;

// 앱을 켠 뒤 한 번만: 알약 펼침 · 넘김 칸 끼어듦 (돌아온 42초엔 처음부터 '● 사장님' · 넘김 칸 있음)
let booted = false;
// 계좌별 마지막으로 보여 준 잔액 (돌아왔을 때 옛 잔액 → 새 잔액으로 굴림). 이 브라우저(localStorage)에도 프로필별로 남겨
// 앱을 새로 켜면 그 값에서 굴림 (두 번째 녹화 219~245: 지난번 0원 회색 → 1원). 저장이 막힌 브라우저면 이번 실행만
const lastShown = new Map<string, number>();
const balKey = (acc: string) => `kb-bal-${currentProfileId() ?? "none"}-${acc}`;
function shownGet(acc: string): number | undefined {
  const k = balKey(acc);
  const m = lastShown.get(k);
  if (m !== undefined) return m;
  try {
    const v = localStorage.getItem(k);
    return v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
  } catch {
    return undefined;
  }
}
function shownSet(acc: string, v: number) {
  const k = balKey(acc);
  lastShown.set(k, v);
  try {
    localStorage.setItem(k, String(v));
  } catch {
    /* 막힘 → 이번 실행만 */
  }
}
// '● 녹화' 는 페이지를 새로 읽지 않고 시작화면부터 다시 띄움(RESTART_EVENT) → 그 뒤 홈도 '처음 들어올 때' 시간표로 (kbank2 인트로 녹화 9.47~13.9초)
window.addEventListener(RESTART_EVENT, () => {
  booted = false;
  lastShown.clear();
});
// 종 뱃지: 녹화 첫 홈 295 (F560), 이체를 마치고 돌아오면 296 (F1290 · 43.6초) → 이번 실행에서 마친 이체 수만큼 늘림
const BADGE = 295;

type Pill = "mini" | "open" | "blue" | "closed";
type Lock = "gray" | "blue" | "open";

export function KbankHome() {
  useKbankStatusBar();
  const go = useKbankGo();
  const active = useLayerActive();
  const notices = BADGE + useKbankSent().count;
  const home = useApi<HomeData>(paths.home);
  const [first] = useState(() => !booted);
  useEffect(() => {
    booted = true;
  }, []);

  // 처음: white → skeleton → content. 돌아온 뒤(다시 그려진 경우)는 바로 content
  const [phase, setPhase] = useState<"white" | "skeleton" | "content">(first ? "white" : "content");
  useEffect(() => {
    if (!first) return;
    const t = [window.setTimeout(() => setPhase("skeleton"), FIRST_AT.skeleton), window.setTimeout(() => setPhase("content"), FIRST_AT.content)];
    return () => t.forEach(clearTimeout);
  }, [first]);

  const accounts = home.data?.accounts ?? [];
  const account: Account | undefined = accounts.find((a) => a.id === "main") ?? accounts[0];
  // 🔔 관리 패널로 더한 케이뱅크 계좌 (녹화엔 계좌 하나뿐): 대표 계좌 카드 밑에 같은 모양의 카드로 (넘김 칸 없이)
  const others = accounts.filter((a) => a !== account);
  const spent = home.data?.monthlyCardSpend ?? 0; // 이번 달 체크카드 합계 또는 🔔 직접 입력 (녹화 0원)
  const userName = home.data?.profile.userName ?? "";
  const ready = phase === "content" && !!account;
  // 자료를 못 받았으면 다시 시도 (녹화에 없음 — 계좌 화면 .kba-fail 과 같은 모양), 아직 받는 중이면 뼈대를 그대로 둠
  const failed = phase === "content" && !account && home.status === "error";
  const waiting = phase === "skeleton" || (phase === "content" && !account && !failed);

  // 들어올 때마다(처음 0, 다른 화면에서 돌아오면 1, 2…) 시간표를 다시 돌림
  const [visit, setVisit] = useState(first ? 0 : 1);
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) setVisit((v) => v + 1);
    wasActive.current = active;
  }, [active]);

  const [pill, setPill] = useState<Pill>(first ? "mini" : "closed");
  const [carousel, setCarousel] = useState(!first);
  const [lock, setLock] = useState<Lock>("gray");
  const [gray, setGray] = useState(first);
  const [fresh, setFresh] = useState(first); // 그림이 한 박자 늦게 (+67ms)
  const [bump, setBump] = useState(false); // 처음 들어올 때 잠깐 카드 전체가 12.1dp 내려감
  // 보여 주는 잔액: 굴리는 중이면 from → value
  const [shown, setShown] = useState<{ value: number; from: number | null; n: number } | null>(null);
  // 돌아온 직후 굴림 시각(BACK.roll) 전엔 새 잔액이 먼저 와도 기다림 (녹화: 회색 깜빡 → 굴림 순서)
  const holdRoll = useRef(false);
  // 알약 문구: 앱을 켤 때마다 첫 녹화('홈에서 한눈에 확인하세요' 👀) / 두 번째 녹화('필요한 기능을 쉽게 찾아보세요' 🔍) 중 하나 (prefs.ts, kbank2 는 첫 녹화 고정)
  const [variant] = useState(kbLaunchVariant);
  // 광고 바텀시트: 앱을 켠 뒤 첫 홈에서만 (일주일간 보지 않기 · 이번 실행 닫음 · 관리 패널 끔 · kbank2 는 prefs.ts 가 거름)
  const [adWanted] = useState(() => first && kbAdShouldShow());
  const [ad, setAd] = useState<KbankAdStage>("off");
  const closeAd = (week: boolean) => {
    if (week) kbAdHideWeek();
    else kbAdCloseForLaunch();
    setAd("off");
  };

  const balance = account?.balance;
  const accountId = account?.id;
  const accountRef = useRef(account);
  const activeRef = useRef(active);
  const adRef = useRef(ad);
  // 아래 시간표(레이아웃 효과)보다 먼저 돌아야 같은 커밋에 온 계좌를 봄
  useLayoutEffect(() => {
    accountRef.current = account;
    activeRef.current = active;
    adRef.current = ad;
  });
  // 앞으로 가기(PC 브라우저)로 광고 시트가 쌓았던 뒤로가기 칸에 다시 들어오면 그 칸을 걷음 — 시트 없이 칸만 남아 뒤로 한 번이 헛돌지 않게 (KbankSend 와 같음)
  useEffect(() => {
    const drop = () => {
      if (activeRef.current && adRef.current === "off" && kbBackLevel() > 0) window.history.back();
    };
    window.addEventListener("popstate", drop);
    return () => window.removeEventListener("popstate", drop);
  }, []);

  // 그리기 전에 돌려야 잔액이 내용과 같은 프레임에 보이고(녹화 292) 시간표도 내용이 보인 때부터 셈
  useLayoutEffect(() => {
    const acc = accountRef.current;
    if (!ready || !acc) return;
    const t: number[] = [];
    const at = (ms: number, f: () => void) => t.push(window.setTimeout(f, ms));
    // 자물쇠 한 바퀴의 타이머는 따로 들고 바퀴마다 바꿈 (t 에 계속 쌓이지 않게 — 앞 바퀴 것은 다음 바퀴가 시작될 때 이미 다 돎)
    let lt: number[] = [];
    const lockLoop = (start: number) => {
      lt = [
        window.setTimeout(() => setLock("gray"), start),
        window.setTimeout(() => setLock("blue"), start + LOCK.blue),
        window.setTimeout(() => setLock("open"), start + LOCK.open),
        window.setTimeout(() => lockLoop(0), start + LOCK.period),
      ];
    };
    setLock("gray");
    if (visit === 0) {
      // 지난번에 보여 준 잔액이 있으면 그 값 → +567 에 새 값으로 굴림. kbank2(첫 녹화 재현)는 첫 녹화처럼 지금 잔액 그대로
      const saved = HAS_INTRO ? undefined : shownGet(acc.id);
      const old = saved ?? acc.balance;
      setShown({ value: old, from: null, n: 0 });
      if (saved === undefined) shownSet(acc.id, acc.balance);
      else {
        holdRoll.current = true;
        at(FRESH.roll, () => {
          holdRoll.current = false;
          const now = accountRef.current?.balance ?? old;
          shownSet(acc.id, now);
          if (now !== old) setShown((s) => ({ value: now, from: old, n: (s?.n ?? 0) + 1 }));
        });
      }
      if (adWanted) {
        // 다른 화면으로 먼저 떠났으면 띄우지 않음
        at(AD.dim, () => activeRef.current && setAd("dim"));
        at(AD.up, () => setAd((s) => (s === "dim" ? "up" : s)));
      }
      at(67, () => setFresh(false));
      at(FRESH.balance, () => setGray(false));
      at(FRESH.pillOpen, () => setPill("open"));
      at(FRESH.pillBlue, () => setPill("blue"));
      at(FRESH.carousel, () => setCarousel(true));
      at(FRESH.bump, () => setBump(true));
      at(FRESH.bumpEnd, () => setBump(false));
      at(FRESH.pillClose, () => setPill("closed"));
      lockLoop(0);
    } else {
      const old = shownGet(acc.id) ?? acc.balance;
      holdRoll.current = true;
      setShown({ value: old, from: null, n: 0 });
      setGray(false);
      setFresh(false);
      setCarousel(true);
      setBump(false);
      setPill((p) => (p === "mini" ? "closed" : p));
      at(BACK.gray, () => setGray(true));
      at(BACK.gray + BACK.grayMs, () => setGray(false));
      at(BACK.roll, () => {
        holdRoll.current = false;
        const now = accountRef.current?.balance ?? old;
        shownSet(acc.id, now);
        if (now !== old) setShown((s) => ({ value: now, from: old, n: (s?.n ?? 0) + 1 }));
      });
      lockLoop(BACK.lock);
    }
    return () => {
      t.forEach(clearTimeout);
      lt.forEach(clearTimeout);
      holdRoll.current = false;
    };
  }, [ready, visit, adWanted]);

  // 홈을 보고 있는 동안 잔액이 바뀌면(관리 패널 등) 바로 굴려서 새 값으로
  useEffect(() => {
    if (!active || balance === undefined || !accountId || !shown || holdRoll.current) return;
    const last = shownGet(accountId);
    if (last === undefined || last === balance) return;
    shownSet(accountId, balance);
    setShown((s) => ({ value: balance, from: s?.value ?? last, n: (s?.n ?? 0) + 1 }));
    // shown 은 시작 여부만 봄
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, accountId, active]);

  // 굴림이 끝나면 from 지움
  useEffect(() => {
    if (shown?.from == null) return;
    const t = window.setTimeout(() => setShown((s) => (s ? { ...s, from: null } : s)), ROLL_MS + 30);
    return () => clearTimeout(t);
  }, [shown?.n, shown?.from]);

  const [panelOpen, setPanelOpen] = useState(false);
  const month = new Date().getMonth() + 1;
  const scrollRef = useRef<HTMLDivElement>(null);
  usePullGreeting(scrollRef, ready);

  const copy = (acc: Account) => {
    navigator.clipboard?.writeText(formatAccountNumber(acc.bank?.pattern, acc.number ?? "")).catch(() => {});
  };

  return (
    <div className={`kb kbh ${phase === "white" || waiting ? "kbh--white" : ""} ${fresh ? "kbh--fresh" : ""}`}>
      {waiting && <Skeleton />}
      {failed && (
        <div className="kbh-fail">
          <p>계좌 정보를 불러오지 못했어요</p>
          <button onClick={home.retry}>다시 시도</button>
        </div>
      )}
      {ready && account && (
        <>
          <div className="kbh-scroll" ref={scrollRef}>
            {/* 맨 위에서 당겨 내리면 머리줄과 카드 사이에 보이는 인사말 (두 번째 녹화 17.5~17.9초). 계절 문구 하나 고정 */}
            <p className="kbh-t kbh-greet" aria-hidden>
              단풍보다 {userName}님의 하루가 더 빛나길 <span className="kbh-greet__leaf">🍁</span>
            </p>
            <div className={`kbh-page ${bump ? "kbh-page--bump" : ""}`} style={{ ["--kbh-extra" as string]: others.length }}>
              {/* 계좌 카드 */}
              <div className={`kbh-card kbh-acct ${carousel ? "kbh-acct--more" : ""}`} onClick={() => go(`/account/${encodeURIComponent(account.id)}`)}>
                <p className="kbh-t kbh-acct__title">
                  {account.label}
                  <span className="kbh-acct__no">{formatAccountNumber(account.bank?.pattern, account.number ?? "")}</span>
                  <button
                    className="kbh-acct__copy"
                    onClick={(e) => {
                      e.stopPropagation();
                      copy(account);
                    }}
                    aria-label="계좌번호 복사"
                  >
                    <KbankCopyIcon color="#67676a" size={12.4} />
                  </button>
                </p>
                <button
                  className="kbh-acct__more"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="더보기"
                >
                  <i />
                  <i />
                  <i />
                </button>
                <Balance shown={shown} gray={gray} />
                <button className="kbh-acct__btn kbh-acct__get" onClick={(e) => e.stopPropagation()}>
                  가져오기
                </button>
                <button
                  className="kbh-acct__btn kbh-acct__send"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(`/send?from=${encodeURIComponent(account.id)}`);
                  }}
                >
                  이체하기
                </button>
                {carousel && (
                  <div className="kbh-one" onClick={(e) => e.stopPropagation()}>
                    <Pic name="kbank-home-card-s" className="kbh-one__card kbh-art" />
                    <p className="kbh-t kbh-one__l1">ONE {month}월 쓴 돈</p>
                    <p className="kbh-t kbh-one__l2">{kbNf.format(spent)}원</p>
                    <div className="kbh-one__dots" aria-hidden>
                      <i className="on" />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                )}
              </div>
              {others.map((a) => (
                <ExtraAccount key={a.id} account={a} onOpen={() => go(`/account/${encodeURIComponent(a.id)}`)} onSend={() => go(`/send?from=${encodeURIComponent(a.id)}`)} onCopy={() => copy(a)} />
              ))}

              {/* 안전한 금융거래 안내 */}
              <div className="kbh-card kbh-safe">
                <p className="kbh-t kbh-safe__l1">안전한 금융거래를 위해 고객님의</p>
                <p className="kbh-t kbh-safe__l2">최신 정보를 확인하고 있어요</p>
                <p className="kbh-t kbh-safe__l3">기간 내 고객확인을 이행하지 않을 경우,</p>
                <p className="kbh-t kbh-safe__l4">관련 법에 따라 이용이 제한됩니다.</p>
                <button className="kbh-safe__x" onClick={noop} aria-label="닫기">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M1.8 1.8 10.2 10.2M10.2 1.8 1.8 10.2" stroke="#7e7e84" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                <button className="kbh-safe__go" onClick={noop}>
                  지금 확인할게요
                </button>
                <span className={`kbh-lock kbh-lock--${lock}`} aria-hidden>
                  <Pic name="kbank-home-lock-gray" className="kbh-lock__gray" />
                  <Pic name="kbank-home-lock-blue" className="kbh-lock__blue" />
                  <Pic name="kbank-home-lock" className="kbh-lock__open" />
                </span>
              </div>

              {/* 바로가기 */}
              <div className="kbh-card kbh-quick">
                {[
                  { label: "내 자산", art: "won" },
                  { label: "자동이체", art: "autosend" },
                  { label: "자동충전", art: "charge" },
                  { label: "편집하기", art: "edit" },
                ].map((q, i) => (
                  <button key={q.art} className={`kbh-quick__item kbh-quick__item--${i}`} onClick={noop}>
                    <i className="kbh-quick__box" />
                    <Pic name={`kbank-home-${q.art}`} className={`kbh-quick__art kbh-quick__art--${q.art} kbh-art`} />
                    <span className="kbh-t">{q.label}</span>
                  </button>
                ))}
              </div>

              {/* 내 자산 */}
              <div className="kbh-card kbh-asset">
                <p className="kbh-t kbh-asset__title">내 자산</p>
                <button className="kbh-asset__edit" onClick={noop}>
                  <span className="kbh-t">편집</span>
                  <Gear />
                </button>
                <p className="kbh-t kbh-asset__sec">카드</p>
                <Pic name="kbank-home-card" className="kbh-asset__card kbh-art" />
                <p className="kbh-t kbh-asset__l1">ONE {month}월 쓴 돈</p>
                <p className="kbh-t kbh-asset__l2">{kbNf.format(spent)}원</p>
                <i className="kbh-asset__line" />
                <button className="kbh-asset__all" onClick={noop}>
                  <span className="kbh-t">내 자산 모두 보기</span>
                  <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden>
                    <path d="M1 1.75 7 7 1 12.25" fill="none" stroke="#686868" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* 흩어져 있는 내 계좌 */}
              <div className="kbh-card kbh-link">
                {/* 남색 → 노랑 → 파랑 S (첫 녹화) → 하늘색 → 초록·파랑 S (두 번째 녹화 13.2~16.5초 노랑 → 파랑 S → 하늘색 → 흰 원 S).
                    kbank2(첫 녹화 재현)는 첫 녹화의 세 장 그대로 */}
                <span className={`kbh-coin ${HAS_INTRO ? "kbh-coin--v1" : ""}`} aria-hidden>
                  {(HAS_INTRO ? COINS.slice(0, 3) : COINS).map((c) => (
                    <Pic key={c} name={`kbank-home-${c}`} className="kbh-art" />
                  ))}
                </span>
                <p className="kbh-t kbh-link__t">흩어져 있는 내 계좌</p>
                <button className="kbh-link__btn" onClick={noop}>
                  연결하기
                </button>
              </div>

              {/* 실시간 추천 */}
              <div className="kbh-card kbh-rec">
                <p className="kbh-t kbh-rec__l1">{userName}님을 위한</p>
                <p className="kbh-t kbh-rec__l2">실시간 추천 서비스예요</p>
                <div className="kbh-rec__row">
                  {RECS.map((r) => (
                    <button key={r.tag} className={`kbh-rec__item kbh-rec__item--${r.kind}`} onClick={noop}>
                      <span className="kbh-rec__tag">{r.tag}</span>
                      {r.art && <Pic name={r.art} className={`kbh-rec__art kbh-rec__art--${r.kind} kbh-art`} />}
                      <b className="kbh-rec__title">{r.title}</b>
                      <span className="kbh-rec__desc kbh-rec__desc--1">{r.desc[0]}</span>
                      <span className="kbh-rec__desc kbh-rec__desc--2">{r.desc[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 의견 */}
              <button className="kbh-opinion" onClick={noop}>
                <Pic name="kbank-home-pen" className="kbh-opinion__pen" />
                <span className="kbh-t kbh-opinion__l1">새로워진 케이뱅크 홈</span>
                <span className="kbh-t kbh-opinion__l2">{userName}님의 의견이 궁금해요</span>
                <svg className="kbh-opinion__go" width="6" height="11" viewBox="0 0 6 11" aria-hidden>
                  <path d="M.8.8 5.2 5.5.8 10.2" fill="none" stroke="#606671" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="kbh-foot">
                <button className="kbh-t" onClick={noop}>
                  간편 홈 모드
                </button>
                <i />
                <button className="kbh-t" onClick={noop}>
                  홈 화면 설정
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {phase !== "white" && (
        <header className={`kbh-head ${waiting ? "kbh-head--skel" : ""}`}>
          {!waiting && (
            <>
              <h1 className="kbh-t kbh-head__title">홈</h1>
              <button className={`kbh-pill kbh-pill--${pill} kbh-pill--${variant}`} onClick={noop}>
                <span className="kbh-pill__in">
                  <i className="kbh-pill__dot" />
                  <span className="kbh-t kbh-pill__text">
                    사장님<span className="kbh-pill__more">{variant === "v2" ? ", 필요한 기능을 쉽게 찾아보세요" : ", 홈에서 한눈에 확인하세요"}</span>
                  </span>
                  {variant === "v2" ? <Pic name="kbank-home-magnifier" className="kbh-pill__mag" /> : <Pic name="kbank-home-eyes" className="kbh-pill__eyes" />}
                </span>
              </button>
              <button className="kbh-bell" onClick={() => setPanelOpen(true)} aria-label="알림 (관리 패널)">
                {/* 종: 위쪽은 뱃지에 가림. 옆선 x 4.85 · 19.15 → 아래로 벌어져 밑줄 y 15.6, 추는 가운데보다 1 왼쪽 (녹화 350) */}
                <svg width="24" height="22" viewBox="0 0 24 22" aria-hidden>
                  <path
                    d="M12 2.6C7.9 2.6 4.85 5.5 4.85 9.6v1.6c0 1.4-1.55 2.2-1.55 3.5 0 .6.4.9 1 .9h15.4c.6 0 1-.3 1-.9 0-1.3-1.55-2.1-1.55-3.5V9.6c0-4.1-3.05-7-7.15-7ZM8.1 15.6a2.9 3.3 0 0 0 5.8 0"
                    fill="none"
                    stroke="#29323e"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="kbh-bell__badge">{notices}</span>
              </button>
            </>
          )}
        </header>
      )}
      {phase === "content" && !waiting && <KbankTabBar active="홈" />}
      <KbankAdSheet stage={ad} onClose={closeAd} />
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

// 더한 계좌 카드 (녹화에 없음): 대표 계좌 카드와 같은 자리·글자 (이름·번호·복사 · ⋮ · 잔액 · 가져오기/이체하기), 넘김 칸 없음
function ExtraAccount({ account, onOpen, onSend, onCopy }: { account: Account; onOpen: () => void; onSend: () => void; onCopy: () => void }) {
  return (
    <div className="kbh-card kbh-acct" onClick={onOpen}>
      <p className="kbh-t kbh-acct__title">
        {account.label}
        <span className="kbh-acct__no">{formatAccountNumber(account.bank?.pattern, account.number ?? "")}</span>
        <button
          className="kbh-acct__copy"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          aria-label="계좌번호 복사"
        >
          <KbankCopyIcon color="#67676a" size={12.4} />
        </button>
      </p>
      <button className="kbh-acct__more" onClick={(e) => e.stopPropagation()} aria-label="더보기">
        <i />
        <i />
        <i />
      </button>
      <p className="kbh-t kbh-acct__bal"><KbankDigits prefix="kbh" text={`${kbNf.format(account.balance)}원`} /></p>
      <button className="kbh-acct__btn kbh-acct__get" onClick={(e) => e.stopPropagation()}>
        가져오기
      </button>
      <button
        className="kbh-acct__btn kbh-acct__send"
        onClick={(e) => {
          e.stopPropagation();
          onSend();
        }}
      >
        이체하기
      </button>
    </div>
  );
}

const COINS = ["coin3", "coin1", "coin2", "coin4", "coin5"];

// 실시간 추천 (녹화 16.5~16.9초, 셋째 카드는 화면 밖으로 잘려 '알뜰 / 기 / 5천' 까지만 보임 — 뒷글자는 지어 넣되
// 가운데 맞춤 줄의 왼끝이 녹화와 같도록 폭을 고름: 둘째 줄 '5천' 잉크 왼끝 353.4 ↔ '5천원 페이백')
const RECS = [
  { tag: "추천", kind: "pick", art: "kbank-home-suitcase", title: "최대 300만원", desc: ["사장님은 유급휴가", "가게는 리프레시"] },
  { tag: "1위", kind: "rank", art: "kbank-home-cards", title: "히든카드", desc: ["온라인 할인 6%", "금융혜택까지"] },
  { tag: "2위", kind: "rank", art: "", title: "알뜰폰 요금제", desc: ["기본료 할인", "5천원 페이백"] },
];


// 잔액: 큰 숫자 + '원'. 굴릴 때 바뀐 자리만 — 줄면 옛 숫자는 아래로 빠지고 새 숫자가 위에서 내려옴 (첫 녹화 1271~1298 · 두 번째 1144~1155),
// 늘면 옛 숫자는 위로 빠지고 새 숫자가 아래에서 올라옴 (두 번째 녹화 236~245 0 → 1)
function Balance({ shown, gray }: { shown: { value: number; from: number | null; n: number } | null; gray: boolean }) {
  if (!shown) return <p className="kbh-t kbh-acct__bal" />;
  const next = `${kbNf.format(shown.value)}원`;
  if (shown.from == null)
    return (
      <p className={`kbh-t kbh-acct__bal ${gray ? "kbh-acct__bal--gray" : ""}`} aria-label={next}>
        <KbankDigits prefix="kbh" text={next} />
      </p>
    );
  const prev = `${kbNf.format(shown.from)}원`;
  const len = Math.max(prev.length, next.length);
  const a = prev.padStart(len, " ");
  const b = next.padStart(len, " ");
  const up = shown.value > shown.from;
  return (
    <p key={shown.n} className={`kbh-t kbh-acct__bal ${gray ? "kbh-acct__bal--gray" : ""}`} aria-label={next}>
      {[...b].map((ch, i) =>
        ch === a[i] ? (
          <span key={i} className={ch === "1" ? "kbh-n1" : undefined}>
            {ch}
          </span>
        ) : (
          <span key={i} className={`kbh-roll ${up ? "kbh-roll--up" : ""}`}>
            <span className="kbh-roll__old"><KbankDigits prefix="kbh" text={a[i].trim()} /></span>
            <span className={`kbh-roll__new ${ch === "1" ? "kbh-n1" : ""}`}>{ch.trim()}</span>
          </span>
        ),
      )}
    </p>
  );
}

// 뼈대 (녹화 289~291, 흰 바탕에 #eff0f3 네모): 머리줄 x 30~95 · y 70~120px, 카드 y 139~273 / 292~784 / 803~957, 막대 976~1012 / 1031~1056
function Skeleton() {
  return (
    <div className="kbh-skel" aria-hidden>
      <i style={{ left: 19.5, top: 12.4, width: 42.3, height: 32.5, borderRadius: 8 }} />
      <i style={{ top: 57.3, height: 87.2 }} />
      <i style={{ top: 156.8, height: 320.2 }} />
      <i style={{ top: 489.4, height: 100.2 }} />
      <i style={{ top: 602.0, height: 23.4 }} />
      <i style={{ top: 637.8, height: 16.3 }} />
    </div>
  );
}

// 편집 옆 톱니 (녹화 350 잉크 x 330.2~342.7 · y 700.3~713.7 → 12.5 × 13.4dp, #7e7d85): 꽃잎 6개 둘레(r = 5.4 + 0.8·cos 6θ) + 가운데 원
const GEAR = `M${Array.from({ length: 72 }, (_, i) => {
  const t = (Math.PI * 2 * i) / 72;
  const r = 5.4 + 0.8 * Math.cos(6 * t);
  return `${(6.5 + r * Math.sin(t)).toFixed(2)} ${(7 - r * Math.cos(t)).toFixed(2)}`;
}).join(" L")}Z`;
function Gear() {
  return (
    <svg width="13" height="14" viewBox="0 0 13 14" aria-hidden>
      <path d={GEAR} fill="none" stroke="#7e7d85" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="6.5" cy="7" r="2" fill="none" stroke="#7e7d85" strokeWidth="1.2" />
    </svg>
  );
}

function Pic({ name, className = "" }: { name: string; className?: string }) {
  const src = localAsset(name);
  return src ? <img className={className} src={src} alt="" draggable={false} /> : <i className={className} />;
}

// 맨 위에서 당겨 내리기 (두 번째 녹화 17.38~17.89초, 원본 프레임 시각으로 카드 위끝을 잼): 카드 묶음이 끈 거리 × 0.5 만큼 내려가고
// 최대 47.5 (녹화 카드 위끝 140 → 213px). 인사말은 0.6배로 따라 내려오며(잉크 아래끝 76.1 @43 → 79.4 @47.5) 나타남.
// 불투명도는 당긴 거리 30 → 42 에서 0 → 1 을 목표로 시간 상수 50ms 로 따라감 — 녹화는 놓은 뒤에도 한 프레임 더 진해짐
// (가장 진한 잉크 202 · 191 · 177 · 165 · 155 → 놓고 148 · 152 · 160 · 179 · 193, 25ms 간격). 놓으면 250ms ease 로 제자리
// (녹화 2116 → 2147: 남은 거리 .92 · .81 · .61 · .44 · .36 · .22 · .15 · .08 — 200ms 에 97%). 새로고침 표시 없음.
// PC 는 마우스 끌기, 폰은 터치. 맨 위(scrollTop 0)에서 아래로 끌 때만, 위로 끌면 보통 스크롤. 끄는 동안은 누름 표시를 풂(kbank-home.css)
// 놓은 뒤에는 인사말이 더 빨리 옅어짐 (시간 상수 25ms — 50 그대로면 약하게 당긴 13~17dp 에서 녹화보다 오래 남았음: 가장 진한 화소 녹화 220 · 223, 클론 204 · 210)
const PULL = { k: 0.5, max: 47.5, slop: 4, releaseMs: 250, from: 30, to: 42, tau: 50, tauBack: 25 };
const easeCss = cubicBezier(0.25, 0.1, 0.25, 1);

function usePullGreeting(ref: RefObject<HTMLDivElement | null>, on: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    let pull = 0; // 지금 당긴 거리 (dp)
    let op = 0; // 인사말 불투명도 (0~1, CSS 에서 × 0.35)
    let raf = 0;
    let last = 0;
    let drag: { x: number; y: number; id: number | null; base: number; pulling: boolean } | null = null;
    let rel: { from: number; t0: number } | null = null;
    let swallowUntil = 0; // 마우스로 당긴 뒤 따라오는 click 은 버림

    const paint = () => {
      if (pull > 0.01 || op > 0.002) {
        el.style.setProperty("--kbh-pull", `${pull.toFixed(2)}px`);
        el.style.setProperty("--kbh-greet", op.toFixed(3));
        el.dataset.pull = drag?.pulling ? "drag" : "back";
      } else {
        el.style.removeProperty("--kbh-pull");
        el.style.removeProperty("--kbh-greet");
        delete el.dataset.pull;
      }
    };
    const tick = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      if (rel) {
        const t = Math.min(1, (now - rel.t0) / PULL.releaseMs);
        pull = rel.from * (1 - easeCss(t));
        if (t >= 1) {
          rel = null;
          pull = 0;
        }
      }
      const target = Math.min(1, Math.max(0, (pull - PULL.from) / (PULL.to - PULL.from)));
      op += (target - op) * (1 - Math.exp(-dt / (drag?.pulling ? PULL.tau : PULL.tauBack)));
      if (!drag?.pulling && !rel && op < 0.003) op = 0;
      paint();
      raf = drag?.pulling || rel || op > 0 ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const start = (x: number, y: number, id: number | null) => {
      drag = el.scrollTop <= 0 ? { x, y, id, base: pull, pulling: false } : null;
    };
    // 이 끌기를 당김으로 가져갔으면 true
    const move = (x: number, y: number) => {
      if (!drag) return false;
      const dy = y - drag.y;
      const dx = Math.abs(x - drag.x);
      if (!drag.pulling) {
        if (Math.max(dx, Math.abs(dy)) < PULL.slop) return false;
        if (dy <= 0 || dx > dy || el.scrollTop > 0) {
          drag = null; // 위로(보통 스크롤) · 옆으로 끌기는 당김 아님
          return false;
        }
        drag.pulling = true;
        rel = null;
      }
      pull = Math.min(PULL.max, Math.max(0, drag.base + dy * PULL.k));
      kick();
      return true;
    };
    const end = () => {
      const was = drag?.pulling;
      drag = null;
      if (!was) return;
      swallowUntil = performance.now() + 300;
      rel = { from: pull, t0: performance.now() };
      kick();
    };

    // 마우스 (터치는 아래 touch* 로 — 터치의 pointer 는 스크롤이 시작되면 pointercancel 로 끊김)
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button === 0) start(e.clientX, e.clientY, e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      if (!(e.buttons & 1)) return end(); // 폰 밖에서 뗌
      if (move(e.clientX, e.clientY) && !el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
    };
    const onUp = (e: PointerEvent) => {
      if (drag && drag.id === e.pointerId) end();
    };
    const onClick = (e: MouseEvent) => {
      if (performance.now() < swallowUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const onSelect = (e: Event) => {
      if (drag) e.preventDefault(); // 마우스로 끄는 동안 글자가 선택되지 않게
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY, null);
      else if (drag?.id === null) end();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!drag || drag.id !== null || e.touches.length !== 1) return;
      if (move(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = () => {
      if (drag?.id === null) end();
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", onClick, true);
    el.addEventListener("selectstart", onSelect);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("selectstart", onSelect);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.style.removeProperty("--kbh-pull");
      el.style.removeProperty("--kbh-greet");
      delete el.dataset.pull;
    };
  }, [ref, on]);
}

// CSS cubic-bezier 와 같은 곡선 (뉴턴법으로 x → t)
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = ((ax * t + bx) * t + cx) * t - x;
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(e) < 1e-5 || !d) break;
      t = Math.min(1, Math.max(0, t - e / d));
    }
    return ((ay * t + by) * t + cy) * t;
  };
}
