// /spend?month=YYYY-MM — 소비 (assets.md §2.1, 녹화 B 140.47–149.24초). 홈 '{M}월에 쓴 돈' · '내역' 에서 push.
// 머리줄(← ◂ 11월 ▸ 돋보기 ⋯)과 탭(전체 · 카드 · 입·출금 · 페이·기타)은 고정, 요약은 스크롤로 사라지고 주간 달력이 탭 밑에 붙음.
// 아래 내비 띠는 scrim 모드 (목록이 띠 밑으로 비쳐 보임). 합계는 서버 spendTotal 하나 → 홈 '{M}월에 쓴 돈' 과 늘 같음
import { useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { Bank } from "../../api/types";
import { tossPaths, type TossSpend, type TossSpendGroup, type TossSpendItem, type TossSpendTab } from "../api";
import { num } from "../format";
import { useTossGo } from "../nav";
import { TossAppBar } from "../ui/AppBar";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { TossFadeIn, TossSkeleton } from "../ui/Skeleton";
import { SPEND, barSegments, defaultDay, diffCopy, monthWeeks, shiftYm, useAssetsRevisit } from "./data";
import { CashbackIcon, DotsGlyph, SearchGlyph, SpendIcon, TriIcon, VChevron } from "./parts";
import { FitText } from "./FitText";
import "./assets.css";

const TABS: [TossSpendTab, string, number][] = [
  ["all", "전체", 52.4],
  ["card", "카드", 116],
  ["account", "입·출금", 184],
  ["pay", "페이·기타", 260.8],
];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

type SpendMemo = { month: string; tab: TossSpendTab; scroll: number; day: string | null; expanded: boolean };

export function Spend() {
  const [params] = useSearchParams();
  const { revisit, saved, save } = useAssetsRevisit<SpendMemo>();
  const [month, setMonth] = useState<string | undefined>(saved.month ?? params.get("month") ?? undefined);
  const [tab, setTab] = useState<TossSpendTab>(saved.tab ?? "all");
  const q = useApi<TossSpend>(tossPaths.spend(month, tab));
  const banks = useApi<Bank[]>(paths.banks);
  // 달 · 탭을 바꾸면 새 값이 올 때까지 앞의 것을 그대로 (한 프레임에 바뀜)
  const [last, setLast] = useState<TossSpend | null>(null);
  if (q.data && q.data !== last) setLast(q.data);
  const data = q.data ?? last;

  // 처음 들어올 때 뼈대를 최소 300ms (웹뷰 뼈대 1.5초를 줄인 값). 뒤로 와서 다시 그리면 바로
  const [minDone, setMinDone] = useState(revisit);
  useEffect(() => {
    if (minDone) return;
    const t = window.setTimeout(() => setMinDone(true), SPEND.skeletonMin);
    return () => window.clearTimeout(t);
  }, [minDone]);
  const ready = minDone && !!data;

  const bodyRef = useRef<HTMLDivElement>(null);
  const [day, setDay] = useState<string | null>(saved.day ?? null);
  const [expanded, setExpanded] = useState(!!saved.expanded);

  // 보이는 달 · 탭이 바뀌면 고른 날 · 스크롤을 처음으로
  const viewKey = data ? `${data.month}|${data.tab}` : "";
  const [shownKey, setShownKey] = useState(revisit ? `${saved.month}|${saved.tab ?? "all"}` : "");
  const [resetScroll, setResetScroll] = useState(0);
  if (ready && viewKey !== shownKey) {
    if (shownKey) {
      setDay(null);
      setResetScroll((n) => n + 1);
    }
    setShownKey(viewKey);
  }
  useLayoutEffect(() => {
    if (resetScroll && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [resetScroll]);

  // 뒤로 와서 다시 그림: 스크롤 되살림
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const el = bodyRef.current;
    if (revisit && el && saved.scroll) el.scrollTop = saved.scroll;
  }, [ready, revisit, saved.scroll]);

  useEffect(() => {
    if (data) save({ month: data.month, tab: data.tab, day, expanded });
  }, [data, day, expanded, save]);

  // ---------- 스크롤 엿보기: 달력 아래를 지난 마지막 날짜 묶음이 고른 날 (동그라미가 바로 옮겨 감) ----------
  const groupEls = useRef(new Map<string, HTMLElement>());
  const lock = useRef<{ target: number; until: number } | null>(null);
  const spy = (st: number) => {
    if (!data) return;
    const line = expanded ? 8.8 : SPEND.spyLine;
    let pick: string | null = null;
    for (const g of data.groups) {
      const el = groupEls.current.get(g.date);
      if (el && el.offsetTop - st <= line) pick = g.date;
    }
    setDay(pick);
  };
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const st = e.currentTarget.scrollTop;
    save({ scroll: st });
    const l = lock.current;
    if (l) {
      if (Math.abs(st - l.target) > 1 && performance.now() < l.until) return;
      lock.current = null;
      return;
    }
    spy(st);
  };
  const unlock = () => (lock.current = null);

  const selected = data ? (day ?? defaultDay(data)) : "";
  const go = useTossGo();

  // 달력 날짜를 누름: 그 날 묶음으로 스크롤 (묶음이 없으면 아무 일 없음)
  const pickDate = (date: string) => {
    const el = groupEls.current.get(date);
    const body = bodyRef.current;
    if (!el || !body) return;
    if (expanded) setExpanded(false);
    setDay(date);
    window.requestAnimationFrame(() => {
      // 펼친 달력을 접는 중이면 지금 높이만큼 빼면 접힌 뒤 자리 (접힌 달력 아래에 그 날 머리가 옴)
      const strip = body.querySelector<HTMLElement>(".toss-assets-strip");
      const max = body.scrollHeight - body.clientHeight;
      const target = Math.max(0, Math.min(max, el.offsetTop - (strip?.offsetHeight ?? SPEND.stripH)));
      lock.current = { target, until: performance.now() + 900 };
      body.scrollTo({ top: target, behavior: "smooth" });
    });
  };
  // ⌄ : 달력 펼치기 (펼친 동안은 붙지 않음 — 붙어 있었으면 달력이 탭 바로 밑에 오게 스크롤을 맞춤)
  const toggleExpand = () => {
    const body = bodyRef.current;
    if (!expanded && body && body.scrollTop > SPEND.summaryH) body.scrollTop = SPEND.summaryH;
    setExpanded(!expanded);
  };

  const changeMonth = (by: number) => {
    if (!data) return;
    setExpanded(false);
    setMonth(shiftYm(data.month, by));
  };
  const changeTab = (t: TossSpendTab) => {
    if (t === tab) return;
    setTab(t);
  };

  const bankColor = (code: string) => banks.data?.find((b) => b.code === code)?.color;

  if (!ready) {
    return (
      <TossPage className="toss-assets-spend" navMode="scrim">
        {q.status === "error" && !data ? (
          <div className="toss-assets-error">
            <p>내역을 불러오지 못했어요</p>
            <TossPressable className="toss-assets-error__retry" radius={8} onPress={q.retry}>
              다시 시도
            </TossPressable>
          </div>
        ) : (
          <SpendSkeleton />
        )}
      </TossPage>
    );
  }

  const s = data!;
  return (
    <TossPage
      className="toss-assets-spend"
      navMode="scrim"
      header={
        <>
          <TossAppBar className="toss-assets-spend__bar" />
          <SpendHeadTools s={s} onMonth={changeMonth} />
          <SpendTabs tab={tab} onTab={changeTab} />
        </>
      }
      bodyRef={bodyRef}
      onScroll={onScroll}
    >
      <div className="toss-assets-spend__content" onPointerDown={unlock} onWheel={unlock}>
        <SpendSummary s={s} />
        <WeekStrip s={s} selected={selected} expanded={expanded} onPick={pickDate} onToggle={toggleExpand} />
        <div className="toss-assets-spend__list">
          {s.groups.length === 0 && !s.cashback ? (
            <p className="toss-assets-spend__empty">내역이 없어요</p>
          ) : (
            s.groups.map((g, gi) => (
              <SpendGroup
                key={g.date}
                g={g}
                cashback={gi === 0 && s.cashback ? s.cashback.count : 0}
                refFn={(el) => {
                  if (el) groupEls.current.set(g.date, el);
                  else groupEls.current.delete(g.date);
                }}
                onRow={(it) => it.channel === "account" && go(`/tx/${encodeURIComponent(it.txId)}`)}
                bankColor={bankColor}
              />
            ))
          )}
        </div>
      </div>
    </TossPage>
  );
}

