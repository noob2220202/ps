import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { accountLine, api, paths } from "../../api/endpoints";
import type { Bank, Recipient, TransferRecipients } from "../../api/types";
import { useApi } from "../../api/useApi";
import { Asset } from "../../assets/Asset";
import { BankIcon } from "../../components/BankIcon";
import { AiDiamond, ArcSpinner } from "../../components/art";
import { BackButton } from "../../components/NavButtons";
import { ErrorState } from "../../components/ErrorState";
import { Dialog, Keypad, Sheet } from "../../components/Sheet";
import { applyKey } from "../../lib/keypad";
import { Icon } from "../../components/icons/Icon";
import { useStatusBar } from "../../hooks/useStatusBar";
import "./Transfer.css";

export interface AmountState {
  from: string; // 보내는 계좌 id
  to: Recipient;
}

// 이체 첫 화면 (영상 2026-10-28 10:08): 내 계좌 / 최근 이체 목록 + "계좌번호 직접입력"
// 직접입력: 은행선택 시트 → 계좌번호 시트 → 서버에서 예금주 조회 → 금액 화면
export function TransferScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get("from") ?? "main";
  const data = useApi<TransferRecipients>(paths.recipients(from));
  const banks = useApi<Bank[]>(paths.banks);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"account" | "kakao">("account");
  const [sheet, setSheet] = useState<"bank" | "number" | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  useStatusBar(sheet ? "#808080" : "#ffffff", "dark");

  const goAmount = (to: Recipient) => navigate("/transfer/amount", { state: { from, to } satisfies AmountState });

  // 검색: 이름, 계좌번호(숫자만), 은행 이름 어디에 걸려도 보여줌
  const q = query.replace(/\s/g, "");
  const hit = (...texts: (string | undefined)[]) => !q || texts.some((t) => t?.replace(/[\s-]/g, "").includes(q));
  const mine = data.data?.mine.filter((m) => hit(m.label, m.number, m.bank.name)) ?? [];
  const recent = data.data?.recent.filter((r) => hit(r.holder, r.number, r.bank.name)) ?? [];

  return (
    <div className="screen transfer">
      <header className="transfer__header">
        <BackButton onClick={() => navigate(-1)} />
      </header>
      <div className="transfer__title">
        <h1>이체</h1>
        <button className="transfer__ai">
          <AiDiamond size={16} /> AI로 이체하기 <Icon name="chevron-right" size={16} stroke={2} />
        </button>
      </div>
      <div className="transfer__search">
        <Icon name="search" size={22} stroke={2} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="받는사람 이름 또는 계좌번호" />
        <button className="transfer__camera" aria-label="계좌번호 촬영">
          <CameraIcon />
        </button>
      </div>
      <div className="transfer__tabs">
        <button className={tab === "account" ? "on" : ""} onClick={() => setTab("account")}>
          계좌번호
        </button>
        <button className={tab === "kakao" ? "on" : ""} onClick={() => setTab("kakao")}>
          카카오톡 친구
        </button>
      </div>

      {tab === "kakao" ? (
        <p className="transfer__empty">카카오톡 친구 목록이 없어요.</p>
      ) : data.status === "error" ? (
        <ErrorState error={data.error} onRetry={data.retry} />
      ) : !data.data ? (
        <SkeletonRows />
      ) : (
        <div className="fade-in">
          {mine.length > 0 && <h2 className="transfer__section">내 계좌</h2>}
          {mine.map((m) => (
            <button
              key={m.accountId}
              className="recipient row-press"
              onClick={() => goAmount({ bank: m.bank, number: (m.number ?? "").replace(/\D/g, ""), holder: m.holder, accountId: m.accountId })}
            >
              <BankIcon bank={m.bank} size={42} />
              <span className="recipient__text">
                {/* 입출금통장은 이름 대신 ⭐ (영상) */}
                <strong>{m.kind === "main" ? <Asset slot="star" /> : m.label}</strong>
                <small>{accountLine(m.bank, m.number)}</small>
              </span>
            </button>
          ))}
          {recent.length > 0 && <h2 className="transfer__section">최근 이체</h2>}
          {recent.map((r) => (
            <div key={`${r.bank.code}-${r.number}`} className="recipient row-press" onClick={() => goAmount(r)}>
              <BankIcon bank={r.bank} size={42} />
              <span className="recipient__text">
                <strong>{r.holder}</strong>
                <small>{accountLine(r.bank, r.number)}</small>
              </span>
              {/* ☆ 즐겨찾기: 등록된 받는 분일 때만 서버에 저장 */}
              <button
                className={`recipient__star ${r.favorite ? "on" : ""}`}
                aria-label="즐겨찾기"
                disabled={!r.payeeId}
                onClick={(e) => {
                  e.stopPropagation();
                  if (r.payeeId) api.updatePayee(r.payeeId, { favorite: !r.favorite }).catch(() => {});
                }}
              >
                <StarIcon />
              </button>
            </div>
          ))}
          {q && mine.length + recent.length === 0 && <p className="transfer__empty">검색 결과가 없어요.</p>}
          <div className="transfer__spacer" />
        </div>
      )}

      <div className="transfer__direct">
        <button className="pressable" onClick={() => setSheet("bank")}>
          + 계좌번호 직접입력
        </button>
      </div>

      <Sheet open={sheet === "bank"} onClose={() => setSheet(null)} className="bank-sheet">
        {banks.data && (
          <BankPicker
            banks={banks.data}
            onPick={(b) => {
              setBank(b);
              setSheet("number");
            }}
          />
        )}
      </Sheet>
      <Sheet open={sheet === "number"} onClose={() => setSheet(null)}>
        {bank && (
          // key: 은행을 바꾸면 입력하던 번호도 새로 (state 초기화)
          <NumberEntry key={bank.code} bank={bank} onChangeBank={() => setSheet("bank")} onFound={goAmount} />
        )}
      </Sheet>
    </div>
  );
}

