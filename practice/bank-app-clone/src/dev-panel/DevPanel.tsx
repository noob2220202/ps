import { useRef, useState, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { api, formatAccountNumber, paths } from "../api/endpoints";
import { useApi } from "../api/useApi";
import type { Account, AppProfile, Bank, HomeData, Payee, Transaction, TxTag } from "../api/types";
import { won } from "../lib/format";
import { OS } from "../platform/platform";
import { THEME_CHOICE } from "../platform/theme";
import { isCapture, setCapture } from "../platform/capture";
import { BankIcon } from "../components/BankIcon";
import { Icon } from "../components/icons/Icon";
import { BankPicker } from "../screens/transfer/TransferScreen";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { currentProfileId, setCurrentProfile } from "../profile/session";
import "./DevPanel.css";

// 🔔 버튼으로 여는 관리 패널. 앱 화면은 실제 앱처럼 "보기"만 하고,
// 계좌 추가·삭제, 잔액, 거래내역, 받는 분, 내 정보 같은 데이터 관리는 전부 여기서 버튼/숫자 입력으로 한다.

type Tab = "basic" | "accounts" | "payees" | "tx";
const TABS: [Tab, string][] = [
  ["basic", "기본"],
  ["accounts", "계좌"],
  ["payees", "받는 분"],
  ["tx", "거래"],
];

export function DevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("basic");
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const timer = useRef(0);

  const notify = (text: string, error = false) => {
    setToast({ text, error });
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2200);
  };
  // 서버 요청 → 성공 메시지 or 서버가 준 에러 메시지
  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      notify(success);
      return true;
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      notify(err ? (err.fields ? Object.values(err.fields)[0] : err.message) : "연결에 실패했어요", true);
      return false;
    }
  };

  return (
    <div className={`dev-panel ${open ? "dev-panel--open" : ""}`} aria-hidden={!open}>
      <div className="dev-panel__backdrop" onClick={onClose} />
      <section className="dev-panel__sheet" role="dialog" aria-label="관리 패널">
        <div className="dev-panel__grabber" />
        <header className="dev-panel__head">
          <strong>관리</strong>
          <button onClick={onClose} aria-label="닫기">
            <Icon name="close" size={20} stroke={2} />
          </button>
        </header>
        <nav className="dev-panel__tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="dev-panel__body">
          {open && tab === "basic" && <BasicTab run={run} />}
          {open && tab === "accounts" && <AccountsTab run={run} />}
          {open && tab === "payees" && <PayeesTab run={run} />}
          {open && tab === "tx" && <TxTab run={run} />}
        </div>
        {toast && <div className={`dev-toast ${toast.error ? "dev-toast--error" : ""}`}>{toast.text}</div>}
      </section>
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, success: string) => Promise<boolean>;

// ---------- 공통 조각 ----------
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={v === value ? "on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

// 금액 입력: 화면엔 "12,000" 처럼 콤마, 값은 숫자. 아래 버튼으로 더하기.
function MoneyInput({ value, onChange, quick = [1000, 10000, 100000] }: { value: number; onChange: (n: number) => void; quick?: number[] }) {
  return (
    <div className="money">
      <div className="money__box">
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString("ko-KR") : ""}
          placeholder="0"
          onChange={(e) => onChange(Math.min(Number(e.target.value.replace(/\D/g, "")) || 0, 1_000_000_000))}
        />
        <span>원</span>
      </div>
      <div className="chips-row">
        {quick.map((q) => (
          <button key={q} type="button" className="chip-btn" onClick={() => onChange(value + q)}>
            +{q >= 10000 ? `${q / 10000}만` : `${q / 1000}천`}
          </button>
        ))}
        <button type="button" className="chip-btn chip-btn--ghost" onClick={() => onChange(0)}>
          지우기
        </button>
      </div>
    </div>
  );
}

const accountName = (a: Account) => (a.kind === "main" ? "카카오뱅크 통장" : a.bank.name);

// ---------- 기본: 기기 / 테마 / 내 정보 ----------
function BasicTab({ run }: { run: Run }) {
  const home = useApi<HomeData>(paths.home);
  if (home.status !== "done") return <div className="tab">불러오는 중…</div>;
  return <BasicForm run={run} initial={home.data} />;
}

