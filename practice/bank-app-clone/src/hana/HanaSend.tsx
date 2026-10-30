import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { Bank, HomeData, Recipient, TransferRecipients, TransferResult } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog } from "../components/Sheet";
import { HANA_BANKS, HANA_TAX, hanaBankName, hanaNumber, nf } from "./bank";
import { ChevronDown, ChevronRight, ClearIcon, CloseIcon, HanaBankBadge, HanaBankLogo, HanaHeader, HanaSpinner, HeaderClose, HeaderText, LimitBadge, PersonIcon, PlusIcon, SearchIcon, StarIcon } from "./common";
import { HanaKeyboard, type KbKey } from "./HanaKeyboard";
import { useHanaStatusBar } from "./theme";
import "./hana-send.css";

// 완료 화면으로 넘기는 값
export interface HanaDoneState {
  result: TransferResult;
  fromNumber: string;
  memoTo: string;
  memoMe: string;
}

type Stage = "who" | "amount" | "memo";

// 이체 (라이트 녹화 7~40초, 다크 녹화 18~70초). 한 화면이 단계별로 바뀜:
//   who    "누구에게 보낼까요?" 직접 입력 / 최근·내계좌·자주 목록
//          └ 직접 입력 → '받는 분' 화면(계좌번호 + 은행 고르기 시트) → 확인 → 계좌 조회
//   amount "얼마를 보낼까요?" 화면 안 숫자 자판 + 1만·5만·10만·100만·전액 → 완료
//   memo   받는분에게 표시 / 나에게 표시 → 다음 → 확인 시트 → '○○ 님에게 이체'
// 실제 앱은 '이체'를 누른 뒤 비밀번호 자판(녹화가 막히는 보안 화면)이 뜨지만, 연습용이라 바로 완료로 넘어감
export function HanaSend() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get("from") ?? "main";
  const home = useApi<HomeData>(paths.home);
  const data = useApi<TransferRecipients>(paths.recipients(from));
  const banks = useApi<Bank[]>(paths.banks);
  const account = home.data?.accounts.find((a) => a.id === from);
  const me = home.data?.profile.userName ?? "";

  const [stage, setStage] = useState<Stage>("who");
  const [entry, setEntry] = useState(false); // '받는 분' 계좌 입력 화면
  const [to, setTo] = useState<Recipient | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null); // 은행선택에서 고른 타일 이름 (금액 단계 위쪽에 그대로: "농협 352…")
  const [amount, setAmount] = useState(0);
  const [memoTo, setMemoTo] = useState<string | null>(null); // null = 기본값(내 이름)
  const [memoMe, setMemoMe] = useState<string | null>(null); // null = 기본값(받는 분 이름)
  const [memo, setMemo] = useState("");
  const [editing, setEditing] = useState<"to" | "me" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (r: Recipient, label: string | null = null) => {
    setTo(r);
    setPickedLabel(label);
    setAmount(0);
    setMemoTo(null);
    setMemoMe(null);
    setMemo("");
    setEntry(false);
    setStage("amount");
  };
  // 거래 상세 '다시 이체': ?bank=…&number=… 로 오면 그 계좌를 바로 조회해서 금액 단계부터
  const againBank = params.get("bank");
  const againNumber = params.get("number");
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });
  useEffect(() => {
    if (!againBank || !againNumber) return;
    api.lookupAccount(againBank, againNumber).then(
      (r) => pickRef.current(r),
      () => setError("입력하신 계좌정보를 확인해 주세요."),
    );
  }, [againBank, againNumber]);
  const back = () => {
    if (confirm) setConfirm(false);
    else if (editing) setEditing(null);
    else if (entry) setEntry(false);
    else if (stage === "memo") setStage("amount");
    else if (stage === "amount") setStage("who");
    else navigate(-1);
  };
  // 안드로이드 뒤로가기: 단계 하나씩 되돌림. 깊이 들어가 있는 동안 방문 기록 한 칸(라우터 state 그대로)을 쌓아 두고,
  // 뒤로가기로 그 칸이 빠지면 한 단계 되돌린 뒤 아직 깊으면 다시 쌓음. 버튼으로 다 빠져나오면 쌓아 둔 칸을 걷어 냄
  const backRef = useRef(back);
  const deep = stage !== "who" || entry || !!editing || confirm;
  const deepRef = useRef(deep);
  useEffect(() => {
    backRef.current = back;
    deepRef.current = deep;
  });
  useEffect(() => {
    if (!deep) return;
    const push = () => window.history.pushState({ ...window.history.state, hanaSend: true }, "");
    push();
    const onPop = () => {
      backRef.current();
      window.setTimeout(() => deepRef.current && !window.history.state?.hanaSend && push());
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.hanaSend) window.history.back();
    };
  }, [deep]);

  const toName = to ? (memoMe ?? to.holder) : "";
  const toLine = to ? `${pickedLabel && stage === "amount" ? pickedLabel : hanaBankName(to.bank, to.number)} ${hanaNumber(to.bank, to.number)}` : "";
  useHanaStatusBar();

  return (
    <div className="hana hana-send screen-fixed">
      {stage === "who" ? (
        <Who
          data={data.data}
          onBack={() => navigate(-1)}
          onDirect={() => setEntry(true)}
          onPick={(r) => (r.accountId === from ? setError("출금계좌와 같은 계좌로는 보낼 수 없어요.") : pick(r))}
          onStar={(r) => r.payeeId && api.updatePayee(r.payeeId, { favorite: !r.favorite })}
        />
      ) : (
        to && (
          <Amount
            stage={stage}
            to={to}
            toLine={toLine}
            account={account}
            amount={amount}
            memoTo={memoTo ?? me}
            memoMe={memoMe ?? to.holder}
            memo={memo}
            onMemo={setMemo}
            onAmount={setAmount}
            onCancel={() => navigate(-1)}
            onPickAgain={() => setStage("who")}
            onAmountDone={() => setStage("memo")}
            onEditAmount={() => setStage("amount")}
            onEdit={setEditing}
            onNext={() => setConfirm(true)}
          />
        )
      )}

      {entry && (
        <Entry
          banks={banks.data ?? []}
          known={[...(data.data?.recent ?? []), ...(data.data?.favorites ?? [])]}
          onClose={() => setEntry(false)}
          onFound={pick}
          onError={setError}
        />
      )}
      {editing && to && (
        <MemoEdit
          title={editing === "to" ? "받는분에게 표시" : "나에게 표시"}
          initial={editing === "to" ? (memoTo ?? me) : (memoMe ?? to.holder)}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            if (editing === "to") setMemoTo(v);
            else setMemoMe(v);
            setEditing(null);
          }}
        />
      )}
      {to && account && (
        <Confirm
          open={confirm}
          to={to}
          toName={toName}
          account={account.number ?? ""}
          amount={amount}
          memoTo={memoTo ?? me}
          memoMe={memoMe ?? to.holder}
          onClose={() => setConfirm(false)}
          onSend={async () => {
            const result = await api.transfer({
              fromAccountId: from,
              bankCode: to.bank.code,
              number: to.number,
              amount,
              memoTo: (memoTo ?? me).trim(),
              memoMe: (memoMe ?? to.holder).trim(),
            });
            if (memo.trim()) await api.updateMemo(result.outTxId, memo.trim()).catch(() => undefined);
            const state: HanaDoneState = { result, fromNumber: account.number ?? "", memoTo: (memoTo ?? me).trim(), memoMe: (memoMe ?? to.holder).trim() };
            navigate("/send/done", { replace: true, state });
          }}
          onError={(m) => {
            setConfirm(false);
            setError(m);
          }}
        />
      )}
      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}

