import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { HomeData, Transaction } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { hanaDay, hanaTxKind, nf } from "./bank";
import { HanaHeader, HanaRetry, HanaSpinner, Ic } from "./common";
import { useHanaGo } from "./loading";
import { useSafeBack } from "./nav";
import { useHanaStatusBar } from "./theme";
import "./hana-history.css";

// 거래내역조회 (라이트 스크린샷 95fd8510 + 녹화 48~60초, 다크 녹화 7초짜리 H/ · D/0171~0190).
// 회색 바탕 위 흰 계좌 카드(통장 이름 · 번호 ⌄ · 잔액 · 출금가능금액 · 가져오기/보내기) → 🔍 1개월|전체|최신순 → 기간 + 잔액 토글 →
// 흰 목록: 날짜 머리 "2026.10.30 (금)" 아래 거래 (시각 · 이름 / 거래구분 · 금액 · 거래후잔액)
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

export function HanaHistory() {
  const navigate = useNavigate();
  const go = useHanaGo();
  const back = useSafeBack("/");
  const { accountId = "main" } = useParams();
  const home = useApi<HomeData>(paths.home);
  const txs = useApi<Transaction[]>(paths.transactions(accountId));
  const [showBalance, setShowBalance] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  useHanaStatusBar({ light: "#f1f2f4", dark: "#202125" });
  const account = home.data?.accounts.find((a) => a.id === accountId);
  const failed = home.status === "error" || txs.status === "error";
  const retry = () => {
    home.retry();
    txs.retry();
  };

  // 1개월: 오늘부터 한 달 전 다음 날까지 (녹화 10.30 → 2026.10.01~2026.10.30). 지난달에 그날이 없으면 지난달 말일 기준 (3.31 → 3.01)
  const [today] = useState(() => new Date());
  const lastOfPrev = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), lastOfPrev) + 1);
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
      <HanaHeader title="거래내역조회" onBack={back} />
      <section className="hh-card">
        {account ? (
          <>
            <div className="hh-card__name">
              {localAsset("hana-symbol") && <img src={localAsset("hana-symbol")} alt="" draggable={false} />}
              {account.label}
              <button onClick={soon} aria-label="더보기">
                <Ic name="more" w={5.9} h={17.6} />
              </button>
            </div>
            <p className="hh-card__no">
              {account.number} <Ic name="chevron-down" w={16.8} h={10.4} className="hh-card__chev" />
            </p>
            {/* 잔액 숫자 22.5px, '원'은 작은 글자 (95fd8510 '원' 높이 = 숫자 높이) */}
            <p className="hh-card__bal">
              {nf.format(account.balance)}
              <span className="hh-card__won">원</span>
            </p>
            <p className="hh-card__avail">출금가능금액 {nf.format(account.balance)}원</p>
            <div className="hh-card__btns">
              <button className="hana-btn hana-btn--mint" onClick={soon}>
                가져오기
              </button>
              <button className="hana-btn" onClick={() => go(`/send?from=${account.id}`)}>
                보내기
              </button>
            </div>
          </>
        ) : failed ? (
          <HanaRetry onRetry={retry} />
        ) : (
          <div className="hh-card__spin">
            <HanaSpinner />
          </div>
        )}
      </section>
      <div className="hh-filter">
        <span className="hh-filter__search">
          <Ic name="search" w={19.7} h={19.7} />
        </span>
        <span className="hh-filter__opts">
          1개월<i />전체<i />최신순
          <Ic name="sort" w={13.3} h={16} className="hh-filter__sort" />
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
        {failed && !txs.data ? (
          <HanaRetry onRetry={retry} />
        ) : !txs.data ? (
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