// ---------- 뼈대 (C1): 머리줄 없이 막대 둘 + 동그라미 · 막대 두 줄, 차례로 나타남 ----------
function SpendSkeleton() {
  return (
    <div className="toss-assets-skel">
      <TossFadeIn delay={170} duration={200}>
        <TossSkeleton tone="web" w={111.2} h={21.6} r={8} className="toss-assets-skel__b1" />
      </TossFadeIn>
      <TossFadeIn delay={270} duration={200}>
        <TossSkeleton tone="web" w={168} h={30.4} r={8} className="toss-assets-skel__b2" />
      </TossFadeIn>
      <TossFadeIn delay={520} duration={200}>
        {[0, 1].map((i) => (
          <div key={i} className="toss-assets-skel__row" style={{ top: 160 + i * 74.4 }}>
            <TossSkeleton tone="web" w={40} h={40} r={20} className="toss-assets-skel__dot" />
            <TossSkeleton tone="web" w={280} h={42.4} r={10} className="toss-assets-skel__bar" />
          </div>
        ))}
      </TossFadeIn>
    </div>
  );
}

// ---------- 머리줄 가운데 ◂ {M}월 ▸ · 오른쪽 돋보기 ⋯ ----------
function SpendHeadTools({ s, onMonth }: { s: TossSpend; onMonth: (by: number) => void }) {
  return (
    <div className="toss-assets-spend__tools">
      <div className="toss-assets-spend__mgroup">
        <TossPressable className="toss-assets-spend__tri" radius={18} disabled={!s.hasPrev} onPress={() => onMonth(-1)} ariaLabel="이전 달">
          <TriIcon dir="left" color={s.hasPrev ? "#8e8d90" : "#3a393c"} />
        </TossPressable>
        <span className="toss-assets-spend__month">{s.label}</span>
        <TossPressable className="toss-assets-spend__tri" radius={18} disabled={!s.hasNext} onPress={() => onMonth(1)} ariaLabel="다음 달">
          <TriIcon dir="right" color={s.hasNext ? "#8e8d90" : "#3a393c"} />
        </TossPressable>
      </div>
      <TossPressable className="toss-assets-spend__search" radius={22} ariaLabel="검색">
        <SearchGlyph />
      </TossPressable>
      <TossPressable className="toss-assets-spend__more" radius={22} ariaLabel="더 보기">
        <DotsGlyph />
      </TossPressable>
    </div>
  );
}

