// S7 보내는 중 → S8 완료 /send/done (확인 화면이 이체를 마치고 replace, cut) (transfer.md §2.9 · §2.10, 녹화 B 115.801 · 69.609 · 118.211)
//  S7: 세 줄 (받는 쪽 이름 파랑, "옮길게요 / 보낼게요") + 동전, 1.4초 이상. 뒤로가기는 받지 않음
//  S8: 글이 모두 흰색 "옮겼어요 / 보냈어요", 0.2초 뒤 체크 로티, 메모 남기기 칩, 옮기기 = 확인 하나 / 보내기 = 공유하기 + 확인
//  확인 · ← · 갤럭시 뒤로 = useSendFinish (광고 화면 또는 이체 흐름 전 화면). 공유하기는 누름만
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { paths } from "../../api/endpoints";
import { useApi } from "../../api/useApi";
import type { TransactionDetail } from "../../api/types";
import { useLayerActive } from "../../platform/LayerContext";
import { useSendFinish } from "../flow";
import { num } from "../format";
import { useTossGo } from "../nav";
import { TossAppBar, TossButton, TossPage, TossPressable } from "../ui";
import { SendCheck, SendCoin } from "./anim";
import { readDone, SENDING_MIN } from "./done";
import { useDoneGuard } from "./guard";
import { useRevisit } from "./keyed";
import "./send.css";

export function SendDone() {
  const location = useLocation();
  const navigate = useNavigate();
  const done = readDone(location.state);
  // 값 없이 들어옴 (주소를 직접 열었음) → 홈으로
  useEffect(() => {
    if (!done) navigate("/", { replace: true });
  }, [done, navigate]);
  return done ? <DoneBody key={done.outTxId} /> : <TossPage header={<TossAppBar onBack={false} />} />;
}

function DoneBody() {
  const location = useLocation();
  const d = readDone(location.state)!;
  const go = useTossGo();
  const finish = useSendFinish();
  const active = useLayerActive();
  // 메모 화면에서 돌아오면 (다시 그려짐) 완료 그대로, 체크는 멈춘 그림
  const revisit = useRevisit("done");
  const [phase, setPhase] = useState<"sending" | "done">(revisit ? "done" : "sending");
  const tx = useApi<TransactionDetail>(paths.transaction(d.outTxId));
  const memo = tx.data?.memo?.trim();

  useEffect(() => {
    if (revisit) return;
    const t = window.setTimeout(() => setPhase("done"), SENDING_MIN);
    return () => window.clearTimeout(t);
  }, [revisit]);
  // 갤럭시 뒤로: 보내는 중엔 무시(지킴 칸을 다시 쌓음), 완료에선 확인과 같음
  const leave = useDoneGuard(active, () => (phase === "sending" ? true : void finish(d.kind)));
  const ok = () => leave(() => finish(d.kind));

  const sending = phase === "sending";
  return (
    <TossPage
      header={<TossAppBar title="토스뱅크 송금" onBack={sending ? () => {} : ok} />}
      className={`toss-send-done toss-send-done--${phase}`}
      bodyClassName="toss-send-done__body"
    >
      <div className="toss-send-done__in">
        <div className="toss-send-done__slot">{sending ? <SendCoin /> : <SendCheck still={revisit} />}</div>
        <h1 className="toss-send-big toss-send-done__title">
          <em>{d.label}</em>
          {d.particle}
          <br />
          {num(d.amount)}원을
          <br />
          {d.kind === "move" ? (sending ? "옮길게요" : "옮겼어요") : sending ? "보낼게요" : "보냈어요"}
        </h1>
        {!sending && (
          <>
            <TossPressable className="toss-send-done__chip" radius={12} onPress={() => go(`/send/memo?tx=${encodeURIComponent(d.outTxId)}`)}>
              {memo || "메모 남기기"}
            </TossPressable>
            <div className="toss-send-done__dock">
              {d.kind === "send" && (
                <TossButton variant="secondary" onPress={() => {}}>
                  공유하기
                </TossButton>
              )}
              <TossButton onPress={ok}>확인</TossButton>
            </div>
          </>
        )}
      </div>
    </TossPage>
  );
}
