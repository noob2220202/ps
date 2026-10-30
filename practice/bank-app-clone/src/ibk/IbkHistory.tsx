import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useParams } from "react-router-dom";
import { api, paths } from "../api/endpoints";
import { http } from "../api/client";
import type { Account, Transaction, TransactionDetail } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog } from "../components/Sheet";
import { ibkNumber, nf } from "./bank";
import { IbkBankLogo, IbkHeader, IbkHeaderIcon, IbkIcon, IbkSheet } from "./common";
import { useIbkSpinner } from "./loading";
import { IBK_PAGE, useIbkBack, useIbkGo } from "./nav";
import { useIbkStatusBar } from "./theme";
import "./ibk-history.css";

// 거래내역조회 + 상세거래내역 시트 (녹화 50.07~70.37초, spec: scratchpad/ibk/specB/history.md).
// 머리줄 아래만 스크롤: 내 계좌 상자(로고·상품명·번호 ∨) → 채우기 / 이체 → 밑줄 링크 3개 → 회색 띠 → '1개월 · 전체 · 최신순 ∨'
// → 기간 띠 → 거래 행(일시 · 이름 · 금액(입금 파랑 / 출금 '-' 검정) · 거래 후 잔액, 피치 103). 행을 누르면 딤 → 시트가 아래에서.
// 위치는 녹화를 클론 좌표로 바꾼 값 (x = (녹화 x − 0.35) / 1.0242, 본문 y = 녹화 y − 81.4) — ibk-history.css 에 값마다 녹화 숫자

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
const won = (n: number) => `${nf.format(n)}원`;
const hangul = (s: string) => /[ㄱ-ㆎ가-힣]/.test(s);
const SOON = "연습용 앱에서는 준비 중인 메뉴예요.";
const MEMO_MAX = 25; // 녹화 '최대 25자까지 입력'

// IBK 원 로고 (spec 7): CI 심볼 벡터(viewBox 1561×1513)를 원(중심 780,750 · 반지름 564)으로 자른 것. 벡터가 없으면 공용 로고 원
function IbkCircleLogo({ size }: { size: number }) {
  const src = localAsset("ibk-ci-symbol");
  if (!src) return <IbkBankLogo bank={{ code: "ibk" }} size={size} className="ibt-acct__logo" />;
  const k = size / 1128;
  return (
    <span className="ibt-acct__logo" style={{ width: size, height: size }}>
      <img src={src} alt="기업" draggable={false} style={{ width: 1561 * k, height: 1513 * k, left: -216 * k, top: -186 * k }} />
    </span>
  );
}

