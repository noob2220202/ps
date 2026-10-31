import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { Bank, HomeData, Recipient, TransferRecipients, TransferResult } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog } from "../components/Sheet";
import { HANA_BANKS, HANA_SECURITIES, HANA_TAX, hanaBankName, hanaNumber, nf } from "./bank";
import { ChevronDown, ChevronRight, ClearIcon, HanaBankBadge, HanaBankLogo, HanaHeader, HanaRetry, HanaSpinner, HeaderClose, HeaderText, Ic, LimitBadge, PersonIcon, PlusIcon, SearchIcon, StarIcon } from "./common";
import { useSafeBack } from "./nav";
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

// 터치 화면(폰·태블릿)인지: 입력칸을 누르면 기기 키보드가 알아서 뜸
const TOUCH = matchMedia("(pointer: coarse)").matches;
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
// 버튼을 누른 뒤 실제 앱이 멈춰 있는 시간 (라이트 녹화): 자판 '완료' → 다음 버튼 회색 + 출금계좌 옆 원호 ≈1초(L/0094~0097) →
// 표시 칸 / '다음' → 회색 한 프레임(L/0120, ≈250ms) → 확인 페이지 / '이체' → 회색 버튼 + 원호(L/0126~, 비밀번호 화면은 건너뜀) ≈1.2초
const WAIT = { settle: 1000, next: 250, send: 1200 };

