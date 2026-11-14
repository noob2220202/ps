// 이체 완료 (invented, transfer.md §5.2): 이체 확인을 바꿔 들어옴 (replace), 뒤로 없음 — 브라우저 뒤로도 확인과 같음 (useAoDoneBack: 보낸 이체를 T2 에서 또 보내지 않게).
// 초록 체크 Ø 56 (가운데 196.5, 220) — 로딩 막이 걷히면 .8 → 1 + 나타남 200ms ease-out. 글 두 줄 + 상자 + 확인 → sendFinish (흐름 시작한 곳으로)
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import type { Bank } from "../../api/types";
import { aoPaths, type AoHome } from "../api";
import { useAoDoneBack, useAoFlow } from "../flow";
import { aoBankLast4, aoDigits, aoNum, aoWon } from "../format";
import { AoButton, AoPage, useAoLoadingVisible } from "../ui";
import { bankLabel } from "./util";

export function SendDone() {
  const [params] = useSearchParams();
  const flow = useAoFlow();
  useAoDoneBack();
  const home = useApi<AoHome>(aoPaths.home);
  const banks = useApi<Bank[]>(aoPaths.banks).data;
  const loading = useAoLoadingVisible();
  const [shown, setShown] = useState(!loading);
  if (!loading && !shown) setShown(true);

  const fromId = params.get("from") ?? "main";
  const from = home.data?.accounts.find((a) => a.id === fromId);
  const holder = params.get("holder") ?? "";
  const amount = Number(params.get("amount")) || 0;
  const afterRaw = params.get("after");
  const after = afterRaw !== null && afterRaw !== "" ? Number(afterRaw) : from?.balance;
  const memo = params.get("memo") ?? "";

  const rows: [string, string][] = [
    ["받는 계좌", `${bankLabel(banks, params.get("bank") ?? "")} ${aoDigits(params.get("number"))}`],
    ["출금 계좌", from ? aoBankLast4(from) : ""],
    ["거래 후 잔액", after !== undefined && !Number.isNaN(after) ? aoWon(after) : ""],
    ...(memo ? [["메모", memo] as [string, string]] : []),
  ];

  return (
    <AoPage
      className="ao-send-done"
      header={<div className="ao-send-done__head" />}
      footer={
        <AoButton className="ao-send-confirm__send" radius={15} height={56} size={18.5} onPress={() => void flow.sendFinish()}>
          확인
        </AoButton>
      }
    >
      <div className="ao-send-done__body">
        <svg className={`ao-send-done__check${shown ? " ao-send-done__check--on" : ""}`} width="56" height="56" viewBox="0 0 56 56" aria-hidden>
          <circle cx="28" cy="28" r="28" fill="#0c8f2d" />
          <path d="M17 28.6 24.6 36 39 21.2" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="ao-send-done__title">
          {holder}님에게
          <br />
          <span className="ao-send-done__amt">
            <span className="ao-num">{aoNum(amount)}</span>원
          </span>
          을 보냈어요
        </h2>
        <div className="ao-send-box ao-send-done__box">
          {rows.map(([label, value]) => (
            <div key={label} className="ao-send-box__row">
              <span className="ao-send-box__label">{label}</span>
              <span className="ao-send-box__value">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </AoPage>
  );
}
