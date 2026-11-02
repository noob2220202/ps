import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
// 내용(C) 뒤 시간표 (ms) — 처음 들어올 때 (녹화 프레임을 하나씩 재서 고침)
//   잔액 흐린 회색 292~305 → 306 검정 (+467), 바로가기·카드 그림 294 (+67)
//   알약: 작은 '● ㅅ'(폭 29.0) 292~305 → 305.5~316 펼침(350ms ease, 회색) → 318.5~327 파랑으로(300ms) → 406.5~418 접힘(380ms, 회색) '● 사장님'
//   'ONE 11월 쓴 돈' 넘김 칸은 319 에 끼어듦(움직임 없이) (+900)
//   309~328 동안 카드 전체가 12.1dp 아래로 내려가 있다가 329 에 제자리 (+567 ~ +1233, 둘 다 한 번에)
const FRESH = { balance: 467, pillOpen: 450, pillBlue: 880, carousel: 900, bump: 567, bumpEnd: 1233, pillClose: 3817 };
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

  const balance = account?.balance;
  const accountId = account?.id;
  const accountRef = useRef(account);
  // 아래 시간표(레이아웃 효과)보다 먼저 돌아야 같은 커밋에 온 계좌를 봄
  useLayoutEffect(() => {
    accountRef.current = account;
  });

  // 그리기 전에 돌려야 잔액이 내용과 같은 프레임에 보이고(녹화 292) 시간표도 내용이 보인 때부터 셈
  useLayoutEffect(() => {
    const acc = accountRef.current;
    if (!ready || !acc) return;
    const t: number[] = [];
    const at = (ms: number, f: () => void) => t.push(window.setTimeout(f, ms));
    const lockLoop = (start: number) => {
      at(start, () => setLock("gray"));
      at(start + LOCK.blue, () => setLock("blue"));
      at(start + LOCK.open, () => setLock("open"));
      at(start + LOCK.period, () => lockLoop(0));
    };
    setLock("gray");
    if (visit === 0) {
      setShown({ value: acc.balance, from: null, n: 0 });
      lastShown.set(acc.id, acc.balance);
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
      const old = lastShown.get(acc.id) ?? acc.balance;
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
        lastShown.set(acc.id, now);
        if (now !== old) setShown((s) => ({ value: now, from: old, n: (s?.n ?? 0) + 1 }));
      });
      lockLoop(BACK.lock);
    }
    return () => {
      t.forEach(clearTimeout);
      holdRoll.current = false;
    };
  }, [ready, visit]);

  // 홈을 보고 있는 동안 잔액이 바뀌면(관리 패널 등) 바로 굴려서 새 값으로
  useEffect(() => {
    if (!active || balance === undefined || !accountId || !shown || holdRoll.current) return;
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
          <div className="kbh-scroll">
            <div className={`kbh-page ${bump ? "kbh-page--bump" : ""}`}>
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
                    <path d="M1.8 1.8 10.2 10.2M10.2 1.8 1.8 10.2" stroke="#7e7e84" strokeWidth="1.5" strokeLinecap="round" />
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
                    <path d="M1 1.75 7 7 1 12.25" fill="none" stroke="#686868" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
                <p className="kbh-t kbh-rec__l1">{userName}님을 위한</p>
                <p className="kbh-t kbh-rec__l2">실시간 추천 서비스예요</p>
                <div className="kbh-rec__row">
                  {RECS.map((r) => (
                    <button key={r.tag} className={`kbh-rec__item kbh-rec__item--${r.kind}`} onClick={soon}>
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
        <header className={`kbh-head ${waiting ? "kbh-head--skel" : ""}`}>
          {!waiting && (
            <>
              <h1 className="kbh-t kbh-head__title">홈</h1>
              <button className={`kbh-pill kbh-pill--${pill}`} onClick={soon}>
                <span className="kbh-pill__in">
                  <i className="kbh-pill__dot" />
                  <span className="kbh-t kbh-pill__text">
                    사장님<span className="kbh-pill__more">, 홈에서 한눈에 확인하세요</span>
                  </span>
                  <Pic name="kbank-home-eyes" className="kbh-pill__eyes" />
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
                <span className="kbh-bell__badge">295</span>
              </button>
            </>
          )}
        </header>
      )}
      {phase === "content" && !waiting && <KbankTabBar active="홈" />}
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

// 실시간 추천 (녹화 16.5~16.9초, 셋째 카드는 화면 밖으로 잘려 '알뜰 / 기 / 5천' 까지만 보임 — 뒷글자는 지어 넣되
// 가운데 맞춤 줄의 왼끝이 녹화와 같도록 폭을 고름: 둘째 줄 '5천' 잉크 왼끝 353.4 ↔ '5천원 페이백')
const RECS = [
  { tag: "추천", kind: "pick", art: "kbank-home-suitcase", title: "최대 300만원", desc: ["사장님은 유급휴가", "가게는 리프레시"] },
  { tag: "1위", kind: "rank", art: "kbank-home-cards", title: "히든카드", desc: ["온라인 할인 6%", "금융혜택까지"] },
  { tag: "2위", kind: "rank", art: "", title: "알뜰폰 요금제", desc: ["기본료 할인", "5천원 페이백"] },
];

// 굵은 금액 줄의 '1' 은 Pretendard 보다 좌우가 넓음 (FONT.md) → '1' 만 span 으로 감싸 좌우 여백 (홈은 '1' 폭 = '0' 폭이 되게 0.095em, kbank-home.css)
const ones = (s: string) => s.split(/(1)/).map((p, i) => (p === "1" ? <span key={i} className="kbh-n1">1</span> : p));

// 잔액: 큰 숫자 + '원'. 굴릴 때 바뀐 자리만 옛 숫자는 아래로 빠지고 새 숫자가 위에서 내려옴 (녹화 1271~1298)
function Balance({ shown, gray }: { shown: { value: number; from: number | null; n: number } | null; gray: boolean }) {
  if (!shown) return <p className="kbh-t kbh-acct__bal" />;
  const next = `${nf.format(shown.value)}원`;
  if (shown.from == null)
    return (
      <p className={`kbh-t kbh-acct__bal ${gray ? "kbh-acct__bal--gray" : ""}`} aria-label={next}>
        {ones(next)}
      </p>
    );
  const prev = `${nf.format(shown.from)}원`;
  const len = Math.max(prev.length, next.length);
  const a = prev.padStart(len, " ");
  const b = next.padStart(len, " ");
  return (
    <p key={shown.n} className={`kbh-t kbh-acct__bal ${gray ? "kbh-acct__bal--gray" : ""}`} aria-label={next}>
      {[...b].map((ch, i) =>
        ch === a[i] ? (
          <span key={i} className={ch === "1" ? "kbh-n1" : undefined}>
            {ch}
          </span>
        ) : (
          <span key={i} className="kbh-roll">
            <span className="kbh-roll__old">{ones(a[i].trim())}</span>
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
