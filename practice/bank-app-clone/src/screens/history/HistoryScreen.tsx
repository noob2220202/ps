import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/mockApi";
import type { Transaction } from "../../api/types";
import { useAsync } from "../../hooks/useAsync";
import { useScrollTop } from "../../hooks/useScrollTop";
import { useStatusBar } from "../../hooks/useStatusBar";
import { FriendsAvatar } from "../../components/art";
import { Icon } from "../../components/icons/Icon";
import { BackButton } from "../../components/NavButtons";
import { TxList } from "../../components/TxList";
import "./History.css";

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="history__header">
      <BackButton onClick={onBack} />
      <span className="history__star">⭐</span>
    </header>
  );
}

function HistorySkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen history">
      <Header onBack={onBack} />
      <div className="skel" style={{ width: 52, height: 52, borderRadius: "50%", margin: "20px auto 0" }} />
      <div className="skel" style={{ width: 130, height: 24, margin: "16px auto 0" }} />
      <div className="skel" style={{ height: 60, margin: "30px 19px 0", borderRadius: 14 }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", margin: "34px 19px 0" }}>
          <div className="skel" style={{ width: 100, height: 14 }} />
          <div className="skel" style={{ width: 70, height: 14 }} />
        </div>
      ))}
    </div>
  );
}

export function HistoryScreen() {
  const { accountId = "main" } = useParams();
  const navigate = useNavigate();
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const scrollTop = useScrollTop(scrollEl);
  const [activeId, setActiveId] = useState<string | null>(null);
  useStatusBar("#fff", "dark");

  const state = useAsync(
    () => Promise.all([api.account(accountId), api.transactions(accountId)]),
    [accountId],
  );

  if (state.status === "loading") return <HistorySkeleton onBack={() => navigate(-1)} />;
  const [account, txs] = state.data;

  // 누른 행을 잠깐 회색으로 유지한 뒤 이동 (영상 27.25초)
  const open = (tx: Transaction) => {
    setActiveId(tx.id);
    setTimeout(() => navigate(`/account/${accountId}/tx/${tx.id}`, { state: { tx } }), 160);
  };

  return (
    <div className="screen history" ref={setScrollEl}>
      <Header onBack={() => navigate(-1)} />

      <div className="history__summary">
        <FriendsAvatar size={52} />
        <strong className="history__balance">
          {account ? account.balance.toLocaleString("ko-KR") : 0}
          <span>원</span>
        </strong>
      </div>

      <div className="search-box">
        <Icon name="search" size={21} stroke={2} />
        <button className="search-box__filter">
          3개월 · 전체 · 최신순 <Icon name="chevron-down" size={14} stroke={1.6} />
        </button>
      </div>

      <div className="history__list">
        <TxList items={txs} onSelect={open} activeId={activeId} />
      </div>

      <button
        className={`to-top ${scrollTop > 320 ? "to-top--visible" : ""}`}
        onClick={() => scrollEl?.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <Icon name="up" size={14} stroke={2} /> 맨 위로
      </button>
    </div>
  );
}
