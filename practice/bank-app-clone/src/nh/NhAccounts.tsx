import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { api, paths } from "../api/endpoints";
import type { Account, HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { Dialog, Keypad, Sheet } from "../components/Sheet";
import { useStatusBar } from "../hooks/useStatusBar";
import { applyKey } from "../lib/keypad";
import { BackArrowKey, NhCloseIcon, NhHeader, NhImg, NhKokKey } from "./common";
import { nhWon } from "./hangul";
import { useNhGo, withNhLoading } from "./loading";
import "./nh-accounts.css";
import "./nh-register.css";

// 아이콘은 실제 화면(스크린샷 720px)에서 잰 모양을 24dp 상자에 옮긴 것 (scratchpad work/accounts/spec.md)

// 잠금 동그라미 안 자물쇠 (열림 = 금액 보이는 중)
function Padlock({ open }: { open: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="5.15" y="10.4" width="13.7" height="9.23" rx="3.4" />
      <path
        d={
          open
            ? "M9.07 10.4V7.68a2.93 2.93 0 0 1 5.86 0"
            : "M9.07 10.4V7.68a2.93 2.93 0 0 1 5.86 0v2.72"
        }
      />
      <path d="M12 14.6v1.7" />
    </svg>
  );
}

// 보기 토글: 카드(둥근 사각 + ↓) / 목록(세 줄 + ↑)
function CardViewIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      aria-hidden
    >
      <rect x="3" y="7.75" width="11.3" height="10.15" rx="1.9" />
      <path d="M18.85 4.9v6.1M16.75 8.75l2.1 2.35 2.1-2.35" />
    </svg>
  );
}
function ListViewIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <path d="M2.4 9.3h12.8M2.4 13.55h12.8M2.4 17.8h12.8" />
      <path d="M19.2 12.6V6.5M16.95 8.95l2.25-2.45 2.25 2.45" />
    </svg>
  );
}

// 섹션 ^ (잉크 11.2 × 5.9, 굵기 1.5). 접히면 ⌄
function SecChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`nh-asec__chev ${open ? "" : "down"}`}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M7 14.1 12 10.15l5 3.95" />
    </svg>
  );
}

// 카드 오른쪽 위 ⋮ (점 지름 3.1, 간격 6.13)
function MoreDots() {
  return (
    <svg
      width="4"
      height="16.4"
      viewBox="0 0 4 16.4"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="2" cy="2" r="1.55" />
      <circle cx="2" cy="8.13" r="1.55" />
      <circle cx="2" cy="14.27" r="1.55" />
    </svg>
  );
}

function QMark({ className = "" }: { className?: string }) {
  return (
    <span className={`nh-accts__q ${className}`} aria-hidden>
      ?
    </span>
  );
}