// ---------- 누구에게 보낼까요? ----------
type Tab = "recent" | "mine" | "fav";
function Who({
  data,
  onBack,
  onDirect,
  onPick,
  onStar,
}: {
  data?: TransferRecipients;
  onBack: () => void;
  onDirect: () => void;
  onPick: (r: Recipient) => void;
  onStar: (r: Recipient) => void;
}) {
  const [tab, setTab] = useState<Tab>("recent");
  const rows: (Recipient & { lastAt?: string })[] | undefined =
    tab === "recent"
      ? data?.recent
      : tab === "fav"
        ? data?.favorites
        : data?.mine.filter((m) => m.number).map((m) => ({ bank: m.bank, number: (m.number ?? "").replace(/\D/g, ""), holder: m.label, accountId: m.accountId }));
  return (
    <>
      <HanaHeader title="이체" onBack={onBack} right={<HeaderText>다계좌이체</HeaderText>} />
      <div className="hs-body">
        <div className="hs-who__title">
          <h2>누구에게 보낼까요?</h2>
          <SearchIcon size={25} />
        </div>
        <button className="hs-field hs-direct" onClick={onDirect}>
          <span>직접 입력</span>
          <ChevronRight size={22} />
        </button>
        <div className="hs-tabs">
          {(
            [
              ["recent", "최근"],
              ["mine", "내계좌"],
              ["fav", "자주"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
          <span className="hs-tabs__contact">
            <PersonIcon /> 연락처
          </span>
        </div>
        {tab === "recent" && <button className="hs-del">삭제</button>}
        <ul className="hs-list">
          {!rows
            ? [0, 1, 2, 3].map((i) => (
                <li key={i} className="hs-row hs-row--skel">
                  <span className="hana-skel hs-skel-icon" />
                  <span className="hana-skel hs-skel-a" />
                  <span className="hana-skel hs-skel-b" />
                </li>
              ))
            : rows.map((r) => (
                <li key={`${r.bank.code}-${r.number}`} className="hs-row" onClick={() => onPick(r)}>
                  <HanaBankBadge bank={r.bank} size={40} />
                  <div className="hs-row__text">
                    <p>
                      <b>{r.holder}</b>
                      {r.lastAt && <span>{r.lastAt.slice(0, 10).replaceAll("-", ".")}</span>}
                    </p>
                    <p className="hs-row__acct">
                      {hanaBankName(r.bank, r.number)} {hanaNumber(r.bank, r.number)}
                    </p>
                  </div>
                  {tab !== "mine" && (
                    <button
                      className="hs-star"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStar(r);
                      }}
                      aria-label="자주쓰는 계좌"
                    >
                      <StarIcon on={!!r.favorite} />
                    </button>
                  )}
                </li>
              ))}
          {rows && !rows.length && <li className="hs-empty">{tab === "fav" ? "자주쓰는 계좌가 없어요" : tab === "mine" ? "보낼 수 있는 내 계좌가 없어요" : "최근 이체한 계좌가 없어요"}</li>}
        </ul>
      </div>
    </>
  );
}

// ---------- 받는 분 (계좌번호 + 은행) ----------
function Entry({
  banks,
  known,
  onClose,
  onFound,
  onError,
}: {
  banks: Bank[];
  known: Recipient[];
  onClose: () => void;
  onFound: (r: Recipient, label: string) => void;
  onError: (m: string) => void;
}) {
  const [digits, setDigits] = useState("");
  const [focus, setFocus] = useState(false);
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  // 처음 열리면 잠깐 뒤 계좌번호 칸에 커서 + 키보드 (녹화 0.6초쯤)
  useEffect(() => {
    const t = window.setTimeout(() => setFocus(true), 450);
    return () => clearTimeout(t);
  }, []);
  useHanaStatusBar(picking ? { light: "#666666", dark: "#080809" } : undefined);

  const bank = banks.find((b) => b.code === bankCode) ?? null;
  const label = bankCode ? (HANA_BANKS.find(([c]) => c === bankCode)?.[1] ?? bank?.short ?? "") : "";
  // 계좌번호로 은행 추천: 최근·자주 목록에 같은 번호가 있으면 그 은행 (실제 앱은 번호 규칙으로 추천)
  const guess = digits.length >= 10 ? known.find((r) => r.number === digits) : undefined;

  const onKey = (k: KbKey) => {
    if (k === "hide" || k === "enter") setFocus(false);
    else if (k === "back") setDigits((d) => d.slice(0, -1));
    else setDigits((d) => (d + k).slice(0, 16));
  };
  const submit = async (code = bankCode, tileLabel = label) => {
    setFocus(false);
    if (digits.length < 6) return onError("계좌번호를 확인해 주세요.");
    if (!code) return setPicking(true);
    setBusy(true);
    try {
      const r = await api.lookupAccount(code, digits);
      onFound(r, tileLabel);
    } catch (e) {
      onError(
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

  return (
    <div className="hs-page" onClick={() => setFocus(false)}>
      <HanaHeader title="받는 분" right={<HeaderClose onClick={onClose} />} />
      <div className="hs-body">
        <h2 className="hs-entry__title">이체할 계좌를 입력해 주세요</h2>
        <div
          className={`hs-field hs-input ${focus ? "hs-input--focus" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setFocus(true);
          }}
        >
          {digits ? <span className="hs-input__value">{digits}</span> : <span className="hs-input__ph">-없이 계좌번호 입력</span>}
          {focus && <i className="hs-caret" />}
          {digits && focus && (
            <button
              className="hs-input__clear"
              onClick={(e) => {
                e.stopPropagation();
                setDigits("");
              }}
              aria-label="지우기"
            >
              <ClearIcon />
            </button>
          )}
        </div>
        <button
          className="hs-field hs-select"
          onClick={(e) => {
            e.stopPropagation();
            setFocus(false);
            setPicking(true);
          }}
        >
          {bank ? (
            <span className="hs-select__bank">
              <HanaBankLogo code={bank.code} bank={bank} scale={0.62} />
              {label}
            </span>
          ) : (
            <span className="hs-input__ph">은행 또는 증권사 선택</span>
          )}
          <ChevronDown size={22} />
        </button>
        {guess && (
          <button
            className="hs-guess"
            onClick={(e) => {
              e.stopPropagation();
              setBankCode(guess.bank.code);
            }}
          >
            <HanaBankLogo code={guess.bank.code} bank={guess.bank} scale={0.42} />
            {hanaBankName(guess.bank, guess.number)} {guess.number}
            <ChevronRight size={16} stroke={1.9} />
          </button>
        )}
      </div>
      <div className="hana-bottom">
        <button
          className="hana-btn"
          onClick={(e) => {
            e.stopPropagation();
            submit();
          }}
        >
          확인
        </button>
      </div>
      {busy && (
        <div className="hs-busy">
          <HanaSpinner size={34} />
        </div>
      )}
      <HanaKeyboard open={focus && !picking} onKey={onKey} />
      <BankSheet
        open={picking}
        banks={banks}
        onClose={() => setPicking(false)}
        onPick={(code) => {
          setPicking(false);
          setBankCode(code);
        }}
        onTax={() => onError("연습용 앱에서는 은행·증권사 계좌로만 보낼 수 있어요.")}
      />
    </div>
  );
}

// ---------- 은행 / 증권 고르기 시트 ----------
// 시트 위 80.8dp(녹화 136px@480) 부터, 반경 19. 손잡이 · X · 은행|증권 탭 → 3열 타일 106.1 × 98.1 (간격 12.8, 좌우 19.7)
const SECURITIES = ["nhsec", "kyobo", "daishin", "mirae", "meritz", "bookook", "samsung", "shinyoung", "shinhansec", "eugene", "yuanta", "ls", "kakaopaysec", "cape", "kiwoom", "tosssec", "hanasec", "imsec", "kis", "wooriinv", "hanwha", "hmsec", "bnksec", "dbsec", "ibksec", "kbsec", "daol", "sks", "sangsangin"];
function BankSheet({
  open,
  banks,
  onClose,
  onPick,
  onTax,
}: {
  open: boolean;
  banks: Bank[];
  onClose: () => void;
  onPick: (code: string) => void;
  onTax: () => void;
}) {
  const [tab, setTab] = useState<"bank" | "sec">("bank");
  useEffect(() => {
    if (!open) return;
    document.documentElement.dataset.hanaDim = "on";
    return () => void delete document.documentElement.dataset.hanaDim;
  }, [open]);
  const byCode = new Map(banks.map((b) => [b.code, b]));
  const tiles: [string, string][] =
    tab === "bank"
      ? HANA_BANKS.filter(([c]) => byCode.has(c))
      : SECURITIES.flatMap((c) => {
          const b = byCode.get(c);
          return b ? [[c, b.name] as [string, string]] : [];
        });
  return (
    <div className={`hs-sheet ${open ? "hs-sheet--open" : ""}`} aria-hidden={!open} onClick={(e) => e.stopPropagation()}>
      <div className="hs-sheet__dim" onClick={onClose} />
      <section className="hs-sheet__panel">
        <i className="hs-sheet__grab" />
        <button className="hs-sheet__close" onClick={onClose} aria-label="닫기">
          <CloseIcon size={26} />
        </button>
        <div className="hs-sheet__tabs">
          <button className={tab === "bank" ? "on" : ""} onClick={() => setTab("bank")}>
            은행
          </button>
          <button className={tab === "sec" ? "on" : ""} onClick={() => setTab("sec")}>
            증권
          </button>
        </div>
        <div className="hs-sheet__grid">
          {tiles.map(([code, name]) => (
            <button key={code} className="hs-tile" onClick={() => onPick(code)}>
              <HanaBankLogo code={code} bank={byCode.get(code)} />
              <span>{name}</span>
            </button>
          ))}
          {tab === "bank" &&
            HANA_TAX.map(([code, name]) => (
              <button key={code} className="hs-tile" onClick={onTax}>
                <HanaBankLogo code={code} />
                <span>{name}</span>
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}

// ---------- 얼마를 보낼까요? / 표시 ----------
// 금액 읽기: 1 → "1원", 10000 → "1만원", 12345 → "1만 2,345원", 1000000 → "100만원"
function readWon(n: number) {
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  if (!man) return `${nf.format(rest)}원`;
  return `${nf.format(man)}만${rest ? ` ${nf.format(rest)}` : ""}원`;
}
const QUICK: [string, number][] = [
  ["1만", 10000],
  ["5만", 50000],
  ["10만", 100000],
  ["100만", 1000000],
];
const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "done"] as const;

function Amount({
  stage,
  to,
  toLine,
  account,
  amount,
  memoTo,
  memoMe,
  memo,
  onMemo,
  onAmount,
  onCancel,
  onPickAgain,
  onAmountDone,
  onEditAmount,
  onEdit,
  onNext,
}: {
  stage: "amount" | "memo";
  to: Recipient;
  toLine: string;
  account?: HomeData["accounts"][number];
  amount: number;
  memoTo: string;
  memoMe: string;
  memo: string;
  onMemo: (v: string) => void;
  onAmount: (n: number) => void;
  onCancel: () => void;
  onPickAgain: () => void;
  onAmountDone: () => void;
  onEditAmount: () => void;
  onEdit: (which: "to" | "me") => void;
  onNext: () => void;
}) {
  const [pressed, setPressed] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [reserve, setReserve] = useState(false);
  const balance = account?.balance ?? 0;
  const over = amount > balance;
  const press = (k: (typeof PAD)[number]) => {
    if (k === "done") {
      if (amount > 0 && !over) onAmountDone();
      return;
    }
    if (k === "back") onAmount(Math.floor(amount / 10));
    else onAmount(Math.min(9_999_999_999, amount * 10 + Number(k)));
  };
  return (
    <>
      <HanaHeader title="이체" right={<HeaderText onClick={onCancel}>취소</HeaderText>} />
      <div className={`hs-body hs-amt hs-amt--${stage}`}>
        <button className="hs-amt__to" onClick={onPickAgain}>
          <b>{to.holder} 님에게</b>
          <span>
            {toLine}
            <ChevronRight size={17} stroke={1.6} />
          </span>
        </button>
        <div className="hs-amt__value" onClick={stage === "memo" ? onEditAmount : undefined}>
          {amount ? (
            <>
              <strong>
                {nf.format(amount)}
                <small>원</small>
              </strong>
              {over ? (
                <>
                  <p className="hs-amt__err">
                    출금가능금액이 부족합니다.
                    <br />
                    예약하고 나중에 이체하시겠어요?
                  </p>
                  <span className="hs-amt__reserve">예약이체</span>
                </>
              ) : (
                <p>{readWon(amount)}을 보낼까요?</p>
              )}
            </>
          ) : (
            <strong className="hs-amt__ph">얼마를 보낼까요?</strong>
          )}
        </div>
        <div className="hs-field hs-from">
          {account ? (
            <>
              <span className="hs-from__no">
                하나은행 {account.number}
                <LimitBadge />
              </span>
              <b>{nf.format(balance)}원</b>
            </>
          ) : (
            <span className="hs-input__ph">
              출금계좌 선택
              <span className="hs-from__spin">
                <HanaSpinner size={22} />
              </span>
            </span>
          )}
          <ChevronDown size={22} />
        </div>
        {stage === "memo" && (
          <div className="hs-memo-part">
            <p className="hs-label">받는분에게 표시</p>
            <button className="hs-field hs-memo" onClick={() => onEdit("to")}>
              <span>{memoTo}</span>
              <ChevronRight size={22} />
            </button>
            <p className="hs-label">나에게 표시</p>
            <button className="hs-field hs-memo" onClick={() => onEdit("me")}>
              <span>{memoMe}</span>
              <ChevronRight size={22} />
            </button>
            {more && (
              <>
                <p className="hs-label">메모</p>
                <input className="hs-field hs-memo hs-memo--input" value={memo} maxLength={20} placeholder="메모 입력 (선택)" onChange={(e) => onMemo(e.target.value)} />
              </>
            )}
            <button className="hs-more" onClick={() => setMore((m) => !m)}>
              {more ? "접기" : "펼치기"}
              <span className={more ? "hs-more--up" : ""}>
                <ChevronDown size={16} stroke={1.5} />
              </span>
            </button>
            <label className="hs-check">
              <input type="checkbox" checked={reserve} onChange={(e) => setReserve(e.target.checked)} />
              <i />
              예약이체
            </label>
          </div>
        )}
      </div>
      {stage === "amount" ? (
        <div className="hs-pad">
          <div className="hs-pad__quick">
            {QUICK.map(([l, n]) => (
              <button key={l} onClick={() => onAmount(Math.min(9_999_999_999, amount + n))}>
                {l}
              </button>
            ))}
            <button onClick={() => onAmount(balance)}>전액</button>
          </div>
          <div className="hs-pad__keys">
            {PAD.map((k) => (
              <button
                key={k}
                className={`hs-key hs-key--${k} ${pressed === k ? "hs-key--down" : ""}`}
                onPointerDown={() => setPressed(k)}
                onPointerUp={() => setPressed(null)}
                onPointerLeave={() => setPressed(null)}
                onClick={() => press(k)}
              >
                {k === "back" ? <PadBack /> : k === "done" ? "완료" : k}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="hana-bottom hs-bottom-fade">
          <button className="hana-btn" onClick={onNext} disabled={!amount || over}>
            다음
          </button>
        </div>
      )}
    </>
  );
}

function PadBack() {
  return (
    <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden>
      <path d="M10 2h19a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H10L1.5 12Z" fill="var(--hs-padback)" />
      <path d="m15 7.5 9 9m0-9-9 9" stroke="var(--hn-bg)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// ---------- 받는분에게 표시 / 나에게 표시 ----------
function MemoEdit({ title, initial, onClose, onSave }: { title: string; initial: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  const [phrases, setPhrases] = useState(["용돈", "경조사"]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <div className="hs-page">
      <HanaHeader title={title} right={<HeaderClose onClick={onClose} />} />
      <div className="hs-body">
        <div className="hs-memo-edit">
          <div className="hs-field hs-memo-edit__input">
            <input ref={input} value={v} maxLength={10} placeholder="최대 10자 입력" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && v.trim() && onSave(v.trim())} />
            {v && (
              <button onClick={() => setV("")} aria-label="지우기">
                <ClearIcon />
              </button>
            )}
          </div>
          <button className="hana-btn hs-memo-edit__ok" onClick={() => v.trim() && onSave(v.trim())}>
            등록
          </button>
        </div>
        <div className="hs-phrase-head">
          <b>자주쓰는문구</b>
          <span>편집</span>
        </div>
        <div className="hs-phrases">
          {phrases.map((p) => (
            <button key={p} onClick={() => setV(p)}>
              {p}
            </button>
          ))}
          <button
            className="hs-phrases__add"
            onClick={() => v.trim() && !phrases.includes(v.trim()) && setPhrases((ps) => [...ps, v.trim()])}
            aria-label="문구 추가"
          >
            <PlusIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 이체 확인 시트 ----------
function Confirm({
  open,
  to,
  toName,
  account,
  amount,
  memoTo,
  memoMe,
  onClose,
  onSend,
  onError,
}: {
  open: boolean;
  to: Recipient;
  toName: string;
  account: string;
  amount: number;
  memoTo: string;
  memoMe: string;
  onClose: () => void;
  onSend: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const bankName = hanaBankName(to.bank, to.number);
  const send = async () => {
    setSending(true);
    try {
      // 실제 앱: 원호 로딩 → 비밀번호 자판(보안 화면) → 완료. 비밀번호 단계는 건너뜀
      await Promise.all([onSend(), new Promise((r) => setTimeout(r, 900))]);
    } catch (e) {
      setSending(false);
      onError(e instanceof ApiError ? e.message : "연결에 실패했어요");
    }
  };
  return (
    <div className={`hs-sheet hs-confirm ${open ? "hs-sheet--open" : ""}`} aria-hidden={!open}>
      <div className="hs-sheet__dim" onClick={sending ? undefined : onClose} />
      <section className="hs-sheet__panel">
        <HanaHeader title="이체" right={<HeaderClose onClick={onClose} />} />
        <h2 className="hs-confirm__title">
          <em>
            {bankName} {to.holder}
          </em>{" "}
          님에게
          <br />
          <em>{nf.format(amount)}원</em>을 이체하시겠어요?
        </h2>
        <dl className="hs-rows">
          <div>
            <dt>입금계좌</dt>
            <dd>
              {bankName}
              <br />
              {hanaNumber(to.bank, to.number)}
            </dd>
          </div>
          <div>
            <dt>출금계좌</dt>
            <dd>
              하나은행
              <br />
              {account}
            </dd>
          </div>
          <div>
            <dt>수수료</dt>
            <dd>무료</dd>
          </div>
          <div>
            <dt>받는분에게 표시</dt>
            <dd>{memoTo}</dd>
          </div>
          <div>
            <dt>나에게 표시</dt>
            <dd>{memoMe}</dd>
          </div>
        </dl>
        <div className="hs-confirm__add">
          <button className="hana-chip">
            <PlusIcon size={15} /> 추가이체
          </button>
        </div>
        <div className="hana-bottom">
          <button className="hana-btn" onClick={() => !sending && send()}>
            {toName} 님에게 이체
          </button>
        </div>
        {sending && (
          <div className="hs-busy hs-busy--clear">
            <HanaSpinner size={34} />
          </div>
        )}
      </section>
    </div>
  );
}
