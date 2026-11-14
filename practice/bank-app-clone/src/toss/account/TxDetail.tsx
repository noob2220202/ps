import { useState } from "react";
import { useParams } from "react-router-dom";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { TossAccount, TossCounterparty, TossHomeData, TossTxDetail } from "../api";
import { fullDateTime, signedWon, won } from "../format";
import { useTossGo } from "../nav";
import { TossAppBar } from "../ui/AppBar";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { acctTxKind } from "./data";
import { MemoEditor } from "./MemoEditor";
import { AcctButton, AcctChevron, AcctPic, AcctTxIcon } from "./parts";
import { ACCT_DETAIL, useAcctPhases, useAcctRevisit } from "./timeline";
import "./account.css";

// 줄마다 높이 (다음 줄 잉크까지, 녹화 A 57.75 · 105.76: 적요 241.6 · 거래 유형 296.0 · 입금처 347.2 · 출금처 394.4 · 메모 445.6 · 일시 501.6 · 거래 후 잔액 556.0 · 받는 분 통장표시 611.2, 마지막 줄 → 선 41.6, 그려지는 줄이 녹화의 기기 px 줄(652.8 · 597.6)에 오도록 41.2)
const ROW_H = { 적요: 54.4, "거래 유형": 51.2, 입금처: 47.2, 출금처: 51.2, 메모: 56, 일시: 54.4, "거래 후 잔액": 55.2, "받는 분 통장표시": 55.2 } as const;
type RowKey = keyof typeof ROW_H;
const FIRST = 241.6; // 첫 줄 잉크 (화면 dp)
const LAST_TO_LINE = 41.2;

// 계좌 표기: "내 토스뱅크 1000-1234-5678" · 다른 사람은 "하나은행 123-456789-01234". 토스머니는 번호 없이
const mine = (a: { bank: { name: string }; number?: string; label?: string; role?: string | null } | undefined) =>
  !a ? "" : a.role === "money" ? "내 토스머니" : `내 ${a.bank.name} ${a.number ?? ""}`.trim();
const side = (c: TossCounterparty) => (c.own ? (c.accountName === "토스머니" ? "내 토스머니" : `내 ${c.bank.name} ${c.number}`) : `${c.bank.name} ${c.number}`);

// /tx/:txId — 상세 내역 (account.md §2.6, 녹화 A 57.75–60.9 입금 · 105.76–108.7 출금).
// 상대 ⓦ + 이름, 금액 28 B (부호 그대로, 흰색) + 복사, 적요 · 거래 유형 · 입금처 · 출금처 · 메모 · 일시 · 거래 후 잔액 (· 받는 분 통장표시), 선, 증명서 발급하기.
// 메모남기기 → 메모 화면(MemoEditor, ≤20자, PATCH). 증명서 발급하기 → /cert (certDepth 1 — 발급 끝 '확인했어요' 가 여기로 돌아옴). 복사 · 밑줄 계좌는 누름 표시만
export function TxDetail() {
  const { txId = "" } = useParams();
  const go = useTossGo();
  const tx = useApi<TossTxDetail>(paths.transaction(txId));
  const home = useApi<TossHomeData>(paths.home);
  const { revisit, bodyRef, saveScroll } = useAcctRevisit();
  const { phase } = useAcctPhases(tx.status === "done", ACCT_DETAIL, revisit);
  const [memoOpen, setMemoOpen] = useState(false);

  const t = tx.data;
  const me = t && (home.data?.accounts.find((a) => a.id === t.accountId) as TossAccount | undefined);
  const userName = home.data?.profile.userName ?? "";
  const c = t?.counterparty ?? null;

  const rows: { key: RowKey; value: string; link?: boolean; memo?: boolean }[] = [];
  if (t) {
    rows.push({ key: "적요", value: t.merchant }, { key: "거래 유형", value: t.kindLabel ?? (t.amount < 0 ? "출금" : "입금") });
    const here = mine(me);
    const inSide = t.amount > 0 ? here : c ? side(c) : "";
    const outSide = t.amount < 0 ? here : c ? side(c) : "";
    if (inSide && (c || t.amount > 0)) rows.push({ key: "입금처", value: inSide, link: true });
    if (outSide && (c || t.amount < 0)) rows.push({ key: "출금처", value: outSide, link: true });
    rows.push({ key: "메모", value: t.memo ?? "", memo: true }, { key: "일시", value: fullDateTime(t.at) }, { key: "거래 후 잔액", value: won(t.balanceAfter) });
    if (c?.direction === "out") rows.push({ key: "받는 분 통장표시", value: t.memoTo || userName });
  }
  let y = FIRST;
  const placed = rows.map((r) => {
    const top = y;
    y += ROW_H[r.key];
    return { ...r, top };
  });
  const lineAt = (placed.at(-1)?.top ?? FIRST) + LAST_TO_LINE;

  return (
    <TossPage className="toss-acct-detail" header={<TossAppBar title="상세 내역" />} bodyRef={bodyRef} onScroll={(e) => saveScroll(e.currentTarget.scrollTop)}>
      {tx.status === "error" && (
        <TossPressable className="toss-acct-fail" onPress={tx.retry}>
          {tx.error?.status === 404 ? "거래를 찾을 수 없어요" : "잠시 후 다시 시도해 주세요"}
        </TossPressable>
      )}
      {phase >= 1 && t && (
        <div className="toss-acct-detail__body" style={{ height: lineAt + 120 - 81.6 }}>
          <AcctTxIcon className="toss-acct-detail__icon" kind={acctTxKind(t)} size={24} />
          <span className="toss-acct-detail__who">{t.merchant}</span>
          <span className="toss-acct-detail__amt">{signedWon(t.amount)}</span>
          <AcctButton className="toss-acct-detail__copy">복사</AcctButton>
          {placed.map((r) => (
            <div key={r.key} className="toss-acct-detail__row" style={{ top: r.top - 81.6 }}>
              <span className="toss-acct-detail__label">{r.key}</span>
              {r.memo ? (
                <TossPressable className={`toss-acct-detail__memo${r.value ? " toss-acct-detail__memo--set" : ""}`} radius={8} inset="-6px -8px" onPress={() => setMemoOpen(true)}>
                  {r.value || "메모남기기"}
                  <AcctChevron className="toss-acct-detail__memochev" color="#57565b" />
                </TossPressable>
              ) : r.link ? (
                <TossPressable className="toss-acct-detail__value toss-acct-detail__value--link" radius={6} inset="-4px -6px">
                  {r.value}
                </TossPressable>
              ) : (
                <span className="toss-acct-detail__value">{r.value}</span>
              )}
            </div>
          ))}
          <div className="toss-acct-detail__line" style={{ top: lineAt - 81.6 }} />
          <TossPressable className="toss-acct-detail__cert" style={{ top: lineAt - 81.6 + 1 }} inset="0 8px" radius={12} color="rgba(255,255,255,0.09)" scale={0.98} fadeIn={100} fadeOut={250} onPress={() => go("/cert", { state: { certDepth: 1 } })}>
            <AcctPic className="toss-acct-detail__doc" name="doc" w={28.8} h={30.5} />
            <span className="toss-acct-detail__certtext">증명서 발급하기</span>
            <AcctChevron className="toss-acct-detail__certchev" color="#57565b" />
          </TossPressable>
        </div>
      )}
      {t && <MemoEditor open={memoOpen} txId={t.id} value={t.memo ?? ""} onClose={() => setMemoOpen(false)} />}
    </TossPage>
  );
}
