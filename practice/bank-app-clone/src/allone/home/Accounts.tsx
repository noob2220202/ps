// 홈 계좌 칸 (home.md §2.4, 쪽 227–550): NH농협 · 다른금융 탭, 쪽 표시 알약 "‹ i | n ›", 끝없이 도는 카드 넘기기, 민트빛.
//  - 카드 353 × 222 (x 20), 간격 10 → 양쪽 이웃이 10 씩 보임. 놓으면 305ms 로 맞춰 서거나 제자리로 (motion.ts AO_CAROUSEL)
//  - 처음 보는 카드는 "상품명을 조회 중이에요 / 조회 중입니다" 를 끌기 시작부터 420ms 보여 준 뒤 한 프레임에 채움
//  - NH농협 카드: ATM출금(눌리지 않음, 누름 표시도 없음) · 거래내역 · 이체. 다른금융 카드(지어냄): 잔액채우기 · 거래내역
//  - 숨김 / 보기 (계좌별, 이 브라우저), 복사 + 토스트
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { isAoNh, type AoAccount } from "../api";
import { aoBankName } from "../bank";
import { aoAccountNumber, aoNum } from "../format";
import { AO_CAROUSEL } from "../motion";
import { aoPrefs, useAoPrefs } from "../prefs";
import { AoBankLogo } from "../ui";
import { bezier, mod, useLoopPager, visibleSlots } from "./pager";

type Tab = "nh" | "other";
const PITCH = 363; // 카드 353 + 간격 10
// 놓은 뒤 맞춰 서기 · 제자리로: 둘 다 305ms cubic-bezier(.3,.43,.3,1) (motion.ts AO_CAROUSEL — C2 4.507–4.783 카드 2 타일 rms 1.0pt, C3 25.192–25.433 rms 0.24pt)
const SNAP_EASE = bezier(...AO_CAROUSEL.easePoints);
const HIDE = { visibility: "hidden" } as const;

export interface AccountsProps {
  accounts: AoAccount[] | undefined;
  filled: boolean; // H3 부터 (뼈대가 아닌 진짜 카드)
  open: boolean; // 아래 칸이 아직 없음 → 민트빛을 자르지 않음
  mainNh: string;
  onCopy: (text: string) => void;
  onHistory: (id: string) => void;
  onSend: (id: string) => void;
  onTopup: (fromId: string) => void;
  onRetry: () => void;
}

