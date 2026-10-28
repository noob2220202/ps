import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { accountLine, api, paths } from "../../api/endpoints";
import type { Account, HomeData } from "../../api/types";
import { useApi } from "../../api/useApi";
import { BankIcon } from "../../components/BankIcon";
import { ArcSpinner } from "../../components/art";
import { BackButton } from "../../components/NavButtons";
import { Dialog, Keypad, Sheet } from "../../components/Sheet";
import { applyKey } from "../../lib/keypad";
import { Icon } from "../../components/icons/Icon";
import { useStatusBar } from "../../hooks/useStatusBar";
import { won } from "../../lib/format";
import { ClearIcon, type AmountState } from "./TransferScreen";
import type { DoneState } from "./TransferDoneScreen";
import "./Transfer.css";

const nf = new Intl.NumberFormat("ko-KR");
const QUICK: [string, number][] = [
  ["+1만", 10_000],
  ["+5만", 50_000],
  ["+10만", 100_000],
];

// "홍길동의 통장 (0000) : 0원" — 계좌번호 끝 4자리
const sourceText = (a: Account) => `${a.label} (${(a.number ?? "").replace(/\D/g, "").slice(-4)}) : ${won(a.balance)}`;

type SheetName = "from" | "memoTo" | "memoMe" | "confirm" | null;

