import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import { useApi } from "../api/useApi";
import { TX_TAGS, type AccountId, type DevSettings, type HomeData, type NewTransaction, type Transaction, type TxTag } from "../api/types";
import { won } from "../lib/format";
import { OS } from "../platform/platform";
import { THEME_CHOICE } from "../platform/theme";
import { getLog, getLogVersion, subscribeLog } from "../mock-server/server";
import { Icon } from "../components/icons/Icon";
import "./DevPanel.css";

// 종 버튼으로 여는 "개발자 패널".
// 이 패널도 화면들과 똑같이 /api 로만 데이터를 바꾼다 → 요청/응답을 눈으로 보며 REST API를 연습하는 용도.
// (API 로그 탭만 예외로 가짜 서버의 기록을 직접 읽음 — 브라우저 개발자도구의 Network 탭 역할)

type Tab = "settings" | "profile" | "tx" | "log";
const TABS: [Tab, string][] = [
  ["settings", "설정"],
  ["profile", "내 정보"],
  ["tx", "거래 만들기"],
  ["log", "API 로그"],
];

export function DevPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("settings");
  return (
    <div className={`dev-panel ${open ? "dev-panel--open" : ""}`} aria-hidden={!open}>
      <div className="dev-panel__backdrop" onClick={onClose} />
      <section className="dev-panel__sheet" role="dialog" aria-label="개발자 패널">
        <div className="dev-panel__grabber" />
        <header className="dev-panel__head">
          <strong>개발자 패널</strong>
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
        {/* 닫혀 있을 땐 내용을 안 그림 → 숨은 패널이 API를 계속 호출하지 않게 */}
        <div className="dev-panel__body">
          {open && tab === "settings" && <SettingsTab />}
          {open && tab === "profile" && <ProfileTab />}
          {open && tab === "tx" && <TxTab />}
          {open && tab === "log" && <LogTab />}
        </div>
      </section>
    </div>
  );
}

// ---------- 공통 조각 ----------
function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" className={v === value ? "on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}

const json = (v: unknown) => JSON.stringify(v, null, 2);

// 요청 결과를 "HTTP 응답"처럼 보여주는 박스
type Result = { ok: true; status: number; body: unknown } | { ok: false; error: ApiError };
function ResultBox({ result }: { result: Result | null }) {
  if (!result) return null;
  return result.ok ? (
    <pre className="result result--ok">
      {result.status} OK{"\n"}
      {json(result.body)}
    </pre>
  ) : (
    <pre className="result result--err">
      {result.error.status} {result.error.code}
      {"\n"}
      {json({ message: result.error.message, fields: result.error.fields })}
    </pre>
  );
}

async function run(fn: () => Promise<unknown>, status = 200): Promise<Result> {
  try {
    return { ok: true, status, body: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e : new ApiError(0, { message: String(e) }) };
  }
}