export function Accounts({ accounts, filled, open, onCopy, onHistory, onSend, onTopup, onRetry }: AccountsProps) {
  const [tab, setTab] = useState<Tab>("nh");
  const list = (accounts ?? []).filter((a) => (tab === "nh" ? isAoNh(a) : !isAoNh(a)));
  const count = Math.max(1, list.length);
  // 본 카드 (채워 그림). 처음엔 NH 첫 카드만
  const [seen, setSeen] = useState<Set<string>>(() => new Set(["nh:0"]));
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const reveal = (keys: string[]) => {
    const fresh = keys.filter((k) => !seen.has(k));
    if (!fresh.length) return;
    timers.current.push(window.setTimeout(() => setSeen((s) => new Set([...s, ...fresh])), AO_CAROUSEL.unseenBody));
  };
  const indexRef = useRef(0);
  const pager = useLoopPager({
    count,
    pitch: PITCH,
    snapMs: AO_CAROUSEL.snap,
    backMs: AO_CAROUSEL.rubber,
    stepMs: AO_CAROUSEL.snap,
    ease: SNAP_EASE,
    disabled: !filled || list.length < 2,
    onDragStart: () => reveal([`${tab}:${mod(indexRef.current - 1, count)}`, `${tab}:${mod(indexRef.current + 1, count)}`]),
  });
  useEffect(() => {
    indexRef.current = pager.index;
  });
  const go = (d: number) => {
    if (!filled || list.length < 2) return;
    reveal([`${tab}:${mod(pager.index + d, count)}`]);
    pager.step(d);
  };
  const pickTab = (t: Tab) => {
    if (t === tab || !filled) return;
    setTab(t);
    pager.reset(0);
    reveal([`${t}:0`]);
  };

  const hidden = useAoPrefs(aoPrefs.hiddenBalances);
  const cardH = filled ? 222 : 241.5; // 카드 높이 (뼈대 카드가 더 김) — 민트빛은 카드 뒤에서 아래로 110pt 더
  const n = list.length;

  return (
    <section className={`ao-home-acct${open ? " ao-home-acct--open" : ""}`}>
      {/* 뼈대 단계(아래 칸 없음)에서는 민트빛이 카드 아래로 더 길게 보임 (C1 12.150: 카드 아래 200pt 까지) */}
      <div className="ao-home-acct__glow" style={{ top: 58, height: open ? 400 : cardH + 110 }} />
      {/* 뼈대 단계: 아래 흰 카드 껍데기 (C1 12.150 쪽 699 = 칸 +566) */}
      {open && <div className="ao-home-wcard ao-home-acct__shell" />}
      <div className="ao-home-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "nh"} className={`ao-home-tab${tab === "nh" ? " ao-home-tab--on" : ""}`} onClick={() => pickTab("nh")}>
          NH농협
        </button>
        <button type="button" role="tab" aria-selected={tab === "other"} className={`ao-home-tab${tab === "other" ? " ao-home-tab--on" : ""}`} onClick={() => pickTab("other")}>
          다른금융
        </button>
      </div>
      <div className="ao-home-pager">
        <button type="button" className="ao-home-pager__btn ao-home-pager__btn--prev" aria-label="이전 계좌" onClick={() => go(-1)}>
          <Chevron dir={-1} />
        </button>
        <span className="ao-home-pager__num ao-home-pager__num--i">{pager.index + 1}</span>
        <i className="ao-home-pager__bar" />
        <span className="ao-home-pager__num ao-home-pager__num--n">{Math.max(1, n)}</span>
        <button type="button" className="ao-home-pager__btn ao-home-pager__btn--next" aria-label="다음 계좌" onClick={() => go(1)}>
          <Chevron dir={1} />
        </button>
      </div>

      <div className="ao-home-cards" {...pager.bind}>
        {!filled && [-1, 0, 1].map((k) => <SkeletonCard key={`s${k}`} x={20 + k * PITCH} onRetry={onRetry} />)}
        {/* 진짜 카드는 데이터가 오면 바로 숨겨 그려 두고 H3 에서 보이기만 (그 순간 그리는 일이 없게) */}
        {accounts && (
          <div className="ao-home-cards__set" style={filled ? undefined : HIDE}>
            {visibleSlots(pager.pos, n).map((k) => {
              const i = mod(k, Math.max(1, n));
              const a = list[i];
              const x = 20 + (k - (n < 2 ? 0 : pager.pos)) * PITCH;
              const style = { transform: `translateX(${x}px)` };
              if (!a) return <EmptyCard key={k} style={style} />;
              if (!seen.has(`${tab}:${i}`)) return <WaitCard key={k} a={a} style={style} />;
              return (
                <Card
                  key={k}
                  a={a}
                  style={style}
                  hidden={hidden.includes(a.id)}
                  onCopy={() => onCopy(`${aoBankName(a.bank)} ${aoAccountNumber(a)}`)}
                  onHide={() => aoPrefs.setBalanceHidden(a.id, !hidden.includes(a.id))}
                  onHistory={() => onHistory(a.id)}
                  onSend={() => onSend(a.id)}
                  onTopup={() => onTopup(a.id)}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Chevron({ dir }: { dir: 1 | -1 }) {
  // 5 × 9.33, 흰색 두께 1.4
  return (
    <svg width="5" height="9.33" viewBox="0 0 5 9.33" aria-hidden style={{ overflow: "visible" }}>
      <path d={dir > 0 ? "M0.7 0.7L4.3 4.67L0.7 8.63" : "M4.3 0.7L0.7 4.67L4.3 8.63"} fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Head({ a, name }: { a: AoAccount; name: string }) {
  return (
    <>
      <AoBankLogo code={a.bank.code} size={32} className="ao-home-card__tile" />
      <p className="ao-home-abs ao-home-card__name">{name}</p>
      <button type="button" className="ao-home-card__more" aria-label="더보기">
        <i style={{ top: 8 }} />
        <i style={{ top: 13.67 }} />
        <i style={{ top: 19.33 }} />
      </button>
    </>
  );
}

function NumberLine({ a, onCopy }: { a: AoAccount; onCopy?: () => void }) {
  return (
    <p className="ao-home-abs ao-home-card__num">
      <span>
        <span className="ao-home-card__bank">{aoBankName(a.bank)}</span> {aoAccountNumber(a)}
      </span>
      <button type="button" className="ao-home-card__copy" onClick={onCopy}>
        복사
      </button>
    </p>
  );
}

interface CardProps {
  a: AoAccount;
  style: CSSProperties;
  hidden: boolean;
  onCopy: () => void;
  onHide: () => void;
  onHistory: () => void;
  onSend: () => void;
  onTopup: () => void;
}

function Card({ a, style, hidden, onCopy, onHide, onHistory, onSend, onTopup }: CardProps) {
  const nh = isAoNh(a);
  return (
    <article className="ao-home-card" style={style}>
      <Head a={a} name={a.label} />
      <NumberLine a={a} onCopy={onCopy} />
      <div className="ao-home-abs ao-home-card__bal">
        <span className={`ao-home-card__amt${hidden ? " ao-home-card__amt--hidden" : ""}`}>
          {hidden ? (
            "잔액 숨김"
          ) : (
            <>
              {aoNum(a.balance)}
              <span className="ao-home-card__won">원</span>
            </>
          )}
        </span>
        <button type="button" className="ao-home-card__hide" onClick={onHide}>
          {hidden ? "보기" : "숨김"}
        </button>
      </div>
      <div className="ao-home-card__btns">
        {nh ? (
          <>
            <button type="button" className="ao-home-card__btn ao-home-card__btn--inert" tabIndex={-1} aria-disabled>
              ATM출금
            </button>
            <button type="button" className="ao-home-card__btn" onClick={onHistory}>
              거래내역
            </button>
            <button type="button" className="ao-home-card__btn" onClick={onSend}>
              이체
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ao-home-card__btn" onClick={onTopup}>
              잔액채우기
            </button>
            <button type="button" className="ao-home-card__btn" onClick={onHistory}>
              거래내역
            </button>
          </>
        )}
      </div>
    </article>
  );
}

// 처음 보는 카드 (C2 4.541–4.841): 이름 줄만 바뀌고 번호 줄 · ⋮ 는 그대로, 아래는 "조회 중입니다"
function WaitCard({ a, style }: { a: AoAccount; style: CSSProperties }) {
  return (
    <article className="ao-home-card" style={style} aria-busy>
      <Head a={a} name="상품명을 조회 중이에요" />
      <NumberLine a={a} />
      <p className="ao-home-abs ao-home-card__wait">조회 중입니다</p>
    </article>
  );
}

// 다른금융 계좌가 없을 때 (지어냄): 안내 + 계좌등록 (아무 일 없음)
function EmptyCard({ style }: { style: CSSProperties }) {
  return (
    <article className="ao-home-card" style={style}>
      <p className="ao-home-abs ao-home-card__empty">다른 금융기관 계좌를 연결해 보세요</p>
      <div className="ao-home-card__btns ao-home-card__btns--one">
        <button type="button" className="ao-home-card__btn">
          계좌등록
        </button>
      </div>
    </article>
  );
}

// 뼈대 카드 (H1 · H2): 241.5 높이, 옅은 막대 3개 (x 39–354, 카드 위 +61 / +138.9 / +192.9)
function SkeletonCard({ x, onRetry }: { x: number; onRetry: () => void }) {
  return (
    <div className="ao-home-card ao-home-card--skel" style={{ transform: `translateX(${x}px)` }} onClick={onRetry} aria-hidden>
      <i className="ao-home-skel" style={{ top: 61, height: 68.9 }} />
      <i className="ao-home-skel" style={{ top: 138.9, height: 24 }} />
      <i className="ao-home-skel" style={{ top: 192.9, height: 24 }} />
    </div>
  );
}
