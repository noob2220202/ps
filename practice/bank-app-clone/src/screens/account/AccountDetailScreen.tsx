import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/mockApi";
import { useAsync } from "../../hooks/useAsync";
import { useScrollFrame } from "../../hooks/useScrollTop";
import { useStatusBar } from "../../hooks/useStatusBar";
import { useTypewriter } from "../../hooks/useTypewriter";
import { won } from "../../lib/format";
import { Asset } from "../../assets/Asset";
import { Icon } from "../../components/icons/Icon";
import { BackButton, GearButton } from "../../components/NavButtons";
import { TxList } from "../../components/TxList";
import "./AccountDetail.css";

// 타이핑은 글자마다 state가 바뀐다. 화면 컴포넌트에서 바로 쓰면 한 글자마다 화면 "전체"가
// 다시 렌더링되므로, 작은 컴포넌트로 분리해서 이 <span>만 다시 그리게 한다.
function TypedText({ text }: { text: string }) {
  const { typed } = useTypewriter(text);
  return <span>{typed}</span>;
}

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
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  // 패럴랙스는 매 프레임 바뀌므로 React를 거치지 않고 DOM 스타일을 직접 바꾼다.
  // transform/opacity만 건드려서 레이아웃 계산 없이 GPU 합성만으로 처리됨.
  useScrollFrame(scrollEl, (top) => {
    const hero = heroRef.current;
    if (hero) {
      hero.style.opacity = String(Math.max(0, 1 - top / 160));
      hero.style.transform = `translate3d(0, ${top * 0.35}px, 0)`;
    }
    setScrolled(top > 40); // on/off가 바뀔 때만 리렌더
  });

  const state = useAsync(
    () => Promise.all([api.account(accountId), api.transactions(accountId)]),
    [accountId],
  );
  const loaded = state.status === "done";
  useStatusBar(loaded && !scrolled ? "#f1e9fd" : "var(--light-bg)", "dark");

  if (!loaded) return <DetailSkeleton onBack={() => navigate(-1)} />;
  const [account, txs] = state.data;
  if (!account) return <div className="screen detail">계좌를 찾을 수 없습니다.</div>;


  return (
    <div className="screen detail" ref={setScrollEl}>
      <div className="detail__gradient" />
      <header className={`detail__header ${scrolled ? "detail__header--solid" : ""}`}>
        <BackButton onClick={() => navigate(-1)} />
        <GearButton />
      </header>

      <div
        className="detail__hero" ref={heroRef}
      >
        <Asset slot="friends" className="detail__friends" />
        <div className="detail__pill">
          <Asset slot="ai-diamond" />
          <TypedText text="지난 달보다 얼마나 더 썼을까요?" />
        </div>
      </div>

      <section className="balance-card">
        <div className="balance-card__top">
          <Asset slot="hand-tile" />
          <div>
            <div className="balance-card__meta">
              <Asset slot="star" />
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
          <Asset slot="moim-member" />
          <span className="moim-card__label">모임 멤버</span>
          <span className="moim-card__value">2명 참여 중</span>
        </button>
        <button className="moim-card__row row-press">
          <Asset slot="moim-dues" />
          <span className="moim-card__label">회비 입금현황</span>
          <Icon name="chevron-right" size={16} className="moim-card__chev" />
        </button>
      </section>
    </div>
  );
}
