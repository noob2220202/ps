import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { HomeData, TransferResult } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog, Sheet } from "../components/Sheet";
import { useStatusBar } from "../hooks/useStatusBar";
import { Icon } from "../components/icons/Icon";
import { EditRow, NhBankIcon, NhDots, NhHeader, NhImg } from "./common";
import { nhWon } from "./hangul";
import type { NhConfirmState } from "./NhSend";
import "./nh-confirm.css";

export interface NhDoneState {
  result: TransferResult;
  memoTo: string;
  memoMe: string;
}

// 송금 확인 (녹화2 25~30초): 출금계좌, 받는 분 정보, 거래메모 → [송금하기]
// 최근 6개월 안에 보낸 적 없는 분이면 "받는 분 정보를 확인해 주세요" 시트 → 점 3개 로딩 → 완료
export function NhConfirm() {
  const navigate = useNavigate();
  const state = useLocation().state as NhConfirmState | null;
  const home = useApi<HomeData>(paths.home);
  const [memo, setMemo] = useState("");
  const [memoTo, setMemoTo] = useState(state?.memoTo ?? "");
  const [memoMe, setMemoMe] = useState(state?.memoMe ?? "");
  const [verify, setVerify] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useStatusBar(verify ? "#0b0b0e" : "#18171c", "light");
  useEffect(() => {
    if (!state) navigate("/", { replace: true });
  }, [state, navigate]);
  if (!state) return null;
  const { from, to, amount, recent } = state;
  const account = home.data?.accounts.find((a) => a.id === from);
  const me = home.data?.profile.userName ?? "";

  const send = async () => {
    setVerify(false);
    setSending(true);
    try {
      const result = await api.transfer({
        fromAccountId: from,
        bankCode: to.bank.code,
        number: to.number,
        amount,
        memoTo: memoTo.trim() || undefined,
        memoMe: memoMe.trim() || undefined,
      });
      if (memo.trim()) await api.updateMemo(result.outTxId, memo.trim()).catch(() => {});
      // 확인 화면을 완료 화면으로 바꿔 끼움 → 완료에서 뒤로 가면 송금 화면
      navigate("/send/done", { replace: true, state: { result, memoTo: memoTo.trim() || me, memoMe: memoMe.trim() || to.holder } satisfies NhDoneState });
    } catch (e) {
      setSending(false);
      setError(e instanceof ApiError ? e.message : "연결에 실패했어요");
    }
  };

  return (
    <div className="screen nh nh-confirm">
      <NhHeader onClose={() => navigate(-1)} />
      <div className="nh-confirm__body">
        <h2>
          <b>{to.holder}</b>님에게
          <br />
          {nhWon(amount)}
          <br />
          송금 할까요?
        </h2>
        <p className="nh-confirm__bank">
          <NhBankIcon bank={to.bank} size={18} /> {to.bank.name}
          {to.number}
        </p>
        <dl className="nh-box nh-confirm__from">
          <Row
            k="출금계좌"
            v={
              <>
                {account?.label}
                <br />
                {account?.number}
              </>
            }
          />
          <Row k="수수료" v="면제" />
        </dl>
        <div className="nh-box nh-confirm__memo">
          <EditRow label="받는계좌에 표시" value={memoTo} placeholder={me} onChange={setMemoTo} />
          <EditRow label="내계좌에 표시" value={memoMe} placeholder={to.holder} onChange={setMemoMe} />
          <EditRow label="거래메모" value={memo} placeholder="한글 20자 이내" onChange={setMemo} />
        </div>
        <button className="nh-confirm__phishing">
          보이스피싱 유의안내 <Icon name="chevron-right" size={13} stroke={2} />
        </button>
      </div>
      <div className="nh-bottom nh-bottom--split">
        <button className="nh-btn nh-btn--line" onClick={() => navigate(-1)}>
          취소
        </button>
        <button className="nh-btn" disabled={sending} onClick={() => (recent ? send() : setVerify(true))}>
          송금하기
        </button>
      </div>

      <Sheet open={verify} onClose={() => setVerify(false)} className="nh-verify">
        <NhImg name="nh-shield" w={48} h={49} className="nh-verify__shield" fallback={<span style={{ fontSize: 36 }}>🛡️</span>} />
        <h2 className="nh-sheet-title center">
          받는 분이 맞는지
          <br />
          한번 더 확인해 주세요
        </h2>
        <div className="nh-verify__box">{to.holder}</div>
        <p className="nh-verify__warn">
          <i>!</i> 최근 6개월간 돈을 보낸 적이 없는 분이에요.
        </p>
        <button className="nh-btn nh-sheet-btn" onClick={send}>
          {to.holder}님께 송금하기
        </button>
        <button className="nh-verify__again" onClick={() => navigate(-1)}>
          받는 분을 다시 입력할게요.
        </button>
      </Sheet>
      {sending && (
        <div className="nh-loading nh-loading--global">
          <NhDots size={9} />
        </div>
      )}
      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}

export function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="nh-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
