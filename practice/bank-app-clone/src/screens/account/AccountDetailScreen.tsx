import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/mockApi";
import { useAsync } from "../../hooks/useAsync";
import { useScrollTop } from "../../hooks/useScrollTop";
import { useStatusBar } from "../../hooks/useStatusBar";
import { useTypewriter } from "../../hooks/useTypewriter";
import { won } from "../../lib/format";
import { AiDiamond, FriendsIllustration } from "../../components/art";
import { Icon } from "../../components/icons/Icon";
import { BackButton, GearButton } from "../../components/NavButtons";
import { TxList } from "../../components/TxList";
import "./AccountDetail.css";

function DetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen detail detail--skeleton">
      <header className="detail__header">
        <BackButton onClick={onBack} />
      </header>
      <div className="skel" style={{ height: 150, margin: "84px 17px 0", borderRadius: 20 }} />
      <div style={{ display: "flex", justifyContent: "space-between", margin: "28px 20px 12px" }}>
        <div className="skel" style={{ width: 60, height: 18 }} />
        <div className="skel" style={{ width: 48, height: 14 }} />
      </div>
      <div className="skel" style={{ height: 260, margin: "0 17px", borderRadius: 20 }} />
    </div>
  );
}

export function AccountDetailScreen() {
  const { accountId = "main" } = useParams();
  const navigate = useNavigate();
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const scrollTop = useScrollTop(scrollEl);

  const state = useAsync(
    () => Promise.all([api.account(accountId), api.transactions(accountId)]),
    [accountId],
  );
  const loaded = state.status === "done";
  useStatusBar(loaded && scrollTop < 40 ? "#f1e9fd" : "var(--light-bg)", "dark");
  const { typed } = useTypewriter("지난 달보다 얼마나 더 썼을까요?", loaded);

  if (!loaded) return <DetailSkeleton onBack={() => navigate(-1)} />;
  const [account, txs] = state.data;
  if (!account) return <div className="screen detail">계좌를 찾을 수 없습니다.</div>;

  // 스크롤할수록 일러스트는 흐려지고 살짝 느리게 올라감(패럴랙스), 헤더엔 배경이 깔림
  const heroFade = Math.max(0, 1 - scrollTop / 160);

  return (
    <div className="screen detail" ref={setScrollEl}>
      <div className="detail__gradient" />
      <header className={`detail__header ${scrollTop > 40 ? "detail__header--solid" : ""}`}>
        <BackButton onClick={() => navigate(-1)} />
        <GearButton />
      </header>

      <div
        className="detail__hero"
        style={{ opacity: heroFade, transform: `translateY(${scrollTop * 0.35}px)` }}
      >
        <FriendsIllustration width={212} />
        <div className="detail__pill">
          <AiDiamond size={17} />
          <span>{typed}</span>
        </div>
      </div>

      <section className="balance-card">
        <div className="balance-card__top">
          <span className="balance-card__hand">👋</span>
          <div>
            <div className="balance-card__meta">
              <span className="star">★</span>
              <span className="outline-badge outline-badge--light">계좌번호</span>
            </div>
            <strong className="balance-card__amount">{won(account.balance)}</strong>
          </div>
        </div>
        <div className="balance-card__actions">
          <button className="light-btn pressable">이체하기</button>
          <button className="light-btn pressable">채우기</button>
        </div>
      </section>

      <div className="section-head">
        <h2>최근 내역</h2>
        <button onClick={() => navigate(`/account/${accountId}/history`)}>전체보기</button>
      </div>
      <TxList
        variant="card"
        items={txs.slice(0, 3)}
        onSelect={(tx) => navigate(`/account/${accountId}/tx/${tx.id}`, { state: { tx } })}
      />

      <div className="section-head">
        <h2>모임 관리</h2>
      </div>
      <section className="moim-card">
        <button className="moim-card__row row-press">
          <span className="moim-card__emoji">😀</span>
          <span className="moim-card__label">모임 멤버</span>
          <span className="moim-card__value">2명 참여 중</span>
        </button>
        <button className="moim-card__row row-press">
          <span className="moim-card__emoji">💵</span>
          <span className="moim-card__label">회비 입금현황</span>
          <Icon name="chevron-right" size={16} className="moim-card__chev" />
        </button>
      </section>
    </div>
  );
}