// 이체 (라이트 녹화 7~40초, 다크 녹화 18~70초). 한 화면이 단계별로 바뀜:
//   who    "누구에게 보낼까요?" 직접 입력 / 최근·내계좌·자주 목록
//          └ 직접 입력 → '받는 분' 화면(계좌번호 + 은행 고르기 시트) → 확인 → 계좌 조회
//   amount "얼마를 보낼까요?" 화면 안 숫자 자판 + 1만·5만·10만·100만·전액 → 완료
//   memo   받는분에게 표시 / 나에게 표시 → 다음 → 확인 시트 → '○○ 님에게 이체'
// 실제 앱은 '이체'를 누른 뒤 비밀번호 자판(녹화가 막히는 보안 화면)이 뜨지만, 연습용이라 바로 완료로 넘어감
export function HanaSend() {
  const navigate = useNavigate();
  const safeBack = useSafeBack("/");
  const [params] = useSearchParams();
  const [from, setFrom] = useState(params.get("from") ?? "main"); // 출금계좌 (금액 화면 상자를 눌러 바꿈)
  const home = useApi<HomeData>(paths.home);
  const data = useApi<TransferRecipients>(paths.recipients(from));
  const banks = useApi<Bank[]>(paths.banks);
  const account = home.data?.accounts.find((a) => a.id === from);
  const me = home.data?.profile.userName ?? "";

  const [stage, setStage] = useState<Stage>("who");
  const [entry, setEntry] = useState(false); // '받는 분' 계좌 입력 화면
  const [picking, setPicking] = useState(false); // 받는 분 화면 위 은행/증권 시트 (뒤로가기로 시트만 닫히게 여기서 들고 있음)
  const [to, setTo] = useState<Recipient | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null); // 은행선택에서 고른 타일 이름 (금액 단계 위쪽에 그대로: "농협 352…")
  const [amount, setAmount] = useState(0);
  const [memoTo, setMemoTo] = useState<string | null>(null); // null = 기본값(내 이름)
  const [memoMe, setMemoMe] = useState<string | null>(null); // null = 기본값(받는 분 이름)
  const [memo, setMemo] = useState("");
  const [editing, setEditing] = useState<"to" | "me" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [fromSheet, setFromSheet] = useState(false); // 출금계좌 선택 시트
  const [unknown, setUnknown] = useState(false); // 조회가 안 된 계좌: 금액 '완료' 뒤 '입금계좌번호 오류' (라이트 녹화 2, 52~56초)
  const [asking, setAsking] = useState(false); // '취소' → 이체를 취소하시겠어요?
  const leaving = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (r: Recipient, label: string | null = null, unknownAccount = false) => {
    setTo(r);
    setPickedLabel(label);
    setUnknown(unknownAccount);
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
    if (asking) setAsking(false);
    else if (fromSheet) setFromSheet(false);
    else if (picking) setPicking(false);
    else if (confirm) setConfirm(false);
    else if (editing) setEditing(null);
    else if (entry) setEntry(false);
    else if (stage === "memo") setStage("amount");
    else if (stage === "amount") setStage("who");
    else safeBack();
  };
  // 안드로이드 뒤로가기: 단계 하나씩 되돌림. 깊이 들어가 있는 동안 방문 기록 한 칸(라우터 state 그대로)을 쌓아 두고,
  // 뒤로가기로 그 칸이 빠지면 한 단계 되돌린 뒤 아직 깊으면 다시 쌓음. 버튼으로 다 빠져나오면 쌓아 둔 칸을 걷어 냄
  const backRef = useRef(back);
  const deep = stage !== "who" || entry || !!editing || confirm || picking || fromSheet;
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
      if (leaving.current) return;
      backRef.current();
      window.setTimeout(() => deepRef.current && !window.history.state?.hanaSend && push());
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.hanaSend) window.history.back();
    };
  }, [deep]);

  // '취소 → 예': 단계와 상관없이 이체를 나감. 깊이 들어가며 쌓아 둔 기록 칸이 있으면 두 칸을 한 번에 (실제: 홈으로)
  const leave = () => {
    leaving.current = true;
    const st = window.history.state as { idx?: number; hanaSend?: boolean } | null;
    if ((st?.idx ?? 0) > 0) window.history.go(st?.hanaSend ? -2 : -1);
    else navigate("/", { replace: true });
  };

  const toName = to ? (memoMe ?? to.holder) : "";
  const toLine = to ? `${pickedLabel && stage === "amount" ? pickedLabel : hanaBankName(to.bank, to.number)} ${hanaNumber(to.bank, to.number)}` : "";
  useHanaStatusBar();

  return (
    <div className="hana hana-send screen-fixed">
      {stage === "who" ? (
        <Who
          data={data.data}
          failed={data.status === "error"}
          onRetry={data.retry}
          onDelete={() => {}}
          onBack={safeBack}
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
            unknown={unknown}
            onBadAccount={() => setError("입금계좌번호 오류입니다.\n오류코드 : OCOM15861")}
            onFrom={() => setFromSheet(true)}
            onCancel={() => setAsking(true)}
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
          picking={picking}
          onPicking={setPicking}
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
            return state;
          }}
          onDone={(state) => navigate("/send/done", { replace: true, state })}
          onError={(m) => {
            setConfirm(false);
            setError(m);
          }}
        />
      )}
      <FromSheet
        open={fromSheet}
        accounts={home.data?.accounts ?? []}
        current={from}
        onClose={() => setFromSheet(false)}
        onPick={(id) => {
          setFrom(id);
          setFromSheet(false);
        }}
        onRegister={() => {}}
      />
      <Dialog message={error} onClose={() => setError(null)} />
      <Dialog message={asking ? "이체를 취소하시겠어요?" : null} cancelLabel="아니요" okLabel="예" onCancel={() => setAsking(false)} onClose={leave} />
    </div>
  );
}

