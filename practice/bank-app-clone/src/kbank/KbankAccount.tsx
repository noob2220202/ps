import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { paths } from "../api/endpoints";
import type { Account, Transaction } from "../api/types";
import { prefetch, useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { KbankHeader } from "./header";
import { useKbankStatusBar } from "./theme";
import "./kbank-account.css";

// 계좌 화면 (녹화 20~21초 프레임 600~650, 44~58초 스크롤 1320~1770, 83~88초 2490~2660).
// 머리줄(‹ · 관리) 아래만 스크롤: 이름·번호·잔액 → 가져오기/이체하기 → 아이콘 4개 → 회색 띠 → 돋보기·'3개월·입출금·최신순'(머리줄 밑에 붙음) → 거래 행.
// 이름이 머리줄 밑으로 숨으면 머리줄 가운데에 이름이 나타남(녹화 45.72~45.94초, 220ms 페이드).
// 들어올 때 뼈대(회색 막대)를 먼저 보여 줌: 녹화 19.88→20.30초, 43.95→44.17초 (밀려 들어온 뒤 0.2~0.4초) → 화면이 생긴 뒤 500ms.
// 위치는 녹화 px ÷ 1.53646 (kbank-account.css 에 값마다 녹화 숫자)

const nf = new Intl.NumberFormat("ko-KR");
const SKELETON_MS = 500;
// 이름(잉크 아래 끝 스크롤 내용 y 50.9)이 머리줄 바닥(앱 48) 밑으로 들어가면 제목 표시
const TITLE_AT = 50;

// 뒤로 돌아왔을 때(거래 상세 닫기) 스크롤 위치 그대로 + 뼈대 없이 (녹화 65.6초 등). 화면 기록(location.key)마다 저장
const seen = new Map<string, number>();

// 뼈대 (녹화 44.05초 raw: 회색 #f1f1f1 막대, 머리줄 ‹·관리 없음). 값은 앱 dp (녹화 px ÷ 1.53646, y 는 − 33.2)
//   이름 x 30~248 · y 163~193px, 번호 y 218~239, 잔액 x 252~559 · y 302~337, 버튼 y 400~473, 네모 66~126(간격 132.3px) · y 517~578,
//   글자 47~145 · y 591~612, 선 y 649~652, 행 (간격 163px) 날짜 x 30~199 · y 702~722, 이름 30~248 / 금액 316~559 · y 736~766
function Skeleton() {
  return (
    <div className="kba-skel" aria-hidden>
      <i style={{ left: 19.5, top: 72.9, width: 142.5, height: 20.2 }} />
      <i style={{ left: 19.5, top: 108.7, width: 142.5, height: 14.3 }} />
      <i style={{ left: 164, top: 163.4, width: 200.5, height: 23.4 }} />
      <i className="kba-skel__btn" style={{ left: 19.5, top: 227.1, width: 168.3, height: 48.2 }} />
      <i className="kba-skel__btn" style={{ left: 195.9, top: 227.1, width: 168.3, height: 48.2 }} />
      {[0, 1, 2, 3].map((n) => (
        <span key={n}>
          <i className="kba-skel__tile" style={{ left: 43 + n * 86.1, top: 303.3 }} />
          <i style={{ left: 30.6 + n * 86.1, top: 351.5, width: 64.4, height: 14.3 }} />
        </span>
      ))}
      <b style={{ top: 389.2 }} />
      {[0, 1, 2].map((n) => (
        <span key={n}>
          <i style={{ left: 19.5, top: 423.7 + n * 106.1, width: 110.6, height: 13.7 }} />
          <i style={{ left: 19.5, top: 445.8 + n * 106.1, width: 142.5, height: 20.2 }} />
          <i style={{ left: 205.7, top: 445.8 + n * 106.1, width: 158.6, height: 20.2 }} />
        </span>
      ))}
    </div>
  );
}

// 번호 옆 복사 (잉크 x 219~241 · y 223~245px = 14.3dp 정사각, #6d737a). 뒤 네모 위에 흰 앞 네모
function CopyIcon({ color, size = 14.3 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
      <rect x="1" y="1" width="14.6" height="14.6" rx="3.4" fill="none" stroke={color} strokeWidth="2" />
      <rect x="6.4" y="6.4" width="14.6" height="14.6" rx="3.4" fill="#fff" stroke={color} strokeWidth="2" />
    </svg>
  );
}
export { CopyIcon as KbankCopyIcon };

const TILES = [
  { key: "plusbox", label: "플러스박스" },
  { key: "reward", label: "입출금리워드" },
  { key: "card", label: "체크카드" },
  { key: "charge", label: "자동충전" },
];

function TxRow({ tx, onOpen }: { tx: Transaction; onOpen: () => void }) {
  const inbound = tx.amount > 0;
  return (
    // 누르는 순간 상세를 미리 받아 둠 → 올라오는 동안 내용이 보임
    <button className="kba-row" onPointerDown={() => void prefetch(paths.transaction(tx.id))} onClick={onOpen}>
      <span className="kba-row__when">
        {tx.date}
        <i className="kba-row__bar" />
        <span className="kba-row__time">{tx.time}</span>
      </span>
      <span className="kba-row__name">{tx.merchant}</span>
      <span className={`kba-row__amt ${inbound ? "kba-row__amt--in" : ""}`}>
        {inbound ? "+" : "-"}
        {nf.format(Math.abs(tx.amount))}원
      </span>
      <span className="kba-row__bal">잔액 {nf.format(tx.balanceAfter)}원</span>
    </button>
  );
}

export function KbankAccount() {
  useKbankStatusBar();
  const { accountId = "main" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const acc = useApi<Account>(paths.account(accountId));
  const txs = useApi<Transaction[]>(paths.transactions(accountId));
  const back = seen.has(location.key);
  const [waited, setWaited] = useState(back);
  const [titled, setTitled] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const ready = waited && acc.status === "done" && txs.status === "done";

  useEffect(() => {
    if (waited) return;
    const id = setTimeout(() => setWaited(true), SKELETON_MS);
    return () => clearTimeout(id);
  }, [waited]);

  // 돌아왔으면 저장해 둔 스크롤 위치로 (그리기 전에)
  useLayoutEffect(() => {
    if (!ready || !scroller.current) return;
    const top = seen.get(location.key) ?? 0;
    scroller.current.scrollTop = top;
    setTitled(top > TITLE_AT);
    if (!seen.has(location.key)) seen.set(location.key, 0);
  }, [ready, location.key]);

  const onScroll = () => {
    const top = scroller.current?.scrollTop ?? 0;
    seen.set(location.key, top);
    setTitled(top > TITLE_AT);
  };

  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/", { replace: true }));
  const a = acc.data;

  return (
    <div className="kb kba">
      {!ready ? (
        <Skeleton />
      ) : (
        <>
          <div className="kba-scroll" ref={scroller} onScroll={onScroll}>
            <section className="kba-top">
              <h2 className="kba-name">{a?.label}</h2>
              <div className="kba-num">
                {a?.number}
                <button
                  className="kba-num__copy"
                  aria-label="계좌번호 복사"
                  onClick={() => void navigator.clipboard?.writeText(a?.number ?? "").catch(() => {})}
                >
                  <CopyIcon color="#6d737a" />
                </button>
              </div>
              <div className="kba-bal">{nf.format(a?.balance ?? 0)}원</div>
              <button className="kba-btn kba-btn--get">가져오기</button>
              <button className="kba-btn kba-btn--send" onClick={() => navigate(`/send?from=${encodeURIComponent(accountId)}`)}>
                이체하기
              </button>
              <div className="kba-tiles">
                {TILES.map((t) => {
                  const src = localAsset(`kbank-account-${t.key}`);
                  return (
                    <button key={t.key} className="kba-tile">
                      {src ? <img src={src} alt="" draggable={false} /> : <span className="kba-tile__ph" />}
                      <span className="kba-tile__label">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <div className="kba-band" />
            <div className="kba-filter">
              <button className="kba-filter__search" aria-label="거래내역 검색">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <circle cx="5.05" cy="5.05" r="4.25" fill="none" stroke="#5e5d63" strokeWidth="1.35" />
                  <path d="M8.2 8.2 11 11" stroke="#5e5d63" strokeWidth="1.35" strokeLinecap="round" />
                </svg>
              </button>
              <button className="kba-filter__opt">
                3개월<i>·</i>입출금<i>·</i>최신순
                <svg width="10.4" height="5.3" viewBox="0 0 10.4 5.3" aria-hidden>
                  <path d="M.6.6 5.2 4.7 9.8.6" fill="none" stroke="#767676" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="kba-list">
              {txs.data?.map((tx) => (
                <TxRow key={tx.id} tx={tx} onOpen={() => navigate(`/tx/${tx.id}`, { state: { tx } })} />
              ))}
            </div>
          </div>
        </>
      )}
      <KbankHeader
        className={`kba-header ${ready ? "" : "kba-header--hidden"} ${titled ? "kba-header--titled" : ""}`}
        title={a?.label ?? " "}
        onBack={goBack}
        right={<button>관리</button>}
      />
    </div>
  );
}