// ---------- 설정 ----------
function SettingsTab() {
  const [settings, setSettings] = useState<DevSettings | null>(null);
  const [latency, setLatency] = useState(0);
  useEffect(() => {
    api.getDevSettings().then((s) => {
      setSettings(s);
      setLatency(s.latency);
    });
  }, []);

  // 기기/테마는 앱 전체 CSS·컴포넌트가 처음 켤 때 정해지므로, 저장 후 새로 연다
  const reopen = (query: string) => location.assign(`/?${query}&skip`);

  const update = async (patch: Partial<DevSettings>) => setSettings(await api.updateDevSettings(patch));

  return (
    <div className="tab">
      <Field label="기기">
        <Segmented value={OS} options={[["android", "Galaxy"], ["ios", "iPhone"]]} onChange={(v) => reopen(`os=${v}`)} />
      </Field>
      <Field label="테마">
        <Segmented
          value={THEME_CHOICE}
          options={[["system", "시스템"], ["light", "라이트"], ["dark", "다크"]]}
          onChange={(v) => reopen(`theme=${v}`)}
        />
      </Field>

      <h3 className="tab__h">가짜 서버</h3>
      <Field label={`응답 지연: ${latency}ms`}>
        <input
          type="range"
          min={0}
          max={2000}
          step={50}
          value={latency}
          onChange={(e) => setLatency(Number(e.target.value))}
          onPointerUp={() => update({ latency })}
          onKeyUp={() => update({ latency })}
        />
      </Field>
      <Field label="실패 확률 (500 에러)">
        <Segmented
          value={settings?.failRate ?? 0}
          options={[[0, "0%"], [0.1, "10%"], [0.3, "30%"], [0.5, "50%"]]}
          onChange={(v) => update({ failRate: v })}
        />
      </Field>
      <p className="tab__hint">지연을 늘리면 스켈레톤·스피너를, 실패 확률을 올리면 "다시 시도" 화면을 직접 확인할 수 있어요.</p>

      <button
        className="btn btn--danger"
        onClick={async () => {
          if (confirm("이름·잔액·거래내역을 처음 상태로 되돌릴까요?")) await api.reset();
        }}
      >
        데이터 초기화 (POST /api/reset)
      </button>
    </div>
  );
}

// ---------- 내 정보 ----------
function ProfileTab() {
  const home = useApi<HomeData>(paths.home);
  if (home.status !== "done") return <div className="tab">불러오는 중…</div>;
  // 데이터가 온 뒤에 폼을 그리고, 폼의 초기값은 props로 받는다.
  // (effect 안에서 setForm으로 복사하면 렌더가 한 번 더 일어나고, 재요청 때 입력 중인 값을 덮어쓸 위험)
  return <ProfileForm initial={home.data} />;
}

function ProfileForm({ initial }: { initial: HomeData }) {
  const [form, setForm] = useState(() => {
    const bal = (id: AccountId) => String(initial.accounts.find((a) => a.id === id)?.balance ?? 0);
    return { ...initial.profile, main: bal("main"), nh: bal("nh") };
  });
  const [result, setResult] = useState<Result | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const fields = result && !result.ok ? result.error.fields : undefined;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const { userName, miniAccountNo, cardLast4 } = form;
    setResult(await run(() => api.updateProfile({ userName, miniAccountNo, cardLast4 })));
  };
  const saveBalance = async (id: AccountId) => {
    setResult(await run(() => api.updateBalance(id, Number(form[id as "main" | "nh"]))));
  };

  return (
    <div className="tab">
      <form onSubmit={saveProfile}>
        <Field label="이름" error={fields?.userName}>
          <input value={form.userName} onChange={set("userName")} maxLength={10} />
        </Field>
        <Field label="mini 계좌번호" error={fields?.miniAccountNo}>
          <input value={form.miniAccountNo} onChange={set("miniAccountNo")} placeholder="0000-00-0000000" />
        </Field>
        <Field label="카드 끝 4자리" error={fields?.cardLast4}>
          <input value={form.cardLast4} onChange={set("cardLast4")} inputMode="numeric" maxLength={4} />
        </Field>
        <button className="btn">저장 (PATCH /api/profile)</button>
      </form>

      <h3 className="tab__h">잔액</h3>
      {(["main", "nh"] as const).map((id) => (
        <div key={id} className="row">
          <Field label={id === "main" ? "입출금통장" : "농협은행 계좌"} error={fields?.balance}>
            <input value={form[id]} onChange={set(id)} inputMode="numeric" />
          </Field>
          <button type="button" className="btn btn--sm" onClick={() => saveBalance(id)}>
            저장
          </button>
        </div>
      ))}
      <p className="tab__hint">잔액을 바꾸면 거래내역의 "거래 후 잔액"도 새 잔액 기준으로 다시 계산돼요.</p>

      <ResultBox result={result} />
    </div>
  );
}

