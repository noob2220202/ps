import { useRef, useState, type ReactNode } from "react";
import { ApiError } from "../api/client";
import { api, formatAccountNumber, paths } from "../api/endpoints";
import { useApi } from "../api/useApi";
import type { Account, AppProfile, Bank, HomeData, Payee, Transaction, TransactionDetail, TransferRecipients, TxTag } from "../api/types";
import { won } from "../lib/format";
import { OS } from "../platform/platform";
import { THEME_CHOICE, THEME_LOCK } from "../platform/theme";
import { isCapture, setCapture } from "../platform/capture";
import { canRecord, recordPhone } from "../platform/recorder";
import { logout, remaining, useAuth } from "../auth/auth";
import { BankIcon } from "../components/BankIcon";
import { Icon } from "../components/icons/Icon";
import { BankPicker } from "../screens/transfer/TransferScreen";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { ALLONE, APP, HAS_INTRO, KAKAO2, currentProfileId, setCurrentProfile } from "../profile/session";
import { kbAdEnabled, kbAdHiddenUntil, kbAdResetHide, kbVariantMode, setKbAdEnabled, setKbVariantMode } from "../kbank/prefs";
import { TossAccountFields } from "../toss/devpanel/TossAccountFields";
import { TossPanelSection } from "../toss/devpanel/TossPanelSection";
import { TossTxFields } from "../toss/devpanel/TossTxFields";
import { aoApi, type AoAccount, type AoHome } from "../allone/api";
import { NoticePanel } from "../allone/home/NoticePanel";
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
    <div className={`dev-panel ${open ? "dev-panel--open" : ""} dev-panel--${APP}`} aria-hidden={!open}>
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
          {open && tab === "basic" && <BasicTab run={run} onClose={onClose} />}
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

// 콕뱅크는 계좌마다 이름(자립예탁금, 저축예금 등)으로
const accountName = (a: Account) => (APP !== "kakao" ? a.label : a.kind !== "main" ? a.bank.name : "카카오뱅크 통장");

// ---------- 기본: 기기 / 테마 / 내 정보 ----------
function BasicTab({ run, onClose }: { run: Run; onClose: () => void }) {
  const home = useApi<HomeData>(paths.home);
  if (home.status !== "done") return <div className="tab">불러오는 중…</div>;
  return <BasicForm run={run} initial={home.data} onClose={onClose} />;
}

