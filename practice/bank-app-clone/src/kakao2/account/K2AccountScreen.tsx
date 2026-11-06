import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { paths } from "../../api/endpoints";
import type { Account, Transaction } from "../../api/types";
import { prefetch, useApi } from "../../api/useApi";
import { ErrorState } from "../../components/ErrorState";
import { useScrollFrame } from "../../hooks/useScrollTop";
import { useStatusBar } from "../../hooks/useStatusBar";
import { won } from "../../lib/format";
import { useLayerActive } from "../../platform/LayerContext";
import promoIcon from "../../assets/local/k2-account-promo.png";
import { K2BackChevron, K2ChevronDown, K2Spinner } from "../art";
import { cutK2Dim, isK2DimUp, K2_SPIN_ON_LIGHT, leaveK2Dim, showK2Dim } from "../dim";
import { K2_NAV } from "../nav";
import { K2AccountSkeleton } from "./K2AccountSkeleton";
import { K2AcctCopy, K2AcctGear, K2AcctMagnifier } from "./icons";
import { K2TxList } from "./K2TxList";
import "./K2Account.css";

// kakao2 통장 (녹화 28.4 – 41.4초 · 45 – 57초, account.md + critic.md 16 · X16 · G2 · X24 · C2). /account/:id 와 /account/:id/history 가 같은 화면.
// 홈 카드에서 push: 머리줄(상태바 띠 + < · 제목 · 톱니)은 첫 프레임부터 제자리, 그 아래 본문(.k2-push-body)만 오른쪽에서 밀려 들어옴 (nav.css).
// 본문 = 계좌번호 · 잔액 · 검색 상자 · 홍보 줄 · 거래 목록(20건씩) + 아래 고정 가져오기 / 이체하기. 거래를 누르면 로딩 막 + 거래상세 모달 (막은 상세가 걷음)
const K2_ACCOUNT = {
  skeletonMin: 1050, // 뼈대 최소: 녹화 첫 push 프레임 → 내용 첫 프레임 1085ms (28.438 → 29.523초) 에서 타이머 · 그리기 몫을 뺌. 받아 둔 게 있어도 들어올 때마다
  pageSize: 20, // 한 번에 보이는 거래 수 (맨 아래 스피너가 보이면 20건 더)
  moreDelay: 560, // 스피너가 보이고 다음 20건이 붙기까지 (36.36 → 36.945초, 54.10 → 54.643초)
  indicatorIdle: 1500, // 스크롤이 멈추고 스크롤 표시가 사라지기까지 (녹화에선 1.02초 멈춰도 그대로)
  transferLoad: 1650, // 이체하기: 홈 이체와 같은 로딩 막 (account.md 2.7 — 녹화에 없음)
  transferNav: 50, // 막이 흐려지기 시작하고 이체 모달이 올라오기 시작 (critic.md C6)
  transferCut: 67, // 막을 걷음
} as const;

// 스크롤 표시 (account.md 2.8): 폭 3, 오른쪽 3, 본문 위 3 ~ 아래 버튼 띠 위끝 (녹화 116 – 721)
const IND_TOP = 3;
const IND_MIN = 36;

