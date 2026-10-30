import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { HomeData, Transaction } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { hanaDay, hanaTxKind, nf } from "./bank";
import { ChevronDown, HanaHeader, HanaSpinner, SearchIcon } from "./common";
import { useHanaStatusBar } from "./theme";
import "./hana-history.css";

// 거래내역조회 (라이트 스크린샷 + 녹화 48~60초, 다크 녹화 7초짜리).
// 회색 바탕 위 흰 계좌 카드(통장 이름 · 번호 ⌄ · 잔액 · 출금가능금액 · 가져오기/보내기) → 🔍 1개월|전체|최신순 → 기간 + 잔액 토글 →
// 흰 목록: 날짜 머리 "2026.10.30 (금)" 아래 거래 (시각 · 이름 / 거래구분 · 금액 · 거래후잔액)
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

export function HanaHistory() {
  const navigate = useNavigate();
  const { accountId = "main" } = useParams();
  const home = useApi<HomeData>(paths.home);
  const txs = useApi<Transaction[]>(paths.transactions(accountId));
  const [showBalance, setShowBalance] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  useHanaStatusBar({ light: "#f1f2f4", dark: "#202125" });
  const account = home.data?.accounts.find((a) => a.id === accountId);

  // 1개월: 오늘부터 한 달 전 다음 날까지 (녹화 10.30 → 2026.10.01~2026.10.30)
  const [today] = useState(() => new Date());
  const start = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate() + 1);
  const startIso = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  const list = (txs.data ?? []).filter((t) => t.at.slice(0, 10) >= startIso);
  const groups = new Map<string, Transaction[]>();
  for (const t of list) {
    const k = t.at.slice(0, 10);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const soon = () => setNotice("연습용 앱에서는 준비 중인 메뉴예요.");

  return (
    <div className="screen hana hana-history">
      <HanaHeader title="거래내역조회" onBack={() => navigate(-1)} />
      <section className="hh-card">
        {account ? (
          <>
            <div className="hh-card__name">
              {localAsset("hana-symbol") && <img src={localAsset("hana-symbol")} alt="" draggable={false} />}
              {account.label}
              <button onClick={soon} aria-label="더보기">
                <svg width="6" height="22" viewBox="0 0 6 22" fill="currentColor" aria-hidden>
                  <circle cx="3" cy="3.5" r="2" />
                  <circle cx="3" cy="11" r="2" />
                  <circle cx="3" cy="18.5" r="2" />
                </svg>
              </button>
            </div>
            <p className="hh-card__no">
              {account.number} <ChevronDown size={20} stroke={1.8} />
            </p>
            <p className="hh-card__bal">{nf.format(account.balance)}원</p>
            <p className="hh-card__avail">출금가능금액 {nf.format(account.balance)}원</p>
            <div className="hh-card__btns">
              <button className="hana-btn hana-btn--mint" onClick={soon}>
                가져오기
              </button>
              <button className="hana-btn" onClick={() => navigate(`/send?from=${account.id}`)}>
                보내기
              </button>
            </div>
          </>
        ) : (
          <div className="hh-card__spin">
            <HanaSpinner />
          </div>
        )}
      </section>
      <div className="hh-filter">
        <SearchIcon size={22} />
        <span className="hh-filter__opts">
          1개월<i />전체<i />최신순
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
            <path d="M5.5 2v14M12.5 2v14" />
            <circle cx="5.5" cy="11.5" r="2" fill="var(--hn-page)" />
            <circle cx="12.5" cy="6.5" r="2" fill="var(--hn-page)" />
          </svg>
        </span>
      </div>
      <div className="hh-range">
        <span>
          {ymd(start)}~{ymd(today)}
        </span>
        <label className="hh-toggle">
          잔액
          <input type="checkbox" checked={showBalance} onChange={(e) => setShowBalance(e.target.checked)} />
          <i />
        </label>
      </div>
      <div className="hh-list">
        {!txs.data ? (
          <div className="hh-list__spin">
            <HanaSpinner />
          </div>
        ) : !list.length ? (
          <p className="hh-empty">조회 기간 동안 거래내역이 없어요</p>
        ) : (
          [...groups].map(([day, items]) => (
            <section key={day} className="hh-group">
              <h3>{hanaDay(day)}</h3>
              {items.map((t) => (
                <button key={t.id} className="hh-item" onClick={() => navigate(`/tx/${t.id}`)}>
                  <span className="hh-item__time">{t.at.slice(11, 19)}</span>
                  <b className="hh-item__name">{t.merchant}</b>
                  <span className="hh-item__kind">{hanaTxKind(t)}</span>
                  <b className={`hh-item__amt ${t.amount < 0 ? "hh-item__amt--out" : ""}`}>
                    {t.amount < 0 ? "-" : "+"}
                    {nf.format(Math.abs(t.amount))}원
                  </b>
                  {showBalance && <span className="hh-item__bal">{nf.format(t.balanceAfter)}원</span>}
                </button>
              ))}
            </section>
          ))
        )}
      </div>
      <Dialog message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