// 넓게 / 포함 토글: 켜짐 = 보라 알약 + 오른쪽 검은 손잡이
function NhSwitch({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      className={`nh-switch ${on ? "on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span>{label}</span>
      <i />
    </button>
  );
}

type SecKey = "dep" | "sav" | "loan" | "fund" | "fx" | "card";
const SECTIONS: { key: SecKey; title: string; chip: string; shop?: string }[] =
  [
    { key: "dep", title: "입출금", chip: "입출금" },
    {
      key: "sav",
      title: "예적금/신탁",
      chip: "예적금/신탁",
      shop: "예적금 상품 알아보기",
    },
    { key: "loan", title: "대출", chip: "대출", shop: "대출 상품 알아보기" },
    { key: "fund", title: "펀드", chip: "펀드", shop: "펀드 상품 알아보기" },
    { key: "fx", title: "외화", chip: "외화", shop: "외화 상품 알아보기" },
    { key: "card", title: "카드", chip: "카드" },
  ];

// 빈 섹션: 흰 공(점 3개가 하나씩 나타남) + '계좌를 찾을 수 없어요.' + 상품 링크
function EmptyCard({ shop }: { shop: string }) {
  return (
    <div className="nh-acard nh-acard--empty">
      <span className="nh-acard__ball">
        <NhImg name="nh-accounts-more" w={51.2} h={51.2} fallback={<span />} />
        <i />
        <i />
        <i />
      </span>
      <b>계좌를 찾을 수 없어요.</b>
      <button className="nh-acard__shop">{shop}</button>
    </div>
  );
}

// 전체계좌 조회 (스크린샷 2026-10-28 9:48, 녹화2 38.25~39.7초)
// 위: 잠금 · 총액 · ?, 필터 칩, 보기 토글(카드/목록), 넓게 토글. 아래: 종류별 섹션(^ 로 접기) + 계좌 카드
export function NhAccounts() {
  const navigate = useNavigate();
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const home = useApi<HomeData>(paths.home);
  const [hidden, setHidden] = useState(false); // 자물쇠: 금액 가리기
  const [chip, setChip] = useState("전체");
  const [view, setView] = useState<"card" | "list">("card");
  const [wide, setWide] = useState(true); // 넓게 (참고 화면은 켜짐)
  const [withLoan, setWithLoan] = useState(true); // 대출 '포함'
  const [folded, setFolded] = useState<SecKey[]>([]);
  useStatusBar("#18171c", "light");

  const accounts = home.data?.accounts ?? [];
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  const money = (n: number) => (hidden ? "잔액보기" : nhWon(n));
  const shown = SECTIONS.filter((s) => chip === "전체" || s.chip === chip);
  const toggle = (k: SecKey) =>
    setFolded((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));

  const card = (a: Account) =>
    view === "list" ? (
      <button
        key={a.id}
        className="nh-arow"
        onClick={() => go(`/history/${a.id}`)}
      >
        <NhImg
          name="nh-accounts-acct"
          w={42.67}
          h={41.6}
          className="nh-arow__icon"
          fallback={<span>🟡</span>}
        />
        <span className="nh-arow__info">
          <b>{a.label}</b>
          <span>농축협 {a.number}</span>
        </span>
        <em>{money(a.balance)}</em>
      </button>
    ) : (
      <div key={a.id} className="nh-acard">
        <button className="nh-acard__more" aria-label="더보기">
          <MoreDots />
        </button>
        <NhImg
          name="nh-accounts-acct"
          w={42.67}
          h={41.6}
          className="nh-acard__icon"
          fallback={<span>🟡</span>}
        />
        <span className="nh-acard__name">
          <b>{a.label}</b>
          <span>
            <span className="nh-acard__no">농축협 {a.number}</span>
            <button
              className="nh-acard__tag"
              onClick={() => go(`/history/${a.id}`)}
            >
              자세히
            </button>
          </span>
        </span>
        <p className="nh-acard__bal">{money(a.balance)}</p>
        <div className="nh-acard__btns">
          <button onClick={() => go(`/history/${a.id}`)}>거래내역</button>
          <i />
          <button onClick={() => go(`/send?from=${a.id}`)}>송금</button>
        </div>
      </div>
    );

  return (
    <div className="screen nh nh-accts">
      <NhHeader
        title="전체계좌 조회"
        onBack={() => navigate(-1)}
        home={() => navigate("/")}
        menu
      />
      <div className="nh-accts__scroll">
        <div className="nh-accts__total">
          <button
            className="nh-accts__lock"
            aria-label={hidden ? "금액 보기" : "금액 가리기"}
            onClick={() => setHidden((h) => !h)}
          >
            <Padlock open={!hidden} />
          </button>
          <b>{home.data ? money(total) : " "}</b>
          <QMark />
        </div>
        <div className="nh-accts__chips" role="tablist">
          {["전체", ...SECTIONS.map((s) => s.chip)].map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={chip === c}
              className={chip === c ? "on" : ""}
              onClick={() => setChip(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="nh-accts__panel">
          <div className="nh-accts__view">
            <button
              className={view === "card" ? "on" : ""}
              aria-label="카드로 보기"
              onClick={() => setView("card")}
            >
              <CardViewIcon />
            </button>
            <button
              className={view === "list" ? "on" : ""}
              aria-label="목록으로 보기"
              onClick={() => setView("list")}
            >
              <ListViewIcon />
            </button>
          </div>
          <div className="nh-accts__wide">
            <NhSwitch label="넓게" on={wide} onChange={setWide} />
          </div>

          <div
            className={`nh-accts__secs ${wide ? "" : "narrow"} ${view === "list" ? "list" : ""}`}
          >
            {shown.map((s) => {
              const list = s.key === "dep" ? accounts : [];
              const open = !folded.includes(s.key);
              const sum = list.reduce((n, a) => n + a.balance, 0);
              return (
                <section key={s.key} className={`nh-asec nh-asec--${s.key}`}>
                  <div
                    className="nh-asec__head"
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => toggle(s.key)}
                  >
                    <h2>
                      {s.title}
                      {s.key === "card" ? (
                        <QMark className="nh-asec__q" />
                      ) : (
                        <em>{list.length}</em>
                      )}
                    </h2>
                    {s.key === "card" ? (
                      <b className="nh-asec__none">미보유</b>
                    ) : (
                      <>
                        <b>{money(sum)}</b>
                        {s.key === "loan" && (
                          <span
                            className="nh-asec__switch"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <NhSwitch
                              label="포함"
                              on={withLoan}
                              onChange={setWithLoan}
                            />
                          </span>
                        )}
                      </>
                    )}
                    <SecChevron open={open} />
                  </div>
                  {open && s.key !== "card" && (
                    <div className="nh-asec__body">
                      {list.length ? (
                        list.map(card)
                      ) : (
                        <EmptyCard shop={s.shop ?? ""} />
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <button
            className="nh-btn nh-btn--outline-purple nh-accts__reg"
            onClick={() => go("/register")}
          >
            콕에 등록된 계좌 보기
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 농협계좌 등록 (녹화2 61.46~65.2초) ----------
// 실제: 조회된 계좌가 없으면 캐릭터 + 안내, '계좌 직접입력 조회'로 계좌를 찾고 [다음]으로 등록. [취소] → 알림창
// 연습용: '계좌 직접입력 조회' 시트에서 계좌번호(농협은행 13자리 / 농축협 14자리)와 지금 잔액을 넣으면 목록에 나오고 [다음]으로 등록

const fmtNumber = (d: string) =>
  d.length === 14
    ? `${d.slice(0, 6)}-${d.slice(6, 8)}-${d.slice(8)}`
    : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}-${d.slice(11)}`;

// 입력칸 오른쪽 ⓧ (공용 계좌번호 시트와 같은 모양)
function ClearCircle() {
  return (
    <svg width="24.6" height="24.6" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#535f6e" />
      <path
        d="m8.15 8.15 7.7 7.7m0-7.7-7.7 7.7"
        stroke="#cbd2da"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18.4"
      height="13.6"
      viewBox="0 0 18.4 13.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M1.2 6 6.8 11.6l10.4-10.4" />
    </svg>
  );
}

export function NhRegister() {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<"number" | "balance" | null>(null);
  const [digits, setDigits] = useState("");
  const [balance, setBalance] = useState("");
  const [found, setFound] = useState<{
    number: string;
    balance: number;
  } | null>(null); // 직접입력으로 찾은 계좌
  const [noteOpen, setNoteOpen] = useState(true);
  const [ask, setAsk] = useState(false); // 취소 알림창
  const [error, setError] = useState<string | null>(null);
  useStatusBar(sheet ? "#0a090b" : "#18171c", "light");

  const openDirect = () => {
    setDigits(found?.number ?? "");
    setBalance(found ? String(found.balance) : "");
    setSheet("number");
  };
  const numberOk = digits.length === 13 || digits.length === 14;
  const toBalance = () => {
    if (!numberOk)
      return setError(
        "농협은행 13자리, 농축협 14자리\n계좌번호를 입력해 주세요.",
      );
    setSheet("balance");
  };
  const lookup = () => {
    setFound({ number: digits, balance: Number(balance || 0) });
    setSheet(null);
  };
  const submit = () => {
    if (!found) return;
    withNhLoading(() =>
      api.addBankAccount({
        bankCode: "nh",
        number: found.number,
        balance: found.balance,
        name: "저축예금",
      }),
    )
      .then(() => navigate(-1))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "연결에 실패했어요"),
      );
  };
  // 예: 알림창이 닫히고 0.19초 뒤 점 3개 로딩 0.65초 → 이전 화면 (녹화2 64.36 → 64.55 → 65.19)
  const cancel = () => {
    setAsk(false);
    window.setTimeout(
      () => withNhLoading(() => undefined, 650).then(() => navigate(-1)),
      190,
    );
  };

  return (
    <div className="screen nh nh-reg">
      <NhHeader
        title="농협계좌등록"
        onBack={() => navigate(-1)}
        home={() => navigate("/")}
        menu
      />
      <div className="nh-reg__scroll">
        <h2 className="nh-reg__title">
          콕뱅크에 <b>등록</b>할
          <br />
          <b>계좌</b>를 <b>선택</b>해 주세요
        </h2>
        {found ? (
          <div className="nh-reg__found">
            <button className="nh-reg__acct on" aria-pressed="true">
              <NhImg
                name="nh-history-acct-plain"
                w={37.33}
                h={37.33}
                fallback={<span>🟡</span>}
              />
              <span>
                <b>저축예금</b>
                <span>농축협 {fmtNumber(found.number)}</span>
                <em>{nhWon(found.balance)}</em>
              </span>
              <i>
                <CheckIcon />
              </i>
            </button>
          </div>
        ) : (
          <div className="nh-reg__empty">
            <NhImg
              name="nh-register-char"
              w={104}
              h={89.6}
              className="nh-reg__char"
              fallback={<span />}
            />
            <b>조회된 농협 계좌가 없습니다.</b>
            <p>
              보유하신 농협계좌가 보이지 않는다면
              <br />
              <button onClick={openDirect}>계좌 직접 입력</button>을 통해 등록해
              주세요.
            </p>
          </div>
        )}
        <button
          className="nh-btn nh-btn--outline-purple nh-reg__direct"
          onClick={openDirect}
        >
          계좌 직접입력 조회
        </button>
        <div className="nh-reg__band" />
        <div className="nh-reg__note">
          <button
            className="nh-reg__note-head"
            aria-expanded={noteOpen}
            onClick={() => setNoteOpen((o) => !o)}
          >
            <NhImg
              name="nh-register-notice"
              w={24}
              h={24.8}
              fallback={<span>📢</span>}
            />
            <b>확인하세요</b>
            <SecChevron open={noteOpen} />
          </button>
          {noteOpen && (
            <ul>
              <li>
                농협계좌는 최대 <em>50개</em> 계좌를 등록할 수 있습니다.
              </li>
              <li>
                <em>압류계좌, 보안계좌, 거래중지계좌, 공동명의 계좌</em>는<br />
                등록할 수 없습니다.
              </li>
              <li>
                농협은행 계좌는 일부 서비스 이용이 제한됩니다.
                <br />
                (예적금, 대출, 외환)
              </li>
            </ul>
          )}
        </div>
      </div>
      <div className="nh-bottom nh-bottom--split">
        <button className="nh-btn nh-btn--line" onClick={() => setAsk(true)}>
          취소
        </button>
        <button className="nh-btn" disabled={!found} onClick={submit}>
          다음
        </button>
      </div>

      {/* 계좌 직접입력: 계좌번호 → 지금 잔액 (공용 키패드 시트 모양) */}
      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        kind="keypad"
        className="nh-reg-sheet nh-sheet--keypad"
      >
        <div className="nh-reg-sheet__head">
          <b>{sheet === "balance" ? "지금 잔액" : "농협 계좌번호"}</b>
          <button
            className="nh-icon-btn"
            aria-label="닫기"
            onClick={() => setSheet(null)}
          >
            <NhCloseIcon />
          </button>
        </div>
        {sheet === "balance" ? (
          <div className={`nh-reg-sheet__box ${balance ? "on" : ""}`}>
            {balance ? (
              <span className="nh-reg-sheet__val">
                {nhWon(Number(balance))}
                <i key={balance} className="nh-reg-sheet__caret" />
                <button
                  className="nh-reg-sheet__clear"
                  aria-label="지우기"
                  onClick={() => setBalance("")}
                >
                  <ClearCircle />
                </button>
              </span>
            ) : (
              <span className="nh-reg-sheet__ph">잔액 입력</span>
            )}
          </div>
        ) : (
          <div className={`nh-reg-sheet__box ${digits ? "on" : ""}`}>
            {digits ? (
              <span className="nh-reg-sheet__val">
                {digits}
                <i key={digits} className="nh-reg-sheet__caret" />
                <button
                  className="nh-reg-sheet__clear"
                  aria-label="지우기"
                  onClick={() => setDigits("")}
                >
                  <ClearCircle />
                </button>
              </span>
            ) : (
              <span className="nh-reg-sheet__ph">계좌번호 입력</span>
            )}
          </div>
        )}
        <Keypad
          kok={sheet !== "balance"}
          kokLabel={<NhKokKey />}
          doubleZero={sheet === "balance"}
          rowHeight={68.25}
          back={<BackArrowKey />}
          onKey={(k) =>
            sheet === "balance"
              ? setBalance((v) => applyKey(v, k, 9))
              : setDigits((v) => applyKey(v, k, 14))
          }
        />
        {sheet === "balance" ? (
          <button className="nh-btn nh-btn--teal nh-sheet-btn" onClick={lookup}>
            조회
          </button>
        ) : (
          <button
            className="nh-btn nh-btn--teal nh-sheet-btn"
            disabled={!digits}
            onClick={toBalance}
          >
            다음
          </button>
        )}
      </Sheet>

      <Dialog
        message={ask ? "농협계좌 등록을 취소하시겠습니까?" : null}
        onClose={cancel}
        onCancel={() => setAsk(false)}
        okLabel="예"
        cancelLabel="아니오"
      />
      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}
