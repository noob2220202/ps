import { useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { Bank, HomeData, Recipient, TransferRecipients } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog, Sheet } from "../components/Sheet";
import { NhHeader } from "./common";
import { withNhLoading } from "./loading";
import { NhAmountSheet } from "./NhAmountSheet";
import { amountError } from "./nhAmount";
import { NhBankPicker } from "./NhBankPicker";
import { NhNumberSheet } from "./NhNumberSheet";
import { NhRecipientList } from "./NhRecipientList";
import { NhSendAmount } from "./NhSendAmount";
import { NhSendWho } from "./NhSendWho";
import { takeFresh, type NhSendRestore } from "./nhSendRestore";
import "./nh-send.css";
import { useNhStatusBar } from "./theme";

export interface NhConfirmState {
  from: string;
  to: Recipient;
  amount: number;
  memoTo: string;
  memoMe: string;
  memo?: string; // 상세 정보 ⌄ 를 열고 적은 거래메모
  recent: boolean; // 최근 6개월 안에 보낸 적 있는 분 (없으면 확인 시트가 한 번 더 뜸)
}

const SIX_MONTHS = 183 * 24 * 3600 * 1000;

// 계좌번호 시트 '다음' → 금액 화면 (녹화2 13.60~14.21초, 누른 때부터 ms):
//   0 시트 닫힘(막 200ms 직선으로 걷힘) → 100 점 3개 + 로딩 막(190ms 직선) — 두 막이 겹쳐 70% 밝기로 잠깐 머문 뒤 0.4 로 →
//   445 점·막 사라짐 → 막 없는 첫 화면 115ms → 560 금액 화면, 그 위에 펼친 최근송금 목록이 0.86 으로 50ms 남음 → 610 금액 화면만
// (값은 화면에 그려지기까지 걸리는 10~15ms 를 뺀 타이머 값: rAF 기록으로 맞춤)
const LOOKUP = { dots: 90, busy: 345, bare: 112, ghost: 60 };
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