// ---------- 탭 (81.6–121.6): 가운데 x 52.4 / 116 / 184 / 260.8, 밑줄은 글자 + 양쪽 ≈ 8 ----------
function SpendTabs({ tab, onTab }: { tab: TossSpendTab; onTab: (t: TossSpendTab) => void }) {
  const labels = useRef(new Map<TossSpendTab, HTMLSpanElement>());
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = labels.current.get(tab);
    if (!el) return;
    const c = TABS.find((t) => t[0] === tab)![2];
    const w = el.offsetWidth + 11.2; // 글자 잉크 + 양쪽 ≈ 7.2–8 (전체 32.8–72.8)
    setInd({ x: c - w / 2, w });
  }, [tab]);
  return (
    <div className="toss-assets-spend__tabs" role="tablist">
      {TABS.map(([id, label, cx]) => (
        <TossPressable key={id} className={`toss-assets-spend__tab${id === tab ? " on" : ""}`} style={{ left: cx - 36 }} radius={10} color="transparent" onPress={() => onTab(id)} role="tab">
          <span
            ref={(el) => {
              if (el) labels.current.set(id, el);
            }}
          >
            {label}
          </span>
        </TossPressable>
      ))}
      {ind && <i className="toss-assets-spend__ind" style={{ left: ind.x, width: ind.w }} />}
    </div>
  );
}

// ---------- 요약: 합계 · 지난달 비교 · 분석 · 분류 막대 · 범례 ----------
function SpendSummary({ s }: { s: TossSpend }) {
  const d = diffCopy(s.vsLastMonth.diff);
  const segs = barSegments(s.categories);
  return (
    <section className="toss-assets-sum">
      <p className="toss-assets-sum__total">{s.total > 0 ? `-${num(s.total)}원` : "0원"}</p>
      <p className="toss-assets-sum__diff">
        {d.tone === "same" ? (
          "지난달과 비슷해요"
        ) : (
          <>
            지난달보다 <em className={d.tone === "more" ? "red" : "blue"}>{d.amount}</em> {d.tone === "more" ? "더 쓰는 중" : "덜 쓰는 중"}
          </>
        )}
      </p>
      <TossPressable className="toss-assets-sum__analyze" radius={8} fadeOut={150}>
        분석
      </TossPressable>
      <div className="toss-assets-sum__bar">
        {segs.length ? segs.map((g) => <i key={g.key} style={{ width: g.w, background: g.color }} />) : <i style={{ width: 336, background: "#3e3d40" }} />}
      </div>
      <div className="toss-assets-sum__legend">
        {segs.map((g) => (
          <span key={g.key}>
            <i style={{ background: g.color }} />
            {s.categories.find((c) => c.key === g.key)?.label ?? g.key}
          </span>
        ))}
      </div>
    </section>
  );
}