// 금액 입력 → (다음) 표기 입력 → (다음) 확인 시트 → 이체하기 → 완료 화면
export function AmountScreen() {
  const navigate = useNavigate();
  const state = useLocation().state as AmountState | null;
  const home = useApi<HomeData>(paths.home);

  const [fromId, setFromId] = useState(state?.from ?? "main");
  const [digits, setDigits] = useState("");
  const [step, setStep] = useState<"amount" | "memo">("amount");
  const [memoTo, setMemoTo] = useState<string | null>(null); // null = 기본값(내 이름)
  const [memoMe, setMemoMe] = useState("");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useStatusBar(sheet ? "#808080" : "#ffffff", "dark");

  // 새로고침 등으로 받는 분 정보가 없으면 홈으로
  useEffect(() => {
    if (!state) navigate("/", { replace: true });
  }, [state, navigate]);
  if (!state) return null;
  const { to } = state;

  const accounts = home.data?.accounts.filter((a) => a.id !== to.accountId) ?? [];
  const from = accounts.find((a) => a.id === fromId);
  const amount = Number(digits || 0);
  const over = !!from && amount > from.balance;
  const myName = home.data?.profile.userName ?? "";
  const memoToText = memoTo ?? myName;

  const send = async () => {
    setSheet(null);
    setSending(true);
    try {
      // 영상에선 인증 화면(녹화 차단됨) 뒤 잠깐 스피너 → 완료. 너무 빨리 끝나면 어색해서 최소 0.8초
      const [result] = await Promise.all([
        api.transfer({ fromAccountId: fromId, bankCode: to.bank.code, number: to.number, amount, memoTo: memoToText, memoMe: memoMe || undefined }),
        new Promise((r) => setTimeout(r, 800)),
      ]);
      navigate("/transfer/done", { replace: true, state: { result } satisfies DoneState });
    } catch (e) {
      setSending(false);
      setError(e instanceof ApiError ? e.message : "연결에 실패했어요");
    }
  };

  return (
    <div className="screen amount">
      <header className="amount__header">
        <BackButton onClick={() => navigate(-1)} />
        <div className="amount__to">
          <strong>
            {to.holder}
            <svg className="amount__tri" width="9" height="6" viewBox="0 0 9 6" aria-hidden>
              <path d="M0 0h9L4.5 6Z" fill="currentColor" />
            </svg>
          </strong>
          <small>{accountLine(to.bank, to.number)}</small>
        </div>
        <button className="amount__cancel" onClick={() => navigate(-2)}>
          취소
        </button>
      </header>

      <div className="amount__main" onClick={() => setStep("amount")}>
        {amount ? (
          <strong className="amount__value">
            {nf.format(amount)}
            {step === "amount" && <i className="caret caret--big" />}원
          </strong>
        ) : (
          <strong className="amount__value amount__value--empty">보낼금액</strong>
        )}
        {/* 안내 줄은 비어 있어도 자리를 차지 → 금액이 위아래로 움직이지 않게 */}
        <p className={`amount__hint ${over ? "amount__hint--error" : ""}`}>
          {over ? `출금 가능 금액(${won(from!.balance)})을 넘었어요` : "\u00a0"}
        </p>
      </div>

      <div className="amount__bottom">
        <button className="amount__source" onClick={() => setSheet("from")} disabled={sending}>
          <span>{from ? sourceText(from) : " "}</span>
          <Icon name="chevron-down" size={18} stroke={1.5} />
        </button>

        {step === "amount" ? (
          <>
            <div className="amount__quick">
              {QUICK.map(([label, add]) => (
                <button key={label} onClick={() => setDigits(String(Math.min(amount + add, 999_999_999)))}>
                  {label}
                </button>
              ))}
              <button onClick={() => from && setDigits(from.balance ? String(from.balance) : "")}>전액</button>
            </div>
            <Keypad doubleZero rowHeight={61} onKey={(k) => setDigits((d) => applyKey(d, k, 9))} />
          </>
        ) : (
          <div className="amount__memos fade-in">
            <button className="memo-row" onClick={() => setSheet("memoTo")}>
              <span>
                받는 분에게 표기 <QuestionIcon />
              </span>
              <em>{memoToText}</em>
            </button>
            <button className="memo-row" onClick={() => setSheet("memoMe")}>
              <span>나에게 표기</span>
              <em className={memoMe ? "" : "memo-row__placeholder"}>{memoMe || "미입력시 수취인명"}</em>
            </button>
          </div>
        )}

        <button
          className="cta amount__next"
          disabled={!amount || over || sending}
          onClick={() => (step === "amount" ? setStep("memo") : setSheet("confirm"))}
        >
          다음
        </button>
      </div>

      {sending && (
        <div className="amount__sending">
          <ArcSpinner size={30} color="#9a9a9a" />
        </div>
      )}

      {/* 보내는 계좌 고르기 */}
      <Sheet open={sheet === "from"} onClose={() => setSheet(null)}>
        <h2 className="pick-sheet__title">출금계좌</h2>
        <div className="pick-sheet__list">
          {accounts.map((a) => (
            <button
              key={a.id}
              className={`pick-sheet__row ${a.id === fromId ? "on" : ""}`}
              onClick={() => {
                setFromId(a.id);
                setSheet(null);
              }}
            >
              <BankIcon bank={a.bank} size={34} />
              <span>
                <strong>{a.label}</strong>
                <small>{won(a.balance)}</small>
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <MemoSheet
        open={sheet === "memoTo"}
        title="받는 분에게 표기"
        initial={memoToText}
        onDone={(v) => {
          setMemoTo(v);
          setSheet(null);
        }}
      />
      <MemoSheet
        open={sheet === "memoMe"}
        title="나에게 표기"
        placeholder="미입력시 수취인명"
        initial={memoMe}
        onDone={(v) => {
          setMemoMe(v);
          setSheet(null);
        }}
      />

      <Sheet open={sheet === "confirm"} onClose={() => setSheet(null)}>
        <div className="confirm-sheet">
          <BankIcon bank={to.bank} size={42} />
          <h2>
            {to.holder}님에게 {won(amount)}
            <br />
            이체하시겠습니까?
          </h2>
          <p>받는계좌 : {accountLine(to.bank, to.number)}</p>
          <div className="confirm-sheet__buttons">
            <button className="cta cta--gray" onClick={() => setSheet(null)}>
              취소
            </button>
            <button className="cta" onClick={send}>
              이체하기
            </button>
          </div>
        </div>
      </Sheet>

      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}

// 표기 입력 시트: 열릴 때마다 현재 값으로 시작하도록 key로 다시 만든다
function MemoSheet(props: { open: boolean; title: string; placeholder?: string; initial: string; onDone: (v: string) => void }) {
  return (
    <Sheet open={props.open} onClose={() => props.onDone(props.initial)}>
      {props.open && <MemoForm {...props} />}
    </Sheet>
  );
}

function MemoForm({ title, placeholder, initial, onDone }: { title: string; placeholder?: string; initial: string; onDone: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  // 시트가 올라오는 중에 포커스하면 키보드 때문에 화면이 튐 → 애니메이션 끝난 뒤
  useEffect(() => {
    const id = setTimeout(() => input.current?.focus(), 320);
    return () => clearTimeout(id);
  }, []);
  return (
    <form
      className="memo-sheet"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(value.trim());
      }}
    >
      <button className="memo-sheet__ok">확인</button>
      <label>
        <span className="memo-sheet__title">{title}</span>
        <span className="memo-sheet__input">
          <input ref={input} value={value} maxLength={20} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
          {value && (
            <button type="button" aria-label="지우기" onClick={() => setValue("")}>
              <ClearIcon />
            </button>
          )}
        </span>
      </label>
      <span className="memo-sheet__count">{value.length} / 20</span>
    </form>
  );
}

function QuestionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#777" strokeWidth="1.2" aria-hidden>
      <circle cx="8" cy="8" r="7" />
      <path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.3" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r=".5" fill="#777" />
    </svg>
  );
}
