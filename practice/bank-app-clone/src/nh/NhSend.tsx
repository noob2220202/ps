import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { Account, Bank, HomeData, Recipient, TransferRecipients } from "../api/types";
import { useApi } from "../api/useApi";
import { Icon } from "../components/icons/Icon";
import { Dialog, Keypad, Sheet } from "../components/Sheet";
import { useStatusBar } from "../hooks/useStatusBar";
import { applyKey } from "../lib/keypad";
import { nhAccountLine, nhBankList, nhNumber } from "./banks";
import { BackArrowKey, ClearDot, EditRow, NhAccountIcon, NhBankIcon, NhDots, NhHeader, QuickSendIcon } from "./common";
import { withNhLoading } from "./loading";
import { hangulAmount, nhWon } from "./hangul";

export interface NhConfirmState {
  from: string;
  to: Recipient;
  amount: number;
  memoTo: string;
  memoMe: string;
  recent: boolean; // 최근 6개월 안에 보낸 적 있는 분 (없으면 확인 시트가 한 번 더 뜸)
}

const SIX_MONTHS = 183 * 24 * 3600 * 1000;

// 콕송금 (녹화2 0~25초). 한 화면이 단계별로 바뀜:
//   who    "누구에게 보낼까요?" 은행·계좌번호 (계좌번호 시트) / 아래 최근송금 목록
//   amount "얼마를 보낼까요?" (금액 시트)
//   memo   "1원을 보낼게요" 받는계좌·내계좌 표시 → [다음] → 확인 화면
export function NhSend() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get("from") ?? "main";
  const home = useApi<HomeData>(paths.home);
  const data = useApi<TransferRecipients>(paths.recipients(from));
  const banks = useApi<Bank[]>(paths.banks);
  const account = home.data?.accounts.find((a) => a.id === from);
  const me = home.data?.profile.userName ?? "";

  // 거래 상세의 '동일내역 송금'은 ?bank=…&number=… 로 은행·계좌번호를 채워서 옴
  const [bankCode, setBankCode] = useState(params.get("bank") ?? "nh");
  const [digits, setDigits] = useState(params.get("number") ?? "");
  const [stage, setStage] = useState<"who" | "amount" | "memo">("who");
  const [sheet, setSheet] = useState<"number" | "amount" | null>(null);
  const [picking, setPicking] = useState(false); // 은행선택 화면
  const [listOpen, setListOpen] = useState(false); // 최근송금 목록을 위로 끌어올림
  const [busy, setBusy] = useState(false); // 점 3개
  const [to, setTo] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState(0);
  const [memoTo, setMemoTo] = useState<string | null>(null); // null = 기본값(내 이름)
  const [memoMe, setMemoMe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bank = banks.data?.find((b) => b.code === bankCode) ?? null;
  useStatusBar(sheet ? "#0b0b0e" : "#18171c", "light");

  const pickRecipient = (r: Recipient) => {
    setTo(r);
    setListOpen(false);
    setStage("amount");
    setSheet("amount");
  };
  const lookup = async () => {
    if (!bank) return;
    setSheet(null);
    setBusy(true);
    try {
      pickRecipient(await api.lookupAccount(bank.code, digits));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? "입력하신 계좌정보를 확인해 주세요.\n\n(연습용 앱: 🔔 관리 → 받는 분 탭에서\n먼저 등록한 계좌만 보낼 수 있어요)"
          : e instanceof ApiError
            ? e.message
            : "연결에 실패했어요",
      );
    } finally {
      setBusy(false);
    }
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
    const state: NhConfirmState = { from, to, amount, memoTo: (memoTo ?? me).trim(), memoMe: memoMe.trim(), recent };
    // 실제 앱도 여기서 화면이 어두워지고 점 3개가 잠깐 돈다
    withNhLoading(() => undefined).then(() => navigate("/send/confirm", { state }));
  };

  if (picking && banks.data)
    return (
      <NhBankPicker
        banks={banks.data}
        onClose={() => setPicking(false)}
        onPick={(b) => {
          setBankCode(b.code);
          setDigits("");
          setPicking(false);
          setSheet("number");
        }}
      />
    );

  return (
    <div className="screen nh nh-send">
      <NhHeader title="콕송금" onBack={back} />
      {stage === "who" || !to ? (
        <>
          <FromAccount account={account} />
          <span className="nh-send__chev">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 5 6 6 6-6M6 12l6 6 6-6" />
            </svg>
          </span>
          <h2 className="nh-send__who">누구에게 보낼까요?</h2>
          <div className="nh-seg nh-seg--box">
            <button className="on">계좌</button>
            <button>휴대전화</button>
          </div>
          <button className="nh-send__bank" onClick={() => setPicking(true)}>
            {bank ? (nhBankList([bank], bank.section)[0]?.label ?? bank.name) : " "} <Icon name="chevron-down" size={18} stroke={2} />
          </button>
          <div className={`nh-send__number ${digits ? "filled" : ""}`}>
            <button onClick={() => setSheet("number")}>{digits || "계좌번호 입력"}</button>
            {busy && <NhDots size={7} />}
            {digits && !busy && (
              <button aria-label="지우기" onClick={() => setDigits("")}>
                <ClearDot />
              </button>
            )}
          </div>
          <button className="nh-send__quick">
            <QuickSendIcon /> 빠른송금
          </button>
          <RecipientList
            open={listOpen}
            onToggle={() => setListOpen((o) => !o)}
            data={data.data}
            onPick={(r) => (r.accountId === from ? setError("출금계좌와 같은 계좌로는 보낼 수 없어요.") : pickRecipient(r))}
          />
        </>
      ) : (
        <>
          <div className="nh-send__mini">
            <span>
              <small>농축협 {account?.number}</small>
              <b>{account && nhWon(account.balance)}</b>
            </span>
            <Icon name="chevron-down" size={18} stroke={2} />
          </div>
          <div className="nh-send__to">
            <p>
              <u>{to.holder}</u>님에게
            </p>
            {stage === "memo" && (
              <p>
                <u>{nhWon(amount)}</u>을 보낼게요
              </p>
            )}
            <small>
              {to.bank.name}
              {to.number}
            </small>
          </div>
          {stage === "amount" ? (
            <>
              <h2 className="nh-send__how">얼마를 보낼까요?</h2>
              <button className="nh-send__amount-box" onClick={() => setSheet("amount")}>
                {amount ? nhWon(amount) : <i>금액 입력</i>}
              </button>
              <div className="nh-send__limit">
                <span>
                  1일 송금 잔여한도 <i className="nh-q">?</i>
                </span>
                <b>{nhWon(data.data?.dailyRemaining ?? 1_000_000)}</b>
              </div>
            </>
          ) : (
            <>
              <div className="nh-box nh-send__memo">
                <EditRow label="받는계좌에 표시" value={memoTo ?? me} placeholder="" onChange={setMemoTo} />
                <EditRow label="내계좌에 표시" value={memoMe} placeholder="받는분 이름 표시" onChange={setMemoMe} />
              </div>
              <p className="nh-send__more">
                상세 정보 <Icon name="chevron-down" size={14} stroke={2} />
              </p>
              <div className="nh-bottom">
                <button className="nh-btn" onClick={next}>
                  다음
                </button>
              </div>
            </>
          )}
        </>
      )}

      <Sheet open={sheet === "number"} onClose={() => setSheet(null)} className="nh-number">
        {bank && (
          <NumberSheet
            bank={bank}
            digits={digits}
            onChange={setDigits}
            onBank={() => {
              setSheet(null);
              setPicking(true);
            }}
            onClose={() => setSheet(null)}
            onDone={lookup}
          />
        )}
      </Sheet>
      <Sheet open={sheet === "amount"} onClose={() => setSheet(null)} className="nh-amount">
        {to && account && (
          <AmountSheet
            key={`${to.bank.code}-${to.number}`}
            balance={account.balance}
            remaining={data.data?.dailyRemaining ?? 1_000_000}
            onClose={() => setSheet(null)}
            onDone={(n) => {
              setAmount(n);
              setSheet(null);
              setStage("memo");
            }}
          />
        )}
      </Sheet>
      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}

