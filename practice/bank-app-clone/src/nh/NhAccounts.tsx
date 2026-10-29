import { useCallback, useState, type MouseEvent, type UIEvent } from "react";
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

// 뒤로: 앱 안에 이전 화면이 있으면 그리로, 주소로 바로 열었으면 정해 둔 화면으로 (앱 밖 기록으로 나가지 않게)
function useNhBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

// 잠금 동그라미 안 자물쇠 (열림 = 금액 보이는 중). 좌표는 동그라미 중심 = (12, 12).
// 몸통 14.18 × 9.49 (선 중심), 위 모서리 2.6 · 아래 모서리 3.35, 고리 반지름 2.8 (오른쪽 끝은 고리 중심 높이에서 끝남)
function Padlock({ open }: { open: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M7.51 10.51h8.98a2.6 2.6 0 0 1 2.6 2.6v3.54A3.35 3.35 0 0 1 15.74 20H8.26a3.35 3.35 0 0 1-3.35-3.35v-3.54a2.6 2.6 0 0 1 2.6-2.6Z" />
      <path
        d={
          open
            ? "M9.2 10.51V7.81a2.8 2.8 0 0 1 5.6 0"
            : "M9.2 10.51V7.81a2.8 2.8 0 0 1 5.6 0v2.7"
        }
      />
      <path d="M12 14.3v1.85" strokeLinecap="round" />
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
      <rect x="2.86" y="7.62" width="11.28" height="10.34" rx="1.6" />
      <path d="M18.85 5.2v5.8M16.75 8.55l2.1 2.35 2.1-2.35" />
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

// 섹션 ^ : 굵기 1.91, 팔 기울기 1.15(가로/세로), 뾰족한 꼭대기. 팔 끝은 잉크 상자(10.88 × 6.12)에서 세로·가로로 잘림
// (스크린샷 720px 섹션 머리 ^ 를 따라 그린 다각형). 접히면 ⌄
function SecChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`nh-asec__chev ${open ? "" : "down"}`}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 8.884 17.44 13.615V15h-1.318L12 11.416 7.878 15H6.56v-1.385Z" />
    </svg>
  );
}

// 카드 오른쪽 위 ⋮ (점 지름 3.0, 간격 6.0 — 스크린샷 5.6px / 11.26px)
function MoreDots() {
  return (
    <svg
      width="4"
      height="16.4"
      viewBox="0 0 4 16.4"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="1.74" cy="2.26" r="1.5" />
      <circle cx="1.74" cy="8.26" r="1.5" />
      <circle cx="1.74" cy="14.26" r="1.5" />
    </svg>
  );
}