// ---------- 은행선택 ----------
export function BankPicker({ banks, onPick, exclude }: { banks: Bank[]; onPick: (b: Bank) => void; exclude?: string[] }) {
  const [query, setQuery] = useState("");
  const list = useMemo(
    () => banks.filter((b) => !exclude?.includes(b.code) && b.name.toLowerCase().includes(query.trim().toLowerCase())),
    [banks, exclude, query],
  );
  const section = (s: Bank["section"]) => list.filter((b) => b.section === s);
  return (
    <>
      <h2 className="bank-sheet__title">은행선택</h2>
      <div className="bank-sheet__search">
        <Icon name="search" size={20} stroke={2} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="은행검색" />
      </div>
      <div className="bank-sheet__list">
        {(["bank", "securities"] as const).map((s) =>
          section(s).length ? (
            <div key={s} className="bank-sheet__grid">
              {section(s).map((b) => (
                <button key={b.code} className="bank-sheet__item" onClick={() => onPick(b)}>
                  <BankIcon bank={b} size={22} />
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
          ) : null,
        )}
        {!list.length && <p className="transfer__empty">검색 결과가 없어요.</p>}
      </div>
    </>
  );
}

// ---------- 계좌번호 입력 ----------
function NumberEntry({ bank, onChangeBank, onFound }: { bank: Bank; onChangeBank: () => void; onFound: (r: Recipient) => void }) {
  const [digits, setDigits] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setChecking(true);
    try {
      onFound(await api.lookupAccount(bank.code, digits));
    } catch (e) {
      // 진짜 앱은 상대 은행에 물어보지만, 여기선 🔔 패널에 등록한 받는 분만 찾을 수 있다
      setError(
        e instanceof ApiError && e.status === 404
          ? `${e.message}\n\n(연습용 앱: 🔔 관리 → 받는 분 탭에서\n먼저 등록한 계좌만 보낼 수 있어요)`
          : e instanceof ApiError
            ? e.message
            : "연결에 실패했어요",
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="number-sheet">
      <button className="number-sheet__bank" onClick={onChangeBank}>
        <BankIcon bank={bank} size={38} />
        <span>
          <strong>
            {bank.name} <Icon name="chevron-down" size={16} stroke={1.8} />
          </strong>
          <small>입금은행</small>
        </span>
      </button>
      <div className="number-sheet__input">
        {digits ? (
          <>
            <span>
              {digits}
              <i className="caret" />
            </span>
            <button aria-label="지우기" onClick={() => setDigits("")}>
              <ClearIcon />
            </button>
          </>
        ) : (
          <span className="number-sheet__placeholder">입금할 계좌번호 입력</span>
        )}
      </div>
      <Keypad rowHeight={56} onKey={(k) => setDigits((d) => applyKey(d, k, 16))} />
      <button className="cta number-sheet__ok" disabled={digits.length < 8 || checking} onClick={confirm}>
        {checking ? <ArcSpinner size={20} color="#888" /> : "확인"}
      </button>
      <Dialog message={error} onClose={() => setError(null)} />
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="transfer__skel">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="recipient">
          <div className="skel" style={{ width: 42, height: 42, borderRadius: "50%" }} />
          <span className="recipient__text">
            <div className="skel" style={{ width: 120, height: 14 }} />
            <div className="skel" style={{ width: 60, height: 10, marginTop: 6 }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ClearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="#a8a8a8" />
      <path d="m6.8 6.8 6.4 6.4m0-6.4-6.4 6.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 4h6l1.6 2.2H20a1.5 1.5 0 0 1 1.5 1.5v10.8A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5V7.7A1.5 1.5 0 0 1 4 6.2h3.4Z" />
      <circle cx="12" cy="12.8" r="3.6" fill="#fff" />
      <circle cx="12" cy="12.8" r="2.2" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m12 2.8 2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.6-4.4 6.3-.8Z" />
    </svg>
  );
}
