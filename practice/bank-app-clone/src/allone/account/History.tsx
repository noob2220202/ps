// /history/:accountId — 거래내역조회 (account.md §2.1 · §3, 녹화 C2 9.991–14.258 · 15.808–20.074, 기준 프레임 C2 11.341 · 12.5).
// 위 고정: 머리줄(‹ 거래내역조회 집 ≡🔍, 59–109) + 계좌 블록(109–203, 누르면 계좌 선택 시트). 그 밑으로 스크롤:
//  잔액 줄 → 계좌관리(눌러도 아무 일 없음) · 이체(누르면 #EAFEEE, sendFromList 로딩 → 누구에게 보낼까요) → 조회 조건 줄 → 기간 줄 + 잔액 숨기기
//  → 457 의 줄부터 거래 행 (120 + 줄 1, 잔액 숨기기면 95). 행을 누르면 거래내역 상세 (입금 txIn 184ms · 출금 txOut 1100ms, 더 어두워지는 막)
// 상세에서 돌아오면 이 층은 밑에 숨어 있던 그대로 (스크롤 · 불러온 줄 수 유지). 새 거래가 생기면(이체 완료 뒤) 맨 위로.
// 녹화의 첫 프레임 32pt 빈칸(웹뷰 그리기 흔적)은 따라 하지 않음 (plan Q18)
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type UIEvent } from "react";
import { useParams } from "react-router-dom";
import { getVersion, subscribeVersion } from "../../api/client";
import { prefetch, useApi } from "../../api/useApi";
import { useLayerActive } from "../../platform/LayerContext";
import { aoPaths, type AoAccount, type AoTransaction } from "../api";
import { aoBankName } from "../bank";
import { aoVisit, useAoFlow } from "../flow";
import { aoAccountNumber, aoTime, aoTxLabel, aoWon } from "../format";
import { aoLoad } from "../loading";
import { aoLock, LOAD, useAoBack } from "../nav";
import { aoPrefs, useAoPrefs } from "../prefs";
import { AoBankLogo, AoButton, AoChevronDownIcon, AoHeader, AoPage, AoSpinner, AoSwitch } from "../ui";
import { ACCT_FILTER_DEFAULT, ACCT_MORE_MS, ACCT_PAGE, acctDate, acctRows, acctSummary, type AcctFilter } from "./list";
import { AcctAccountSheet, AcctFilterSheet } from "./Sheets";
import "./account.css";

// NH 40 타일 x 24–64, y 136–176 (AoBankLogo 는 자리를 style 로 받음)
const LOGO_AT = { position: "absolute", left: 24, top: 27 } as const;

// 계좌 블록 (위 고정): NH 40 타일 · 상품명 15.5/500 · "NH농협은행  302-…" 13/400 #666 · ▾
function AccountBlock({ account, onOpen }: { account?: AoAccount; onOpen: () => void }) {
  return (
    <button type="button" className="ao-acct-block" onClick={() => account && onOpen()} aria-label="계좌 선택">
      {account && (
        <>
          <AoBankLogo code={account.bank.code} size={40} style={LOGO_AT} />
          <span className="ao-acct-block__name">{account.label}</span>
          <span className="ao-acct-block__sub">
            <span>{aoBankName(account.bank)}</span>
            <span className="ao-acct-block__num">{aoAccountNumber(account)}</span>
          </span>
          <AoChevronDownIcon className="ao-acct-block__chev" />
        </>
      )}
    </button>
  );
}

// 거래 한 줄: 왼쪽 날짜 · 시각 (| 올원이체) / 이름, 오른쪽 출금·입금 / 금액 / 잔액 N원
function TxRow({ tx, hideBalance, onOpen }: { tx: AoTransaction; hideBalance: boolean; onOpen: (tx: AoTransaction) => void }) {
  const out = tx.amount < 0;
  const label = aoTxLabel(tx);
  return (
    <button type="button" className={`ao-acct-row${hideBalance ? " ao-acct-row--short" : ""}`} onClick={() => onOpen(tx)}>
      <span className="ao-acct-row__when">
        <span className="ao-acct-dt">{acctDate(tx.at)}</span>
        <span className="ao-acct-dt ao-acct-row__time">{aoTime(tx.at)}</span>
        {label && (
          <>
            <i className="ao-acct-row__bar" />
            <span className="ao-acct-row__label">{label}</span>
          </>
        )}
      </span>
      <span className="ao-acct-row__name">{tx.merchant}</span>
      <span className={`ao-acct-row__kind ao-acct-row__kind--${out ? "out" : "in"}`}>{out ? "출금" : "입금"}</span>
      <span className={`ao-acct-row__amt ao-acct-row__amt--${out ? "out" : "in"}`}>{aoWon(Math.abs(tx.amount))}</span>
      {!hideBalance && <span className="ao-acct-row__bal">잔액 {aoWon(tx.balanceAfter)}</span>}
    </button>
  );
}

