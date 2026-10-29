import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { Bank, HomeData, TransferResult } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { Dialog, Sheet } from "../components/Sheet";
import { NhBankIcon, NhHeader, NhImg } from "./common";
import { withNhLoading } from "./loading";
import { nhWon } from "./hangul";
import type { NhConfirmState } from "./NhSend";
import "./nh-confirm.css";
import { sendFromScratchOnReturn } from "./nhSendRestore";
import { nhPic, useNhStatusBar } from "./theme";

export interface NhDoneState {
  result: TransferResult;
  memoTo: string;
  memoMe: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 송금 처리 시간표 (녹화2 27.915~30.32초). 시트 버튼을 누르면 시트가 62ms 동안 사라지고 115ms 뒤 점 3개가 뜸 (28.029).
// 아래는 점 3개가 뜬 때 기준 ms
const SEND = {
  afterSheet: 115,
  blackFrom: 210, // 막이 다 덮인 직후 화면 전체가 0.48초 동안 검게 됨 (28.238~28.715, 상태바까지)
  blackTo: 690,
  // 검은 화면이 끝나면 막·점이 같이 걷혀 확인 화면이 밝게 보였다가 (28.715~), 점(28.76)과 막(28.79, 0→0.6 200ms 직선)이 다시 뜸
  gap: 50,
  done: 2120, // 완료 화면으로 바뀜 (30.147). 막은 그 뒤 170ms 더 덮여 있음 (30.318)
  doneDim: 170,
};

// 송금 확인 (녹화2 24~28초): X / "OOO님에게 1원 송금 할까요?" / 은행 아이콘+번호 / 출금계좌·수수료(남색 상자) /
// 표시·거래메모(테두리 상자) / 보이스피싱 유의안내 / [취소][송금하기]
// 최근 6개월 안에 보낸 적 없는 분이면 "받는 분이 맞는지" 시트 → 점 3개 로딩 → 완료
export function NhConfirm() {
  const navigate = useNavigate();
  const state = useLocation().state as NhConfirmState | null;
  const home = useApi<HomeData>(paths.home);
  const [memo, setMemo] = useState(state?.memo ?? "");
  const [memoTo, setMemoTo] = useState(state?.memoTo ?? "");
  // 앞 단계에서 '내계좌에 표시'를 비워 두면 실제 앱은 받는 분 이름을 값으로 채워 보여줌 (녹화2 24.5초: 흰 글자 + ⓧ)
  const [memoMe, setMemoMe] = useState(state?.memoMe || state?.to.holder || "");
  const [verify, setVerify] = useState(false);
  const sending = useRef(false); // 송금 중 (두 번 누름 막기. 버튼 모양은 그대로)
  const [black, setBlack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 받는 분 확인 시트의 막(0.5)은 상태바를 덮지 않음 (녹화2 27.0초 상태바 그대로 #17161b). 송금 중 검은 화면 때만 상태바도 검정
  useNhStatusBar("#18171c", { black });
  useEffect(() => {
    if (!state) navigate("/", { replace: true });
  }, [state, navigate]);
  // 완료 화면 그림(스프라이트)을 미리 받아 둠 → 완료 화면이 뜨자마자 동전이 보이게
  useEffect(() => {
    const src = localAsset(nhPic("nh-done-mark"));
    if (src) new Image().src = src;
  }, []);
  if (!state) return null;
  const { from, to, amount, recent } = state;
  const account = home.data?.accounts.find((a) => a.id === from);
  const me = home.data?.profile.userName ?? "";

  // 로딩은 두 번: 점 3개 → 막 → 검은 화면(0.48초) → 막·점 걷힘(밝은 확인 화면 60ms) → 다시 점 3개·막 → 완료 화면
  // 송금하기 버튼은 그동안 보라색 그대로 (막 아래에서 어두워질 뿐, 비활성 회색으로 바뀌지 않음)
  const send = async () => {
    if (sending.current) return;
    sending.current = true;
    setVerify(false);
    if (verify) await sleep(SEND.afterSheet);
    const transfer = api.transfer({
      fromAccountId: from,
      bankCode: to.bank.code,
      number: to.number,
      amount,
      memoTo: memoTo.trim() || undefined,
      memoMe: memoMe.trim() || undefined,
    });
    // 실패하면 시간표를 기다리지 않고 바로 멈춤 (성공하면 시간표대로)
    const failed = transfer.then(() => new Promise<never>(() => {}));
    const step = (ms: number) => Promise.race([sleep(ms), failed]);
    try {
      await withNhLoading(async () => {
        await step(SEND.blackFrom);
        setBlack(true);
        await step(SEND.blackTo - SEND.blackFrom);
        setBlack(false); // 검은 화면과 로딩이 같은 프레임에 걷힘
      }, 0);
      await step(SEND.gap);
      await withNhLoading(async () => {
        const [result] = await Promise.all([transfer, sleep(SEND.done - SEND.blackTo - SEND.gap)]);
        if (memo.trim()) await api.updateMemo(result.outTxId, memo.trim()).catch(() => {});
        // 확인 화면을 완료 화면으로 바꿔 끼움 → 완료에서 뒤로 가면 송금 화면
        navigate("/send/done", { replace: true, state: { result, memoTo: memoTo.trim() || me, memoMe: memoMe.trim() || to.holder } satisfies NhDoneState });
        await sleep(SEND.doneDim);
      }, 0);
    } catch (e) {
      setBlack(false);
      sending.current = false;
      setError(e instanceof ApiError ? e.message : "연결에 실패했어요");
    }
  };

  return (
    <div className="screen nh nh-cf">
      <NhHeader onClose={() => navigate(-1)} />
      <h2 className="nh-cf__title">
        <span>
          <b>{to.holder}</b>님에게
        </span>
        <b>{nhWon(amount)}</b>
        <b>송금 할까요?</b>
      </h2>
      <p className="nh-cf__bank">
        <NhCfBankIcon bank={to.bank} />
        <span>
          {to.bank.name} {to.number}
        </span>
      </p>
      <dl className="nh-cf__from">
        <div>
          <dt>출금계좌</dt>
          <dd>
            {account?.label}
            <br />
            {account?.number}
          </dd>
        </div>
        <div>
          <dt>수수료</dt>
          <dd>면제</dd>
        </div>
      </dl>
      <div className="nh-cf__memo">
        <NhCfRow label="받는계좌에 표시" value={memoTo} placeholder={me} onChange={setMemoTo} />
        <NhCfRow label="내계좌에 표시" value={memoMe} placeholder={to.holder} onChange={setMemoMe} />
        <NhCfRow label="거래메모" value={memo} placeholder="한글 20자 이내" onChange={setMemo} />
      </div>
      <button className="nh-cf__phish">
        보이스피싱 유의안내
        <NhCfChevron />
      </button>
      <div className="nh-bottom nh-bottom--split nh-cf__bottom">
        <button className="nh-btn nh-btn--line" onClick={() => navigate(-1)}>
          취소
        </button>
        <button className="nh-btn" onClick={() => !sending.current && (recent ? send() : setVerify(true))}>
          송금하기
        </button>
      </div>

      <Sheet open={verify} onClose={() => setVerify(false)} kind="nhverify" className="nh-vf">
        <NhImg name={nhPic("nh-shield")} w={46.4} h={52.8} className="nh-vf__shield" fallback={<span style={{ fontSize: 36 }}>🛡️</span>} />
        <h2 className="nh-vf__title">
          받는 분이 맞는지
          <br />
          한번 더 확인해 주세요
        </h2>
        <div className="nh-vf__name">{to.holder}</div>
        <p className="nh-vf__warn">
          <NhCfWarnIcon />
          최근 6개월간 돈을 보낸 적이 없는 분이에요.
        </p>
        <button className="nh-btn nh-vf__send" onClick={send}>
          <b>{to.holder}</b>님께 송금하기
        </button>
        <button
          className="nh-vf__again"
          onClick={() => {
            sendFromScratchOnReturn(); // 콕송금을 처음 단계부터
            navigate(-1);
          }}
        >
          받는 분을 다시 입력할게요.
        </button>
      </Sheet>
      {black && <div className="nh-cf__black" />}
      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}

// 받는 은행: 둥근 사각 아이콘 24dp (은행선택 화면과 같은 그림, nh-bank-<code>.png). 없으면 동그라미
function NhCfBankIcon({ bank }: { bank: Bank }) {
  const src = localAsset(`nh-bank-${bank.code}`);
  if (!src) return <NhBankIcon bank={bank} size={24} />;
  return <img className="nh-cf__bank-icon" src={src} alt="" width={24} height={24} draggable={false} />;
}

// 표시·메모 한 줄: 왼쪽 이름(16/400), 오른쪽 입력칸(17/500) + ⓧ (값이 있을 때)
function NhCfRow({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <label className="nh-cf__row">
      <span>{label}</span>
      <input value={value} maxLength={20} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button
          className="nh-cf__clear"
          aria-label="지우기"
          onClick={(e) => {
            e.preventDefault();
            onChange("");
          }}
        >
          <svg width="16.4" height="16.4" viewBox="0 0 16 16" aria-hidden>
            <circle cx="8" cy="8" r="8" fill="#2b343c" />
            <path d="m5.26 5.26 5.48 5.48m0-5.48-5.48 5.48" stroke="#cbd2da" strokeWidth="1.3" />
          </svg>
        </button>
      )}
    </label>
  );
}

// 보이스피싱 유의안내 옆 › (5.6 × 11.2, 굵기 1.5, 진한 회색)
export function NhCfChevron({ className = "nh-cf__chev" }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M9.2 6.4 14.8 12l-5.6 5.6" />
    </svg>
  );
}

// 빨간 원 + 흰 ! (20dp)
function NhCfWarnIcon() {
  return (
    <svg className="nh-vf__warn-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="#e44547" />
      <path d="M10 5.2v6" stroke="#fff" strokeWidth="2.2" />
      <circle cx="10" cy="14.4" r="1.25" fill="#fff" />
    </svg>
  );
}