function BasicForm({ run, initial }: { run: Run; initial: HomeData }) {
  const [name, setName] = useState(initial.profile.userName);
  const [card, setCard] = useState(initial.profile.cardLast4);
  // 기기/테마는 앱 전체가 처음 켤 때 정해지므로 저장 후 다시 연다
  const reopen = (query: string) => location.assign(`/?${query}&skip`);

  return (
    <div className="tab">
      <CurrentProfile />
      <Field label="기기">
        <Segmented value={OS} options={[["android", "Galaxy"], ["ios", "iPhone"]]} onChange={(v) => reopen(`os=${v}`)} />
      </Field>
      <CaptureToggle />
      <Field label="테마">
        <Segmented value={THEME_CHOICE} options={[["system", "시스템"], ["light", "라이트"], ["dark", "다크"]]} onChange={(v) => reopen(`theme=${v}`)} />
      </Field>

      <h3 className="tab__h">내 정보</h3>
      <Field label="이름">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={10} />
      </Field>
      <Field label="카드 끝 4자리">
        <input value={card} inputMode="numeric" maxLength={4} onChange={(e) => setCard(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <button className="btn" onClick={() => run(() => api.updateProfile({ userName: name, cardLast4: card }), "내 정보를 저장했어요")}>
        저장
      </button>

      <h3 className="tab__h">이 프로필 데이터</h3>
      <div className="row">
        <button
          className="btn btn--sm btn--danger"
          onClick={() => confirm("계좌·거래내역·받는 분을 모두 지우고 빈 상태(통장 0원)로 만들까요?") && run(() => api.reset("empty"), "빈 상태로 만들었어요")}
        >
          빈 상태로
        </button>
        <button
          className="btn btn--sm btn--danger"
          onClick={() => confirm("지금 데이터를 지우고 홍길동 예시 데이터로 채울까요?") && run(() => api.reset("example"), "예시 데이터로 채웠어요")}
        >
          예시 데이터로
        </button>
      </div>
    </div>
  );
}

// 캡쳐모드 켜고 끄기 (CSS만 바뀌므로 바로 적용)
function CaptureToggle() {
  const [on, setOn] = useState(isCapture);
  return (
    <Field label="캡쳐모드 (폰 테두리·아래 스위치 숨기기)">
      <Segmented
        value={on ? "on" : "off"}
        options={[
          ["off", "끄기"],
          ["on", "켜기"],
        ]}
        onChange={(v) => {
          setCapture(v === "on");
          setOn(v === "on");
        }}
      />
    </Field>
  );
}

// 지금 프로필 + 바꾸기 (sessionStorage를 비우고 다시 열면 프로필 고르기 화면)
function CurrentProfile() {
  const list = useApi<AppProfile[]>(paths.profiles);
  const me = list.data?.find((p) => p.id === currentProfileId());
  return (
    <div className="current-profile">
      {me ? <ProfileAvatar profile={me} size={40} /> : <span className="current-profile__blank" />}
      <span className="current-profile__name">
        <small>지금 프로필</small>
        <strong>{me?.name ?? "…"}</strong>
      </span>
      <button
        className="btn btn--sm"
        onClick={() => {
          setCurrentProfile(null);
          location.assign("/");
        }}
      >
        프로필 바꾸기
      </button>
    </div>
  );
}

// ---------- 계좌: 잔액 수정 / 다른 은행 계좌 추가·삭제 ----------
function AccountsTab({ run }: { run: Run }) {
  const home = useApi<HomeData>(paths.home);
  const banks = useApi<Bank[]>(paths.banks);
  if (home.status !== "done" || banks.status !== "done") return <div className="tab">불러오는 중…</div>;
  return (
    <div className="tab">
      <h3 className="tab__h tab__h--first">내 계좌</h3>
      {home.data.accounts.map((a) => (
        <AccountEditor key={a.id} account={a} bank={banks.data.find((b) => b.code === a.bank?.code)} run={run} />
      ))}
      <h3 className="tab__h">카드</h3>
      <CardEditor key={`${home.data.profile.cardSpend}-${home.data.profile.cashbackCount}`} home={home.data} run={run} />
      <h3 className="tab__h">다른 은행 계좌 추가</h3>
      <AddBankAccount banks={banks.data} run={run} />
    </div>
  );
}

function AccountEditor({ account, bank, run }: { account: Account; bank?: Bank; run: Run }) {
  // draft: 사용자가 고치기 시작한 값. 안 건드렸으면 null → 서버 잔액을 그대로 보여줌
  // (effect로 서버 값을 state에 복사하지 않아도 거래가 추가되면 자동으로 최신 잔액이 보임)
  const [draft, setDraft] = useState<number | null>(null);
  const balance = draft ?? account.balance;
  const [safeDraft, setSafeDraft] = useState<number | null>(null);
  const safebox = safeDraft ?? account.safebox ?? 0;
  const [number, setNumber] = useState(account.number ?? "");
  const [openEdit, setOpenEdit] = useState(false);

  const external = account.kind === "external";
  return (
    <div className="acct-edit">
      <button className="acct-edit__head" onClick={() => setOpenEdit(!openEdit)}>
        <BankIcon bank={account.bank} size={30} />
        <span className="acct-edit__name">
          <strong>{accountName(account)}</strong>
          <small>{account.number}</small>
        </span>
        <span className="acct-edit__bal">{won(account.balance)}</span>
        <Icon name={openEdit ? "chevron-down" : "chevron-right"} size={16} stroke={2} />
      </button>
      {openEdit && (
        <div className="acct-edit__body">
          <Field label="잔액">
            <MoneyInput value={balance} onChange={setDraft} quick={[10000, 100000, 1000000]} />
          </Field>
          <button
            className="btn btn--sm"
            onClick={async () => {
              if (await run(() => api.updateAccount(account.id, { balance }), `${accountName(account)} 잔액을 바꿨어요`)) setDraft(null);
            }}
          >
            잔액 저장
          </button>
          {account.kind === "main" && (
            <>
              <Field label="세이프박스 (홈 카드 아래 칩)">
                <MoneyInput value={safebox} onChange={setSafeDraft} quick={[10000, 100000, 1000000]} />
              </Field>
              <button
                className="btn btn--sm"
                onClick={async () => {
                  if (await run(() => api.updateAccount(account.id, { safebox }), "세이프박스 금액을 바꿨어요")) setSafeDraft(null);
                }}
              >
                세이프박스 저장
              </button>
            </>
          )}
          {external && (
            <>
              <Field label="계좌번호">
                <input value={number} inputMode="numeric" onChange={(e) => setNumber(formatAccountNumber(bank?.pattern, e.target.value))} />
              </Field>
              <div className="row">
                <button className="btn btn--sm" onClick={() => run(() => api.updateAccount(account.id, { number }), "계좌번호를 바꿨어요")}>
                  계좌번호 저장
                </button>
                <button
                  className="btn btn--sm btn--danger"
                  onClick={() => confirm(`${account.label}를 삭제할까요?\n거래내역도 함께 지워져요.`) && run(() => api.deleteAccount(account.id), "계좌를 삭제했어요")}
                >
                  계좌 삭제
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 홈 카드 섹션: "이번달 쓴 돈"(직접 입력 / 자동 계산) + "현금 돌려받을 기회 N건"
function CardEditor({ home, run }: { home: HomeData; run: Run }) {
  const auto = home.profile.cardSpend === null;
  const [spend, setSpend] = useState(home.monthlyCardSpend);
  const [count, setCount] = useState(home.profile.cashbackCount);
  return (
    <div className="add-bank">
      <Field label={`이번달 쓴 돈 ${auto ? "(지금: 체크카드 거래 합계로 자동)" : "(지금: 직접 입력한 값)"}`}>
        <MoneyInput value={spend} onChange={setSpend} quick={[10000, 100000, 1000000]} />
      </Field>
      <div className="row">
        <button className="btn btn--sm" style={{ flex: 1 }} onClick={() => run(() => api.updateProfile({ cardSpend: spend }), "이번달 쓴 돈을 바꿨어요")}>
          이 금액으로
        </button>
        <button
          className="btn btn--sm btn--danger"
          disabled={auto}
          onClick={() => run(() => api.updateProfile({ cardSpend: null }), "체크카드 거래 합계로 계산해요")}
        >
          자동 계산으로
        </button>
      </div>
      <Field label="현금 돌려받을 기회">
        <div className="chips-row">
          <button className="chip-btn" onClick={() => setCount(Math.max(0, count - 1))}>
            −
          </button>
          <span className="count-value">{count}건</span>
          <button className="chip-btn" onClick={() => setCount(Math.min(99, count + 1))}>
            +
          </button>
          <button className="btn btn--sm" style={{ marginLeft: "auto" }} onClick={() => run(() => api.updateProfile({ cashbackCount: count }), `${count}건으로 바꿨어요`)}>
            저장
          </button>
        </div>
      </Field>
    </div>
  );
}

// 은행 고르기: 고른 은행을 보여주는 버튼 → 누르면 이체 화면과 같은 '은행선택' 목록(검색 가능)이 펼쳐짐
function BankSelect({ banks, value, onChange, exclude }: { banks: Bank[]; value: Bank; onChange: (b: Bank) => void; exclude?: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="bank-select" onClick={() => setOpen(!open)}>
        <BankIcon bank={value} size={30} />
        <strong>{value.name}</strong>
        <Icon name={open ? "chevron-down" : "chevron-right"} size={16} stroke={2} />
      </button>
      {open && (
        <div className="bank-select__picker">
          <BankPicker
            banks={banks}
            exclude={exclude}
            onPick={(b) => {
              onChange(b);
              setOpen(false);
            }}
          />
        </div>
      )}
    </>
  );
}

// 은행 형식대로 하이픈 넣은 계좌번호 입력칸 (형식 모르는 은행은 숫자만)
function NumberInput({ bank, value, onChange }: { bank: Bank; value: string; onChange: (v: string) => void }) {
  const placeholder = bank.pattern ? bank.pattern.map((n) => "0".repeat(n)).join("-") : "숫자 10~14자리";
  return <input value={value} inputMode="numeric" placeholder={placeholder} onChange={(e) => onChange(formatAccountNumber(bank.pattern, e.target.value).slice(0, 20))} />;
}

function AddBankAccount({ banks, run }: { banks: Bank[]; run: Run }) {
  const [bank, setBank] = useState(banks.find((b) => b.code === "kb") ?? banks[1]);
  const [number, setNumber] = useState("");
  const [balance, setBalance] = useState(0);

  return (
    <div className="add-bank">
      {/* 카카오뱅크 통장은 이미 있으니 여기선 뺀다 */}
      <BankSelect
        banks={banks}
        value={bank}
        exclude={["kakao"]}
        onChange={(b) => {
          setBank(b);
          setNumber("");
        }}
      />
      <Field label={`${bank.name} 계좌번호`}>
        <NumberInput bank={bank} value={number} onChange={setNumber} />
      </Field>
      <Field label="시작 잔액">
        <MoneyInput value={balance} onChange={setBalance} quick={[10000, 100000, 1000000]} />
      </Field>
      <button
        className="btn"
        onClick={async () => {
          if (await run(() => api.addBankAccount({ bankCode: bank.code, number, balance }), `${bank.name} 계좌를 추가했어요`)) {
            setNumber("");
            setBalance(0);
          }
        }}
      >
        계좌 추가
      </button>
    </div>
  );
}

// ---------- 받는 분: 이체할 때 계좌번호로 찾을 "다른 사람 계좌" ----------
function PayeesTab({ run }: { run: Run }) {
  const payees = useApi<Payee[]>(paths.payees);
  const banks = useApi<Bank[]>(paths.banks);
  if (payees.status !== "done" || banks.status !== "done") return <div className="tab">불러오는 중…</div>;
  return (
    <div className="tab">
      <p className="tab__hint">
        이체 화면에서 계좌번호를 입력하면 여기 등록된 이름이 나와요. 등록 안 된 계좌는 "계좌정보를 확인해 주세요"가 떠요.
        (내 계좌는 등록하지 않아도 돼요)
      </p>
      <h3 className="tab__h tab__h--first">받는 분 {payees.data.length}명</h3>
      {payees.data.map((p) => (
        <PayeeEditor key={p.id} payee={p} run={run} />
      ))}
      <h3 className="tab__h">받는 분 등록</h3>
      <AddPayee banks={banks.data} run={run} />
    </div>
  );
}

function PayeeEditor({ payee, run }: { payee: Payee; run: Run }) {
  const [open, setOpen] = useState(false);
  const [holder, setHolder] = useState(payee.holder);
  const [number, setNumber] = useState(formatAccountNumber(payee.bank.pattern, payee.number));
  return (
    <div className="acct-edit">
      <button className="acct-edit__head" onClick={() => setOpen(!open)}>
        <BankIcon bank={payee.bank} size={30} />
        <span className="acct-edit__name">
          <strong>
            {payee.holder} {payee.favorite && "★"}
          </strong>
          <small>
            {payee.bank.short} {payee.number}
          </small>
        </span>
        <Icon name={open ? "chevron-down" : "chevron-right"} size={16} stroke={2} />
      </button>
      {open && (
        <div className="acct-edit__body">
          <Field label="예금주 이름">
            <input value={holder} maxLength={20} onChange={(e) => setHolder(e.target.value)} />
          </Field>
          <Field label="계좌번호">
            <NumberInput bank={payee.bank} value={number} onChange={setNumber} />
          </Field>
          <div className="row">
            <button className="btn btn--sm" onClick={() => run(() => api.updatePayee(payee.id, { holder, number }), "받는 분 정보를 바꿨어요")}>
              저장
            </button>
            <button
              className="btn btn--sm btn--danger"
              onClick={() => confirm(`${payee.holder}님을 받는 분에서 지울까요?`) && run(() => api.deletePayee(payee.id), "받는 분을 지웠어요")}
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPayee({ banks, run }: { banks: Bank[]; run: Run }) {
  const [bank, setBank] = useState(banks.find((b) => b.code === "nh") ?? banks[0]);
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  return (
    <div className="add-bank">
      <BankSelect
        banks={banks}
        value={bank}
        onChange={(b) => {
          setBank(b);
          setNumber("");
        }}
      />
      <Field label={`${bank.name} 계좌번호`}>
        <NumberInput bank={bank} value={number} onChange={setNumber} />
      </Field>
      <Field label="예금주 이름">
        <input value={holder} maxLength={20} placeholder="예: 김민지" onChange={(e) => setHolder(e.target.value)} />
      </Field>
      <button
        className="btn"
        onClick={async () => {
          if (await run(() => api.addPayee({ bankCode: bank.code, number, holder }), `${holder}님을 등록했어요`)) {
            setNumber("");
            setHolder("");
          }
        }}
      >
        받는 분 등록
      </button>
    </div>
  );
}

// ---------- 거래: 계좌 고르고 → 금액·거래처 → 입금/출금 ----------
const MERCHANTS = ["편의점", "카페", "배달앱", "마트", "교통", "월급", "용돈", "이체"];
const TAGS: [TxTag, string][] = [
  ["#체크카드", "체크카드"],
  ["#자동이체", "자동이체"],
  ["#이체", "이체"],
  ["#예금이자", "이자"],
];

function TxTab({ run }: { run: Run }) {
  const home = useApi<HomeData>(paths.home);
  const [accountId, setAccountId] = useState("main");
  const [amount, setAmount] = useState(5000);
  const [merchant, setMerchant] = useState("편의점");
  const [tag, setTag] = useState<TxTag>("#체크카드");
  const list = useApi<Transaction[]>(paths.transactions(accountId));

  if (home.status !== "done") return <div className="tab">불러오는 중…</div>;
  const accounts = home.data.accounts;
  const current = accounts.find((a) => a.id === accountId) ?? accounts[0];

  const send = (sign: 1 | -1) =>
    run(
      () => api.createTransaction(current.id, { merchant, amount: sign * amount, tag }),
      `${merchant} ${won(amount)} ${sign > 0 ? "입금" : "출금"}했어요`,
    );

  return (
    <div className="tab">
      <Field label="계좌">
        <div className="chips-row chips-row--wrap">
          {accounts.map((a) => (
            <button key={a.id} className={`chip-btn ${a.id === current.id ? "on" : ""}`} onClick={() => setAccountId(a.id)}>
              {accountName(a)}
            </button>
          ))}
        </div>
      </Field>
      <p className="tab__hint">
        현재 잔액 <strong>{won(current.balance)}</strong>
      </p>

      <Field label="금액">
        <MoneyInput value={amount} onChange={setAmount} quick={[1000, 5000, 10000, 50000]} />
      </Field>
      <Field label="거래처">
        <div className="chips-row chips-row--wrap">
          {MERCHANTS.map((m) => (
            <button key={m} type="button" className={`chip-btn ${m === merchant ? "on" : ""}`} onClick={() => setMerchant(m)}>
              {m}
            </button>
          ))}
        </div>
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={20} placeholder="직접 입력" />
      </Field>
      <Field label="거래 종류">
        <Segmented value={tag} options={TAGS} onChange={setTag} />
      </Field>

      <div className="row">
        <button className="btn btn--in" onClick={() => send(1)}>
          입금하기 +
        </button>
        <button className="btn btn--out" onClick={() => send(-1)}>
          출금하기 −
        </button>
      </div>

      <h3 className="tab__h">최근 거래</h3>
      {list.status === "done" && list.data.length === 0 && <p className="tab__hint">거래가 없어요.</p>}
      {list.status === "done" &&
        list.data.slice(0, 10).map((t) => (
          <div key={t.id} className="tx-row">
            <span>
              {t.date} {t.merchant}
            </span>
            <span className={t.amount > 0 ? "tx-row__in" : ""}>{t.amount > 0 ? `+${won(t.amount)}` : won(t.amount)}</span>
            <button aria-label="거래 삭제" onClick={() => run(() => api.deleteTransaction(t.id), "거래를 지웠어요")}>
              <Icon name="close" size={14} stroke={2} />
            </button>
          </div>
        ))}
    </div>
  );
}
