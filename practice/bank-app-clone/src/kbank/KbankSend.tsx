import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { Account, Bank, HomeData, Recipient, TransferRecipients, TransferResult } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { BankIcon } from "../components/BankIcon";
import { KbankHeader } from "./header";
import { KbankKeypad } from "./keypad";
import { kbBackLevel, kbHistoryGo, kbNf, kbPress, kbReadWon, useKbankBackStep } from "./sendback";
import { useKbankStatusBar } from "./theme";
import "./kbank-send.css";

// 완료 화면(/send/done)으로 넘기는 값 (location.state)
export interface KbankDoneState {
  result: TransferResult; // 서버 응답: to(받는 분), amount, balanceAfter …
  from: { id: string; bank: Bank; number: string };
}

// 이체 (녹화 21.5~35초, 프레임 645~1060). 한 화면이 단계로 바뀜:
//   skel    회색 뼈대 (665~676, ≈370ms) — 머리줄 ‹ 도 없음
//   who     어디로 돈을 보낼까요? (677~) — 행을 누르면 받는 분이 정해지고 금액으로
//   amount  ○○(0110) 에서 / ○○ 님에게 · 얼마를 보내시겠어요? · 칩 · 숫자판 · 다음 (726~)
//   confirm K › B · ○○님에게 N원을 보낼까요? · 표시·시간 표 · 보내기 → 확인중 (912~)
// 실제 앱은 보내기 뒤 보안 비밀번호(녹화 35초 검정) → 클론은 건너뛰고 완료(/send/done, '보내는 중이에요'부터)로
type Stage = "skel" | "who" | "amount" | "confirm";
type To = Recipient;

const digitsOf = (s = "") => s.replace(/\D/g, "");
const soon = () => {}; // 기능 없는 버튼: 눌러도 아무 일 없음
const SKEL_MS = 370; // 뼈대 665 → 내용 677 (12프레임)
const PICK_MS = 300; // 행을 떼고 금액 화면이 붙기까지 (녹화 ≈ 0.7초 중 통신 시간을 줄임)
const CHECK_MS = 900; // 보내기 → '··· 확인중' 최소 시간 (녹화 990~1040 은 그 뒤 비밀번호)

// 은행 원 로고: 녹화에 나온 것(카카오뱅크·케이뱅크·농축협·새마을금고)은 녹화에서 잘라 키운 그림(scripts/kbank-crops/send.py), 나머지는 공용 BankIcon
export function KbankBankLogo({ bank, size }: { bank: Pick<Bank, "code" | "name" | "short" | "color"> & Partial<Bank>; size: number }) {
  const src = localAsset(`kbank-bank-${bank.code}`);
  if (src) return <img className="kb-logo" src={src} alt={bank.name} width={size} height={size} draggable={false} />;
  return <BankIcon bank={bank as Bank} size={size} />;
}

