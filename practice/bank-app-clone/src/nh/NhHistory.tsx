import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { Account, HomeData, Transaction } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog, Sheet } from "../components/Sheet";
import { useStatusBar } from "../hooks/useStatusBar";
import { useNhGo, withNhLoading } from "./loading";
import { NhCloseIcon, NhHeader, NhImg } from "./common";
import { nhWon } from "./hangul";
import "./nh-history.css";

type Filter = "all" | "in" | "out";
const FILTER_LABEL: Record<Filter, string> = {
  all: "입출금",
  in: "입금",
  out: "출금",
};
const TABS = ["입출금", "예적금/신탁", "대출", "펀드", "외화"];
const digits = (s: string) => s.replace(/\D/g, "");

// "26.09.29~26.10.28" (오늘부터 한 달)
function monthRange() {
  const fmt = (d: Date) => `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  start.setDate(start.getDate() + 1);
  return {
    label: `${fmt(start)}~${fmt(end)}`,
    from: start.toISOString().slice(0, 10),
  };
}

// 아래 아이콘들은 실제 화면(스크린샷 720px)에서 잰 모양을 24dp 상자에 옮긴 것 (scratchpad work/history/spec.md)
// 계좌번호 옆 ⌄ (잉크 12×6.4dp, 1.6dp, #cdd2d8)
function AcctChevron() {
  return (
    <svg className="nh-hist__chev" width="14" height="8" viewBox="0 0 14 8" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M1.45 1.05 7 6.6l5.55-5.55" />
    </svg>
  );
}

// 최근거래순 옆 ⌄ (잉크 11.7×6.9dp, 1.4dp)
function SortChevron() {
  return (
    <svg width="14" height="9" viewBox="0 0 14 9" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M1.63 1.5 7 6.87l5.37-5.37" />
    </svg>
  );
}

// 잠금 동그라미 안 자물쇠 (열림 = 잔액 보이는 중)
function Padlock({ open }: { open: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
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

// 계좌선택 시트 체크 (잉크 16.8×12.8dp, 1.8dp, 보라)
function CheckIcon() {
  return (
    <svg width="18.4" height="13.6" viewBox="0 0 18.4 13.6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
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

// 계좌별 거래내역 (스크린샷 2026-10-28 9:48, 녹화2 40~61초)
export function NhHistory() {
  const { accountId = "main" } = useParams();
  const navigate = useNavigate();
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const home = useApi<HomeData>(paths.home);
  const account = useApi<Account>(paths.account(accountId));
  const txs = useApi<Transaction[]>(paths.transactions(accountId));
  const [hidden, setHidden] = useState(false); // 자물쇠: 잔액 가리기
  const [filter, setFilter] = useState<Filter>("all");
  const [pick, setPick] = useState<"account" | "filter" | null>(null);
  const [pickTab, setPickTab] = useState<"list" | "direct">("list");
  const [typed, setTyped] = useState("");
  const [alert, setAlert] = useState<string | null>(null);
  useStatusBar(pick ? "#0c0b0e" : "#18171c", "light");

  const range = monthRange();
  const rows = (txs.data ?? []).filter((t) => t.at.slice(0, 10) >= range.from && (filter === "all" || (filter === "in" ? t.amount > 0 : t.amount < 0)));
  const a = account.data;

  // 계좌번호 ⌄ : 실제 앱은 점 3개 로딩(약 0.2초) 뒤 시트가 올라옴
  const openPicker = () => {
    setPickTab("list");
    setTyped("");
    withNhLoading(() => undefined, 200).then(() => setPick("account"));
  };
  const toAccount = (id: string) => {
    setPick(null);
    if (id !== accountId) go(`/history/${id}`, { replace: true });
  };
  // 직접입력 '확인': 입력한 번호가 내 계좌면 그 계좌로, 아니면 알림
  const confirmTyped = () => {
    const n = digits(typed);
    if (!n) return setAlert("계좌번호를 입력해 주세요.");
    const hit = home.data?.accounts.find((x) => digits(x.number ?? "") === n);
    if (hit) toAccount(hit.id);
    else setAlert("조회할 수 없는 계좌입니다.\n계좌번호를 확인해 주세요.");
  };

  return (
    <div className="screen nh nh-hist">
      <NhHeader title="계좌별 거래내역" onBack={() => navigate(-1)} home={() => navigate("/")} onMenu={() => go("/accounts")} />
      <nav className="nh-hist__tabs">
        {TABS.map((t, i) => (
          <button key={t} className={i === 0 ? "on" : ""}>
            {t}
          </button>
        ))}
      </nav>

      {/* 헤더·탭 아래만 스크롤 (시트가 화면에 고정되게) */}
      <div className="nh-hist__scroll">
        <div className="nh-hist__acct">
          <NhImg name="nh-history-acct" w={40.53} h={41.07} className="nh-hist__icon" fallback={<span>🟡</span>} />
          <span className="nh-hist__name">
            <b>{a?.label ?? " "}</b>
            <button onClick={openPicker}>
              농축협&nbsp;<span className="nh-hist__no">{a?.number}</span>
              <AcctChevron />
            </button>
          </span>
          <button className="nh-hist__more" aria-label="더보기">
            <svg width="4" height="16.4" viewBox="0 0 4 16.4" fill="currentColor" aria-hidden>
              <circle cx="2" cy="2" r="1.55" />
              <circle cx="2" cy="8.15" r="1.55" />
              <circle cx="2" cy="14.3" r="1.55" />
            </svg>
          </button>
        </div>
        <div className="nh-hist__bal">
          <button className="nh-hist__lock" aria-label={hidden ? "잔액 보기" : "잔액 가리기"} onClick={() => setHidden((h) => !h)}>
            <Padlock open={!hidden} />
          </button>
          <b>{a ? (hidden ? "잔액보기" : nhWon(a.balance)) : " "}</b>
        </div>
        <div className="nh-hist__chips">
          <button className="send" onClick={() => go(`/send?from=${accountId}`)}>
            <NhImg name="nh-history-coin" w={23.47} h={23.47} fallback={<span>🪙</span>} />
            송금
          </button>
          <button onClick={() => setFilter("out")}>송금한 내역</button>
          <button>ATM출금</button>
          <button>입출금알림</button>
        </div>

        <div className="nh-hist__list">
          <div className="nh-hist__view">
            <button className="on" aria-label="목록">
              <ListIcon />
            </button>
            <button aria-label="달력">
              <CalendarIcon />
            </button>
          </div>
          <button className="nh-hist__range" onClick={() => setPick("filter")}>
            <span className="nh-hist__date">{range.label}</span>
            <span className="nh-hist__cond">
              <span>
                {FILTER_LABEL[filter]} · <i>1개월</i>
              </span>
              <SlidersIcon />
            </span>
          </button>
          <div className="nh-hist__sort">
            <SearchIcon />
            <span>
              최근거래순
              <SortChevron />
            </span>
          </div>
          {rows.map((t) => (
            <button key={t.id} className="nh-hist__tx" onClick={() => go(`/tx/${t.id}`)}>
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
          ))}
          {txs.data && !rows.length && <p className="nh-empty">조회기간 내 거래내역이 없어요.</p>}
        </div>
      </div>

      {/* 계좌선택 시트 (녹화2 55.8~61초): 손잡이, [계좌선택|직접입력] 탭, X, 계좌 줄 + 체크, 아래 '계좌 등록' */}
      <Sheet open={pick === "account"} onClose={() => setPick(null)} kind="hist" className="nh-hpick">
        <div className="nh-sheet-handle" />
        <div className="nh-hpick__head">
          <div className="nh-hpick__tabs" role="tablist">
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
                  <NhImg name="nh-history-acct-plain" w={37.33} h={37.33} className="nh-hpick__icon" fallback={<span>🟡</span>} />
                  <span className="nh-hpick__info">
                    <b>{x.label}</b>
                    <span>
                      농축협 {x.number}
                      <button
                        className="nh-hpick__copy"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard?.writeText(x.number ?? "").catch(() => undefined);
                        }}
                      >
                        복사
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
            <button
              className="nh-btn nh-btn--outline-purple nh-hpick__btn nh-hpick__btn--add"
              onClick={() =>
                withNhLoading(() => undefined).then(() => {
                  setPick(null);
                  navigate("/register");
                })
              }
            >
              계좌 등록
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
            </label>
            <p className="nh-hpick__note">
              <InfoIcon />
              나만의 계좌도 조회할 수 있어요.
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
          {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
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
      <Dialog message={alert} onClose={() => setAlert(null)} />
    </div>
  );
}
