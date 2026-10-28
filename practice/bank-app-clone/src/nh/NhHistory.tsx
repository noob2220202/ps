import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { Account, HomeData, Transaction } from "../api/types";
import { useApi } from "../api/useApi";
import { Icon } from "../components/icons/Icon";
import { Sheet } from "../components/Sheet";
import { useStatusBar } from "../hooks/useStatusBar";
import { useNhGo } from "./loading";
import { HomeLine, LockIcon, NhAccountIcon, NhImg } from "./common";
import { nhWon } from "./hangul";

type Filter = "all" | "in" | "out";
const FILTER_LABEL: Record<Filter, string> = { all: "입출금", in: "입금", out: "출금" };

// "26.09.29~26.10.28" (오늘부터 한 달)
function monthRange() {
  const fmt = (d: Date) => `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  start.setDate(start.getDate() + 1);
  return { label: `${fmt(start)}~${fmt(end)}`, from: start.toISOString().slice(0, 10) };
}

// 계좌별 거래내역 (스크린샷 2026-10-28 9:48)
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
  useStatusBar(pick ? "#0b0b0e" : "#18171c", "light");

  const range = monthRange();
  const rows = (txs.data ?? []).filter(
    (t) => t.at.slice(0, 10) >= range.from && (filter === "all" || (filter === "in" ? t.amount > 0 : t.amount < 0)),
  );
  const a = account.data;

  return (
    <div className="screen nh nh-history">
      <header className="nh-header">
        <button className="nh-icon-btn" aria-label="뒤로" onClick={() => navigate(-1)}>
          <Icon name="back" size={24} stroke={1.8} />
        </button>
        <h1>계좌별 거래내역</h1>
        <span className="nh-header__right">
          <button className="nh-icon-btn" aria-label="홈" onClick={() => navigate("/")}>
            <HomeLine />
          </button>
          <button className="nh-icon-btn" aria-label="전체계좌" onClick={() => go("/accounts")}>
            <Icon name="menu" size={24} stroke={1.7} />
          </button>
        </span>
      </header>
      <nav className="nh-tabs nh-tabs--scroll">
        {["입출금", "예적금/신탁", "대출", "펀드", "외화"].map((t, i) => (
          <button key={t} className={i === 0 ? "on" : ""}>
            {t}
          </button>
        ))}
      </nav>

      <div className="nh-history__account">
        <span className="nh-history__icon">
          <NhAccountIcon size={33} />
          {a?.kind === "main" && <i className="nh-star" />}
        </span>
        <span className="nh-history__name">
          <b>{a?.label ?? " "}</b>
          <button onClick={() => setPick("account")}>
            농축협 {a?.number} <Icon name="chevron-down" size={16} stroke={2} />
          </button>
        </span>
        <span className="nh-history__dots">⋮</span>
      </div>
      <div className="nh-history__balance">
        <button className="nh-lock nh-lock--ring" aria-label="잔액 가리기" onClick={() => setHidden((h) => !h)}>
          <LockIcon size={18} />
        </button>
        <b>{a ? (hidden ? "잔액보기" : nhWon(a.balance)) : " "}</b>
      </div>
      <div className="nh-history__chips">
        <button className="send" onClick={() => go(`/send?from=${accountId}`)}>
          <NhImg name="nh-chip-send" w={20} h={20} fallback={<span>🪙</span>} /> 송금
        </button>
        <button onClick={() => setFilter("out")}>송금한 내역</button>
        <button>ATM출금</button>
        <button>입출금알림</button>
      </div>

      <div className="nh-history__list">
        <div className="nh-history__view">
          <button className="on" aria-label="목록">
            <Icon name="menu" size={18} stroke={1.8} />
          </button>
          <button aria-label="달력">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M4 10h16M9 3v4m6-4v4" />
            </svg>
          </button>
        </div>
        <button className="nh-history__range" onClick={() => setPick("filter")}>
          <span>{range.label}</span>
          <span>
            {FILTER_LABEL[filter]} · 1개월 <Icon name="sliders" size={20} stroke={1.8} />
          </span>
        </button>
        <div className="nh-history__sort">
          <Icon name="search" size={21} stroke={1.9} />
          <span>
            최근거래순 <Icon name="chevron-down" size={16} stroke={1.8} />
          </span>
        </div>
        {rows.map((t) => (
          <button key={t.id} className="nh-tx" onClick={() => go(`/tx/${t.id}`)}>
            <span className="nh-tx__left">
              <small>{t.at.replace("T", " ").replaceAll("-", ".")}</small>
              <b>{t.merchant}</b>
            </span>
            <span className="nh-tx__right">
              <small className={t.amount > 0 ? "in" : "out"}>{t.amount > 0 ? "입금" : "출금"}</small>
              <b className={t.amount > 0 ? "in" : ""}>{nhWon(Math.abs(t.amount))}</b>
              <small>잔액 {nhWon(t.balanceAfter)}</small>
            </span>
          </button>
        ))}
        {txs.data && !rows.length && <p className="nh-empty">조회기간 내 거래내역이 없어요.</p>}
      </div>

      <Sheet open={pick === "account"} onClose={() => setPick(null)}>
        <h2 className="nh-sheet-title">계좌선택</h2>
        <div className="nh-pick">
          {home.data?.accounts.map((x) => (
            <button
              key={x.id}
              className={x.id === accountId ? "on" : ""}
              onClick={() => {
                setPick(null);
                if (x.id !== accountId) go(`/history/${x.id}`, { replace: true });
              }}
            >
              <NhAccountIcon size={28} />
              <span>
                <b>{x.label}</b>
                <small>{x.number}</small>
              </span>
              <em>{nhWon(x.balance)}</em>
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={pick === "filter"} onClose={() => setPick(null)}>
        <h2 className="nh-sheet-title">조회조건</h2>
        <div className="nh-seg nh-seg--sheet">
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
    </div>
  );
}
