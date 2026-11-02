import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatAccountNumber, paths } from "../api/endpoints";
import type { Account, HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { DevPanel } from "../dev-panel/DevPanel";
import { useLayerActive } from "../platform/LayerContext";
import { KbankCopyIcon } from "./KbankAccount";
import { KbankTabBar } from "./tabbar";
import { useKbankStatusBar } from "./theme";
import "./kbank-home.css";

// 케이뱅크 홈 (녹화 9.47~19.5초 프레임 284~585, 이체 뒤 돌아온 42~43초 1250~1300).
// 바탕은 화면에 고정된 파랑 그라데이션, 머리줄(홈 · '● 사장님' 알약 · 종)도 고정(반투명 + 흐림), 카드들만 스크롤, 아래 탭바.
// 카드: 계좌(듀얼K · 잔액 · 가져오기/이체하기 + 'ONE n월 쓴 돈' 넘김) → 안전한 금융거래 안내 → 바로가기 4개 → 내 자산 → 흩어진 계좌 →
//       실시간 추천(가로 카드) → 새로워진 케이뱅크 홈 의견 → 간편 홈 모드 | 홈 화면 설정.
// 위치는 녹화 px ÷ 1.53646 (앱 y 는 − 33.2), kbank-home.css 에 값마다 녹화 숫자.

// 처음 들어올 때 (녹화 284 = 0): 흰 화면 284~288 → 뼈대 289~291 → 내용 292 (= C).
const FIRST_AT = { skeleton: 167, content: 267 };
// 내용(C) 뒤 시간표 (ms) — 처음 들어올 때
//   잔액 흐린 회색 292~305 → 306 검정 (+467), 바로가기·카드 그림 294 (+67)
//   알약: 작은 '● ㅅ'(폭 29.3) 292~305 → 306~316 펼침(333ms, 회색) → 313~322 파랑으로(300ms) → 407~419 접힘(400ms, 회색) '● 사장님'
//   'ONE 11월 쓴 돈' 넘김 칸은 319 에 끼어듦(움직임 없이) (+900)
//   자물쇠: 잠긴 회색 → 312 파랑 → 314 열림 (+450 · +550 쯤, 돌아온 42초와 같은 순서)
const FRESH = { balance: 467, pillOpen: 467, pillBlue: 700, carousel: 900, pillClose: 3830, lockBlue: 450, lockOpen: 550 };
// 돌아왔을 때 (이체 완료 → 홈, 녹화 1250 화면이 밀려 들어오기 시작 = 0): 1262~1263 잔액 회색(+400, 67ms) →
//   1268~1276 숫자가 위에서 내려오며 바뀜(+600, 270ms, 옛 숫자는 아래로 빠짐) · 자물쇠 1270 파랑(+667) · 1274 열림(+800)
const BACK = { gray: 400, grayMs: 67, roll: 600, lockBlue: 667, lockOpen: 800 };
const ROLL_MS = 270;

// 앱을 켠 뒤 한 번만: 알약 펼침 · 넘김 칸 끼어듦 (돌아온 42초엔 처음부터 '● 사장님' · 넘김 칸 있음)
let booted = false;
// 계좌별 마지막으로 보여 준 잔액 (돌아왔을 때 옛 잔액 → 새 잔액으로 굴림)
const lastShown = new Map<string, number>();

const nf = new Intl.NumberFormat("ko-KR");

type Pill = "mini" | "open" | "blue" | "closed";
type Lock = "gray" | "blue" | "open";

export function KbankHome() {
  useKbankStatusBar();
  const navigate = useNavigate();
  const active = useLayerActive();
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
  const userName = home.data?.profile.userName ?? "";
  const ready = phase === "content" && !!account;

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
  // 보여 주는 잔액: 굴리는 중이면 from → value
  const [shown, setShown] = useState<{ value: number; from: number | null; n: number } | null>(null);

  const balance = account?.balance;
  const accountId = account?.id;
  const accountRef = useRef(account);
  useEffect(() => {
    accountRef.current = account;
  });

  useEffect(() => {
    const acc = accountRef.current;
    if (!ready || !acc) return;
    const t: number[] = [];
    const at = (ms: number, f: () => void) => t.push(window.setTimeout(f, ms));
    setLock("gray");
    if (visit === 0) {
      setShown({ value: acc.balance, from: null, n: 0 });
      lastShown.set(acc.id, acc.balance);
      at(67, () => setFresh(false));
      at(FRESH.balance, () => setGray(false));
      at(FRESH.pillOpen, () => setPill("open"));
      at(FRESH.pillBlue, () => setPill("blue"));
      at(FRESH.carousel, () => setCarousel(true));
      at(FRESH.pillClose, () => setPill("closed"));
      at(FRESH.lockBlue, () => setLock("blue"));
      at(FRESH.lockOpen, () => setLock("open"));
    } else {
      const old = lastShown.get(acc.id) ?? acc.balance;
      setShown({ value: old, from: null, n: 0 });
      setGray(false);
      setFresh(false);
      setCarousel(true);
      setPill((p) => (p === "mini" ? "closed" : p));
      at(BACK.gray, () => setGray(true));
      at(BACK.gray + BACK.grayMs, () => setGray(false));
      at(BACK.roll, () => {
        const now = accountRef.current?.balance ?? old;
        lastShown.set(acc.id, now);
        if (now !== old) setShown((s) => ({ value: now, from: old, n: (s?.n ?? 0) + 1 }));
      });
      at(BACK.lockBlue, () => setLock("blue"));
      at(BACK.lockOpen, () => setLock("open"));
    }
    return () => t.forEach(clearTimeout);
  }, [ready, visit]);

  // 홈을 보고 있는 동안 잔액이 바뀌면(관리 패널 등) 바로 굴려서 새 값으로
  useEffect(() => {
    if (!active || balance === undefined || !accountId || !shown) return;
    const last = lastShown.get(accountId);
    if (last === undefined || last === balance) return;
    lastShown.set(accountId, balance);
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
  const soon = () => {};

  const copy = (acc: Account) => {
    navigator.clipboard?.writeText(formatAccountNumber(acc.bank?.pattern, acc.number ?? "")).catch(() => {});
  };

  return (
    <div className={`kb kbh ${phase !== "content" ? "kbh--white" : ""} ${fresh ? "kbh--fresh" : ""}`}>
      {phase === "skeleton" && <Skeleton />}
      {ready && account && (
        <>
          <div className="kbh-scroll">
            <div className="kbh-page">
              {/* 계좌 카드 */}
              <div className={`kbh-card kbh-acct ${carousel ? "kbh-acct--more" : ""}`} onClick={() => navigate(`/account/${encodeURIComponent(account.id)}`)}>
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
                    navigate(`/send?from=${encodeURIComponent(account.id)}`);
                  }}
                >
                  이체하기
                </button>
                {carousel && (
                  <div className="kbh-one" onClick={(e) => e.stopPropagation()}>
                    <Pic name="kbank-home-card" className="kbh-one__card kbh-art" />
                    <p className="kbh-t kbh-one__l1">ONE {month}월 쓴 돈</p>
                    <p className="kbh-t kbh-one__l2">0원</p>
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

              {/* 안전한 금융거래 안내 */}
              <div className="kbh-card kbh-safe">
                <p className="kbh-t kbh-safe__l1">안전한 금융거래를 위해 고객님의</p>
                <p className="kbh-t kbh-safe__l2">최신 정보를 확인하고 있어요</p>
                <p className="kbh-t kbh-safe__l3">기간 내 고객확인을 이행하지 않을 경우,</p>
                <p className="kbh-t kbh-safe__l4">관련 법에 따라 이용이 제한됩니다.</p>
                <button className="kbh-safe__x" onClick={soon} aria-label="닫기">
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                    <path d="M1.3 1.3 10.7 10.7M10.7 1.3 1.3 10.7" stroke="#7e7e84" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                <button className="kbh-safe__go" onClick={soon}>
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
                  <button key={q.art} className={`kbh-quick__item kbh-quick__item--${i}`} onClick={soon}>
                    <i className="kbh-quick__box" />
                    <Pic name={`kbank-home-${q.art}`} className={`kbh-quick__art kbh-quick__art--${q.art} kbh-art`} />
                    <span className="kbh-t">{q.label}</span>
                  </button>
                ))}
              </div>

              {/* 내 자산 */}
              <div className="kbh-card kbh-asset">
                <p className="kbh-t kbh-asset__title">내 자산</p>
                <button className="kbh-asset__edit" onClick={soon}>
                  <span className="kbh-t">편집</span>
                  <Gear />
                </button>
                <p className="kbh-t kbh-asset__sec">카드</p>
                <Pic name="kbank-home-card" className="kbh-asset__card kbh-art" />
                <p className="kbh-t kbh-asset__l1">ONE {month}월 쓴 돈</p>
                <p className="kbh-t kbh-asset__l2">0원</p>
                <i className="kbh-asset__line" />
                <button className="kbh-asset__all" onClick={soon}>
                  <span className="kbh-t">내 자산 모두 보기</span>
                  <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden>
                    <path d="M1.2 1 6.8 7 1.2 13" fill="none" stroke="#686868" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* 흩어져 있는 내 계좌 */}
              <div className="kbh-card kbh-link">
                <span className="kbh-coin" aria-hidden>
                  <Pic name="kbank-home-coin3" className="kbh-art" />
                  <Pic name="kbank-home-coin1" className="kbh-art" />
                  <Pic name="kbank-home-coin2" className="kbh-art" />
                </span>
                <p className="kbh-t kbh-link__t">흩어져 있는 내 계좌</p>
                <button className="kbh-link__btn" onClick={soon}>
                  연결하기
                </button>
              </div>

              {/* 실시간 추천 */}
              <div className="kbh-card kbh-rec">
                <p className="kbh-t kbh-w kbh-rec__l1">{userName}님을 위한</p>
                <p className="kbh-t kbh-w kbh-rec__l2">실시간 추천 서비스예요</p>
                <div className="kbh-rec__row">
                  {RECS.map((r) => (
                    <button key={r.tag} className={`kbh-rec__item kbh-rec__item--${r.kind}`} onClick={soon}>
                      <span className="kbh-rec__tag">{r.tag}</span>
                      {r.art && <Pic name={r.art} className={`kbh-rec__art kbh-rec__art--${r.kind} kbh-art`} />}
                      <b className="kbh-w kbh-rec__title">{r.title}</b>
                      <span className="kbh-w kbh-rec__desc">{r.desc[0]}</span>
                      <span className="kbh-w kbh-rec__desc">{r.desc[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 의견 */}
              <button className="kbh-opinion" onClick={soon}>
                <Pic name="kbank-home-pen" className="kbh-opinion__pen" />
                <span className="kbh-t kbh-opinion__l1">새로워진 케이뱅크 홈</span>
                <span className="kbh-t kbh-opinion__l2">{userName}님의 의견이 궁금해요</span>
                <svg className="kbh-opinion__go" width="6" height="11" viewBox="0 0 6 11" aria-hidden>
                  <path d="M.8.8 5.2 5.5.8 10.2" fill="none" stroke="#606671" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div className="kbh-foot">
                <button className="kbh-t" onClick={soon}>
                  간편 홈 모드
                </button>
                <i />
                <button className="kbh-t" onClick={soon}>
                  홈 화면 설정
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {phase !== "white" && (
        <header className={`kbh-head ${phase === "skeleton" ? "kbh-head--skel" : ""}`}>
          {phase === "content" && (
            <>
              <h1 className="kbh-t kbh-head__title">홈</h1>
              <button className={`kbh-pill kbh-pill--${pill}`} onClick={soon}>
                <span className="kbh-pill__in">
                  <i className="kbh-pill__dot" />
                  <span className="kbh-t kbh-pill__text">
                    사장님
                    <span className="kbh-pill__more">
                      , 홈에서 한눈에 확인하세요
                      <Pic name="kbank-home-eyes" className="kbh-pill__eyes" />
                    </span>
                  </span>
                </span>
              </button>
              <button className="kbh-bell" onClick={() => setPanelOpen(true)} aria-label="알림 (관리 패널)">
                <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden>
                  <path
                    d="M11 3.2c-3.6 0-6.1 2.7-6.1 6.4v4.6l-1.8 3.1c-.3.5.1 1.1.6 1.1h14.6c.6 0 .9-.6.6-1.1l-1.8-3.1V9.6c0-3.7-2.5-6.4-6.1-6.4ZM8.9 18.6c.2 1.2 1 1.9 2.1 1.9s1.9-.7 2.1-1.9"
                    fill="none"
                    stroke="#29323e"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="kbh-bell__badge">295</span>
              </button>
            </>
          )}
        </header>
      )}
      {phase !== "white" && <KbankTabBar active="홈" />}
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

// 실시간 추천 (녹화 16.5~16.9초, 셋째 카드는 화면 밖으로 잘려 '알뜰 / 기 / 5천' 까지만 보임)
const RECS = [
  { tag: "추천", kind: "pick", art: "kbank-home-suitcase", title: "최대 300만원", desc: ["사장님은 유급휴가", "가게는 리프레시"] },
  { tag: "1위", kind: "rank", art: "kbank-home-cards", title: "히든카드", desc: ["온라인 할인 6%", "금융혜택까지"] },
  { tag: "2위", kind: "rank", art: "", title: "알뜰폰 요금제", desc: ["기본료 할인", "5천원 혜택"] },
];

// 잔액: 큰 숫자 + '원'. 굴릴 때 바뀐 자리만 옛 숫자는 아래로 빠지고 새 숫자가 위에서 내려옴 (녹화 1268~1276)
function Balance({ shown, gray }: { shown: { value: number; from: number | null; n: number } | null; gray: boolean }) {
  if (!shown) return <p className="kbh-t kbh-acct__bal" />;
  const next = `${nf.format(shown.value)}원`;
  if (shown.from == null)
    return <p className={`kbh-t kbh-acct__bal ${gray ? "kbh-acct__bal--gray" : ""}`}>{next}</p>;
  const prev = `${nf.format(shown.from)}원`;
  const len = Math.max(prev.length, next.length);
  const a = prev.padStart(len, " ");
  const b = next.padStart(len, " ");
  return (
    <p key={shown.n} className={`kbh-t kbh-acct__bal ${gray ? "kbh-acct__bal--gray" : ""}`} aria-label={next}>
      {[...b].map((ch, i) =>
        ch === a[i] ? (
          <span key={i}>{ch}</span>
        ) : (
          <span key={i} className="kbh-roll">
            <span className="kbh-roll__old">{a[i].trim()}</span>
            <span className="kbh-roll__new">{ch.trim()}</span>
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

// 편집 옆 톱니 (잉크 x 330.6~342.3 · y 700.3~713.3 → 11.7 × 13dp, #7e7d85): 꽃잎 6개 둘레(r = 5 + 0.75·cos 6θ) + 가운데 원
const GEAR = `M${Array.from({ length: 72 }, (_, i) => {
  const t = (Math.PI * 2 * i) / 72;
  const r = 5 + 0.75 * Math.cos(6 * t);
  return `${(6 + r * Math.sin(t)).toFixed(2)} ${(6.5 - r * Math.cos(t)).toFixed(2)}`;
}).join(" L")}Z`;
function Gear() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden>
      <path d={GEAR} fill="none" stroke="#7e7d85" strokeWidth="1.15" strokeLinejoin="round" />
      <circle cx="6" cy="6.5" r="1.9" fill="none" stroke="#7e7d85" strokeWidth="1.15" />
    </svg>
  );
}

function Pic({ name, className = "" }: { name: string; className?: string }) {
  const src = localAsset(name);
  return src ? <img className={className} src={src} alt="" draggable={false} /> : <i className={className} />;
}