export function History() {
  const { accountId = "main" } = useParams();
  const flow = useAoFlow();
  const back = useAoBack();
  const account = useApi<AoAccount>(aoPaths.account(accountId));
  const txs = useApi<AoTransaction[]>(aoPaths.transactions(accountId));
  const hideBalance = useAoPrefs(aoPrefs.hideTxBalance);
  const [filter, setFilter] = useState<AcctFilter>(ACCT_FILTER_DEFAULT);
  const [count, setCount] = useState(ACCT_PAGE);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState<"account" | "filter" | null>(null);
  const [sheetExit, setSheetExit] = useState<"slide" | "cut">("slide");
  const bodyRef = useRef<HTMLDivElement>(null);
  const moreTimer = useRef(0);

  useEffect(() => aoVisit("history"), []);
  useEffect(() => () => window.clearTimeout(moreTimer.current), []);

  const data = txs.data;
  // 날짜가 바뀌어도 맞게 (오늘 기준 기간) — 거래 목록 · 조건이 바뀔 때만 다시 거름
  const { rows, range } = useMemo(() => acctRows(data ?? [], filter), [data, filter]);
  const shown = useMemo(() => rows.slice(0, count), [rows, count]);

  // 새 거래가 생기면 (이체 완료 뒤 돌아옴 · 🔔 패널) 맨 위로, 20개부터
  const newest = data?.[0]?.id;
  const seen = useRef(newest);
  useEffect(() => {
    if (newest === undefined || seen.current === newest) return;
    const first = seen.current === undefined;
    seen.current = newest;
    if (first) return;
    setCount(ACCT_PAGE);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [newest]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (more || count >= rows.length) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 200) return;
    setMore(true);
    moreTimer.current = window.setTimeout(() => {
      setCount((c) => c + ACCT_PAGE);
      setMore(false);
    }, ACCT_MORE_MS);
  };

  const closeSheet = () => {
    setSheetExit("slide");
    setSheet(null);
  };

  // 조회 조건 (nav.ts LOAD.acctFilter, invented 600ms): 시트는 막 밑에 그대로 두었다가 cut(567) 에 한 프레임에 사라지고 줄 · 기간 · 요약이 바뀜,
  // 맨 위부터. 스피너 567 · 막 600 에 걷힘. 막 동안 뒤로 가면(cut 전) 막만 걷히고 조건은 그대로
  const applyFilter = (f: AcctFilter) => {
    if (!aoLock(LOAD.acctFilter.off + 100)) return;
    void aoLoad("acctFilter", {
      onCut: () => {
        setSheetExit("cut");
        setSheet(null);
        setFilter(f);
        setCount(ACCT_PAGE);
        window.clearTimeout(moreTimer.current);
        setMore(false);
        bodyRef.current?.scrollTo({ top: 0 });
      },
    });
  };

  // 계좌 선택: 같은 계좌면 닫기만. 다른 계좌면 거래내역조회 로딩(history) 밑에서 이 칸을 그 계좌로 바꿈 (조건 · 스크롤은 처음부터)
  const pickAccount = (a: AoAccount) => {
    if (a.id === accountId) return closeSheet();
    void flow.go(`/history/${encodeURIComponent(a.id)}`, {
      via: "history",
      replace: true,
      prefetch: [aoPaths.account(a.id), aoPaths.transactions(a.id)],
    });
  };

  // 보이는 입금 줄의 상세를 미리 받아 둠: 입금 상세는 녹화에서 184ms 만에 열려서 (서버 지연 250ms 보다 짧음),
  // 받아 둔 상세는 받기를 기다리지 않고 표 시각 그대로 연다. 데이터가 바뀌면(메모 · ☆ · 이체) 받아 둔 것은 버리고 다시 받음.
  // 출금 상세는 막(1100ms) 동안 받으면 되므로 늘 goTx
  const active = useLayerActive();
  const version = useSyncExternalStore(subscribeVersion, getVersion);
  const ready = useRef(new Map<string, number>()); // 거래 id → 받아 둔 때의 데이터 버전
  const asked = useRef(new Map<string, number>());
  useEffect(() => {
    if (!active) return;
    for (const tx of shown) {
      if (tx.amount < 0 || asked.current.get(tx.id) === version) continue;
      asked.current.set(tx.id, version);
      void prefetch(aoPaths.transaction(tx.id)).then((r) => r && ready.current.set(tx.id, version));
    }
  }, [shown, active, version]);

  const openTx = (tx: AoTransaction) => {
    if (tx.amount > 0 && ready.current.get(tx.id) === getVersion()) void flow.go(`/tx/${encodeURIComponent(tx.id)}`, { via: "txIn" });
    else void flow.goTx(tx.id, tx.amount < 0 ? "out" : "in");
  };

  const a = account.data;
  const failed = !data && txs.status === "error";

  return (
    <AoPage
      className="ao-acct-hist"
      bodyRef={bodyRef}
      onScroll={onScroll}
      header={
        <>
          <AoHeader variant="nav" title="거래내역조회" onBack={back} onHome={() => void flow.goHome()} onMenu={() => void flow.goMenu()} />
          <AccountBlock account={a} onOpen={() => setSheet("account")} />
        </>
      }
    >
      <div className="ao-acct-top">
        <div className="ao-acct-bal">
          <span className="ao-acct-bal__label">잔액</span>
          {a && <span className="ao-acct-bal__amt">{aoWon(a.balance)}</span>}
        </div>
        <div className="ao-acct-btns">
          {/* 계좌관리: 녹화에 누름 모양이 없음 → 누름 없이 아무 일 없음 (plan §1.7) */}
          <AoButton variant="outline" active={false} radius={10} height={42.67} size={16} weight={500}>
            계좌관리
          </AoButton>
          <AoButton variant="outlineGreen" radius={10} height={42.67} size={16} weight={500} onPress={() => a && void flow.goSend({ from: a.id, origin: "history" })}>
            이체
          </AoButton>
        </div>
        <button type="button" className="ao-acct-filter-row" onClick={() => setSheet("filter")}>
          <span>{acctSummary(filter)}</span>
          <AoChevronDownIcon size="sm" w={10} h={6} className="ao-acct-filter-row__chev" />
        </button>
        <div className="ao-acct-range">
          <span className="ao-acct-range__dates ao-acct-dt">{range.label}</span>
          <span className="ao-acct-range__hide">잔액 숨기기</span>
          <AoSwitch className="ao-acct-range__switch" checked={hideBalance} onChange={aoPrefs.setHideTxBalance} aria-label="잔액 숨기기" />
        </div>
      </div>
      <div className="ao-acct-list">
        {failed ? (
          <div className="ao-acct-error">
            <p>일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.</p>
            <AoButton variant="outline" width={120} height={40} radius={10} size={15} weight={500} onPress={txs.retry}>
              다시 시도
            </AoButton>
          </div>
        ) : data && rows.length === 0 ? (
          <p className="ao-acct-empty">조회 기간 내 거래내역이 없어요</p>
        ) : (
          shown.map((tx) => <TxRow key={tx.id} tx={tx} hideBalance={hideBalance} onOpen={openTx} />)
        )}
        {more && (
          <div className="ao-acct-more">
            <AoSpinner size={28} />
          </div>
        )}
      </div>

      <AcctAccountSheet open={sheet === "account"} exit={sheetExit} current={accountId} onClose={closeSheet} onPick={pickAccount} />
      <AcctFilterSheet open={sheet === "filter"} exit={sheetExit} value={filter} onClose={closeSheet} onApply={applyFilter} />
    </AoPage>
  );
}