// 콕송금 (녹화2 0~25초). 한 화면이 단계별로 바뀜:
//   who    "누구에게 보낼까요?" 은행·계좌번호 (계좌번호 시트) / 아래 최근송금 목록
//   amount "얼마를 보낼까요?" — 금액 상자를 누르면 금액 시트 (녹화1·2 모두 화면이 뜨고 1.7~1.9초 뒤 사용자가 눌러서 열림)
//   memo   "1원을 보낼게요" 받는계좌·내계좌 표시 → [다음] → 확인 화면
// 키패드 시트(계좌번호·금액)가 열리면 상태바도 막(0.6)과 같이 #0a090b 로 어두워짐 (녹화 #09080b)
export function NhSend() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // 송금 확인에서 X·취소로 돌아온 경우: 이동 직전 입력값으로 '보낼게요' 단계부터 (한 번만 읽음)
  const [restore] = useState(() => {
    const r = (location.state as { restore?: NhSendRestore } | null)?.restore;
    return r && !takeFresh() ? r : null;
  });
  // 거래 상세 '동일내역 송금': ?bank=…&number=…&amount=… → 같은 계좌를 조회하면 금액도 채움
  const presetAmount = Number(params.get("amount") ?? 0);
  const from = params.get("from") ?? "main";
  const home = useApi<HomeData>(paths.home);
  const data = useApi<TransferRecipients>(paths.recipients(from));
  const banks = useApi<Bank[]>(paths.banks);
  const account = home.data?.accounts.find((a) => a.id === from);
  const me = home.data?.profile.userName ?? "";

  // 거래 상세의 '동일내역 송금'은 ?bank=…&number=… 로 은행·계좌번호를 채워서 옴
  const [bankCode, setBankCode] = useState(restore?.bankCode ?? params.get("bank") ?? "nh");
  const [digits, setDigits] = useState(restore?.digits ?? params.get("number") ?? "");
  const [stage, setStage] = useState<"who" | "amount" | "memo">(restore ? "memo" : "who");
  const [sheet, setSheet] = useState<"number" | "amount" | null>(null);
  const [closing, setClosing] = useState<"number" | "amount" | null>(null); // 닫히는 중인 키패드 시트 (176dp 내려가며 200ms 투명해짐)
  const closeTimer = useRef(0);
  const [amountSeq, setAmountSeq] = useState(0); // 금액 시트를 열 때마다 지금 금액으로 새로 시작
  const [picking, setPicking] = useState(false); // 은행선택 화면
  const [listOpen, setListOpen] = useState(false); // 최근송금 목록을 위로 끌어올림
  const [busy, setBusy] = useState(false); // 점 3개
  const [to, setTo] = useState<Recipient | null>(restore?.to ?? null);
  const [amount, setAmount] = useState(restore?.amount ?? 0);
  const [memoTo, setMemoTo] = useState<string | null>(restore ? restore.memoTo : null); // null = 기본값(내 이름)
  const [memoMe, setMemoMe] = useState(restore?.memoMe ?? "");
  const [memo, setMemo] = useState(restore?.memo ?? ""); // 거래메모 (상세 정보 ⌄)
  const [detail, setDetail] = useState(!!restore?.memo);
  const [ghost, setGhost] = useState(false); // 금액 화면으로 넘어갈 때 잠깐 겹쳐 보이는 펼친 최근송금 목록
  const [error, setError] = useState<string | null>(null);
  const bank = banks.data?.find((b) => b.code === bankCode) ?? null;
  useNhStatusBar("#18171c", { dim: !!sheet });

  const closeSheet = () => {
    if (!sheet) return;
    setSheet(null);
    setClosing(sheet);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setClosing(null), 230);
  };
  const openAmount = () => {
    setAmountSeq((n) => n + 1);
    setSheet("amount");
  };
  const pickRecipient = (r: Recipient) => {
    setTo(r);
    setListOpen(false);
    setAmount(presetAmount && r.bank.code === params.get("bank") && r.number === params.get("number") ? presetAmount : 0);
    setMemo("");
    setDetail(false);
    setStage("amount");
  };
  const lookup = async () => {
    if (!bank) return;
    closeSheet();
    const found = api.lookupAccount(bank.code, digits).then(
      (r) => ({ r }),
      (e: unknown) => ({ e }),
    );
    await wait(LOOKUP.dots);
    setBusy(true);
    const [res] = await Promise.all([found, wait(LOOKUP.busy)]);
    setBusy(false);
    if ("e" in res) {
      const e = res.e;
      setError(
        e instanceof ApiError && e.status === 404
          ? "입력하신 계좌정보를 확인해 주세요.\n\n(연습용 앱: 🔔 관리 → 받는 분 탭에서\n먼저 등록한 계좌만 보낼 수 있어요)"
          : e instanceof ApiError
            ? e.message
            : "연결에 실패했어요",
      );
      return;
    }
    await wait(LOOKUP.bare);
    pickRecipient(res.r);
    setGhost(true);
    window.setTimeout(() => setGhost(false), LOOKUP.ghost);
  };
  const back = () => {
    if (stage === "memo") setStage("amount");
    else if (stage === "amount") setStage("who");
    else navigate(-1);
  };
  const next = () => {
    if (!to) return;
    const last = data.data?.recent.find((r) => r.bank.code === to.bank.code && r.number === to.number)?.lastAt;
    const recent = !!to.accountId || (!!last && Date.now() - Date.parse(last) < SIX_MONTHS);
    const state: NhConfirmState = { from, to, amount, memoTo: (memoTo ?? me).trim(), memoMe: memoMe.trim(), memo: memo.trim(), recent };
    const keep: NhSendRestore = { bankCode, digits, to, amount, memoTo, memoMe, memo };
    // 실제 앱도 여기서 화면이 어두워지고 점 3개가 잠깐 돈다. 막 아래에서: 지금 입력값을 이 기록에 남기고 → 확인 화면으로
    withNhLoading(() => undefined).then(() => {
      navigate(location.pathname + location.search, { replace: true, state: { restore: keep } });
      navigate("/send/confirm", { state });
    });
  };

  return (
    <>
      <div className={`screen nh nh-send nh-send--${stage === "who" || !to ? "who" : stage}`}>
        <NhHeader title="콕송금" onBack={back} tools />
        {stage === "who" || !to ? (
          <NhSendWho
            account={account}
            bank={bank}
            digits={digits}
            busy={busy}
            recipients={data.data}
            listOpen={listOpen}
            onPickBank={() => setPicking(true)}
            onOpenNumber={() => setSheet("number")}
            onClearDigits={() => setDigits("")}
            onToggleList={() => setListOpen((o) => !o)}
            onPickRecipient={(r) => (r.accountId === from ? setError("출금계좌와 같은 계좌로는 보낼 수 없어요.") : pickRecipient(r))}
          />
        ) : (
          <NhSendAmount
            account={account}
            to={to}
            stage={stage}
            amount={amount}
            remaining={data.data?.dailyRemaining ?? 1_000_000}
            memoTo={memoTo ?? me}
            memoMe={memoMe}
            memo={memo}
            detail={detail}
            onMemoTo={setMemoTo}
            onMemoMe={setMemoMe}
            onMemo={setMemo}
            onToggleDetail={() => setDetail((d) => !d)}
            onOpenAmount={openAmount}
            onClearAmount={() => setAmount(0)}
            onLimitInfo={() => setError("1일 송금 잔여한도는 오늘 더 보낼 수 있는 금액이에요.\n이체한도는 전체메뉴 > 한도 조회·변경에서 바꿀 수 있어요.")}
            onPickAgain={() => setStage("who")}
            onAmountNext={() => setStage("memo")}
            onNext={next}
          />
        )}
        {ghost && stage === "amount" && (
          <div className="nh-sa-ghost" aria-hidden>
            <NhRecipientList open data={data.data} onToggle={() => undefined} onPick={() => undefined} appear="static" />
          </div>
        )}

        <Sheet open={sheet === "number"} onClose={closeSheet} className={`nh-number nh-sheet--keypad nh-amt-sheet ${closing === "number" ? "nh-amt-closing" : ""}`} kind="keypad">
          {bank && (
            <NhNumberSheet
              bank={bank}
              digits={digits}
              onChange={setDigits}
              onBank={() => setPicking(true)}
              onClose={closeSheet}
              onDone={lookup}
            />
          )}
        </Sheet>
        <Sheet
          open={sheet === "amount"}
          onClose={closeSheet}
          className={`nh-amount nh-sheet--keypad nh-amt-sheet nh-amt-sheet--open-slow ${closing === "amount" ? "nh-amt-closing" : ""}`}
          kind="keypad"
        >
          {to && account && (
            <NhAmountSheet
              key={`${to.bank.code}-${to.number}-${amountSeq}`}
              initial={amount}
              balance={account.balance}
              remaining={data.data?.dailyRemaining ?? 1_000_000}
              onClose={closeSheet}
              onDone={(n) => {
                // 잔액 부족·한도 초과여도 '다음'은 눌림: 시트만 닫히고 화면 금액 상자 아래에 안내 (녹화1 61.6초)
                setAmount(n);
                closeSheet();
                if (!amountError(n, account.balance, data.data?.dailyRemaining ?? 1_000_000)) setStage("memo");
              }}
            />
          )}
        </Sheet>
        <Dialog message={error} onClose={() => setError(null)} />
      </div>
      {/* 은행선택은 콕송금 위에 덮어 그림 (콕송금은 그대로 남아 뒤에 보임). 고르면 85ms 사라진 뒤 185ms 있다가 계좌번호 시트가 올라옴 */}
      {picking && (
        <NhBankPicker
          banks={banks.data}
          onClose={() => setPicking(false)}
          onPick={(b) => {
            setPicking(false);
            setBankCode(b.code);
            setDigits("");
            window.setTimeout(() => setSheet("number"), 185);
          }}
        />
      )}
    </>
  );
}