export function KbankSend() {
  useKbankStatusBar();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get("from") ?? "main";
  const home = useApi<HomeData>(paths.home);
  const data = useApi<TransferRecipients>(paths.recipients(from));
  const banks = useApi<Bank[]>(paths.banks);
  const account = home.data?.accounts.find((a) => a.id === from);
  const me = home.data?.profile.userName ?? "";
  const ready = !!data.data && !!home.data;

  const [stage, setStage] = useState<Stage>("skel");
  const [seq, setSeq] = useState(0); // 단계 본문을 새로 그릴 때마다 (들어오는 애니메이션 다시)
  const [to, setTo] = useState<To | null>(null);
  const [amount, setAmount] = useState(0);
  const [memoTo, setMemoTo] = useState<string | null>(null); // 받는사람 통장에 표시 (null = 내 이름)
  const [memoMe, setMemoMe] = useState<string | null>(null); // 내 통장에 표시 (null = 받는 분 이름)
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popSeq, setPopSeq] = useState(0);
  const [stars, setStars] = useState<Record<string, boolean>>({}); // ☆ 누른 결과 (서버 반영 전에 바로 보이게)
  // 받는 분 직접 입력
  const [digits, setDigits] = useState("");
  const [typing, setTyping] = useState(false);
  const [bankSheet, setBankSheet] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const busy = useRef(false);
  const leaving = useRef(false);

  // 뼈대는 최소 370ms, 데이터가 오면 내용으로 (한 번에)
  const [skelDone, setSkelDone] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSkelDone(true), SKEL_MS);
    return () => clearTimeout(t);
  }, []);
  if (stage === "skel" && skelDone && ready) setStage("who");

  const toStage = (s: Stage) => {
    setStage(s);
    setSeq((n) => n + 1);
  };
  const choose = (r: To) => {
    if (!to || to.bank.code !== r.bank.code || to.number !== r.number) {
      setMemoTo(null);
      setMemoMe(null);
    }
    setTo(r);
  };
  // 행 → (300ms) → 금액. 받는 분 화면은 한 번에 사라지고 금액 화면이 차례로 페이드 (프레임 726~731)
  const pick = (r: To) => {
    if (busy.current) return;
    busy.current = true;
    window.setTimeout(() => {
      busy.current = false;
      choose(r);
      toStage("amount");
    }, PICK_MS);
  };
  // 직접 입력 → 은행 고르기 → 예금주 조회 → 금액 (녹화에 없음: 가장 단순하게)
  const submitDigits = async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    setLookupError(null);
    try {
      const r = await api.lookupAccount(code, digits);
      choose(r);
      setTyping(false);
      toStage("amount");
    } catch (e) {
      setLookupError(e instanceof ApiError ? e.message : "연결에 실패했어요");
    } finally {
      busy.current = false;
    }
  };
  const toggleStar = (key: string, r: To & { payeeId?: string }, on: boolean) => {
    if (!r.payeeId) return;
    setStars((s) => ({ ...s, [key]: !on }));
    api.updatePayee(r.payeeId, { favorite: !on }).catch(() => setStars((s) => ({ ...s, [key]: on })));
  };

  const over = !!account && amount > account.balance;
  const next = () => {
    if (busy.current || !to || !account || amount <= 0 || over) return;
    toStage("confirm");
  };

  // 보내기 → '··· 확인중' → (비밀번호 생략) → 완료 화면으로 바꿈 (기록에서 이체 화면 자리를 완료로)
  const send = async () => {
    if (sending || !to || !account) return;
    setSending(true);
    try {
      const [result] = await Promise.all([
        api.transfer({
          fromAccountId: account.id,
          bankCode: to.bank.code,
          number: to.number,
          amount,
          memoTo: (memoTo ?? me).trim(),
          memoMe: (memoMe ?? to.holder).trim(),
        }),
        new Promise((r) => setTimeout(r, CHECK_MS)),
      ]);
      const state: KbankDoneState = { result, from: { id: account.id, bank: account.bank, number: account.number ?? "" } };
      leaving.current = true;
      await kbHistoryGo(-kbBackLevel()); // 단계마다 쌓은 뒤로가기 칸을 먼저 걷음
      navigate("/send/done", { replace: true, state });
    } catch (e) {
      setSending(false);
      setError(e instanceof ApiError ? e.message : "연결에 실패했어요. 잠시 후 다시 시도해 주세요");
    }
  };

  const stepBack = () => {
    if (sending) return;
    setError(null);
    if (stage === "confirm") toStage("amount");
    else if (stage === "amount") toStage("who");
  };
  useKbankBackStep(
    stage === "amount" || stage === "confirm",
    () => {
      if (leaving.current) return;
      setPopSeq((n) => n + 1);
      stepBack();
    },
    popSeq,
  );
  useKbankBackStep(bankSheet, () => setBankSheet(false));
  // ‹ : 받는 분 화면이면 이체를 나감, 아니면 한 단계 뒤로
  const headerBack = () => {
    if (stage === "who" || stage === "skel") navigate(-1);
    else stepBack();
  };
  // 취소: 이체를 나감 (쌓아 둔 뒤로가기 칸 + 이체 화면 한 칸)
  const cancel = () => {
    if (sending) return;
    leaving.current = true;
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) window.history.go(-(kbBackLevel() + 1));
    else navigate("/", { replace: true });
  };

  return (
    <div className="kb kbs">
      {stage === "skel" ? (
        <Skeleton />
      ) : (
        <KbankHeader
          className="kbs-head"
          onBack={headerBack}
          right={
            stage !== "who" ? (
              <button className="kbs-cancel" onClick={cancel}>
                취소
              </button>
            ) : undefined
          }
        />
      )}
      {stage === "who" && data.data && (
        <Who
          data={data.data}
          stars={stars}
          onStar={toggleStar}
          onPick={pick}
          digits={digits}
          typing={typing}
          onType={() => setTyping(true)}
          onDigits={(d) => {
            setDigits(d);
            setLookupError(null);
          }}
          lookupError={lookupError}
        />
      )}
      {stage === "who" && typing && digits.length >= 6 && (
        <div className="kbs-bottom">
          <button className="kbs-btn" onClick={() => setBankSheet(true)}>
            다음
          </button>
        </div>
      )}
      {stage === "who" && bankSheet && (
        <BankSheet
          banks={banks.data ?? []}
          onClose={() => setBankSheet(false)}
          onPick={(code) => {
            setBankSheet(false);
            void submitDigits(code);
          }}
        />
      )}
      {stage === "amount" && to && account && (
        <div key={`amount-${seq}`} className="kbs-stage kbs-amount">
          <Amount account={account} to={to} amount={amount} onClear={() => setAmount(0)} />
          <KbankKeypad onKey={(k) => setAmount((a) => kbPress(a, k))} onChip={(add) => setAmount((a) => Math.min(add === null ? account.balance : a + add, 99_999_999_999))} />
          <div className="kbs-bottom kbs-fade kbs-fade--3">
            <button className="kbs-btn" disabled={amount <= 0 || over} onClick={next}>
              다음
            </button>
          </div>
        </div>
      )}
      {stage === "confirm" && to && account && (
        <div key={`confirm-${seq}`} className="kbs-stage">
          <Confirm
            account={account}
            to={to}
            amount={amount}
            memoTo={memoTo ?? me}
            memoMe={memoMe ?? to.holder}
            onMemoTo={(v) => setMemoTo(v.trim() || null)}
            onMemoMe={(v) => setMemoMe(v.trim() || null)}
          />
          {error && <p className="kbs-error">{error}</p>}
          <div className="kbs-bottom">
            <button className={`kbs-btn ${sending ? "kbs-btn--check" : ""}`} onClick={send}>
              {sending ? <Checking /> : "보내기"}
            </button>
          </div>
        </div>
      )}
      {(data.status === "error" || home.status === "error") && (
        <div className="kbs-fail">
          <p>정보를 불러오지 못했어요</p>
          <button
            onClick={() => {
              data.retry();
              home.retry();
            }}
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}

// '··· 확인중' (프레임 990~1040): 점 셋이 차례로 밝아짐
export function Checking() {
  return (
    <span className="kbs-checking">
      <i />
      <i />
      <i />
      <span>확인중</span>
    </span>
  );
}

// ---------- 뼈대 (프레임 670) ----------
function Skeleton() {
  const row = (top: number) => (
    <>
      <i className="kbs-sk kbs-sk--dot" style={{ top: top + 9 }} />
      <i className="kbs-sk kbs-sk--l1" style={{ top }} />
      <i className="kbs-sk kbs-sk--l2" style={{ top: top + 28.6 }} />
    </>
  );
  return (
    <div className="kbs-skel" aria-busy>
      <i className="kbs-sk kbs-sk--title" />
      <i className="kbs-sk kbs-sk--seg" />
      <i className="kbs-sk kbs-sk--input" />
      <i className="kbs-sk kbs-sk--sec" style={{ top: 293.3 }} />
      <i className="kbs-sk kbs-sk--secr" style={{ top: 293.3 }} />
      {row(348.6)}
      {row(433.2)}
      <i className="kbs-sk kbs-sk--sec" style={{ top: 525.6 }} />
      <i className="kbs-sk kbs-sk--secr" style={{ top: 525.6 }} />
      {row(581.6)}
      {row(665.6)}
    </div>
  );
}

// ---------- 어디로 돈을 보낼까요? (프레임 700) ----------
type Row = { key: string; r: To & { payeeId?: string; favorite?: boolean }; name: string };
function Who({
  data,
  stars,
  onStar,
  onPick,
  digits,
  typing,
  onType,
  onDigits,
  lookupError,
}: {
  data: TransferRecipients;
  stars: Record<string, boolean>;
  onStar: (key: string, r: Row["r"], on: boolean) => void;
  onPick: (r: To) => void;
  digits: string;
  typing: boolean;
  onType: () => void;
  onDigits: (d: string) => void;
  lookupError: string | null;
}) {
  const [pressed, setPressed] = useState<string | null>(null);
  const mine: Row[] = data.mine
    .filter((m) => m.number)
    .map((m) => ({ key: `m-${m.accountId}`, r: { bank: m.bank, number: digitsOf(m.number), holder: m.holder, accountId: m.accountId }, name: m.label }));
  const recent: Row[] = data.recent.map((r) => ({ key: `r-${r.bank.code}-${r.number}`, r, name: r.holder }));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (typing) input.current?.focus();
  }, [typing]);
  return (
    <>
      <div className="kbs-body">
        <div className="kbs-who" style={{ height: 511.2 + 78.1 * (recent.length + mine.length) + 60 - 56 }}>
          <h2 className="kbs-t kbs-who__title">어디로 돈을 보낼까요?</h2>
          <div className="kbs-seg" role="tablist">
            <button role="tab" aria-selected className="on">
              계좌번호
            </button>
            <button role="tab" aria-selected={false} onClick={soon}>
              휴대폰번호
            </button>
          </div>
          <label className={`kbs-acct ${typing ? "kbs-acct--on" : ""}`} onClick={onType}>
            {typing ? (
              <input
                ref={input}
                className="kbs-acct__input"
                value={digits}
                inputMode="numeric"
                autoComplete="off"
                placeholder="계좌번호 입력"
                aria-label="계좌번호"
                onChange={(e) => onDigits(digitsOf(e.target.value).slice(0, 16))}
              />
            ) : (
              <span className="kbs-acct__ph">계좌번호 입력</span>
            )}
          </label>
          {lookupError && <p className="kbs-acct__err">{lookupError}</p>}
          <h3 className="kbs-t kbs-sec kbs-sec--mine">내 계좌</h3>
          {mine.map((row, i) => (
            <WhoRow key={row.key} row={row} top={375.9 - 56 + 78.1 * i - 39.05} pressed={pressed === row.key} onPress={setPressed} onPick={onPick} />
          ))}
          <button className="kbs-other" style={{ top: 375.9 - 56 + 78.1 * mine.length - 16.25 }} onClick={soon}>
            <i className="kbs-other__plus">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M7 0.8v12.4M0.8 7h12.4" stroke="#6d7583" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </i>
            <span>다른 은행 계좌 불러오기</span>
          </button>
          <div className="kbs-recent" style={{ top: 78.1 * mine.length }}>
            <h3 className="kbs-t kbs-sec kbs-sec--recent">최근 보낸 계좌</h3>
            <button className="kbs-edit" onClick={soon}>
              편집하기
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M1.2 10.8 1.6 8.3 8.2 1.7a1 1 0 0 1 1.4 0l.7.7a1 1 0 0 1 0 1.4L3.7 10.4Z" fill="#0312a0" />
              </svg>
            </button>
            {recent.map((row, i) => {
              const on = stars[row.key] ?? !!row.r.favorite;
              return (
                <WhoRow
                  key={row.key}
                  row={row}
                  top={511.2 - 56 + 78.1 * i - 39.05}
                  pressed={pressed === row.key}
                  onPress={setPressed}
                  onPick={onPick}
                  star={
                    <button
                      className={`kbs-star ${on ? "kbs-star--on" : ""}`}
                      aria-label="즐겨찾기"
                      aria-pressed={on}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStar(row.key, row.r, on);
                      }}
                    >
                      <svg width="22" height="21" viewBox="0 0 22 21" aria-hidden>
                        <path
                          d="M11 1.3l2.85 5.9 6.45.85-4.7 4.5 1.2 6.4L11 15.85 5.2 18.95l1.2-6.4-4.7-4.5 6.45-.85Z"
                          fill={on ? "#ffc61a" : "none"}
                          stroke={on ? "#ffc61a" : "#878c96"}
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
      {/* 떠 있는 '이체를 도와주러 온 AI' 알약 (무반응) */}
      <button className="kbs-ai" onClick={soon}>
        {localAsset("kbank-send-ai") && <img src={localAsset("kbank-send-ai")} alt="" draggable={false} />}
        <span>이체를 도와주러 온 AI</span>
      </button>
    </>
  );
}

// 행: 로고 원 36.4 · 이름 · '은행 번호' · ☆. 피치 78.1
function WhoRow({
  row,
  top,
  pressed,
  onPress,
  onPick,
  star,
}: {
  row: Row;
  top: number;
  pressed: boolean;
  onPress: (k: string | null) => void;
  onPick: (r: To) => void;
  star?: ReactNode;
}) {
  return (
    <div
      className={`kbs-row ${pressed ? "kbs-row--on" : ""}`}
      style={{ top }}
      role="button"
      tabIndex={0}
      onPointerDown={() => onPress(row.key)}
      onPointerUp={() => onPress(null)}
      onPointerLeave={() => onPress(null)}
      onClick={() => onPick(row.r)}
      onKeyDown={(e) => e.key === "Enter" && onPick(row.r)}
    >
      <span className="kbs-row__logo">
        <KbankBankLogo bank={row.r.bank} size={36.4} />
      </span>
      <b className="kbs-row__name">{row.name}</b>
      <span className="kbs-row__acct">{`${row.r.bank.name} ${row.r.number}`}</span>
      {star}
    </div>
  );
}

// ---------- 금액 (프레임 760 · 860) ----------
function Amount({ account, to, amount, onClear }: { account: Account; to: To; amount: number; onClear: () => void }) {
  const last4 = digitsOf(account.number).slice(-4);
  return (
    <div className="kbs-amt">
      <p className="kbs-amt__line kbs-amt__line--from kbs-fade">
        <KbankBankLogo bank={account.bank} size={20.8} />
        <b>{`${account.bank.name}(${last4})`}</b> 에서
      </p>
      <p className="kbs-amt__line kbs-amt__line--to kbs-fade kbs-fade--1">
        <KbankBankLogo bank={to.bank} size={20.8} />
        <b>{`${to.bank.name} ${to.holder}`}</b> 님에게
      </p>
      <div className="kbs-amt__field kbs-fade kbs-fade--2">
        {amount > 0 ? (
          <>
            <span className="kbs-amt__value">
              {kbNf.format(amount)}
              <i className="kbs-caret" />원
            </span>
            <button className="kbs-amt__clear" onClick={onClear} aria-label="지우기">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <circle cx="8" cy="8" r="8" fill="#69727f" />
                <path d="M5.4 5.4l5.2 5.2M10.6 5.4l-5.2 5.2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <i className="kbs-caret kbs-caret--ph" />
            <span className="kbs-amt__ph">얼마를 보내시겠어요?</span>
          </>
        )}
      </div>
      <p className="kbs-amt__avail kbs-fade kbs-fade--2">
        <span>{amount > 0 ? kbReadWon(amount) : "출금 가능금액"}</span>
        <i className="kbs-amt__sep" />
        <u>{kbNf.format(account.balance)}원</u>
      </p>
    </div>
  );
}

// ---------- 확인 (프레임 950) ----------
function Confirm({
  account,
  to,
  amount,
  memoTo,
  memoMe,
  onMemoTo,
  onMemoMe,
}: {
  account: Account;
  to: To;
  amount: number;
  memoTo: string;
  memoMe: string;
  onMemoTo: (v: string) => void;
  onMemoMe: (v: string) => void;
}) {
  return (
    <div className="kbs-cf">
      <KbankPair from={account.bank} to={to.bank} className="kbs-cfin" />
      <h2 className="kbs-big kbs-big--1 kbs-cfin kbs-cfin--1">
        <em>{to.holder}</em>님에게
      </h2>
      <h2 className="kbs-big kbs-big--2 kbs-cfin">{kbNf.format(amount)}원을</h2>
      <h2 className="kbs-big kbs-big--3 kbs-cfin kbs-cfin--1">보낼까요?</h2>
      <p className="kbs-sub kbs-cfin kbs-cfin--2">{`${to.bank.name} ${to.number}로 보내요`}</p>
      <div className="kbs-table kbs-cfup">
        <MemoRow label="받는사람 통장에 표시" value={memoTo} onSave={onMemoTo} />
        <MemoRow label="내 통장에 표시" value={memoMe} onSave={onMemoMe} />
        <div className="kbs-table__row">
          <span>보낼 시간</span>
          <button className="kbs-table__val" onClick={soon}>
            바로 보낼게요
            <Pencil />
          </button>
        </div>
      </div>
      <button className="kbs-addon kbs-cfup kbs-cfup--1" onClick={soon}>
        부가기능 설정
        <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden>
          <path d="M1.3 1.2 6.6 6.5l-5.3 5.3" fill="none" stroke="#292929" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// K › B (확인) — 완료 화면은 › 대신 ›››
export function KbankPair({ from, to, className = "", moving = false }: { from: Bank; to: Bank; className?: string; moving?: boolean }) {
  return (
    <div className={`kbs-pair ${className}`}>
      <KbankBankLogo bank={from} size={48.8} />
      {moving ? (
        <span className="kbs-pair__run" aria-hidden>
          {[0, 1, 2].map((i) => (
            <svg key={i} width="7" height="12" viewBox="0 0 7 12">
              <path d="M1.2 1.2 5.6 6l-4.4 4.8" fill="none" stroke="#4862f7" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ))}
        </span>
      ) : (
        <svg className="kbs-pair__gt" width="9" height="14" viewBox="0 0 9 14" aria-hidden>
          <path d="M1.8 1.6 7 7l-5.2 5.4" fill="none" stroke="#4862f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <KbankBankLogo bank={to} size={48.8} />
    </div>
  );
}

function Pencil() {
  // ✎ : 잉크 x 326.1~341.7 · 15.6 × 15.6 (프레임 950)
  return (
    <svg className="kbs-pen" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M1 15l.6-3.6L10.9 2.1a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L4.6 14.4Z" fill="#2a2d33" />
    </svg>
  );
}

// 표시 이름: ✎ 를 누르면 그 자리에서 고침 (녹화에 없음 — 가장 단순하게)
function MemoRow({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  return (
    <div className="kbs-table__row">
      <span>{label}</span>
      {edit === null ? (
        <button className="kbs-table__val" onClick={() => setEdit(value)}>
          {value}
          <Pencil />
        </button>
      ) : (
        <input
          className="kbs-table__input"
          autoFocus
          value={edit}
          maxLength={10}
          onChange={(e) => setEdit(e.target.value)}
          onBlur={() => {
            onSave(edit);
            setEdit(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      )}
    </div>
  );
}

// ---------- 은행 고르기 (녹화에 없음: 아래 시트에 목록만) ----------
function BankSheet({ banks, onClose, onPick }: { banks: Bank[]; onClose: () => void; onPick: (code: string) => void }) {
  return (
    <div className="kbs-sheet" onClick={onClose}>
      <div className="kbs-sheet__in" onClick={(e) => e.stopPropagation()}>
        <h2 className="kbs-sheet__title">은행 선택</h2>
        <div className="kbs-sheet__grid">
          {banks
            .filter((b) => b.section === "bank")
            .map((b) => (
              <button key={b.code} onClick={() => onPick(b.code)}>
                <KbankBankLogo bank={b} size={32} />
                <span>{b.short}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