// ---------- 누구에게 보낼까요? ----------
type Tab = "recent" | "mine" | "fav";
function Who({
  data,
  failed,
  onRetry,
  onDelete,
  onBack,
  onDirect,
  onPick,
  onStar,
}: {
  data?: TransferRecipients;
  failed: boolean;
  onRetry: () => void;
  onDelete: () => void;
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
        {tab === "recent" && (
          <button className="hs-del" onClick={onDelete}>
            삭제
          </button>
        )}
        <ul className="hs-list">
          {!rows && failed ? (
            <li>
              <HanaRetry onRetry={onRetry} />
            </li>
          ) : !rows
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
  picking,
  onPicking: setPicking,
  onClose,
  onFound,
  onError,
}: {
  banks: Bank[];
  known: Recipient[];
  picking: boolean;
  onPicking: (open: boolean) => void;
  onClose: () => void;
  onFound: (r: Recipient, label: string, unknown?: boolean) => void;
  onError: (m: string) => void;
}) {
  const [digits, setDigits] = useState("");
  const [focus, setFocus] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const blur = () => input.current?.blur();
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 처음 열리면 잠깐 뒤 계좌번호 칸에 커서 + 키보드 (녹화 0.6초쯤)
  useEffect(() => {
    const t = window.setTimeout(() => input.current?.focus(), 450);
    return () => clearTimeout(t);
  }, []);
  // 시트가 열려도 상태바는 그대로 (0871415a 상태바 흰색, 머리줄만 어두움)
  useHanaStatusBar();

  const bank = banks.find((b) => b.code === bankCode) ?? null;
  const label = bankCode ? (HANA_BANKS.find(([c]) => c === bankCode)?.[1] ?? bank?.short ?? "") : "";
  // 계좌번호로 은행 추천: 최근·자주 목록에 같은 번호가 있으면 그 은행 (실제 앱은 번호 규칙으로 추천)
  const guess = digits.length >= 10 ? known.find((r) => r.number === digits) : undefined;

  const onKey = (k: KbKey) => {
    if (k === "hide" || k === "enter") blur();
    else if (k === "back") setDigits((d) => d.slice(0, -1));
    else setDigits((d) => (d + k).slice(0, 16));
  };
  const submit = async (code = bankCode, tileLabel = label) => {
    blur();
    if (digits.length < 6) return onError("계좌번호를 확인해 주세요.");
    if (!code) return setPicking(true);
    setBusy(true);
    try {
      const r = await api.lookupAccount(code, digits);
      onFound(r, tileLabel);
    } catch (e) {
      // 등록 안 된 계좌: 실제 앱처럼 이름 없이 금액 화면으로 가고, 금액 '완료' 뒤에 '입금계좌번호 오류' (🔔 관리 → 받는 분에 등록한 계좌만 보낼 수 있음)
      const bank = banks.find((b) => b.code === code);
      if (e instanceof ApiError && e.status === 404 && bank) return onFound({ bank, number: digits, holder: "" }, tileLabel, true);
      onError(e instanceof ApiError ? e.message : "연결에 실패했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hs-page" onClick={blur}>
      <HanaHeader title="받는 분" right={<HeaderClose onClick={onClose} />} />
      <div className="hs-body">
        <h2 className="hs-entry__title">이체할 계좌를 입력해 주세요</h2>
        {/* 진짜 입력칸: 폰에선 폰 자체 키보드(숫자)가 뜨고, PC에선 키보드로 치거나 아래 그려 둔 갤럭시 자판으로 */}
        <div className={`hs-field hs-input ${focus ? "hs-input--focus" : ""}`} onClick={(e) => e.stopPropagation()}>
          <input
            ref={input}
            className="hs-input__el"
            value={digits}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="-없이 계좌번호 입력"
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 16))}
            onKeyDown={(e) => e.key === "Enter" && blur()}
          />
          {digits && focus && (
            <button
              className="hs-input__clear"
              onMouseDown={(e) => e.preventDefault()}
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
            blur();
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
            <HanaBankLogo code={guess.bank.code} bank={guess.bank} scale={0.55} />
            {hanaBankName(guess.bank, guess.number)} {guess.number}
            <ChevronRight size={20} stroke={1.9} />
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
      {/* 폰(터치)에선 폰 키보드가 뜨니까 그림 자판은 PC에서만 */}
      {!TOUCH && <HanaKeyboard open={focus && !picking} onKey={onKey} />}
      <BankSheet
        open={picking}
        banks={banks}
        onClose={() => setPicking(false)}
        onPick={(code) => {
          setPicking(false);
          setBankCode(code);
        }}
        onTax={() => {}}
      />
    </div>
  );
}

// ---------- 은행 / 증권 고르기 시트 ----------
// 시트 위 80.8dp(녹화 136px@480) 부터, 반경 19. 손잡이 · X · 은행|증권 탭 → 3열 타일 106.1 × 98.1 (간격 12.8, 좌우 19.7)
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
  const byCode = new Map(banks.map((b) => [b.code, b]));
  const tiles = (tab === "bank" ? HANA_BANKS : HANA_SECURITIES).filter(([c]) => byCode.has(c));
  return (
    <div className={`hs-sheet ${open ? "hs-sheet--open" : ""}`} aria-hidden={!open} onClick={(e) => e.stopPropagation()}>
      <div className="hs-sheet__dim" onClick={onClose} />
      <section className="hs-sheet__panel">
        <i className="hs-sheet__grab" />
        <button className="hs-sheet__close" onClick={onClose} aria-label="닫기">
          <Ic name="close" w={17.5} h={17.5} />
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

// ---------- 출금계좌 선택 시트 ----------
// 라이트 녹화 2 (32~34초): 금액 화면 출금계좌 상자를 누르면 올라옴. 시트 위 352dp(앱 영역 324), 손잡이 · '출금계좌 선택' · X →
// 하나은행|다른은행 탭 (밑줄 자리는 은행 시트와 같음). 하나은행 = 로고 원 · 통장 이름 / 번호 · 아래 줄 오른쪽 잔액,
// 다른은행 = (!) 등록된 계좌가 없어요 + 계좌 등록 (연습용 앱엔 다른은행 출금계좌가 없음)
function FromSheet({
  open,
  accounts,
  current,
  onClose,
  onPick,
  onRegister,
}: {
  open: boolean;
  accounts: HomeData["accounts"];
  current: string;
  onClose: () => void;
  onPick: (id: string) => void;
  onRegister: () => void;
}) {
  const [tab, setTab] = useState<"hana" | "other">("hana");
  return (
    <div className={`hs-sheet hs-fromsheet ${open ? "hs-sheet--open" : ""}`} aria-hidden={!open} onClick={(e) => e.stopPropagation()}>
      <div className="hs-sheet__dim" onClick={onClose} />
      <section className="hs-sheet__panel">
        <i className="hs-sheet__grab" />
        <h2 className="hs-fromsheet__title">출금계좌 선택</h2>
        <button className="hs-sheet__close" onClick={onClose} aria-label="닫기">
          <Ic name="close" w={17.5} h={17.5} />
        </button>
        <div className="hs-sheet__tabs">
          <button className={tab === "hana" ? "on" : ""} onClick={() => setTab("hana")}>
            하나은행
          </button>
          <button className={tab === "other" ? "on" : ""} onClick={() => setTab("other")}>
            다른은행
          </button>
        </div>
        {tab === "hana" ? (
          <ul className="hs-fromlist">
            {accounts.map((a) => (
              <li key={a.id}>
                <button className={a.id === current ? "on" : ""} onClick={() => onPick(a.id)}>
                  <HanaBankBadge bank={a.bank} />
                  <b>{a.label}</b>
                  <span>{a.number}</span>
                  <strong>{nf.format(a.balance)}원</strong>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="hs-fromsheet__empty">
            <svg width="31" height="31" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="16" cy="16" r="14.6" />
              <path d="M16 8.8v9.4" strokeLinecap="round" strokeWidth="2.2" />
              <circle cx="16" cy="22.6" r="1.4" fill="currentColor" stroke="none" />
            </svg>
            <b>등록된 계좌가 없어요</b>
            <span>다른은행 계좌 등록 후 이용해 주세요.</span>
            <button onClick={onRegister}>계좌 등록</button>
          </div>
        )}
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
  unknown,
  onBadAccount,
  onFrom,
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
  unknown: boolean;
  onBadAccount: () => void;
  onFrom: () => void;
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
  // 금액 화면이 뜨면 출금계좌 상자가 한 줄짜리 '출금계좌 선택' + 원호로 ≈0.75초 있다가(L/0085~0087) 계좌가 채워지고 자판이 올라옴
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 750);
    return () => clearTimeout(t);
  }, []);
  const loaded = ready && !!account;
  const [settling, setSettling] = useState(false); // 자판 '완료' 뒤 ≈1초: 자판 내려가고 '다음' 회색 + 원호
  const [stuck, setStuck] = useState(false); // 계좌번호 오류 뒤: 자판 없이 '다음' 회색 (금액을 누르면 자판이 다시)
  const [nextBusy, setNextBusy] = useState(false); // '다음' 누른 뒤 회색 한 프레임
  const balance = account?.balance ?? 0;
  const over = amount > balance;
  const press = (k: (typeof PAD)[number]) => {
    if (k === "done") {
      if (amount > 0 && !over && !settling) {
        setSettling(true);
        sleep(WAIT.settle).then(() => {
          setSettling(false);
          if (!unknown) return onAmountDone();
          setStuck(true);
          onBadAccount();
        });
      }
      return;
    }
    if (k === "back") onAmount(Math.floor(amount / 10));
    else onAmount(Math.min(9_999_999_999, amount * 10 + Number(k)));
  };
  return (
    <>
      <HanaHeader title="이체" right={<HeaderText onClick={onCancel}>취소</HeaderText>} />
      {/* 표시 단계는 금액이 보이는 채로 뜨고(라이트 녹화 2 31초, 다크 D/0109), 위로 밀면 금액이 이름 줄 뒤로 숨고 상자가 이름 줄 아래까지(L/0104, D/0111) */}
      <div
        className={`hs-body hs-amt hs-amt--${stage} ${settling || stuck ? "hs-amt--settled" : ""}`}
        onScroll={(e) => e.currentTarget.style.setProperty("--hs-scroll", `${e.currentTarget.scrollTop}px`)}
      >
        <button className="hs-amt__to" onClick={onPickAgain}>
          {/* 조회 안 된 계좌는 이름 줄이 비어 있음 (은행·번호 줄은 그 자리 그대로) */}
          <b>{unknown ? "\u00a0" : `${to.holder} 님에게`}</b>
          <span>
            {toLine}
            <ChevronRight size={17} stroke={1.6} />
          </span>
        </button>
        <div className="hs-amt__value" onClick={stage === "memo" ? onEditAmount : stuck ? () => setStuck(false) : undefined}>
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
        <div className={`hs-field hs-from ${loaded ? "" : "hs-from--loading"}`} onClick={loaded && !settling ? onFrom : undefined}>
          {loaded ? (
            <>
              <span className="hs-from__no">
                하나은행 {account!.number}
                <LimitBadge />
              </span>
              <b>{nf.format(balance)}원</b>
            </>
          ) : (
            <span className="hs-input__ph">출금계좌 선택</span>
          )}
          {(!loaded || settling) && (
            <span className="hs-from__spin">
              <HanaSpinner size={34} stroke={3.3} />
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
      {stage === "amount" && loaded && !settling && !stuck ? (
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
          <button
            className="hana-btn"
            onClick={() => {
              if (nextBusy) return;
              setNextBusy(true);
              sleep(WAIT.next).then(() => {
                setNextBusy(false);
                onNext();
              });
            }}
            disabled={stage !== "memo" || !amount || over || nextBusy}
          >
            다음
          </button>
        </div>
      )}
    </>
  );
}

function PadBack() {
  return (
    <svg width="27" height="19" viewBox="0 0 34 24" aria-hidden>
      <path d="M10 2h19a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H10L1.5 12Z" fill="var(--hs-padback)" />
      <path d="m15 7.5 9 9m0-9-9 9" stroke="var(--hn-bg)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------- 받는분에게 표시 / 나에게 표시 ----------
function MemoEdit({ title, initial, onClose, onSave }: { title: string; initial: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  const [focus, setFocus] = useState(false);
  const [phrases, setPhrases] = useState(["용돈", "경조사"]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <div className="hs-page">
      <HanaHeader title={title} right={<HeaderClose onClick={onClose} />} />
      <div className="hs-body">
        <div className="hs-memo-edit">
          <div className="hs-field hs-memo-edit__input">
            <input
              ref={input}
              value={v}
              maxLength={10}
              placeholder="최대 10자 입력"
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              onChange={(e) => setV(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && v.trim() && onSave(v.trim())}
            />
            {v && focus && (
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => setV("")} aria-label="지우기">
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
            <PlusIcon size={15} />
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
  onDone,
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
  onSend: () => Promise<HanaDoneState>;
  onDone: (state: HanaDoneState) => void;
  onError: (m: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const bankName = hanaBankName(to.bank, to.number);
  const send = async () => {
    setSending(true);
    try {
      // 실제 앱: 버튼이 회색이 되고 원호 로딩 → 비밀번호 자판(보안 화면) → 완료. 비밀번호 단계는 건너뜀
      const [state] = await Promise.all([onSend(), sleep(WAIT.send)]);
      onDone(state);
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
          <button className="hana-btn" onClick={() => !sending && send()} disabled={sending}>
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