function BasicForm({ run, initial, onClose }: { run: Run; initial: HomeData; onClose: () => void }) {
  const [name, setName] = useState(initial.profile.userName);
  const [card, setCard] = useState(initial.profile.cardLast4);
  // 기기/테마는 앱 전체가 처음 켤 때 정해지므로 저장 후 다시 연다
  const reopen = (query: string) => location.assign(`/?${query}&skip`);

  return (
    <div className="tab">
      <CurrentProfile />
      {/* kakao2 · allone 은 녹화 기기(아이폰 · 라이트 모드), 토스는 갤럭시 · 다크로 고정이라 기기 · 테마 고르기 없음 */}
      {!KAKAO2 && APP !== "toss" && !ALLONE && (
        <Field label="기기">
          <Segmented value={OS} options={[["android", "Galaxy"], ["ios", "iPhone"]]} onChange={(v) => reopen(`os=${v}`)} />
        </Field>
      )}
      <CaptureToggle />
      <RecordButton onStart={onClose} />
      {!THEME_LOCK && (
        <Field label="테마">
          <Segmented value={THEME_CHOICE} options={[["system", "시스템"], ["light", "라이트"], ["dark", "다크"]]} onChange={(v) => reopen(`theme=${v}`)} />
        </Field>
      )}
      {APP === "kbank" && <KbankTakeTwo run={run} home={initial} />}

      <h3 className="tab__h">내 정보</h3>
      <Field label="이름">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={10} />
      </Field>
      {APP === "kakao" && (
        <Field label="카드 끝 4자리">
          <input value={card} inputMode="numeric" maxLength={4} onChange={(e) => setCard(e.target.value.replace(/\D/g, ""))} />
        </Field>
      )}
      <button className="btn" onClick={() => run(() => api.updateProfile({ userName: name, cardLast4: card }), "내 정보를 저장했어요")}>
        저장
      </button>
      {/* NH올원뱅크: 정기점검 안내 시트 (home 영역 src/allone/home/NoticePanel.tsx) */}
      {ALLONE && <NoticePanel run={run} home={initial as AoHome} />}

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

// 케이뱅크 두 번째 녹화에서 새로 나온 것 (src/kbank/prefs.ts — 이 브라우저·프로필에만 저장):
//  - 홈 첫 진입 광고 바텀시트 켜기/끄기, '일주일간 보지 않기' 지우기 (앱을 켤 때 첫 홈에서만 뜸 → 다음에 켤 때부터)
//  - 알약 문구(홈 머리줄 알약 · 이체 '어디로' AI 알약): 번갈아 / 첫 녹화 / 두 번째 녹화 (다음에 앱을 켤 때부터 — 한 실행 안에서는 두 알약이 같은 문구)
//  - 중복 이체 확인창 시험: 예시 이체는 날짜가 밀려 '오늘 같은 이체'가 없을 수 있어 하나 넣어 둠
// kbank2(첫 녹화 인트로 재현)는 광고 없음 · 첫 녹화 문구 고정이라 바꾸지 않음
function KbankTakeTwo({ run, home }: { run: Run; home: HomeData }) {
  const [ad, setAd] = useState(kbAdEnabled);
  const [hideUntil, setHideUntil] = useState(kbAdHiddenUntil);
  const [mode, setMode] = useState(kbVariantMode);
  const [openedAt] = useState(Date.now); // 패널을 연 때 ('보지 않기' 기간이 지났는지)
  const from = home.accounts[0]?.id ?? "main";
  const recent = useApi<TransferRecipients>(paths.recipients(from)).data?.recent[0];
  if (HAS_INTRO)
    return (
      <Field label="두 번째 녹화 (광고 시트 · 알약 문구)">
        <p className="tab__hint">이 서버(kbank2)는 첫 녹화 재현이라 광고 시트 없음 · 첫 녹화 문구로 고정이에요.</p>
      </Field>
    );
  const hidden = hideUntil > openedAt;
  const until = new Date(hideUntil);
  return (
    <>
      <h3 className="tab__h">두 번째 녹화</h3>
      {/* label(Field) 로 감싸지 않음 — 안내 글을 누르면 첫 버튼('켜기' · '번갈아')이 눌려 설정이 몰래 바뀌었음 */}
      <div className="field">
        <span className="field__label">홈 첫 진입 광고 시트 (다음에 앱을 켤 때부터)</span>
        <Segmented
          value={ad ? "on" : "off"}
          options={[
            ["on", "켜기"],
            ["off", "끄기"],
          ]}
          onChange={(v) => {
            setKbAdEnabled(v === "on");
            setAd(v === "on");
          }}
        />
      </div>
      <div className="row">
        <button
          className="btn btn--sm"
          disabled={!hidden}
          onClick={() => {
            kbAdResetHide();
            setHideUntil(0);
          }}
        >
          '일주일간 보지 않기' 지우기
        </button>
      </div>
      <p className="tab__hint">
        {hidden
          ? `'일주일간 보지 않기'로 ${until.getMonth() + 1}월 ${until.getDate()}일 ${String(until.getHours()).padStart(2, "0")}:${String(until.getMinutes()).padStart(2, "0")}까지 안 보여요.`
          : "'일주일간 보지 않기'를 누르지 않았어요."}
      </p>
      <div className="field">
        <span className="field__label">알약 문구 (홈 · 이체 AI 알약, 다음에 앱을 켤 때부터)</span>
        <Segmented
          value={mode}
          options={[
            ["alternate", "번갈아"],
            ["v1", "첫 녹화"],
            ["v2", "두 번째 녹화"],
          ]}
          onChange={(v) => {
            setKbVariantMode(v);
            setMode(v);
          }}
        />
      </div>
      <p className="tab__hint">번갈아 = 앱을 켤 때마다 첫 녹화 · 두 번째 녹화 문구를 번갈아 (● 녹화도 새로 켠 것으로 셈).</p>
      {/* 여기도 label 로 감싸지 않음 — 안내 글을 눌러도 버튼이 눌려 1원이 나갔음 */}
      <div className="field">
        <span className="field__label">중복 이체 확인창 시험</span>
        <button
          className="btn btn--sm"
          disabled={!recent}
          onClick={() =>
            recent &&
            run(() => api.transfer({ fromAccountId: from, bankCode: recent.bank.code, number: recent.number, amount: 1 }), `${recent.holder}님께 1원을 보냈어요`)
          }
        >
          오늘 같은 이체 하나 넣기
        </button>
        <p className="tab__hint">
          {recent ? `최근 보낸 계좌 맨 위 ${recent.holder}님께 지금 1원을 보내 둠 → 앱에서 같은 분께 1원을 보내면 확인창이 떠요.` : "최근 보낸 계좌가 없어요."}
        </p>
      </div>
    </>
  );
}

// 화면 녹화: 패널을 닫고 → 브라우저가 "이 탭 공유"를 물어보면 허용 → 폰 화면만 녹화.
// 녹화하는 동안은 캡쳐모드로 테두리를 숨겼다가 끝나면 원래대로
function RecordButton({ onStart }: { onStart: () => void }) {
  if (!canRecord())
    return (
      <Field label="화면 녹화">
        <p className="tab__hint">이 브라우저는 웹 화면 녹화를 지원하지 않아요. 폰에서는 폰 자체 화면녹화를 써 주세요. (PC 크롬/엣지 권장)</p>
      </Field>
    );
  return (
    <Field label="화면 녹화 (폰 화면만 잘라서 영상 파일로 저장)">
      <button
        className="btn btn--sm"
        onClick={() => {
          onStart();
          recordPhone();
        }}
      >
        ● 녹화 시작
      </button>
      <p className="tab__hint">
        폰 아래 [● 녹화] 버튼과 같아요. 녹화가 시작되면 앱이 시작화면부터 다시 켜져요. PC는 공유 창에서 "이 탭", 폰은 허용한 뒤 화면을 한 번 더 누르면
        전체화면으로 시작돼요. 끝낼 때: PC는 위쪽 막대의 정지, 폰은 뒤로가기(전체화면 나가기)
      </p>
    </Field>
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
      <AccountLine />
    </div>
  );
}

// 로그인한 계정 · 남은 기간 · 로그아웃
function AccountLine() {
  const auth = useAuth();
  if (auth.status !== "in") return null;
  return (
    <p className="tab__hint" style={{ width: "100%", margin: "8px 0 0" }}>
      계정 {auth.user.username} · {remaining(auth.user)}{" "}
      <button className="btn btn--sm" onClick={() => logout().then(() => location.assign("/"))}>
        로그아웃
      </button>
    </p>
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
      {APP === "kakao" && <SuspendToggle suspended={!!home.data.profile.suspended} run={run} />}
      {/* 이번달 쓴 돈·캐시백은 카카오뱅크 홈에만 있음. 케이뱅크 홈 'ONE n월 쓴 돈' 도 이번달 쓴 돈 (캐시백 칸 없음).
          토스: 홈 '{M}월에 쓴 돈' = 소비 합계 + 캐시백 기회 */}
      {(APP === "kakao" || APP === "kbank" || APP === "toss") && (
        <>
          <h3 className="tab__h">카드</h3>
          <CardEditor key={`${home.data.profile.cardSpend}-${home.data.profile.cashbackCount}`} home={home.data} run={run} />
        </>
      )}
      {/* 콕뱅크는 농협 계좌만, 하나원큐는 하나은행 계좌만. 토스는 토스뱅크 계좌 + 다른 은행 계좌 (여러 은행을 모아 보는 앱) */}
      {APP === "toss" ? (
        <>
          <h3 className="tab__h">{ownBank().name} 계좌 추가</h3>
          <AddOwnBankAccount run={run} />
          <h3 className="tab__h">다른 은행 계좌 추가</h3>
          <AddBankAccount banks={banks.data} run={run} exclude={[]} withName />
          <TossPanelSection run={run} home={home.data} />
        </>
      ) : ALLONE ? (
        // NH올원뱅크: NH농협은행 계좌(홈 NH농협 카드 · 내계좌) + 다른 은행 출금계좌(다른금융 · 잔액채우기에서 꺼내 옴)
        <>
          <h3 className="tab__h">{ownBank().name} 계좌 추가</h3>
          <AddOwnBankAccount run={run} />
          <h3 className="tab__h">다른 은행 계좌 추가 (잔액채우기 출금계좌)</h3>
          <AddBankAccount banks={banks.data} run={run} exclude={[]} withName />
        </>
      ) : APP !== "kakao" ? (
        <>
          {/* 케이뱅크는 케이뱅크 계좌만 (서버도 다른 은행은 거절) */}
          <h3 className="tab__h">{ownBank().name} 계좌 추가</h3>
          <AddOwnBankAccount run={run} />
        </>
      ) : (
        <>
          <h3 className="tab__h">다른 은행 계좌 추가</h3>
          <AddBankAccount banks={banks.data} run={run} />
        </>
      )}
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
  const [label, setLabel] = useState(account.label);
  const [openEdit, setOpenEdit] = useState(false);

  const external = account.kind === "external";
  const own = APP !== "kakao"; // 콕뱅크·하나원큐·i-ONE Bank: 계좌 이름·번호를 대표계좌까지 전부 바꿀 수 있음
  const ownHint =
    APP === "hana"
      ? { name: "영하나플러스통장", number: "숫자 14자리", max: 16 }
      : APP === "ibk"
        ? { name: "보통예금(IBK W통장)", number: "숫자 14자리", max: 17 }
        : APP === "kbank"
          ? { name: "듀얼K 입출금통장", number: "숫자 12자리", max: 14 }
          : APP === "toss"
            ? { name: "토스뱅크 통장", number: "숫자 12자리", max: 14 }
            : APP === "allone"
              ? { name: "NH페이모아통장", number: "숫자 13자리", max: 16 }
              : { name: "자립예탁금", number: "숫자 13~14자리", max: 17 };
  // 토스: 토스뱅크 계좌만 자유 입력(숫자 · 하이픈), 다른 은행 계좌는 카카오뱅크처럼 그 은행 형식대로 하이픈 (하나 14자리 + 하이픈이 14자에서 잘리지 않게)
  // allone 도 같음: NH농협은행(은행 코드 nh) 계좌만 자유 입력, KB 등 다른 은행 계좌는 그 은행 형식대로
  const freeNumber = own && ((APP !== "toss" && APP !== "allone") || account.bank?.code === (APP === "allone" ? "nh" : "toss"));
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
          {account.kind === "main" && APP === "kakao" && (
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
          {own && (
            <>
              <Field label="계좌 이름 (홈·내역에 보이는 이름)">
                {/* 토스의 다른 은행 계좌는 '토스뱅크 통장' 대신 흔한 이름을 보기로 (freeNumber 는 토스 밖에선 늘 own 과 같음) */}
                <input value={label} maxLength={20} placeholder={freeNumber ? ownHint.name : "입출금통장"} onChange={(e) => setLabel(e.target.value)} />
              </Field>
              <button className="btn btn--sm" onClick={() => run(() => api.updateAccount(account.id, { name: label }), "계좌 이름을 바꿨어요")}>
                이름 저장
              </button>
            </>
          )}
          {/* 카카오뱅크 통장(main)도 번호를 바꿀 수 있음 — 이체 금액 화면 '(뒤 4자리)' 에 쓰임 */}
          {(external || own || account.kind === "main") && (
            <>
              <Field label="계좌번호">
                {freeNumber ? (
                  // 농협은 13자리(352-0000-0000-00)와 14자리(000000-00-000000), 하나은행은 14자리(000-000000-00000) → 숫자만 받고 서버가 하이픈을 넣음
                  <input value={number} inputMode="numeric" placeholder={ownHint.number} onChange={(e) => setNumber(e.target.value.replace(/[^\d-]/g, "").slice(0, ownHint.max))} />
                ) : (
                  <input value={number} inputMode="numeric" onChange={(e) => setNumber(formatAccountNumber(bank?.pattern, e.target.value, bank?.alt))} />
                )}
              </Field>
              <div className="row">
                <button className="btn btn--sm" onClick={() => run(() => api.updateAccount(account.id, { number }), "계좌번호를 바꿨어요")}>
                  계좌번호 저장
                </button>
                {external && (
                  <button
                    className="btn btn--sm btn--danger"
                    onClick={() => confirm(`${account.label}를 삭제할까요?\n거래내역도 함께 지워져요.`) && run(() => api.deleteAccount(account.id), "계좌를 삭제했어요")}
                  >
                    계좌 삭제
                  </button>
                )}
              </div>
            </>
          )}
          {APP === "toss" && <TossAccountFields account={account} run={run} />}
          {ALLONE && <AoBlockToggle account={account} run={run} />}
        </div>
      )}
    </div>
  );
}

// NH올원뱅크 계좌별 지급정지 (연습용). 걸면 이 계좌에서 보낼 때(이체 비밀번호 뒤 · 잔액채우기) 서버가 막고 '안내' 팝업 (녹화 C3 33.3 · 12.75). 입금은 그대로
function AoBlockToggle({ account, run }: { account: Account; run: Run }) {
  const blocked = !!(account as AoAccount).blocked;
  return (
    <div className="field">
      <span className="field__label">지급정지 (걸면 이 계좌에서 보낼 때 '안내' 팝업 · 연습용)</span>
      <Segmented
        value={blocked ? "on" : "off"}
        options={[
          ["on", "걸기"],
          ["off", "풀기"],
        ]}
        onChange={(v) => {
          if ((v === "on") !== blocked) run(() => aoApi.setBlocked(account.id, v === "on"), v === "on" ? "지급정지를 걸었어요" : "지급정지를 풀었어요");
        }}
      />
    </div>
  );
}

// 카카오뱅크 계좌 지급정지 (연습용): 켜면 이체의 마지막 '이체하기'에서 서버가 막고 '고객센터로 문의해주세요.' 팝업 (SuspendedDialog — 연습용 표시가 늘 같이 나옴).
// label(Field) 로 감싸지 않음 — 안내 글을 누르면 첫 버튼이 눌려 설정이 몰래 바뀜
function SuspendToggle({ suspended, run }: { suspended: boolean; run: Run }) {
  return (
    <div className="field">
      <span className="field__label">계좌 지급정지 (켜면 이체 마지막 '이체하기'에서 '고객센터로 문의해주세요.' 팝업 · 연습용 표시)</span>
      <Segmented
        value={suspended ? "on" : "off"}
        options={[
          ["on", "켜기"],
          ["off", "끄기"],
        ]}
        onChange={(v) => {
          if ((v === "on") !== suspended)
            run(() => api.updateProfile({ suspended: v === "on" }), v === "on" ? "지급정지를 켰어요" : "지급정지를 껐어요");
        }}
      />
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
      <Field
        label={
          APP === "toss"
            ? `이번 달 쓴 돈 (홈 · 소비) ${auto ? "(지금: 소비 합계로 자동)" : "(지금: 직접 입력한 값)"}`
            : `${APP === "kbank" ? "ONE 이번 달 쓴 돈" : "이번달 쓴 돈"} ${auto ? "(지금: 체크카드 거래 합계로 자동)" : "(지금: 직접 입력한 값)"}`
        }
      >
        <MoneyInput value={spend} onChange={setSpend} quick={[10000, 100000, 1000000]} />
      </Field>
      <div className="row">
        <button className="btn btn--sm" style={{ flex: 1 }} onClick={() => run(() => api.updateProfile({ cardSpend: spend }), "이번달 쓴 돈을 바꿨어요")}>
          이 금액으로
        </button>
        <button
          className="btn btn--sm btn--danger"
          disabled={auto}
          onClick={() => run(() => api.updateProfile({ cardSpend: null }), APP === "toss" ? "소비 합계로 계산해요" : "체크카드 거래 합계로 계산해요")}
        >
          자동 계산으로
        </button>
      </div>
      {(APP === "kakao" || APP === "toss") && (
        <Field label={APP === "toss" ? "캐시백 기회" : "현금 돌려받을 기회"}>
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
      )}
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
  const shape = (p: number[]) => p.map((n) => "0".repeat(n)).join("-");
  const placeholder = bank.pattern ? [bank.pattern, bank.alt].filter((p) => p).map((p) => shape(p!)).join(" 또는 ") : "숫자 10~14자리";
  return <input value={value} inputMode="numeric" placeholder={placeholder} onChange={(e) => onChange(formatAccountNumber(bank.pattern, e.target.value, bank.alt).slice(0, 20))} />;
}

// exclude: 은행 목록에서 뺄 은행 (카카오뱅크는 카카오뱅크 통장이 이미 있어 뺌, 토스는 [] ), withName: 계좌 이름 칸 (토스: 주거래하나 통장 등)
function AddBankAccount({ banks, run, exclude = ["kakao"], withName = false }: { banks: Bank[]; run: Run; exclude?: string[]; withName?: boolean }) {
  const [bank, setBank] = useState(banks.find((b) => b.code === "kb") ?? banks[1]);
  const [number, setNumber] = useState("");
  const [balance, setBalance] = useState(0);
  const [name, setName] = useState("");

  return (
    <div className="add-bank">
      {/* 카카오뱅크 통장은 이미 있으니 여기선 뺀다 */}
      <BankSelect
        banks={banks}
        value={bank}
        exclude={exclude}
        onChange={(b) => {
          setBank(b);
          setNumber("");
        }}
      />
      {withName && (
        <Field label="계좌 이름">
          <input value={name} maxLength={20} placeholder="입출금통장" onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      <Field label={`${bank.name} 계좌번호`}>
        <NumberInput bank={bank} value={number} onChange={setNumber} />
      </Field>
      <Field label="시작 잔액">
        <MoneyInput value={balance} onChange={setBalance} quick={[10000, 100000, 1000000]} />
      </Field>
      <button
        className="btn"
        onClick={async () => {
          if (
            await run(
              () => api.addBankAccount({ bankCode: bank.code, number, balance, ...(withName && name.trim() && { name: name.trim() }) }),
              `${bank.name} 계좌를 추가했어요`,
            )
          ) {
            setNumber("");
            setBalance(0);
            setName("");
          }
        }}
      >
        계좌 추가
      </button>
    </div>
  );
}

// 콕뱅크: 농협 계좌 추가 (은행 고르기 없음)
// 콕뱅크·하나원큐·i-ONE Bank: 그 은행 계좌만 추가 (이름 · 번호 · 시작 잔액)
const OWN_BANK = {
  nh: { code: "nh", name: "농협", placeholder: "저축예금", numberLabel: "농협 계좌번호 (농축협 14자리 / 농협은행 13자리)" },
  hana: { code: "hana", name: "하나은행", placeholder: "입출금통장", numberLabel: "하나은행 계좌번호 (14자리)" },
  ibk: { code: "ibk", name: "기업은행", placeholder: "보통예금", numberLabel: "기업은행 계좌번호 (14자리)" },
  kbank: { code: "kbank", name: "케이뱅크", placeholder: "듀얼K 입출금통장", numberLabel: "케이뱅크 계좌번호 (12자리)" },
  // 토스: 앱 id 와 은행 코드가 같은 "toss" (토스뱅크) — infra.md §4
  toss: { code: "toss", name: "토스뱅크", placeholder: "토스뱅크 통장", numberLabel: "토스뱅크 계좌번호 (12자리)" },
  // NH올원뱅크: 앱 id "allone" ≠ 은행 코드. NH농협은행 계좌는 은행 코드 "nh" (콕뱅크 앱 id 와 같은 글자지만 다른 것 — infra.md §4)
  allone: { code: "nh", name: "NH농협은행", placeholder: "NH페이모아통장", numberLabel: "NH농협은행 계좌번호 (13자리)" },
};
const ownBank = () => OWN_BANK[APP === "hana" || APP === "ibk" || APP === "kbank" || APP === "toss" || APP === "allone" ? APP : "nh"];
function AddOwnBankAccount({ run }: { run: Run }) {
  const own = ownBank();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [balance, setBalance] = useState(0);
  return (
    <div className="add-bank">
      <Field label="계좌 이름">
        <input value={name} maxLength={20} placeholder={own.placeholder} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={own.numberLabel}>
        <input value={number} inputMode="numeric" placeholder="숫자만" onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 14))} />
      </Field>
      <Field label="시작 잔액">
        <MoneyInput value={balance} onChange={setBalance} quick={[10000, 100000, 1000000]} />
      </Field>
      <button
        className="btn"
        onClick={async () => {
          if (await run(() => api.addBankAccount({ bankCode: own.code, name: name.trim() || undefined, number, balance }), `${own.name} 계좌를 추가했어요`)) {
            setName("");
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
        (내 계좌는 등록하지 않아도 돼요){APP === "kakao" && " '최근 이체에 표시'를 켠 받는 분만 이체 화면 '최근 이체'에 나와요."}
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
  const [number, setNumber] = useState(formatAccountNumber(payee.bank.pattern, payee.number, payee.bank.alt));
  return (
    <div className="acct-edit">
      <button className="acct-edit__head" onClick={() => setOpen(!open)}>
        <BankIcon bank={payee.bank} size={30} />
        <span className="acct-edit__name">
          <strong>
            {payee.holder} {payee.favorite && "★"} {payee.receiveError && "⚠"}
            {APP === "kakao" && payee.showRecent && <small> · 최근 이체</small>}
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
            {/* 카카오뱅크: 이 받는 분을 이체 화면 '최근 이체'에 보일지 (☆ 즐겨찾기와 따로) */}
            {APP === "kakao" && (
              <button
                className="btn btn--sm btn--ghost"
                onClick={() =>
                  run(
                    () => api.updatePayee(payee.id, { showRecent: !payee.showRecent }),
                    payee.showRecent ? "최근 이체에서 뺐어요" : "최근 이체에 넣었어요",
                  )
                }
              >
                {payee.showRecent ? "최근 이체에서 빼기" : "최근 이체에 넣기"}
              </button>
            )}
            {/* NH올원뱅크: ☆ (누구에게 보낼까요 '자주' 탭 · 거래내역 상세 ☆ 와 같은 값) */}
            {ALLONE && (
              <button
                className="btn btn--sm btn--ghost"
                onClick={() =>
                  run(() => aoApi.setFavorite(payee.id, !payee.favorite), payee.favorite ? "자주 보내는 분에서 뺐어요" : "자주 보내는 분에 넣었어요")
                }
              >
                {payee.favorite ? "☆ 자주에서 빼기" : "★ 자주에 넣기"}
              </button>
            )}
            {/* i-ONE Bank: 실제 녹화(28초)의 받는 은행 오류 안내를 이 계좌로 재현 */}
            {APP === "ibk" && (
              <button
                className="btn btn--sm btn--ghost"
                onClick={() =>
                  run(
                    () => api.updatePayee(payee.id, { receiveError: !payee.receiveError }),
                    payee.receiveError ? "받는 은행 오류를 껐어요" : "이 계좌로 보내면 받는 은행 오류 안내가 떠요",
                  )
                }
              >
                {payee.receiveError ? "받는 은행 오류 끄기" : "받는 은행 오류 켜기"}
              </button>
            )}
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
  // 처음 고른 은행 = 그 앱 은행 (은행 코드). allone 은 마지막 "nh" = NH농협은행 (앱 id "allone" 은 은행 코드가 아님)
  const [bank, setBank] = useState(banks.find((b) => b.code === (APP === "hana" || APP === "ibk" || APP === "kbank" || APP === "toss" ? APP : "nh")) ?? banks[0]);
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [recent, setRecent] = useState(true); // 카카오뱅크: 이체 화면 '최근 이체'에 보이게
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
      {APP === "kakao" && (
        <button type="button" className={`chip-btn${recent ? " on" : ""}`} style={{ alignSelf: "flex-start" }} onClick={() => setRecent(!recent)}>
          {recent ? "✓ 최근 이체에 표시" : "최근 이체에 안 보임"}
        </button>
      )}
      <button
        className="btn"
        onClick={async () => {
          if (await run(() => api.addPayee({ bankCode: bank.code, number, holder, ...(APP === "kakao" && { showRecent: recent }) }), `${holder}님을 등록했어요`)) {
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
// 토스는 성인 계정 예시라 '용돈' 대신 '관리비' (다른 앱은 그대로)
const MERCHANTS =
  APP === "toss" ? ["편의점", "카페", "배달앱", "마트", "교통", "월급", "관리비", "이체"] : ["편의점", "카페", "배달앱", "마트", "교통", "월급", "용돈", "이체"];
const TAGS: [TxTag, string][] = [
  ["#체크카드", "체크카드"],
  ["#자동이체", "자동이체"],
  ["#이체", "이체"],
  ["#예금이자", "이자"],
  // 카카오뱅크만: 고르면 거래상세·거래내역의 "#체크카드" 같은 뱃지가 안 보임
  ...(APP === "kakao" ? ([["", "없음"]] as [TxTag, string][]) : []),
];

function TxTab({ run }: { run: Run }) {
  const home = useApi<HomeData>(paths.home);
  const banks = useApi<Bank[]>(paths.banks);
  const [accountId, setAccountId] = useState("main");
  const [amount, setAmount] = useState(5000);
  const [merchant, setMerchant] = useState("편의점");
  const [tag, setTag] = useState<TxTag>("#체크카드");
  const list = useApi<Transaction[]>(paths.transactions(accountId));
  const [editing, setEditing] = useState<string | null>(null);
  const [shown, setShown] = useState(10); // 보여 줄 거래 수 (더 보기로 늘림)

  if (home.status !== "done" || banks.status !== "done") return <div className="tab">불러오는 중…</div>;
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
      <p className="tab__hint">거래를 누르면 상세거래내역 시트에 보이는 값을 전부 고칠 수 있어요 (시간까지).</p>
      {list.status === "done" && list.data.length === 0 && <p className="tab__hint">거래가 없어요.</p>}
      {list.status === "done" &&
        list.data.slice(0, shown).map((t) => (
          <div key={t.id}>
            <div className="tx-row">
              <button type="button" className="tx-row__main" onClick={() => setEditing(editing === t.id ? null : t.id)}>
                <span>
                  {t.date} {t.merchant}
                </span>
                <span className={t.amount > 0 ? "tx-row__in" : ""}>{t.amount > 0 ? `+${won(t.amount)}` : won(t.amount)}</span>
              </button>
              <button aria-label="거래 삭제" onClick={() => run(() => api.deleteTransaction(t.id), "거래를 지웠어요")}>
                <Icon name="close" size={14} stroke={2} />
              </button>
            </div>
            {editing === t.id && <TxEditForm tx={t} banks={banks.data} run={run} onSaved={() => setEditing(null)} />}
          </div>
        ))}
      {/* 예전엔 최근 10건만 보여서 그보다 오래된 거래는 고칠 수 없었음 → 더 보기 / 전부 보기 */}
      {list.status === "done" && list.data.length > shown && (
        <div className="row">
          <button className="btn btn--sm" style={{ flex: 1 }} onClick={() => setShown(shown + 20)}>
            더 보기 ({shown} / {list.data.length}건)
          </button>
          <button className="btn btn--sm btn--ghost" onClick={() => setShown(list.data.length)}>
            전부 보기
          </button>
        </div>
      )}
    </div>
  );
}

const SIGN_OPTIONS: ["out" | "in", string][] = [
  ["out", "출금"],
  ["in", "입금"],
];

// 상세거래내역 시트에 보이는 값 전부: 이름·금액(입금/출금)·날짜시간(초까지)·거래구분·상대은행·상대계좌·상대계좌 예금주명·메모
function TxEditForm({ tx, banks, run, onSaved }: { tx: Transaction; banks: Bank[]; run: Run; onSaved: () => void }) {
  const detail = useApi<TransactionDetail>(paths.transaction(tx.id));
  const [merchant, setMerchant] = useState(tx.merchant);
  const [sign, setSign] = useState<"out" | "in">(tx.amount < 0 ? "out" : "in");
  const [amount, setAmount] = useState(Math.abs(tx.amount));
  const [tag, setTag] = useState<TxTag>(tx.tag);
  const [date, setDate] = useState(tx.at.slice(0, 10));
  const [time, setTime] = useState(tx.at.slice(11, 19));
  const [kind, setKind] = useState("");
  const [bank, setBank] = useState(banks.find((b) => b.code === "kakao") ?? banks[0]);
  const [counterNumber, setCounterNumber] = useState("");
  const [counterHolder, setCounterHolder] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  // 상세 조회가 끝나면 그 값으로 한 번만 채움 (타이핑하는 중에 다시 덮어쓰지 않게)
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (detail.status === "done" && loadedFor !== tx.id) {
    setLoadedFor(tx.id);
    setKind(detail.data.kind);
    setMemo(detail.data.memo ?? "");
    if (detail.data.transfer) {
      setBank(banks.find((b) => b.code === detail.data.transfer!.bank.code) ?? bank);
      setCounterNumber(detail.data.transfer.number);
      setCounterHolder(detail.data.transfer.holder);
    }
  }
  const ready = detail.status === "done" && loadedFor === tx.id;

  // 카카오뱅크는 상대 정보(상대은행·상대계좌·상대계좌 예금주명)를 "이체"에서만 둠 — 다른 종류로 바꾸면 있던 상대 정보도 지움
  const clearCounter = APP === "kakao" && tag !== "#이체";

  const save = async () => {
    if (busy || !ready) return;
    setBusy(true);
    const ok = await run(
      () =>
        api.updateTransaction(tx.id, {
          merchant,
          amount: sign === "out" ? -amount : amount,
          tag,
          at: `${date}T${time}`,
          kind,
          memo,
          counterBank: clearCounter ? "" : bank.code,
          counterNumber: clearCounter ? "" : counterNumber,
          counterHolder: clearCounter ? "" : counterHolder,
        }),
      "거래를 고쳤어요",
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <div className="tx-edit">
      <Field label="이름">
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={20} />
      </Field>
      <div className="row">
        <Field label="거래내용">
          <Segmented value={sign} options={SIGN_OPTIONS} onChange={setSign} />
        </Field>
      </div>
      <Field label="금액">
        <MoneyInput value={amount} onChange={setAmount} quick={[1000, 5000, 10000, 50000]} />
      </Field>
      <div className="row">
        <Field label="날짜">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="시간">
          <input type="time" step={1} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="거래 종류">
        <Segmented value={tag} options={TAGS} onChange={setTag} />
      </Field>
      <Field label="거래구분">
        <input value={kind} onChange={(e) => setKind(e.target.value)} maxLength={20} placeholder={ready ? undefined : "불러오는 중…"} disabled={!ready} />
      </Field>
      {!clearCounter && (
        <>
          <Field label="상대은행">
            <BankSelect banks={banks} value={bank} onChange={setBank} />
          </Field>
          <Field label="상대계좌">
            <NumberInput bank={bank} value={counterNumber} onChange={setCounterNumber} />
          </Field>
          <Field label="상대계좌 예금주명">
            <input value={counterHolder} onChange={(e) => setCounterHolder(e.target.value)} maxLength={20} placeholder="계좌·예금주명을 비우면 상대 정보 없음" />
          </Field>
        </>
      )}
      <Field label="메모">
        <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={25} placeholder={ready ? undefined : "불러오는 중…"} disabled={!ready} />
      </Field>
      <div className="row">
        <button type="button" className="btn btn--sm" disabled={busy || !ready} onClick={save}>
          저장
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onSaved}>
          닫기
        </button>
      </div>
      {/* 토스만의 거래 칸 (분류 · 결제 수단 · 카드 · 취소됨 · 소비에서 제외): 저장은 그 칸이 따로 */}
      {APP === "toss" && <TossTxFields tx={tx} run={run} />}
    </div>
  );
}
