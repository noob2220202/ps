import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { TossAccount, TossHomeData, TossTransaction } from "../api";
import { useTossFlow } from "../flow";
import { hm, mmdd, num, signedWon, won } from "../format";
import { TossAppBar } from "../ui/AppBar";
import { TOSS_DOCK_SPACE } from "../ui/Button";
import { GearIcon } from "../ui/icons";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { TossProgressBar } from "../ui/ProgressBar";
import { TossSkeleton } from "../ui/Skeleton";
import { acctGroupByDay } from "./data";
import { AcctBottomBar, AcctCheckMark, AcctFilterRow } from "./ListParts";
import { AcctAdLogo, AcctButton, AcctPic, AcctRow } from "./parts";
import { ACCT_OTHER, useAcctPhases, useAcctRevisit } from "./timeline";
import "./account.css";

// 새로고침 표시: 둥근 화살표 (돌다가 → 파란 ✓)
function RefreshGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M19.4 12a7.4 7.4 0 1 1-2.6-5.65" stroke="#8d8c92" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18.6 3.6v4.1h-4.1" stroke="#8d8c92" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// /account/:accountId — 다른 은행 계좌 상세 (account.md §2.7 S4, 녹화 B 161.5–164.9초 영하나플러스 통장).
// 거래내역과 같은 뼈대: 머리줄 제목 = 계좌 이름, 오른쪽 새로고침(들어오면 돌다가 ✓) · 흐린 톱니. 계좌번호는 숫자만, 잔액은 한 번 반짝임.
// 목록은 아이콘 없이 MM.DD (그날 첫 줄만), 입금은 '+' 없이 파랑. 보내기는 토스뱅크 계좌일 때만 송금으로 (다른 은행은 누름 표시만, plan.md §1.2)
export function OtherAccount() {
  const { accountId = "" } = useParams();
  const { goSend } = useTossFlow();
  const account = useApi<TossAccount>(paths.account(accountId));
  const txs = useApi<TossTransaction[]>(paths.transactions(accountId));
  const home = useApi<TossHomeData>(paths.home);
  const ready = account.status === "done" && txs.status === "done";
  const failed = !ready && (account.status === "error" || txs.status === "error");
  const { revisit, bodyRef, saveScroll } = useAcctRevisit();
  const { phase, barReady } = useAcctPhases(ready, ACCT_OTHER, revisit);

  // 새로고침: 들어올 때부터 돌다가 ACCT_OTHER.spin 에 ✓ (뒤로 와서 다시 그리면 처음부터 ✓)
  const [refreshed, setRefreshed] = useState(revisit);
  useEffect(() => {
    if (!ready || revisit) return;
    const t = window.setTimeout(() => setRefreshed(true), ACCT_OTHER.spin);
    return () => window.clearTimeout(t);
  }, [ready, revisit]);

  const a = account.data;
  const list = txs.data ?? [];
  const cashback = home.data?.profile.cashbackCount ?? 0;
  const isToss = a?.bank.code === "toss";

  const right = (
    <div className="toss-acct-other__hr">
      <span className={`toss-acct-other__refresh${refreshed ? " toss-acct-other__refresh--done" : ""}`}>
        <span className="toss-acct-other__spin">
          <RefreshGlyph />
        </span>
        <span className="toss-acct-other__ok">
          <AcctCheckMark size={20.8} />
        </span>
      </span>
      <TossPressable className={`toss-acct-other__gear${phase >= 2 ? " toss-acct-other__gear--on" : ""}`} radius={20} ariaLabel="설정">
        <GearIcon filled size={28} color="#545456" />
      </TossPressable>
    </div>
  );

  return (
    <TossPage
      className="toss-acct-other"
      header={<TossAppBar title={a?.label ?? home.data?.accounts.find((x) => x.id === accountId)?.label ?? ""} right={right} progress={<TossProgressBar ready={barReady} />} />}
      dock={phase >= 1 ? <AcctBottomBar onSend={isToss ? () => goSend({ from: accountId }) : undefined} /> : undefined}
      bodyRef={bodyRef}
      onScroll={(e) => saveScroll(e.currentTarget.scrollTop)}
    >
      {failed && (
        <TossPressable className="toss-acct-fail" onPress={() => (account.status === "error" ? account.retry() : txs.retry())}>
          {account.error?.status === 404 ? "계좌를 찾을 수 없어요" : "잠시 후 다시 시도해 주세요"}
        </TossPressable>
      )}
      {phase === 1 && (
        <div className="toss-acct-other__skel">
          <TossSkeleton w={124.8} h={20.8} r={8} />
          <TossSkeleton w={114.4} h={28.8} r={8} />
          <TossSkeleton w={25.6} h={28.8} r={8} />
        </div>
      )}
      {phase >= 2 && a && (
        <>
          <div className="toss-acct-other__top">
            <span className="toss-acct-other__acct">
              {a.bank.name} {(a.number ?? "").replace(/\D/g, "")}
            </span>
            <span className={`toss-acct-other__bal${revisit ? " toss-acct-other__bal--still" : ""}`}>{num(a.balance)}원</span>
            <span className="toss-acct-other__rate">연 0.1%</span>
            {cashback > 0 && (
              <div className="toss-acct-other__cb">
                <AcctPic className="toss-acct-other__cbtile" name="cashback" w={40} />
                <span className="toss-acct-other__cbtext">
                  캐시백 기회 <b>{cashback}번</b> 남음
                </span>
                <AcctButton className="toss-acct-other__cbget">받기</AcctButton>
              </div>
            )}
            <AcctRow className="toss-acct-other__ad" inset="0 8px">
              <AcctAdLogo className="toss-acct-other__adlogo" kind="cup" size={38.4} />
              <span className="toss-acct-other__adtitle">샘플커피 선착순 최대 20% 할인</span>
              <span className="toss-acct-other__adsub">센스 있는 커피 선물해요 · AD</span>
            </AcctRow>
            <AcctFilterRow className="toss-acct-other__filter" check={false} />
          </div>
          {acctGroupByDay(list).map((g) =>
            g.items.map((t, i) => (
              <AcctRow key={t.id} className="toss-acct-other__row" inset="0 8px">
                {i === 0 && <span className="toss-acct-other__date">{mmdd(t.at)}</span>}
                <span className="toss-acct-other__name">{t.merchant}</span>
                <span className="toss-acct-other__time">{hm(t.at)}</span>
                <span className={`toss-acct-other__amt${t.amount > 0 ? " toss-acct-other__amt--in" : ""}`}>{signedWon(t.amount, false)}</span>
                <span className="toss-acct-other__after">{won(t.balanceAfter)}</span>
              </AcctRow>
            )),
          )}
          {!list.length && <div className="toss-acct-hist__empty">거래내역이 없어요</div>}
          <div style={{ height: TOSS_DOCK_SPACE + 12 }} />
        </>
      )}
    </TossPage>
  );
}
