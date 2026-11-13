import { useCallback, useState, type UIEvent } from "react";
import { useParams } from "react-router-dom";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { TossAccount, TossTransaction } from "../api";
import { useTossFlow } from "../flow";
import { hm, mwd, num, signedWon, won } from "../format";
import { useTossGo } from "../nav";
import { TossAppBar } from "../ui/AppBar";
import { TOSS_DOCK_SPACE } from "../ui/Button";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { TossProgressBar } from "../ui/ProgressBar";
import { AcctBottomBar, AcctFilterRow, AcctHistoryActions } from "./ListParts";
import { AcctAdLogo, AcctBolt, AcctChevron, AcctRow, AcctTxIcon } from "./parts";
import { acctGroupByDay, acctTxKind } from "./data";
import { acctInterest, ACCT_HISTORY, useAcctCheck, useAcctPhases, useAcctRevisit } from "./timeline";
import "./account.css";

// /bank/:accountId/history — 거래내역 (account.md §2.5 · §3.5 · §3.6, 녹화 A 45.5–56.4초 · 102.8–112.7초).
// 머리줄은 제목 없이 ← 와 카드 · 관리 (다 받은 뒤), 바탕은 스크롤 따라 (40 → 160dp 에서 불투명). 전체 ⌄ 줄 옆 ✓ 는 다 받은 뒤 잠깐.
// 줄을 누르면 상세 (/tx/:id), 보내기 → 송금. 아래 채우기 · 보내기는 고정, 목록은 그 밑으로 흐려지며 지나감
export function History() {
  const { accountId = "main" } = useParams();
  const go = useTossGo();
  const { goSend } = useTossFlow();
  const account = useApi<TossAccount>(paths.account(accountId));
  const txs = useApi<TossTransaction[]>(paths.transactions(accountId));
  const ready = account.status === "done" && txs.status === "done";
  const failed = !ready && (account.status === "error" || txs.status === "error");
  const { revisit, bodyRef, savedScroll, saveScroll } = useAcctRevisit();
  const { phase, barReady } = useAcctPhases(ready, ACCT_HISTORY, revisit);
  const loaded = phase >= 1;
  const check = useAcctCheck(loaded && !revisit, ACCT_HISTORY.check, ACCT_HISTORY.checkHold);
  const { onScrollTop } = check;

  // 머리줄 바탕은 0–200dp 에서만 바뀜 → 그 밖에서는 같은 값이라 다시 그리지 않음
  const clampSt = (v: number) => Math.max(0, Math.min(200, Math.round(v)));
  const [st, setSt] = useState(() => clampSt(savedScroll));
  const onScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const v = e.currentTarget.scrollTop;
      setSt(clampSt(v));
      onScrollTop(v);
      saveScroll(v);
    },
    [onScrollTop, saveScroll],
  );

  const a = account.data;
  const list = txs.data ?? [];
  const groups = acctGroupByDay(list);

  return (
    <TossPage
      className="toss-acct-hist"
      headerOverlay
      header={<TossAppBar mode="scroll" scrollTop={st} right={loaded ? <AcctHistoryActions /> : undefined} progress={<TossProgressBar ready={barReady} />} />}
      dock={loaded ? <AcctBottomBar onSend={() => goSend({ from: accountId })} /> : undefined}
      onScroll={onScroll}
      bodyRef={bodyRef}
    >
      {failed && (
        <TossPressable className="toss-acct-fail" onPress={() => (account.status === "error" ? account.retry() : txs.retry())}>
          잠시 후 다시 시도해 주세요
        </TossPressable>
      )}
      {loaded && a && (
        <>
          <div className="toss-acct-hist__top">
            <span className="toss-acct-hist__acct">
              {a.bank.name} {a.number}
            </span>
            <span className="toss-acct-hist__bal">{num(a.balance)}원</span>
            <AcctRow className="toss-acct-hist__int" inset="0 8px" ariaLabel="어제까지 쌓인 이자">
              <AcctBolt className="toss-acct-hist__inticon" />
              <span className="toss-acct-hist__intcap">어제까지 쌓인 이자</span>
              <span className="toss-acct-hist__intamt">{num(acctInterest(a.balance))}원</span>
              <AcctChevron className="toss-acct-hist__intchev" color="#555557" />
            </AcctRow>
            <div className="toss-acct-hist__band" />
            <AcctFilterRow className="toss-acct-hist__filter" check={check.on} />
            <span className="toss-acct-hist__adcap">AD</span>
            <AcctRow className="toss-acct-hist__ad" inset="0 8px">
              <AcctAdLogo className="toss-acct-hist__adlogo" kind="gift" size={38.4} />
              <span className="toss-acct-hist__adtitle">예시버거 e쿠폰 최대 30% 할인</span>
              <span className="toss-acct-hist__adsub">선착순 판매 완료 시 종료! • AD</span>
            </AcctRow>
          </div>
          {groups.map((g) => (
            <div key={g.day}>
              <div className="toss-acct-hist__date">{mwd(g.items[0].at)}</div>
              {g.items.map((t) => (
                <AcctRow key={t.id} className="toss-acct-hist__row" onPress={() => go(`/tx/${encodeURIComponent(t.id)}`)}>
                  <AcctTxIcon className="toss-acct-hist__icon" kind={acctTxKind(t)} />
                  <span className="toss-acct-hist__name">{t.merchant}</span>
                  <span className="toss-acct-hist__time">{hm(t.at)}</span>
                  <span className={`toss-acct-hist__amt${t.amount > 0 ? " toss-acct-hist__amt--in" : ""}`}>{signedWon(t.amount)}</span>
                  <span className="toss-acct-hist__after">{won(t.balanceAfter)}</span>
                </AcctRow>
              ))}
            </div>
          ))}
          {!list.length && <div className="toss-acct-hist__empty">거래내역이 없어요</div>}
          <div style={{ height: TOSS_DOCK_SPACE + 12 }} />
        </>
      )}
    </TossPage>
  );
}