// 거래 행. 누르는 동안 scale(.96) + 바탕 #f1f2f7 (spec 3-7). 끌어서 스크롤해도 누른 모습 그대로 따라가고, 손을 떼면 되돌아감.
// 짧게 누르고 떼면(클릭) 크기만 돌아가고 바탕은 딤이 덮을 때까지 그대로
function TxRow({ tx, onOpen, held }: { tx: Transaction; onOpen: (tx: Transaction) => void; held: boolean }) {
  const [pressed, setPressed] = useState(false);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const clear = useRef<(() => void) | null>(null);
  useEffect(() => () => clear.current?.(), []);
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    moved.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    setPressed(true);
    clear.current?.();
    // 스크롤로 포인터가 취소돼도(pointercancel) 손을 뗄 때까지 눌린 채로
    const up = () => {
      setPressed(false);
      clear.current?.();
    };
    const cancel = () => (moved.current = true);
    window.addEventListener("pointerup", up);
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    window.addEventListener("pointercancel", cancel);
    clear.current = () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
      window.removeEventListener("pointercancel", cancel);
      clear.current = null;
    };
  };
  const move = (e: PointerEvent) => {
    if (pressed && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) moved.current = true;
  };
  const out = tx.amount < 0;
  const name = tx.merchant;
  return (
    <button
      className={`ibt-tx ${pressed ? "is-down" : ""} ${held ? "is-held" : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onClick={() => !moved.current && onOpen(tx)}
    >
      <span className="ibt-tx__date">
        {tx.date} {tx.time}
      </span>
      <b className={`ibt-tx__name ${hangul(name) ? "" : "ibt-tx__name--latin"}`}>{name}</b>
      <b className={`ibt-tx__amt ${out ? "" : "ibt-tx__amt--in"}`}>{out ? `-${won(-tx.amount)}` : won(tx.amount)}</b>
      <span className="ibt-tx__bal">{won(tx.balanceAfter)}</span>
    </button>
  );
}

// 상세 표의 값: 숫자(일시·계좌번호·'-')는 Roboto 13.5px, 한글은 13px (spec 4-3)
function Cell({ label, value, top }: { label: string; value: string; top: number }) {
  const num = /^[\d\s.:-]+$/.test(value);
  return (
    <div className="ibt-cell" style={{ top }}>
      <span className="ibt-cell__label">{label}</span>
      <b className={`ibt-cell__value ${num ? "ibt-cell__value--num" : ""}`}>{value}</b>
    </div>
  );
}

// 줄 기준(위 구분선 가운데) — 카드 위끝 기준. 첫 줄은 카드 위 테두리 가운데 (녹화 390.2 / 439.25 / 488.75 / 538.05 / 587.45 / 636.5 / 686.05 − 389.7)
const ROW_TOPS = [0.5, 49.55, 99.05, 148.35, 197.75, 246.8, 296.35];

function TxSheetBody({
  tx,
  detail,
  onClose,
  onResend,
  onNotice,
}: {
  tx: Transaction;
  detail: TransactionDetail | null;
  onClose: () => void;
  onResend: (d: TransactionDetail) => void;
  onNotice: (m: string) => void;
}) {
  const out = tx.amount < 0;
  // 다시이체: 내가 보낸 이체만 (녹화 출금 건에만 버튼, 입금 건엔 없음 → 시트가 7.65 낮음)
  const resend = out && !!tx.toBank;
  const transferIn = !out && tx.tag === "#이체";
  const kind = tx.tag === "#이체" ? (out ? "스마트뱅킹" : "타행이체") : (detail?.kind ?? "");
  const t = detail?.transfer;
  const rows: [string, string][] = [
    ["거래일시", detail?.transactedAt ?? `${tx.at.slice(0, 10).replaceAll("-", ".")} ${tx.at.slice(11, 19)}`],
    ["거래구분", kind],
    ["거래내용", out ? "출금" : "입금"],
    ["상대은행", t?.bank.short ?? "-"],
    ["상대계좌", t?.number ?? "-"],
    ["상대계좌 예금주명", t?.holder ?? (transferIn || out ? tx.merchant : "-")],
  ];
  const [memo, setMemo] = useState(detail?.memo ?? "");
  const [saved, setSaved] = useState(detail?.memo ?? "");
  const [busy, setBusy] = useState(false);
  const [prevMemo, setPrevMemo] = useState(detail?.memo);
  if (detail?.memo !== prevMemo) {
    setPrevMemo(detail?.memo);
    setMemo(detail?.memo ?? "");
    setSaved(detail?.memo ?? "");
  }
  const input = useRef<HTMLInputElement>(null);
  const save = async () => {
    if (busy) return;
    const v = memo.trim();
    if (v === saved) {
      input.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const r = await api.updateMemo(tx.id, v);
      setSaved(r.memo);
      setMemo(r.memo);
      input.current?.blur();
      onNotice(r.memo ? "메모를 등록했어요." : "메모를 지웠어요.");
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "메모를 등록하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`ibt-sheet ${resend ? "" : "ibt-sheet--plain"}`}>
      <h2 className="ibt-sheet__title">상세거래내역</h2>
      <button className="ibt-sheet__close" onClick={onClose} aria-label="닫기">
        <IbkIcon name="close" w={15.77} h={15.7} />
      </button>
      <p className="ibt-sheet__name">{tx.merchant}</p>
      <b className={`ibt-sheet__amt ${out ? "" : "ibt-sheet__amt--in"}`}>{out ? `-${won(-tx.amount)}` : won(tx.amount)}</b>
      {resend && (
        <button className="ibt-sheet__resend" disabled={!t} onClick={() => t && detail && onResend(detail)}>
          <span>다시이체</span>
        </button>
      )}
      <div className="ibt-card">
        {rows.map(([label, value], i) => (
          <Cell key={label} label={label} value={value} top={ROW_TOPS[i]} />
        ))}
        <div className="ibt-cell ibt-cell--memo" style={{ top: ROW_TOPS[6] }}>
          <span className="ibt-cell__label">메모</span>
          <input
            ref={input}
            className="ibt-cell__memo"
            value={memo}
            maxLength={MEMO_MAX}
            placeholder={`최대 ${MEMO_MAX}자까지 입력`}
            aria-label="메모"
            onChange={(e) => setMemo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <button className="ibt-cell__save" disabled={busy} onClick={save}>
            <span>등록</span>
          </button>
        </div>
        {ROW_TOPS.slice(1).map((y) => (
          <i key={y} className="ibt-card__line" style={{ top: y - 0.5 }} />
        ))}
      </div>
    </div>
  );
}

export function IbkHistory() {
  useIbkStatusBar();
  const go = useIbkGo();
  const back = useIbkBack("/");
  const { accountId = "main" } = useParams();
  const account = useApi<Account>(paths.account(accountId));
  const txs = useApi<Transaction[]>(paths.transactions(accountId));
  const loading = account.status === "loading" || txs.status === "loading";
  useIbkSpinner(loading);
  const failed = !loading && (account.status === "error" || txs.status === "error");
  const [notice, setNotice] = useState<string | null>(null);
  const soon = () => setNotice(SOON);

  // 1개월: 오늘부터 한 달 전 다음 날까지 (녹화: 10.30 → 2026.10.01 ~ 2026.10.30). 지난달에 그날이 없으면 지난달 말일 기준
  const [today] = useState(() => new Date());
  const lastOfPrev = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const from = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), lastOfPrev) + 1);
  const fromIso = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
  const list = (txs.data ?? []).filter((t) => t.at.slice(0, 10) >= fromIso); // 서버가 최신순으로 줌

  // 상세 시트: 행을 떼고 ≈130ms 뒤 딤(녹화 53.83 → 53.97), 딤 뒤 ≈200ms 기다렸다 시트 (상세 조회 시간 — 녹화 333/133ms)
  const [sel, setSel] = useState<Transaction | null>(null);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState<string | null>(null); // 시트가 덮을 때까지 눌린 바탕을 남겨 둘 행
  const timer = useRef(0);
  const want = useRef<string | null>(null); // 지금 연 거래 (늦게 온 다른 거래 상세는 버림)
  useEffect(() => () => clearTimeout(timer.current), []);
  const openTx = (tx: Transaction) => {
    if (open || held) return;
    setHeld(tx.id);
    setSel(tx);
    setDetail(null);
    want.current = tx.id;
    http
      .get<TransactionDetail>(paths.transaction(tx.id))
      .then((d) => want.current === d.id && setDetail(d))
      .catch(() => {});
    timer.current = window.setTimeout(() => {
      setOpen(true);
      setHeld(null);
    }, 130);
  };
  const close = () => setOpen(false);
  const resend = (d: TransactionDetail) => {
    if (!d.transfer) return;
    // 시트의 뒤로가기 칸을 이체 화면으로 바꿔 넣음 → 이체에서 뒤로 오면 시트는 닫힘
    go(`/send?bank=${d.transfer.bank.code}&number=${d.transfer.number}`, { ...IBK_PAGE, replace: true });
  };

  return (
    <div className="ibk ibk-page ibt">
      <IbkHeader title="거래내역조회" onBack={back} right={<IbkHeaderIcon name="menu" label="전체메뉴" onClick={() => go("/menu", { anim: "menu-in" })} />} />
      <div className="ibk-body">
        {failed ? (
          <div className="ibt-fail">
            <p>거래내역을 불러오지 못했어요.</p>
            <button
              onClick={() => {
                account.retry();
                txs.retry();
              }}
            >
              다시 시도
            </button>
          </div>
        ) : account.data && txs.data ? (
          <>
            <section className="ibt-top">
              <h2 className="ibt-top__title">내 계좌</h2>
              <button className="ibt-acct" onClick={soon} aria-label="계좌 선택">
                <IbkCircleLogo size={22.6} />
                <span className="ibt-acct__name">{account.data.label}</span>
                <b className="ibt-acct__no">{ibkNumber(account.data.bank, account.data.number ?? "")}</b>
                <IbkIcon name="chevron-down" w={12.5} h={6.25} sw={1.35} color="#222" className="ibt-acct__chev" />
              </button>
              <button className="ibt-btn ibt-btn--fill" onClick={soon}>
                <span>채우기</span>
              </button>
              <button className="ibt-btn ibt-btn--send" onClick={() => go(`/send?from=${accountId}`, IBK_PAGE)}>
                <span>이체</span>
              </button>
              <nav className="ibt-links">
                <button className="ibt-link ibt-link--1" onClick={soon}>
                  간편이체내역
                </button>
                <i className="ibt-links__bar ibt-links__bar--1" />
                <button className="ibt-link ibt-link--2" onClick={soon}>
                  예약이체내역
                </button>
                <i className="ibt-links__bar ibt-links__bar--2" />
                <button className="ibt-link ibt-link--3" onClick={soon}>
                  ATM출금내역
                </button>
              </nav>
              <div className="ibt-band" />
              <button className="ibt-filter" onClick={soon}>
                <span>1개월 · 전체 · 최신순</span>
                <IbkIcon name="chevron-down" w={10.5} h={5.35} sw={1.1} color="#8f9093" className="ibt-filter__chev" />
              </button>
              <div className="ibt-period">
                <span>
                  {ymd(from)} ~ {ymd(today)}
                </span>
              </div>
            </section>
            <div className="ibt-list">
              {list.length ? (
                list.map((t) => <TxRow key={t.id} tx={t} onOpen={openTx} held={held === t.id} />)
              ) : (
                <p className="ibt-empty">조회기간 내 거래내역이 없습니다.</p>
              )}
            </div>
          </>
        ) : null}
      </div>
      <IbkSheet open={open} onClose={close} wait={200}>
        {sel && (
          <TxSheetBody key={sel.id} tx={sel} detail={detail} onClose={close} onResend={resend} onNotice={setNotice} />
        )}
      </IbkSheet>
      <Dialog message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