function QMark({
  className = "",
  onClick,
}: {
  className?: string;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button
      className={`nh-accts__q ${className}`}
      aria-label="도움말"
      onClick={onClick}
    >
      ?
    </button>
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
function EmptyCard({ shop, onShop }: { shop: string; onShop: () => void }) {
  return (
    <div className="nh-acard nh-acard--empty">
      <span className="nh-acard__ball">
        <NhImg name="nh-accounts-more" w={51.2} h={51.2} fallback={<span />} />
        <i />
        <i />
        <i />
      </span>
      <b>계좌를 찾을 수 없어요.</b>
      {shop && (
        <button className="nh-acard__shop" onClick={onShop}>
          {shop}
        </button>
      )}
    </div>
  );
}

// 계좌 아이콘: 대표계좌(main)는 청록 별이 붙은 아이콘, 나머지(직접입력으로 등록한 계좌 등)는 별 없는 아이콘
function AcctIcon({
  account,
  className,
}: {
  account: Account;
  className: string;
}) {
  return account.kind === "main" ? (
    <NhImg
      name="nh-accounts-acct"
      w={42.67}
      h={41.6}
      className={className}
      fallback={<span>🟡</span>}
    />
  ) : (
    <NhImg
      name="nh-history-acct-plain"
      w={37.33}
      h={37.33}
      className={`${className} ${className}--plain`}
      fallback={<span>🟡</span>}
    />
  );
}

// 데이터가 오기 전 뼈대 막대 (녹화2 38.25~38.53초: 총액·섹션 금액 자리에 회색 막대)
function Skel({ className }: { className: string }) {
  return <span className={`nh-skel ${className}`} aria-hidden />;
}

// 전체계좌 조회 (스크린샷 2026-10-28 9:48, 녹화2 38.25~39.7초)
// 위: 잠금 · 총액 · ?, 필터 칩, 보기 토글(카드/목록), 넓게 토글. 아래: 종류별 섹션(^ 로 접기) + 계좌 카드
// 데이터가 오기 전에는 뼈대(회색 막대), 실패하면 오류 + 다시 시도
export function NhAccounts() {
  const navigate = useNavigate();
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const goBack = useNhBack("/");
  const home = useApi<HomeData>(paths.home);
  const [hidden, setHidden] = useState(false); // 자물쇠: 금액 가리기
  const [chip, setChip] = useState("전체");
  const [chipsEnd, setChipsEnd] = useState(false); // 칩 줄을 끝까지 밀면 오른쪽 흐림을 없앰
  const [view, setView] = useState<"card" | "list">("card");
  const [wide, setWide] = useState(true); // 넓게 (참고 화면은 켜짐)
  const [withLoan, setWithLoan] = useState(true); // 대출 '포함': 끄면 총액에서 대출 잔액을 뺌
  const [folded, setFolded] = useState<SecKey[]>([]);
  const [info, setInfo] = useState<string | null>(null); // ?, ⋮, 상품 링크, ☰ 안내
  useStatusBar("#18171c", "light");

  const ready = home.status === "done";
  const failed = home.status === "error";
  const accounts = home.data?.accounts ?? [];
  const inSec = (k: SecKey) => (k === "dep" ? accounts : []); // 우리 데이터는 입출금 계좌만 있음
  const sumOf = (k: SecKey) => inSec(k).reduce((n, a) => n + a.balance, 0);
  const total = SECTIONS.reduce(
    (n, sec) =>
      sec.key === "card" || (sec.key === "loan" && !withLoan)
        ? n
        : n + sumOf(sec.key),
    0,
  );
  const money = (n: number) => (hidden ? "잔액보기" : nhWon(n));
  const shown = SECTIONS.filter((s) => chip === "전체" || s.chip === chip);
  const toggle = (k: SecKey) =>
    setFolded((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));
  const onChipsScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setChipsEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };
  // 카드 안 버튼은 카드 전체 누름(거래내역)과 겹치지 않게
  const inCard = (f: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    f();
  };

  const card = (a: Account) =>
    view === "list" ? (
      <button
        key={a.id}
        className="nh-arow"
        onClick={() => go(`/history/${a.id}`)}
      >
        <AcctIcon account={a} className="nh-arow__icon" />
        <span className="nh-arow__info">
          <b>{a.label}</b>
          <span>농축협 {a.number}</span>
        </span>
        <em>{money(a.balance)}</em>
      </button>
    ) : (
      <div
        key={a.id}
        className="nh-acard"
        role="link"
        tabIndex={0}
        aria-label={`${a.label} 거래내역`}
        onClick={() => go(`/history/${a.id}`)}
        onKeyDown={(e) => e.key === "Enter" && go(`/history/${a.id}`)}
      >
        <button
          className="nh-acard__more"
          aria-label="더보기"
          onClick={inCard(() =>
            setInfo(
              "계좌 이름 변경·순서 변경·숨기기는\n연습 앱에서 지원하지 않아요.",
            ),
          )}
        >
          <MoreDots />
        </button>
        <AcctIcon account={a} className="nh-acard__icon" />
        <span className="nh-acard__name">
          <b>{a.label}</b>
          <span>
            <span className="nh-acard__no">농축협 {a.number}</span>
            <button
              className="nh-acard__tag"
              onClick={inCard(() => go(`/history/${a.id}`))}
            >
              자세히
            </button>
          </span>
        </span>
        <p className="nh-acard__bal">{money(a.balance)}</p>
        <div className="nh-acard__btns">
          <button onClick={inCard(() => go(`/history/${a.id}`))}>
            거래내역
          </button>
          <i />
          <button onClick={inCard(() => go(`/send?from=${a.id}`))}>송금</button>
        </div>
      </div>
    );

  return (
    <div className="screen nh nh-accts">
      <NhHeader
        title="전체계좌 조회"
        onBack={goBack}
        home={() => navigate("/")}
        onMenu={() => setInfo("전체메뉴는 연습 앱에서 지원하지 않아요.")}
      />
      <div className="nh-accts__scroll">
        <div className="nh-accts__total">
          {ready ? (
            <>
              <button
                className="nh-accts__lock"
                aria-label={hidden ? "금액 보기" : "금액 가리기"}
                onClick={() => setHidden((h) => !h)}
              >
                <Padlock open={!hidden} />
              </button>
              <b>{money(total)}</b>
              <QMark
                onClick={() =>
                  setInfo(
                    "총액은 조회된 계좌 잔액의 합계예요.\n대출 '포함'을 끄면 대출 잔액은 빼고 보여줘요.",
                  )
                }
              />
            </>
          ) : (
            !failed && <Skel className="nh-accts__skel-total" />
          )}
        </div>
        <div
          className={`nh-accts__chips ${chipsEnd ? "end" : ""}`}
          role="tablist"
          onScroll={onChipsScroll}
        >
          {["전체", ...SECTIONS.map((s) => s.chip)].map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={chip === c}
              className={chip === c ? "on" : ""}
              onClick={(e) => {
                setChip(c);
                e.currentTarget.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                  inline: "nearest",
                });
              }}
            >
              <span>{c}</span>
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

          {failed ? (
            <div className="nh-accts__err">
              <b>일시적인 오류가 발생했어요</b>
              <span>계좌 정보를 불러오지 못했어요.</span>
              <button className="nh-btn nh-btn--line" onClick={home.retry}>
                다시 시도
              </button>
            </div>
          ) : (
            <div
              className={`nh-accts__secs ${wide ? "" : "narrow"} ${view === "list" ? "list" : ""} ${ready ? "" : "loading"}`}
            >
              {shown.map((s) => {
                const list = inSec(s.key);
                const open = ready && !folded.includes(s.key);
                return (
                  <section
                    key={s.key}
                    className={`nh-asec nh-asec--${s.key} ${ready && !open ? "folded" : ""}`}
                  >
                    <div
                      className="nh-asec__head"
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => ready && toggle(s.key)}
                      onKeyDown={(e) =>
                        ready && e.key === "Enter" && toggle(s.key)
                      }
                    >
                      <h2>
                        {s.title}
                        {s.key === "card" ? (
                          <QMark
                            className="nh-asec__q"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInfo("콕뱅크에서 조회되는 카드가 없어요.");
                            }}
                          />
                        ) : (
                          ready && <em>{list.length}</em>
                        )}
                      </h2>
                      {s.key === "card" ? (
                        <b className="nh-asec__none">미보유</b>
                      ) : (
                        <>
                          {ready ? (
                            <b>{money(sumOf(s.key))}</b>
                          ) : (
                            <Skel
                              className={`nh-asec__skel ${s.key === "loan" ? "nh-asec__skel--short" : ""}`}
                            />
                          )}
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
                      <SecChevron open={!ready || open} />
                    </div>
                    {open && s.key !== "card" && (
                      <div className="nh-asec__body">
                        {list.length ? (
                          list.map(card)
                        ) : (
                          <EmptyCard
                            shop={s.shop ?? ""}
                            onShop={() =>
                              setInfo(
                                `${s.title} 상품 안내는\n연습 앱에서 지원하지 않아요.`,
                              )
                            }
                          />
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          <button
            className="nh-btn nh-btn--outline-purple nh-accts__reg"
            onClick={() => go("/register")}
          >
            콕에 등록된 계좌 보기
          </button>
        </div>
      </div>
      <Dialog message={info} onClose={() => setInfo(null)} />
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
  const go = useNhGo();
  const goBack = useNhBack("/accounts");
  const [sheet, setSheet] = useState<"number" | "balance" | null>(null);
  const [digits, setDigits] = useState("");
  const [balance, setBalance] = useState("");
  const [found, setFound] = useState<{
    number: string;
    balance: number;
  } | null>(null); // 직접입력으로 찾은 계좌
  const [noteOpen, setNoteOpen] = useState(true);
  const [ask, setAsk] = useState<"open" | "closing" | null>(null); // 취소 알림창
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
      .then(goBack)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "연결에 실패했어요"),
      );
  };
  // 예 (녹화2 64.357 누름): 알림창이 0.1초 동안 흐려지며 사라짐(64.459) → 누른 뒤 0.155초에 점 3개 로딩(64.512)
  // → 누른 뒤 0.836초에 이전 화면(65.193). 이전 화면이 나온 뒤에도 로딩 막이 조금 남아 있음(녹화 끝 65.28까지)
  const cancel = () => {
    setAsk("closing");
    window.setTimeout(() => setAsk(null), 100);
    window.setTimeout(
      () =>
        withNhLoading(async () => {
          await new Promise((r) => setTimeout(r, 650)); // 화면이 바뀌어 보이기까지 한 프레임 더 걸림
          goBack();
          await new Promise((r) => setTimeout(r, 200));
        }, 0),
      155,
    );
  };

  return (
    <div className="screen nh nh-reg">
      <NhHeader
        title="농협계좌등록"
        onBack={goBack}
        home={() => navigate("/")}
        onMenu={() => go("/accounts")}
      />
      <div className="nh-reg__scroll">
        <h2 className="nh-reg__title">
          <span>
            콕뱅크에 <b>등록</b>할
          </span>
          <span>
            <b>계좌</b>를 <b>선택</b>해 주세요
          </span>
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
        <button className="nh-btn nh-btn--line" onClick={() => setAsk("open")}>
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

      <div className={`nh-reg__ask ${ask === "closing" ? "closing" : ""}`}>
        <Dialog
          message={ask ? "농협계좌 등록을 취소하시겠습니까?" : null}
          onClose={cancel}
          onCancel={() => setAsk(null)}
          okLabel="예"
          cancelLabel="아니오"
        />
      </div>
      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}
