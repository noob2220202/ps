// S5 옮길까요 / 보낼까요 /send/confirm?…&amount= (transfer.md §2.6, 녹화 B 63.727 옮길까요 · 97.514 보낼까요). 금액에서 cut 으로 들어오고 ← 도 cut
//  가운데 세 줄 (받는 쪽 이름은 파랑) · 받는 분에게 표시 / 출금 계좌 / 입금 계좌 · 옮기기 / 보내기 · "평생 수수료 무료"
//  보낼 때 입금 계좌 앞 방패는 0.11초 뒤 나타나 체크가 되풀이됨 (B 97.54 · 97.76–97.90)
//  받는 분에게 표시 → 메모(S6, push). 옮기기 / 보내기 → 점 (옮기기 0.42초 · 보내기 ≈1초, 인증은 건너뜀) → 이체 → 보내는 중(S7, cut · replace)
import { useState } from "react";
import { ApiError } from "../../api/client";
import { api } from "../../api/endpoints";
import { num } from "../format";
import { useTossGo } from "../nav";
import { TossAppBar, TossButton, TossDialog, TossPage, TossPressable } from "../ui";
import { TossRedirect } from "../ui/Redirect";
import { RowChevron, Shield } from "./common";
import { accountLine, isMove, toLabel, useSendMemo, verbAsk, verbCta } from "./store";
import { hasSendTarget, targetQuery, useSendParams, useSendTarget } from "./target";
import type { SendDoneState } from "./done";
import "./send.css";

const DOTS_MOVE = 420;
const DOTS_SEND = 1000;

export function SendConfirm() {
  const p = useSendParams();
  // 받는 분 · 금액 없이 주소를 바로 열었음 → 어디로 보낼까요 / 금액
  if (!hasSendTarget(p)) return <TossRedirect to={`/send?from=${encodeURIComponent(p.from)}`} />;
  if (!(p.amount > 0)) return <TossRedirect to={`/send/amount?${targetQuery(p)}`} />;
  return <ConfirmBody />;
}

function ConfirmBody() {
  const p = useSendParams();
  const res = useSendTarget(p);
  const go = useTossGo();
  const memo = useSendMemo();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialogState] = useState({ title: "", body: "", open: false });
  const amount = p.amount;
  const t = res.target;
  const from = res.from;
  const ready = res.status === "ready" && !!t && !!from;
  const memoTo = memo ?? res.userName;

  const send = async () => {
    if (!ready || busy || !t || !from) return;
    setBusy(true);
    const t0 = performance.now();
    try {
      const r = await api.transfer({ fromAccountId: from.id, bankCode: t.bank.code, number: t.digits, amount, ...(memo ? { memoTo: memo } : {}) });
      const left = (isMove(t) ? DOTS_MOVE : DOTS_SEND) - (performance.now() - t0);
      if (left > 0) await new Promise((ok) => window.setTimeout(ok, left));
      const { label, particle } = toLabel(t);
      const state: SendDoneState = { kind: isMove(t) ? "move" : "send", label, particle, amount, outTxId: r.outTxId };
      go("/send/done", { replace: true, delay: 0, lock: 300, state: { send: state } });
    } catch (e) {
      setBusy(false);
      const msg = e instanceof ApiError ? e.message : "잠시 후 다시 시도해주세요.";
      setDialogState({ title: `${isMove(t) ? "옮기지" : "보내지"} 못했어요`, body: msg, open: true });
    }
  };

  const lbl = t ? toLabel(t) : null;
  return (
    <TossPage header={<TossAppBar title="토스뱅크 송금" />} className="toss-send-cf" bodyClassName="toss-send-cf__body">
      {ready && lbl && (
        <div className="toss-send-cf__in">
          <h1 className="toss-send-big toss-send-cf__title">
            <em>{lbl.label}</em>
            {lbl.particle}
            <br />
            {num(amount)}원을
            <br />
            {verbAsk(t)}
          </h1>
          <div className="toss-send-cf__rows">
            <TossPressable className="toss-send-cf__row" inset="0 4px" radius={8} color="#211f27" onPress={() => go(`/send/memo?${targetQuery(p)}&amount=${amount}`)}>
              <span className="toss-send-cf__label">받는 분에게 표시</span>
              <span className="toss-send-cf__val">
                <span>{memoTo}</span>
                <RowChevron />
              </span>
            </TossPressable>
            <TossPressable className="toss-send-cf__row" inset="0 4px" radius={8} color="#211f27" onPress={() => {}}>
              <span className="toss-send-cf__label">출금 계좌</span>
              <span className="toss-send-cf__val">
                <span>내 {from.label}</span>
                <RowChevron />
              </span>
            </TossPressable>
            <TossPressable className="toss-send-cf__row" inset="0 4px" radius={8} color="#211f27" disabled={isMove(t)} onPress={() => {}}>
              <span className="toss-send-cf__label">입금 계좌</span>
              <span className="toss-send-cf__val">
                {!isMove(t) && <Shield check="cf" />}
                <span>{accountLine(t)}</span>
                {!isMove(t) && <RowChevron />}
              </span>
            </TossPressable>
          </div>
          <div className="toss-send-cf__ok">
            <TossButton loading={busy} onPress={send}>
              {verbCta(t)}
            </TossButton>
          </div>
          <p className="toss-send-cf__cap">평생 수수료 무료</p>
        </div>
      )}
      <TossDialog open={dialog.open} title={dialog.title} body={dialog.body} onClose={() => setDialogState((d) => ({ ...d, open: false }))} />
    </TossPage>
  );
}
