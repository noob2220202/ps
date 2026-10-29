import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams, type NavigateOptions } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { Account, HomeData, Transaction } from "../api/types";
import { prefetch, useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog, Sheet } from "../components/Sheet";
import { useLayerActive } from "../platform/LayerContext";
import { useNhLoading, withNhLoading } from "./loading";
import { NhCloseIcon, NhHeader } from "./common";
import { nhWon } from "./hangul";
import "./nh-history.css";
import { useNhStatusBar } from "./theme";

type Filter = "all" | "in" | "out" | "atm";
const FILTER_LABEL: Record<Filter, string> = {
  all: "입출금",
  in: "입금",
  out: "출금",
  atm: "ATM출금",
};
const SHEET_FILTERS: Filter[] = ["all", "in", "out"];
const TABS = ["입출금", "예적금/신탁", "대출", "펀드", "외화"];
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const digits = (s: string) => s.replace(/\D/g, "");
const pad = (n: number) => String(n).padStart(2, "0");
// 날짜는 모두 기기(지역) 시각 기준. 거래의 at도 "2026-10-28T21:46:51" 같은 지역 시각
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dotted = (d: Date) => `${String(d.getFullYear()).slice(2)}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

// 조회기간 1개월: 한 달 전 같은 날(그 달에 없으면 말일)의 다음 날 ~ 오늘. 10/28 → 09.29, 3/31 → 03.01
function monthRange(end = new Date()) {
  const y = end.getFullYear();
  const m = end.getMonth() - 1;
  const lastDay = new Date(y, m + 1, 0).getDate(); // 지난달 말일
  const start = new Date(y, m, Math.min(end.getDate(), lastDay) + 1);
  return { label: `${dotted(start)}~${dotted(end)}`, from: ymd(start), to: ymd(end) };
}

const matches = (t: Transaction, f: Filter) =>
  f === "all" ? true : f === "in" ? t.amount > 0 : f === "out" ? t.amount < 0 : t.amount < 0 && /ATM/i.test(`${t.merchant} ${t.tag}`);

// 뒤로가기(브라우저 popstate)로 이 화면이 다시 열렸는지. 화면마다 <Routes location>으로 그려서
// useNavigationType()은 늘 POP이라 쓸 수 없음 → 마지막 popstate 시각으로 판단
let lastPop = -1e9;
if (typeof window !== "undefined") window.addEventListener("popstate", () => (lastPop = performance.now()));
const cameBack = () => performance.now() - lastPop < 1000;

// 주소로 바로 들어와서 앱 안에 이전 화면이 없으면 홈으로
function useSafeBack() {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  };
}

// 아래 아이콘들은 실제 화면(스크린샷 720px)에서 잰 모양을 24dp 상자에 옮긴 것 (scratchpad work/history/spec.md)
// 계좌번호 옆 ⌄ (잉크 12×6.4dp, 1.6dp, #cdd2d8)
function AcctChevron() {
  return (
    <svg className="nh-hist__chev" width="14" height="8" viewBox="0 0 14 8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M1.5 1.1 7 6.6l5.5-5.5" />
    </svg>
  );
}

// 최근거래순 옆 ⌄ (잉크 11.7×6.9dp, 1.4dp)
function SortChevron({ up }: { up?: boolean }) {
  return (
    <svg width="14" height="9" viewBox="0 0 14 9" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d={up ? "M1.63 7.37 7 2l5.37 5.37" : "M1.63 1.5 7 6.87l5.37-5.37"} />
    </svg>
  );
}

// 잠금 동그라미 안 자물쇠 (열림 = 잔액 보이는 중)
function Padlock({ open }: { open: boolean }) {
  return (
    <svg className="nh-hist__padlock" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <rect x="5.15" y="10.4" width="13.7" height="9.23" rx="3.4" />
      <path d={open ? "M9.07 10.4V7.68a2.93 2.93 0 0 1 5.86 0" : "M9.07 10.4V7.68a2.93 2.93 0 0 1 5.86 0v2.72"} />
      <path d="M12 14.6v1.7" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4.35 7.07h15.3M4.35 12h15.3M4.35 16.93h15.3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="4.38" y="5.23" width="15.24" height="13.65" rx="2.6" />
      <path d="M4.38 8.96h15.24M8.53 2.67v2.56M15.47 2.67v2.56" />
    </svg>
  );
}

// 기간 필터바 오른쪽: 두 줄 + 동그라미 (동그라미 안은 비어 있음)
function SlidersIcon() {
  return (
    <svg width="20" height="20" viewBox="2 2 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2.27 7.47h3.6M11.47 7.47h10.26M2.27 16.53h10M17.87 16.53h3.86" />
      <circle cx="8.67" cy="7.47" r="2.8" />
      <circle cx="15.07" cy="16.53" r="2.8" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="10.5" cy="10.5" r="7.57" />
      <path d="m15.85 15.85 4.05 4.05" />
    </svg>
  );
}

// 계좌선택 시트 체크 (잉크 16.8×12.8dp, 1.8dp → 녹화에서 조금 더 굵게 보여 2.0, 보라)
function CheckIcon() {
  return (
    <svg width="18.4" height="13.6" viewBox="0 0 18.4 13.6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1.2 6 6.8 11.6l10.4-10.4" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
      <circle cx="9" cy="9" r="7.9" />
      <path d="M9 7.6v5.4" strokeWidth="1.2" />
      <circle cx="9" cy="5.3" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

// 잘라 온 그림을 SVG <image>로: <img>는 그리는 상자가 CSS px 정수로 반올림돼 다시 샘플링(흐려짐)되지만
// SVG 안 좌표는 반올림되지 않아 기기 px에 1:1로 놓을 수 있음 (x·y는 기기 px 격자에 맞춘 미세 보정)
function CrispImg({ name, w, h, x = 0, y = 0, className, fallback }: { name: string; w: number; h: number; x?: number; y?: number; className: string; fallback: ReactNode }) {
  const src = localAsset(name);
  if (!src)
    return (
      <span className={`nh-img nh-img--fallback ${className}`} style={{ width: w, height: h }}>
        {fallback}
      </span>
    );
  return (
    <svg className={`nh-img nh-hist-img ${className}`} width={w} height={h} aria-hidden>
      <image href={src} x={x} y={y} width={w} height={h} />
    </svg>
  );
}

// 0.5dp(기기 1px) 테두리. CSS border·box-shadow는 0.5px를 1 CSS px(기기 1.875px)로 올려 그려서 SVG 선으로 그림.
// 상자 크기는 CSS(--w/--h 없이 100%)로, 선 위치는 nh-history.css 의 x/y/rx 값으로 정함
function Hairline({ className }: { className: string }) {
  return (
    <svg className={`nh-hair ${className}`} aria-hidden>
      <rect />
    </svg>
  );
}

// 거래 줄 아래 0.5dp 구분선들(스크린샷 y 1210 / 1426 px 한 줄씩). 줄마다 SVG를 두면 줄 위치(115.2 간격)가
// 줄마다 다르게 반올림돼서 선이 두 줄로 번짐 → 한 SVG 안에 115.2 간격으로 그림
function RowLines({ count }: { count: number }) {
  return (
    <svg className="nh-hist__seps" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <rect key={i} y={i * 115.2 + 114.3333} />
      ))}
    </svg>
  );
}

// 계좌별 거래내역 (스크린샷 2026-10-28 9:48, 녹화2 40~61초)
// 계좌가 바뀌면(시트 선택·직접입력) 잔액 가리기·필터 등을 처음 상태로: 계좌 id를 key로 새로 그림
export function NhHistory() {
  const { accountId = "main" } = useParams();
  return <HistoryScreen key={accountId} accountId={accountId} />;
}

function HistoryScreen({ accountId }: { accountId: string }) {
  const navigate = useNavigate();
  const [popped] = useState(cameBack);
  const back = useSafeBack();
  const loading = useNhLoading();
  const active = useLayerActive();
  const home = useApi<HomeData>(paths.home);
  const account = useApi<Account>(paths.account(accountId));
  const txs = useApi<Transaction[]>(paths.transactions(accountId));
  const [tab, setTab] = useState(0);
  const [hidden, setHidden] = useState(false); // 자물쇠: 잔액 가리기
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"list" | "cal">("list");
  const [asc, setAsc] = useState(false); // 과거거래순
  const [searchParams] = useSearchParams();
  // 돋보기: null = 검색 닫힘. 거래 상세의 ''이름' 검색 ›'은 ?q=이름 으로 열려서 바로 걸러짐
  const [query, setQuery] = useState<string | null>(() => searchParams.get("q"));
  const [menu, setMenu] = useState(false); // ⋮
  const [alerts, setAlerts] = useState(false); // 입출금알림 신청 여부 (모양만)
  const [pick, setPick] = useState<"account" | "filter" | null>(null);
  const [pickTab, setPickTab] = useState<"list" | "direct">("list");
  const [typed, setTyped] = useState("");
  const [alert, setAlert] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<"tx" | "load" | null>(null); // 다음 화면 등장 방식 (CSS)
  // 실제 앱: 로딩 막이 걷힌 뒤 약 130ms 있다가 거래 줄이 나타남(녹화2 41.105 → 41.233). 뒤로 돌아올 땐 바로
  // (iOS 스와이프 중 뒤에 깔려 그려질 때도 바로)
  const [ready, setReady] = useState(popped || !active);
  useNhStatusBar("#18171c"); // 계좌선택 시트가 열려도 상태바는 그대로 (녹화2 55.6~61)

  // 로딩 막을 minMs 동안 보여 준 뒤 이동하고, 새 화면이 실제로 붙을 때까지(이 화면이 맨 위에서 내려가거나 사라질 때까지)
  // 막을 유지. 막이 먼저 걷히면 이전 화면이 몇 프레임 보임 (실제 앱은 막이 걷히는 프레임에 이미 새 화면)
  const leave = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!active) leave.current?.();
  }, [active]);
  useEffect(() => () => leave.current?.(), [leave]);
  const goUnder = (to: string, minMs = 550, opts?: NavigateOptions) =>
    withNhLoading(async () => {
      await new Promise((r) => setTimeout(r, minMs));
      await new Promise<void>((done) => {
        const t = setTimeout(done, 300);
        leave.current = () => {
          clearTimeout(t);
          leave.current = null;
          done();
        };
        navigate(to, opts);
      });
    }, 0);

  useEffect(() => {
    if (ready || loading) return;
    const id = setTimeout(() => setReady(true), 130);
    return () => clearTimeout(id);
  }, [ready, loading]);

  const range = monthRange();
  const all = txs.data ?? [];
  const q = query?.trim() ?? "";
  const rows = all
    .filter((t) => {
      const day = t.at.slice(0, 10);
      return day >= range.from && day <= range.to && matches(t, filter) && (!q || t.merchant.includes(q));
    })
    .sort((x, y) => (asc ? x.at.localeCompare(y.at) : y.at.localeCompare(x.at)));
  const a = account.data;
  const missing = account.status === "error" && account.error.status === 404;

  // 거래상세는 로딩 없이 바로 넘어감(약 85ms 교차 페이드) → 상세 데이터를 미리 받아 둠
  const txLoads = useRef(new Map<string, Promise<unknown>>());
  const loadTx = (id: string) => {
    const had = txLoads.current.get(id);
    if (had) return had;
    const p = prefetch(paths.transaction(id));
    txLoads.current.set(id, p);
    return p;
  };
  const rowIds = rows.slice(0, 20).map((t) => t.id).join(",");
  useEffect(() => {
    if (!ready || !rowIds) return;
    for (const id of rowIds.split(",")) {
      if (!txLoads.current.has(id)) txLoads.current.set(id, prefetch(paths.transaction(id)));
    }
  }, [ready, rowIds]);
  const openTx = (id: string) => {
    setLeaving("tx");
    loadTx(id).then(() => navigate(`/tx/${id}`));
  };
  const goLoad = (to: string) => {
    setLeaving("load");
    goUnder(to);
  };

  // 계좌번호 ⌄ : 실제 앱은 점 3개 로딩(약 0.19초) 뒤 시트가 올라옴
  const openPicker = () => {
    setPickTab("list");
    setTyped("");
    withNhLoading(() => undefined, 185).then(() => setPick("account"));
  };
  const toAccount = (id: string) => {
    setPick(null);
    if (id !== accountId) goUnder(`/history/${id}`, 550, { replace: true });
  };
  // 직접입력 '확인': 입력한 번호가 내 계좌면 그 계좌로, 아니면 알림
  const confirmTyped = () => {
    const n = digits(typed);
    if (!n) return setAlert("계좌번호를 입력해 주세요.");
    const hit = home.data?.accounts.find((x) => digits(x.number ?? "") === n);
    if (hit) toAccount(hit.id);
    else setAlert("조회할 수 없는 계좌입니다.\n계좌번호를 확인해 주세요.");
  };
  // 계좌 등록: 로딩 막이 0.8초 유지되는 동안 시트는 그대로, 그다음 등록 화면으로 한 번에 바뀜 (녹화2 60.66 → 61.46)
  const toRegister = () => {
    setLeaving("load");
    goUnder("/register", 800);
  };
  const copyNumber = (n?: string) => navigator.clipboard?.writeText(n ?? "").catch(() => undefined);

  const txRow = (t: Transaction) => (
    <button key={t.id} className="nh-hist__tx" onPointerDown={() => loadTx(t.id)} onClick={() => openTx(t.id)}>
      <span className="nh-hist__txl">
        <small>{t.at.replace("T", " ").replaceAll("-", ".")}</small>
        <b>{t.merchant}</b>
      </span>
      <span className="nh-hist__txr">
        <small className={t.amount > 0 ? "in" : "out"}>{t.amount > 0 ? "입금" : "출금"}</small>
        <b className={t.amount > 0 ? "in" : ""}>{nhWon(Math.abs(t.amount))}</b>
        <small>
          잔액 <span>{nhWon(t.balanceAfter)}</span>
        </small>
      </span>
    </button>
  );

  const failed = (txs.status === "error" && !txs.data) || (account.status === "error" && !missing);

  return (
    <div className={`screen nh nh-hist${leaving ? ` nh-hist--to-${leaving}` : ""}${popped ? " nh-hist--pop" : ""}`}>
      <NhHeader title="계좌별 거래내역" onBack={back} home={() => navigate("/")} onMenu={() => goLoad("/accounts")} />
      <nav className="nh-hist__tabs" role="tablist">
        {TABS.map((t, i) => (
          <button key={t} role="tab" aria-selected={i === tab} className={i === tab ? "on" : ""} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </nav>

      {/* 헤더·탭 아래만 스크롤 (시트가 화면에 고정되게) */}
      <div className="nh-hist__scroll">
        {tab !== 0 ? (
          <p className="nh-hist__none">조회할 수 있는 {TABS[tab]} 계좌가 없어요.</p>
        ) : missing ? null : (
          <>
            <div className="nh-hist__acct">
              <CrispImg name="nh-history-acct" w={40.5333} h={41.0667} x={-0.4} y={-0.1333} className="nh-hist__icon" fallback={<span>🟡</span>} />
              <span className="nh-hist__name">
                <b>{a?.label ?? " "}</b>
                <button onClick={openPicker}>
                  농축협<span className="nh-hist__no">{a?.number}</span>
                  <AcctChevron />
                </button>
              </span>
              <button className="nh-hist__more" aria-label="더보기" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <svg width="4" height="16.4" viewBox="0 0 4 16.4" fill="currentColor" aria-hidden>
                  <circle cx="2" cy="2" r="1.55" />
                  <circle cx="2" cy="8.15" r="1.55" />
                  <circle cx="2" cy="14.3" r="1.55" />
                </svg>
              </button>
              {menu && (
                <>
                  <div className="nh-hist__menu-bg" onClick={() => setMenu(false)} />
                  <div className="nh-hist__menu" role="menu">
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        copyNumber(a?.number);
                        setAlert("계좌번호가 복사되었습니다.");
                      }}
                    >
                      계좌번호 복사
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        goLoad("/accounts");
                      }}
                    >
                      전체계좌 조회
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="nh-hist__bal">
              <button className="nh-hist__lock" aria-label={hidden ? "잔액 보기" : "잔액 가리기"} onClick={() => setHidden((h) => !h)}>
                <svg className="nh-hist__ring" aria-hidden>
                  <ellipse />
                </svg>
                <Padlock open={!hidden} />
              </button>
              <b>{a ? (hidden ? "잔액보기" : nhWon(a.balance)) : " "}</b>
              {/* 잔액이 0원이면 [+ 채우기] (2026-10-29 녹화) */}
              {a?.balance === 0 && !hidden && <span className="nh-hist__fill">+ 채우기</span>}
            </div>
            <div className="nh-hist__chips">
              <button className="send" onClick={() => goLoad(`/send?from=${accountId}`)}>
                <Hairline className="nh-hist__sendline" />
                <CrispImg name="nh-history-coin" w={23.4667} h={23.4667} x={0.2} y={0.2} className="nh-hist__coin" fallback={<span>🪙</span>} />
                <span>송금</span>
              </button>
              <button className={filter === "out" ? "on" : ""} aria-pressed={filter === "out"} onClick={() => setFilter((f) => (f === "out" ? "all" : "out"))}>
                송금한 내역
              </button>
              <button className={filter === "atm" ? "on" : ""} aria-pressed={filter === "atm"} onClick={() => setFilter((f) => (f === "atm" ? "all" : "atm"))}>
                ATM출금
              </button>
              <button
                onClick={() => {
                  setAlerts((v) => !v);
                  setAlert(alerts ? "입출금알림을 해지했어요." : "입출금알림을 신청했어요.\n입출금이 있으면 알림으로 알려드려요.");
                }}
              >
                입출금알림
              </button>
            </div>

            <div className="nh-hist__list">
              <div className="nh-hist__view" role="tablist">
                <button role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} aria-label="목록" onClick={() => setView("list")}>
                  <ListIcon />
                </button>
                <button role="tab" aria-selected={view === "cal"} className={view === "cal" ? "on" : ""} aria-label="달력" onClick={() => setView("cal")}>
                  <CalendarIcon />
                </button>
              </div>
              {view === "list" ? (
                <>
                  <button className="nh-hist__range" onClick={() => setPick("filter")}>
                    <span className="nh-hist__date">{range.label}</span>
                    <span className="nh-hist__cond">
                      <span>
                        {FILTER_LABEL[filter]} · <i>1개월</i>
                      </span>
                      <SlidersIcon />
                    </span>
                  </button>
                  <div className={`nh-hist__sort${query !== null ? " nh-hist__sort--search" : ""}`}>
                    {query !== null ? (
                      <>
                        <SearchIcon />
                        <input autoFocus value={query} maxLength={20} placeholder="거래내용을 입력해 주세요." onChange={(e) => setQuery(e.target.value)} />
                        <button className="nh-hist__qclose" aria-label="검색 닫기" onClick={() => setQuery(null)}>
                          <NhCloseIcon />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="nh-hist__search" aria-label="검색" onClick={() => setQuery("")}>
                          <SearchIcon />
                        </button>
                        <button className="nh-hist__order" onClick={() => setAsc((v) => !v)}>
                          <span>{asc ? "과거거래순" : "최근거래순"}</span>
                          <SortChevron up={asc} />
                        </button>
                      </>
                    )}
                  </div>
                  {failed ? (
                    <div className="nh-hist__err">
                      <b>일시적인 오류가 발생했어요</b>
                      <button
                        className="nh-btn nh-btn--line"
                        onClick={() => {
                          account.retry();
                          txs.retry();
                        }}
                      >
                        다시 시도
                      </button>
                    </div>
                  ) : (
                    ready &&
                    txs.data && (
                      <>
                        {rows.length > 0 && (
                          <div className="nh-hist__rows">
                            {rows.map(txRow)}
                            <RowLines count={rows.length} />
                          </div>
                        )}
                        {!rows.length && <p className="nh-empty">{q ? "검색 결과가 없어요." : "조회기간 내 거래내역이 없어요."}</p>}
                      </>
                    )
                  )}
                </>
              ) : (
                <HistoryCalendar txs={all.filter((t) => matches(t, filter))} renderRow={txRow} />
              )}
            </div>
          </>
        )}
      </div>

      {/* 계좌선택 시트 (녹화2 55.8~61초): 손잡이, [계좌선택|직접입력] 탭, X, 계좌 줄 + 체크, 아래 '계좌 등록' */}
      <Sheet open={pick === "account"} onClose={() => setPick(null)} kind="hist" className="nh-hpick">
        <div className="nh-sheet-handle" />
        <div className="nh-hpick__head">
          <div className="nh-hpick__tabs" role="tablist">
            <Hairline className="nh-hpick__tabsline" />
            <button role="tab" aria-selected={pickTab === "list"} className={pickTab === "list" ? "on" : ""} onClick={() => setPickTab("list")}>
              계좌선택
            </button>
            <button role="tab" aria-selected={pickTab === "direct"} className={pickTab === "direct" ? "on" : ""} onClick={() => setPickTab("direct")}>
              직접입력
            </button>
          </div>
          <button className="nh-icon-btn nh-hpick__close" aria-label="닫기" onClick={() => setPick(null)}>
            <NhCloseIcon />
          </button>
        </div>
        {pickTab === "list" ? (
          <>
            <div className="nh-hpick__list">
              {home.data?.accounts.map((x) => (
                <div key={x.id} className="nh-hpick__row" role="button" tabIndex={0} onClick={() => toAccount(x.id)}>
                  <CrispImg name="nh-history-acct-plain" w={37.3333} h={37.3333} y={-0.8} className="nh-hpick__icon" fallback={<span>🟡</span>} />
                  <span className="nh-hpick__info">
                    <b>{x.label}</b>
                    <span>
                      농축협 {x.number}
                      <button
                        className="nh-hpick__copy"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyNumber(x.number);
                        }}
                      >
                        <Hairline className="nh-hpick__copyline" />
                        <span>복사</span>
                      </button>
                    </span>
                    <em>{nhWon(x.balance)}</em>
                  </span>
                  {x.id === accountId && (
                    <span className="nh-hpick__check">
                      <CheckIcon />
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button className="nh-btn nh-btn--outline-purple nh-hpick__btn nh-hpick__btn--add" onClick={toRegister}>
              <Hairline className="nh-hpick__addline" />
              <span>계좌 등록</span>
            </button>
          </>
        ) : (
          <>
            <label className="nh-hpick__field">
              <input
                value={typed}
                inputMode="numeric"
                maxLength={20}
                placeholder="계좌번호를 입력해 주세요."
                onChange={(e) => setTyped(e.target.value.replace(/[^\d-]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && confirmTyped()}
              />
              <Hairline className="nh-hpick__fieldline" />
            </label>
            <p className="nh-hpick__note">
              <InfoIcon />
              <span>나만의 계좌도 조회할 수 있어요.</span>
            </p>
            <button className="nh-btn nh-hpick__btn nh-hpick__btn--ok" onClick={confirmTyped}>
              확인
            </button>
          </>
        )}
      </Sheet>
      <Sheet open={pick === "filter"} onClose={() => setPick(null)} kind="hist" className="nh-hpick nh-hpick--filter">
        <div className="nh-sheet-handle" />
        <div className="nh-hpick__head">
          <h2>조회조건</h2>
          <button className="nh-icon-btn nh-hpick__close" aria-label="닫기" onClick={() => setPick(null)}>
            <NhCloseIcon />
          </button>
        </div>
        <div className="nh-hpick__tabs nh-hpick__tabs--filter">
          {SHEET_FILTERS.map((f) => (
            <button
              key={f}
              className={filter === f ? "on" : ""}
              onClick={() => {
                setFilter(f);
                setPick(null);
              }}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </Sheet>
      <Dialog message={missing ? "조회할 수 없는 계좌입니다.\n계좌번호를 확인해 주세요." : null} onClose={back} />
      <Dialog message={alert} onClose={() => setAlert(null)} />
    </div>
  );
}

// 보기 토글 '달력': 달마다 날짜 칸, 거래가 있는 날엔 입금(파랑)·출금(빨강) 합계, 누른 날의 거래 줄을 아래에
function HistoryCalendar({ txs, renderRow }: { txs: Transaction[]; renderRow: (t: Transaction) => ReactNode }) {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [day, setDay] = useState(ymd(today));
  const first = month.getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const byDay = new Map<string, Transaction[]>();
  for (const t of txs) byDay.set(t.at.slice(0, 10), [...(byDay.get(t.at.slice(0, 10)) ?? []), t]);
  const sum = (list: Transaction[], sign: 1 | -1) => list.filter((t) => Math.sign(t.amount) === sign).reduce((s, t) => s + Math.abs(t.amount), 0);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const picked = (byDay.get(day) ?? []).slice().sort((x, y) => y.at.localeCompare(x.at));
  return (
    <div className="nh-hcal">
      <div className="nh-hcal__head">
        <button aria-label="이전 달" onClick={() => shift(-1)}>
          <SortChevron />
        </button>
        <b>
          {month.getFullYear()}.{pad(month.getMonth() + 1)}
        </b>
        <button aria-label="다음 달" onClick={() => shift(1)}>
          <SortChevron />
        </button>
      </div>
      <div className="nh-hcal__grid">
        {WEEK.map((w) => (
          <span key={w} className="nh-hcal__wd">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const key = ymd(d);
          const list = byDay.get(key) ?? [];
          const inSum = sum(list, 1);
          const outSum = sum(list, -1);
          return (
            <button key={key} className={`nh-hcal__day${key === day ? " on" : ""}${key === ymd(today) ? " today" : ""}`} onClick={() => setDay(key)}>
              <span>{d.getDate()}</span>
              {inSum > 0 && <i className="in">+{inSum.toLocaleString("ko-KR")}</i>}
              {outSum > 0 && <i className="out">-{outSum.toLocaleString("ko-KR")}</i>}
            </button>
          );
        })}
      </div>
      {picked.length ? (
        <div className="nh-hist__rows">
          {picked.map(renderRow)}
          <RowLines count={picked.length} />
        </div>
      ) : (
        <p className="nh-empty">이 날은 거래내역이 없어요.</p>
      )}
    </div>
  );
}