// ---------- 거래 만들기 ----------
const nowLocal = () => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16); // datetime-local 형식 "2026-10-28T09:30"
};

function TxTab() {
  const [accountId, setAccountId] = useState<AccountId>("main");
  const [dir, setDir] = useState<"out" | "in">("out");
  const [amount, setAmount] = useState("5000");
  const [merchant, setMerchant] = useState("예시편의점");
  const [tag, setTag] = useState<TxTag>("#체크카드");
  const [at, setAt] = useState(nowLocal);
  const [result, setResult] = useState<Result | null>(null);
  const list = useApi<Transaction[]>(paths.transactions(accountId));

  const body: NewTransaction = {
    merchant,
    amount: (dir === "out" ? -1 : 1) * Math.abs(Math.round(Number(amount) || 0)),
    tag,
    at,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(await run(() => api.createTransaction(accountId, body), 201));
  };
  const fields = result && !result.ok ? result.error.fields : undefined;

  return (
    <div className="tab">
      <form onSubmit={submit}>
        <Field label="계좌">
          <Segmented value={accountId} options={[["main", "입출금통장"], ["mini", "mini"]]} onChange={setAccountId} />
        </Field>
        <Field label="종류">
          <Segmented value={dir} options={[["out", "출금 (-)"], ["in", "입금 (+)"]]} onChange={setDir} />
        </Field>
        <div className="row">
          <Field label="금액" error={fields?.amount}>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="태그" error={fields?.tag}>
            <select value={tag} onChange={(e) => setTag(e.target.value as TxTag)}>
              {TX_TAGS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="거래처" error={fields?.merchant}>
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={20} />
        </Field>
        <Field label="거래 시각" error={fields?.at}>
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>

        <pre className="result result--req">
          POST {paths.transactions(accountId)}
          {"\n"}
          {json(body)}
        </pre>
        <button className="btn">요청 보내기</button>
      </form>

      <ResultBox result={result} />

      <h3 className="tab__h">최근 거래 (DELETE로 삭제)</h3>
      {list.status === "done" &&
        list.data.slice(0, 8).map((t) => (
          <div key={t.id} className="tx-row">
            <span>
              {t.date} {t.merchant}
            </span>
            <span className={t.amount > 0 ? "tx-row__in" : ""}>{t.amount > 0 ? `+${won(t.amount)}` : won(t.amount)}</span>
            <button
              aria-label="삭제"
              onClick={async () => setResult(await run(() => api.deleteTransaction(t.id), 204))}
            >
              <Icon name="close" size={14} stroke={2} />
            </button>
          </div>
        ))}
      {list.status === "done" && list.data.length === 0 && <p className="tab__hint">거래가 없어요.</p>}
    </div>
  );
}

// ---------- API 로그 ----------
function LogTab() {
  useSyncExternalStore(subscribeLog, getLogVersion);
  const [openId, setOpenId] = useState<number | null>(null);
  const entries = getLog();
  return (
    <div className="tab">
      <p className="tab__hint">화면들이 보낸 요청이 최신순으로 쌓여요. 눌러서 요청/응답 내용을 보세요.</p>
      {entries.length === 0 && <p className="tab__hint">아직 요청이 없어요.</p>}
      {entries.map((e) => (
        <div key={e.id} className="log">
          <button className="log__line" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
            <span className="log__time">{e.at}</span>
            <span className={`log__method log__method--${e.method}`}>{e.method}</span>
            <span className="log__path">{e.path}</span>
            <span className={`log__status ${e.status >= 400 ? "log__status--err" : ""}`}>{e.status}</span>
            <span className="log__ms">{e.ms}ms</span>
          </button>
          {openId === e.id && (
            <pre className="result">
              {e.request !== undefined && `요청 본문\n${json(e.request)}\n\n`}
              응답 본문{"\n"}
              {e.response === undefined ? "(없음 — 204 No Content)" : json(e.response)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