export function K2AccountScreen() {
  const { accountId = "main" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const active = useLayerActive();
  useStatusBar("#fff", "dark");

  const account = useApi<Account>(paths.account(accountId));
  const txList = useApi<Transaction[]>(paths.transactions(accountId));
  // 제목은 데이터보다 먼저: 홈이 넘겨준 이름 (critic.md X24)
  const title = (location.state as { label?: string } | null)?.label ?? account.data?.label ?? "";

  // 뼈대 → 내용: 둘 다 받고 최소 시간이 지나면 170ms 교차 페이드 (뼈대는 흐려진 뒤 걷음), 아래 버튼은 그 프레임에 바로
  const [minDone, setMinDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), K2_ACCOUNT.skeletonMin);
    return () => clearTimeout(t);
  }, []);
  const ready = minDone && account.status === "done" && txList.status === "done";
  const [skelGone, setSkelGone] = useState(false);
  const onSkelGone = useCallback(() => setSkelGone(true), []);
  const failed = ready ? null : account.status === "error" ? account : txList.status === "error" ? txList : null;

  // 20건씩: 맨 아래 스피너 줄이 아래 버튼 띠 위로 보이면 560ms 뒤 다음 20건 (한 프레임에 붙고 스크롤 위치 그대로)
  const [pages, setPages] = useState(1);
  const txs = useMemo(() => txList.data ?? [], [txList.data]);
  const visible = useMemo(() => txs.slice(0, pages * K2_ACCOUNT.pageSize), [txs, pages]);
  const more = visible.length < txs.length;

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLElement>(null);
  const ind = useRef({ top: 0, timer: 0 });
  const [line, setLine] = useState(false);

  useEffect(() => {
    if (!footer || !scrollEl) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !timer) timer = window.setTimeout(() => setPages((p) => p + 1), K2_ACCOUNT.moreDelay);
      },
      { root: scrollEl, rootMargin: `0px 0px -${barRef.current?.offsetHeight ?? 0}px 0px` },
    );
    io.observe(footer);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [footer, scrollEl, pages]);

  // 스크롤 표시: 길이 = 칸 × 보이는 높이 / 전체 높이. 스크롤하면 나타나고 멈추고 1.5초 뒤 흐려짐. 매 프레임 DOM 직접 (리렌더 없음)
  const paintInd = useCallback((el: HTMLElement) => {
    const i = indRef.current;
    const max = el.scrollHeight - el.clientHeight;
    if (!i || max <= 0) return;
    const track = el.clientHeight - IND_TOP - (barRef.current?.offsetHeight ?? 0);
    const len = Math.max(IND_MIN, (track * el.clientHeight) / el.scrollHeight);
    const y = IND_TOP + ((track - len) * Math.min(1, Math.max(0, el.scrollTop / max)));
    i.style.height = `${len}px`;
    i.style.transform = `translate3d(0, ${y}px, 0)`;
  }, []);
  const hideInd = useCallback((now?: boolean) => {
    clearTimeout(ind.current.timer);
    const i = indRef.current;
    if (!i) return;
    i.style.transition = now ? "none" : "";
    i.classList.remove("k2acct__ind--on");
  }, []);
  useScrollFrame(scrollEl, (top) => {
    setLine(top > 0); // 머리줄 아래 선: 조금이라도 내리면 (녹화 30.223초 첫 스크롤 프레임)
    const s = ind.current;
    if (!scrollEl || top === s.top) return;
    s.top = top;
    paintInd(scrollEl);
    indRef.current?.classList.add("k2acct__ind--on");
    clearTimeout(s.timer);
    s.timer = window.setTimeout(() => hideInd(), K2_ACCOUNT.indicatorIdle);
  });
  // 거래가 붙어 전체 높이가 바뀌면 길이도 (보이고 있을 때만 의미 있음)
  useEffect(() => {
    if (scrollEl) paintInd(scrollEl);
  }, [scrollEl, visible, paintInd]);
  useEffect(() => {
    const s = ind.current;
    return () => clearTimeout(s.timer);
  }, []);

  // 모달(거래상세 · 이체)이 덮으면 스크롤 표시를 숨김: 막 밑에서는 그대로 보이다가 모달이 다 덮은 뒤 흐려짐 없이
  // (녹화 41.43초 막 밑에 보임, 돌아와도 스크롤할 때까지 안 보임 — 45.17 → 45.77초).
  // 덮였다 돌아왔는데 로딩 막이 남아 있으면(상세가 걷지 못하고 뒤로 등) 걷음
  const wasActive = useRef(active);
  const sending = useRef<number[] | null>(null);
  useEffect(() => {
    const s = ind.current;
    if (!active) {
      clearTimeout(s.timer);
      s.timer = window.setTimeout(() => hideInd(true), K2_NAV.modal);
    } else if (!wasActive.current && isK2DimUp() && !sending.current) cutK2Dim();
    wasActive.current = active;
  }, [active, hideInd]);

  // 거래 누름: 손 뗀 프레임에 로딩 막 + 스피너, 거래상세가 아래에서 올라옴 (상세가 데이터를 그리면 막을 걷음)
  const openTx = useCallback(
    (tx: Transaction) => {
      showK2Dim({ spinnerColor: K2_SPIN_ON_LIGHT });
      navigate(`/account/${accountId}/tx/${tx.id}`, { state: { tx } });
    },
    [navigate, accountId],
  );

  // 이체하기: 홈 이체와 같은 흐름 — 로딩 막(받는 분 목록 미리 받기) → 막이 흐려지기 시작 → 50ms 뒤 이체 모달 → 67ms 에 막 걷음
  const toTransfer = () => {
    if (sending.current) return;
    const timers: number[] = [];
    sending.current = timers;
    showK2Dim({ spinnerColor: K2_SPIN_ON_LIGHT });
    const start = performance.now();
    void prefetch(paths.recipients(accountId)).then(() => {
      if (sending.current !== timers) return;
      timers.push(
        window.setTimeout(
          () => {
            leaveK2Dim();
            timers.push(
              window.setTimeout(() => navigate(`/transfer?from=${encodeURIComponent(accountId)}`), K2_ACCOUNT.transferNav),
              window.setTimeout(() => {
                cutK2Dim();
                if (sending.current === timers) sending.current = null;
              }, K2_ACCOUNT.transferCut),
            );
          },
          Math.max(0, start + K2_ACCOUNT.transferLoad - performance.now()),
        ),
      );
    });
  };
  useEffect(
    () => () => {
      if (!sending.current) return;
      sending.current.forEach(clearTimeout);
      sending.current = null;
      cutK2Dim();
    },
    [],
  );

  const acc = account.data;
  return (
    <div className="k2acct">
      <header className={`k2acct__nav${line ? " k2acct__nav--line" : ""}`}>
        <div className="k2acct__navrow">
          <button className="k2acct__back" aria-label="뒤로" onClick={() => navigate(-1)}>
            <K2BackChevron />
          </button>
          <h1 className="k2acct__title">{title}</h1>
          <button className="k2acct__gear" aria-label="설정">
            <K2AcctGear />
          </button>
        </div>
      </header>

      <div className="k2acct__body k2-push-body">
        {failed ? (
          <ErrorState
            error={failed.error}
            onRetry={() => {
              account.retry();
              txList.retry();
            }}
          />
        ) : (
          !skelGone && <K2AccountSkeleton leaving={ready} onGone={onSkelGone} />
        )}

        {ready && acc && (
          <>
            <div className="k2acct__scroll" ref={setScrollEl}>
              <div className="k2acct__content">
                <div className="k2acct__head">
                  <div className="k2acct__num">
                    <span>{acc.number}</span>
                    <K2AcctCopy className="k2acct__copy" />
                  </div>
                  <strong className="k2acct__bal">{won(acc.balance)}</strong>

                  <div className="k2acct__search">
                    <K2AcctMagnifier className="k2acct__magn" />
                    <span className="k2acct__filter">
                      3개월 · 전체 · 최신순
                      <K2ChevronDown />
                    </span>
                  </div>

                  <div className="k2acct__promo">
                    <img src={promoIcon} alt="" />
                    <div className="k2acct__promo-text">
                      <small>The 체크카드 출시 이벤트</small>
                      <strong>100% 소비 지원금</strong>
                    </div>
                  </div>
                  <div className="k2acct__divider" />
                </div>

                <K2TxList items={visible} onSelect={openTx} />
                {more && (
                  <div className="k2list__more" ref={setFooter}>
                    <K2Spinner size="more" color="#dfdfdf" />
                  </div>
                )}
              </div>
            </div>
            <i className="k2acct__ind" ref={indRef} />

            <div className="k2acct__bar" ref={barRef}>
              <div className="k2acct__btns">
                <button className="k2acct__btn k2acct__btn--get pressable">가져오기</button>
                <button className="k2acct__btn k2acct__btn--send pressable" onClick={toTransfer}>
                  이체하기
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