function FromAccount({ account }: { account?: Account }) {
  return (
    <div className="nh-send__from">
      <NhAccountIcon size={22} plain />
      <span className="nh-send__from-text">
        <b>{account?.label ?? " "}</b>
        <small>농축협 {account?.number}</small>
      </span>
      <Icon name="chevron-down" size={18} stroke={2} />
      <span className="nh-send__from-balance">{account ? nhWon(account.balance) : ""}</span>
    </div>
  );
}

// ---------- 최근송금 / 내계좌 / 자주쓰는 (아래에 깔린 시트, 손잡이 누르면 위로) ----------
function RecipientList({
  open,
  onToggle,
  data,
  onPick,
}: {
  open: boolean;
  onToggle: () => void;
  data?: TransferRecipients;
  onPick: (r: Recipient) => void;
}) {
  const [tab, setTab] = useState<"recent" | "mine" | "fav">("recent");
  // line: 이름 아래 줄. 내계좌 탭은 "농축협 352-…" + 오른쪽 잔액
  const rows: (Recipient & { at?: string; line?: string; balance?: number })[] =
    tab === "recent"
      ? (data?.recent ?? []).map((r) => ({ ...r, at: r.lastAt.replace("T", " ").replaceAll("-", ".") }))
      : tab === "mine"
        ? (data?.mine ?? []).map((m) => ({
            bank: m.bank,
            number: (m.number ?? "").replace(/\D/g, ""),
            holder: m.label,
            accountId: m.accountId,
            line: `농축협 ${nhNumber(m.number ?? "")}`,
            balance: m.balance,
          }))
        : (data?.favorites ?? []);
  return (
    <section className={`nh-rlist ${open ? "open" : ""}`}>
      <button className="nh-rlist__handle" aria-label={open ? "내리기" : "올리기"} onClick={onToggle} />
      <div className="nh-rlist__tabs">
        {(
          [
            ["recent", "최근송금"],
            ["mine", "내계좌"],
            ["fav", "자주쓰는"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="nh-rlist__tools">
        <Icon name="search" size={21} stroke={1.9} />
        {tab === "recent" ? (
          <TrashIcon />
        ) : (
          <span className="nh-rlist__reg">
            <Icon name="plus" size={13} stroke={2} /> 등록
          </span>
        )}
      </div>
      <div className="nh-rlist__rows">
        {rows.map((r) => (
          <div key={`${r.bank.code}-${r.number}`} className="nh-rlist__row" onClick={() => onPick(r)}>
            {r.accountId ? <NhAccountIcon size={36} plain /> : <NhBankIcon bank={r.bank} size={36} />}
            <span className="nh-rlist__text">
              <b>{r.holder}</b>
              <small>{r.line ?? nhAccountLine(r.bank, r.number)}</small>
              {r.at && <small>{r.at}</small>}
            </span>
            {r.balance !== undefined ? (
              <em className="nh-rlist__bal">{nhWon(r.balance)}</em>
            ) : (
              <button className="nh-rlist__plus" aria-label="자주쓰는계좌로 추가" onClick={(e) => e.stopPropagation()}>
                <Icon name="plus" size={14} stroke={2.4} />
              </button>
            )}
          </div>
        ))}
        {data && !rows.length && <p className="nh-empty">{tab === "fav" ? "자주쓰는 계좌가 없어요." : "내역이 없어요."}</p>}
      </div>
    </section>
  );
}

function TrashIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6m4-6v6" />
    </svg>
  );
}

// ---------- 계좌번호 시트: [은행 ⌄] [X] / 입력칸 / 키패드(콕) / 다음 ----------
function NumberSheet({
  bank,
  digits,
  onChange,
  onBank,
  onClose,
  onDone,
}: {
  bank: Bank;
  digits: string;
  onChange: (d: string) => void;
  onBank: () => void;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <>
      <div className="nh-sheet-head">
        <button className="nh-number__bank" onClick={onBank}>
          <NhBankIcon bank={bank} size={20} /> {nhBankList([bank], bank.section)[0]?.label ?? bank.name}{" "}
          <Icon name="chevron-down" size={15} stroke={2} />
        </button>
        <button className="nh-icon-btn" aria-label="닫기" onClick={onClose}>
          <Icon name="close" size={22} stroke={1.7} />
        </button>
      </div>
      {/* 비어 있으면 회색 테두리 + "계좌번호 입력", 치기 시작하면 청록 테두리 */}
      <div className={`nh-number__box ${digits ? "on" : ""}`}>
        <span>
          {digits || <i>계좌번호 입력</i>}
          {digits && <i className="nh-caret" />}
        </span>
        {digits && (
          <button aria-label="지우기" onClick={() => onChange("")}>
            <ClearDot />
          </button>
        )}
      </div>
      <Keypad kok rowHeight={57} back={<BackArrowKey />} onKey={(k) => onChange(applyKey(digits, k, 16))} />
      <button className="nh-btn nh-btn--teal nh-sheet-btn" disabled={digits.length < 10} onClick={onDone}>
        다음
      </button>
    </>
  );
}

// ---------- 금액 시트: [X] / 1원 ⓧ / 일원 / +1만 +5만 +10만 +100만 전액 / 키패드(00) / 다음 ----------
function AmountSheet({
  balance,
  remaining,
  onClose,
  onDone,
}: {
  balance: number;
  remaining: number;
  onClose: () => void;
  onDone: (amount: number) => void;
}) {
  const [raw, setRaw] = useState("");
  const amount = Number(raw || 0);
  // 녹화1 60초: 잔액보다 많으면 금액이 빨개지고 아래 안내 두 줄
  const error =
    amount > balance ? "통장의 잔액이 부족합니다.\n잔액을 확인해 주세요." : amount > remaining ? "1일 송금 잔여한도를 초과했습니다.\n금액을 확인해 주세요." : null;
  const add = (n: number) => setRaw(String(Math.min(amount + n, 99_999_999)));

  return (
    <>
      <div className="nh-sheet-head nh-sheet-head--end">
        <button className="nh-icon-btn" aria-label="닫기" onClick={onClose}>
          <Icon name="close" size={22} stroke={1.7} />
        </button>
      </div>
      <div className={`nh-amount__value ${raw ? "" : "empty"} ${error ? "error" : ""}`}>
        {raw ? (
          <>
            {nhWon(amount)}
            <i className="nh-caret" />
            <button aria-label="지우기" onClick={() => setRaw("")}>
              <ClearDot />
            </button>
          </>
        ) : (
          "금액 입력"
        )}
      </div>
      <p className={`nh-amount__hint ${error ? "error" : ""}`}>{error ?? hangulAmount(amount)}</p>
      <div className="nh-chips">
        {(
          [
            [10_000, "+ 1만"],
            [50_000, "+ 5만"],
            [100_000, "+ 10만"],
            [1_000_000, "+ 100만"],
          ] as const
        ).map(([n, label]) => (
          <button key={n} onClick={() => add(n)}>
            {label}
          </button>
        ))}
        <button onClick={() => setRaw(String(Math.min(balance, remaining)))}>전액</button>
      </div>
      <Keypad doubleZero rowHeight={57} back={<BackArrowKey />} onKey={(k) => setRaw((v) => applyKey(v, k, 8))} />
      <button className="nh-btn nh-btn--teal nh-sheet-btn" disabled={!amount || !!error} onClick={() => onDone(amount)}>
        다음
      </button>
    </>
  );
}

// ---------- 은행선택 (전체 화면) ----------
export function NhBankPicker({ banks, onPick, onClose }: { banks: Bank[]; onPick: (b: Bank) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"bank" | "securities">("bank");
  const [query, setQuery] = useState("");
  const list = useMemo(() => nhBankList(banks, tab).filter((b) => b.label.includes(query.trim())), [banks, tab, query]);
  return (
    // 녹화1 30~45초: 오른쪽 위 X / "은행/증권사명을 입력해 주세요" 밑줄 검색칸 / 은행·증권사 탭 / 3칸 타일
    <div className="screen nh nh-banks">
      <NhHeader onClose={onClose} />
      <div className="nh-banks__search">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="은행/증권사명을 입력해 주세요" />
        <Icon name="search" size={22} stroke={1.9} />
      </div>
      <div className="nh-pill-tabs">
        <button className={tab === "bank" ? "on" : ""} onClick={() => setTab("bank")}>
          은행
        </button>
        <button className={tab === "securities" ? "on" : ""} onClick={() => setTab("securities")}>
          증권사
        </button>
      </div>
      <div className="nh-banks__grid">
        {list.map((b) => (
          <button key={b.code} onClick={() => onPick(b)}>
            <NhBankIcon bank={b} size={30} />
            <span>{b.label}</span>
          </button>
        ))}
      </div>
      {!list.length && <p className="nh-empty">검색 결과가 없어요.</p>}
    </div>
  );
}