// ---------- 주간 달력 (붙음): 일요일부터 7칸 51.2, 고른 날 ⌀40 #100f12, 날마다 +받은 돈 / -쓴 돈 ----------
function WeekStrip({
  s,
  selected,
  expanded,
  onPick,
  onToggle,
}: {
  s: TossSpend;
  selected: string;
  expanded: boolean;
  onPick: (date: string) => void;
  onToggle: () => void;
}) {
  const weeks = monthWeeks(s.month);
  const wi = Math.max(0, weeks.findIndex((w) => w.some((c) => c.date === selected && !c.out)));
  const byDate = new Map(s.days.map((d) => [d.date, d]));
  // 펼치기 · 접기 동안만 움직임 (스크롤 엿보기로 다른 주로 넘어갈 땐 바로)
  const [anim, setAnim] = useState(false);
  const [prevExp, setPrevExp] = useState(expanded);
  if (prevExp !== expanded) {
    setPrevExp(expanded);
    setAnim(true);
  }
  useEffect(() => {
    if (!anim) return;
    const t = window.setTimeout(() => setAnim(false), SPEND.expand + 30);
    return () => window.clearTimeout(t);
  }, [anim]);
  const rows = expanded ? weeks.length : 1;
  const h = SPEND.weekTop + rows * SPEND.weekH + SPEND.foot;
  return (
    <div className={`toss-assets-strip${expanded ? " toss-assets-strip--open" : ""}${anim ? " toss-assets-strip--anim" : ""}`} style={{ height: h }}>
      <div className="toss-assets-strip__dow">
        {DOW.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="toss-assets-strip__clip" style={{ height: rows * SPEND.weekH }}>
        <div className="toss-assets-strip__weeks" style={{ transform: `translate3d(0, ${expanded ? 0 : -wi * SPEND.weekH}px, 0)` }}>
          {weeks.map((w, i) => (
            <div key={i} className="toss-assets-strip__week">
              {w.map((c) => {
                const d = c.out ? undefined : byDate.get(c.date);
                const on = c.date === selected && !c.out;
                return (
                  <TossPressable
                    key={c.date}
                    className={`toss-assets-strip__cell${c.out ? " out" : ""}${on ? " on" : ""}`}
                    disabled={c.out}
                    color="transparent"
                    onPress={() => onPick(c.date)}
                  >
                    <span className="toss-assets-strip__date">{c.day}</span>
                    {d && d.income > 0 && <FitText className="toss-assets-strip__in" text={`+${num(d.income)}원`} max={42} />}
                    {d && d.expense > 0 && <FitText className="toss-assets-strip__out" text={`-${num(d.expense)}원`} max={42} />}
                  </TossPressable>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <TossPressable className="toss-assets-strip__more" radius={14} onPress={onToggle} ariaLabel={expanded ? "달력 접기" : "달력 펼치기"}>
        <VChevron up={expanded} />
      </TossPressable>
    </div>
  );
}

// ---------- 날짜 묶음: 머리 'D일 요일' (+ 평소보다 많이 씀) · 캐시백 줄(오늘만) · 거래 줄 72.8 ----------
function SpendGroup({
  g,
  cashback,
  refFn,
  onRow,
  bankColor,
}: {
  g: TossSpendGroup;
  cashback: number;
  refFn: (el: HTMLElement | null) => void;
  onRow: (it: TossSpendItem) => void;
  bankColor: (code: string) => string | undefined;
}) {
  return (
    <section className="toss-assets-group" ref={refFn}>
      <h3 className="toss-assets-group__head">
        {g.label}
        {g.overspent && <span className="toss-assets-group__over">평소보다 많이 씀</span>}
      </h3>
      {cashback > 0 && (
        <div className="toss-assets-cash">
          <CashbackIcon />
          <p className="toss-assets-cash__title">{cashback}건</p>
          <p className="toss-assets-cash__sub">캐시백 가능한 내역</p>
          <TossPressable className="toss-assets-cash__btn" radius={8} fadeOut={150}>
            받기
          </TossPressable>
        </div>
      )}
      {g.items.map((it) => (
        <SpendRow key={it.id} it={it} onPress={() => onRow(it)} bankColor={bankColor} />
      ))}
    </section>
  );
}

function SpendRow({ it, onPress, bankColor }: { it: TossSpendItem; onPress: () => void; bankColor: (code: string) => string | undefined }) {
  const a = it.amount;
  const text = it.tone === "income" ? `+${num(a)}원` : a < 0 ? `-${num(-a)}원` : `${num(a)}원`;
  return (
    <TossPressable className={`toss-assets-srow toss-assets-srow--${it.tone}`} color="#27282d" onPress={onPress}>
      <SpendIcon icon={it.icon} bankColor={bankColor} />
      <div className="toss-assets-srow__text">
        <div className="toss-assets-srow__line">
          <p className="toss-assets-srow__title">
            {it.title}
            {it.suffix && (
              <>
                <span className="toss-assets-srow__bar"> | </span>
                <span className="toss-assets-srow__suffix">{it.suffix}</span>
              </>
            )}
          </p>
          <p className="toss-assets-srow__amt">{text}</p>
        </div>
        <p className="toss-assets-srow__sub">{it.subtitle}</p>
      </div>
    </TossPressable>
  );
}
