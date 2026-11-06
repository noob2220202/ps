import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { api } from "../../api/endpoints";
import type { Bank, Recipient } from "../../api/types";
import { BankIcon } from "../../components/BankIcon";
import { ArcSpinner } from "../../components/art";
import { Icon } from "../../components/icons/Icon";
import { Dialog, Keypad } from "../../components/Sheet";
import { applyKey } from "../../lib/keypad";
import { ClearIcon } from "../../screens/transfer/TransferScreen";
import { K2Magnifier } from "../art";
import "../../screens/transfer/Transfer.css"; // 계좌번호 시트 안(.number-sheet)은 카카오뱅크 것 그대로
import "./k2-bank-sheet.css";

// kakao2 이체의 아래 시트들 (녹화 9.86 ~ 23.8초, transfer.md §4). 은행선택과 계좌번호가 배경(검정 .737) 하나를 같이 씀 —
// 은행을 고르면 은행선택은 내려가고 계좌번호가 올라옴 (배경은 그대로). 열기 = 살짝 튀는 스프링 500ms, 닫기 = 210ms ease-out
export type K2SheetKind = "bank" | "number";

const SKEL_MS = 215; // 은행선택을 열 때마다 뼈대 (떼고 → 10.075초 목록)
// iOS 스크롤 막대 (11.3 ~ 23.6초 프레임마다 잼): 길 = 목록 위끝 + 35 ~ 화면 아래 − 72 (맨 끝에서 막대 아래끝 780),
// 길이 = 길 × 보이는 높이 / 내용 높이 (접힘 162 · 펼침 141 — 녹화와 같음). 스크롤이 멈추고 1초 뒤 사라짐
const BAR = { top: 35, bottom: 72, holdMs: 1000 };

export function K2BankSheet({
  sheet,
  banks,
  bank,
  onClose,
  onPick,
  onChangeBank,
  onFound,
}: {
  sheet: K2SheetKind | null;
  banks: Bank[] | undefined;
  bank: Bank | null;
  onClose: () => void;
  onPick: (b: Bank) => void;
  onChangeBank: () => void;
  onFound: (r: Recipient) => void;
}) {
  // 열 때마다 새로 (검색어 · 스크롤 · 뼈대) — 닫히는 동안은 그대로 두고 다음에 열 때 key 를 바꿈
  const [seq, setSeq] = useState(0);
  const [wasBank, setWasBank] = useState(false);
  if ((sheet === "bank") !== wasBank) {
    setWasBank(sheet === "bank");
    if (sheet === "bank") setSeq((n) => n + 1);
  }

  return (
    <div className={`k2bank ${sheet ? "k2bank--open" : ""}`} aria-hidden={!sheet}>
      <div className="k2bank__backdrop" onClick={onClose} />
      <section className={`k2bank__panel k2bank__panel--bank ${sheet === "bank" ? "k2bank__panel--open" : ""}`} role="dialog">
        {seq > 0 && <BankPicker key={seq} banks={banks} onPick={onPick} onCancel={onClose} />}
      </section>
      <section className={`k2bank__panel k2bank__panel--number ${sheet === "number" ? "k2bank__panel--open" : ""}`} role="dialog">
        {bank && (
          // key: 은행을 바꾸면 입력하던 번호도 새로 (state 초기화)
          <NumberEntry key={bank.code} bank={bank} onChangeBank={onChangeBank} onFound={onFound} />
        )}
      </section>
    </div>
  );
}

// ---------- 은행선택 (10.70초): 취소 · 은행선택 · 은행검색 + 두 줄 격자. 목록을 내리면 제목이 숨고 검색칸이 34pt 올라감 (한 프레임) ----------
// memo: 이체 화면이 다시 그려져도(검색 입력 등) 격자 61칸을 다시 그리지 않음 — 시트가 움직이는 중에 프레임이 끊기지 않게
const BankPicker = memo(function BankPicker({ banks, onPick, onCancel }: { banks: Bank[] | undefined; onPick: (b: Bank) => void; onCancel: () => void }) {
  const [query, setQuery] = useState("");
  const [skel, setSkel] = useState(true);
  const [compact, setCompact] = useState(false);
  const listEl = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const barTimer = useRef(0);
  useEffect(() => () => clearTimeout(barTimer.current), []);
  // 막대 자리 · 길이 (머리가 접히거나 펼쳐진 뒤에도 다시 — 목록 위끝 · 높이가 바뀜. 펼칠 때는 50ms 움직임이 끝난 뒤)
  const placeBar = () => {
    const el = listEl.current;
    const b = bar.current;
    const body = el?.parentElement;
    if (!el || !b || !body || el.scrollHeight <= el.clientHeight) return;
    const top = el.offsetTop + BAR.top;
    const track = body.clientHeight - BAR.bottom - top;
    const len = Math.min(track, (track * el.clientHeight) / el.scrollHeight);
    const f = Math.min(1, Math.max(0, el.scrollTop / (el.scrollHeight - el.clientHeight)));
    b.style.transform = `translateY(${top + (track - len) * f}px)`;
    b.style.height = `${len}px`;
  };
  useLayoutEffect(placeBar, [compact]);
  const onScroll = (el: HTMLDivElement) => {
    setCompact(el.scrollTop > 0);
    placeBar();
    bar.current?.classList.add("k2bank__bar--on");
    clearTimeout(barTimer.current);
    barTimer.current = window.setTimeout(() => bar.current?.classList.remove("k2bank__bar--on"), BAR.holdMs);
  };
  useEffect(() => {
    const id = setTimeout(() => setSkel(false), SKEL_MS);
    return () => clearTimeout(id);
  }, []);
  const list = useMemo(() => (banks ?? []).filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase())), [banks, query]);
  const sections = (["bank", "securities"] as const).map((s) => list.filter((b) => b.section === s)).filter((l) => l.length);

  return (
    <div className={`k2bank__body ${compact ? "k2bank__body--compact" : ""}`}>
      <button className="k2bank__cancel" onClick={onCancel}>
        취소
      </button>
      <h2 className="k2bank__title">은행선택</h2>
      <label className="k2bank__search">
        <K2Magnifier width={14.3} height={15} stroke={1.35} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="은행검색" />
      </label>
      <div className="k2bank__list" ref={listEl} onScroll={(e) => onScroll(e.currentTarget)} onTransitionEnd={placeBar}>
        {skel || !banks ? (
          <div className="k2bank__grid" aria-label="불러오는 중">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className="k2bank__skel">
                <i />
                <b />
              </span>
            ))}
          </div>
        ) : (
          <>
            {sections.map((l, i) => (
              <div key={l[0].section}>
                {i > 0 && <hr className="k2bank__sep" />}
                <div className="k2bank__grid">
                  {l.map((b) => (
                    <button key={b.code} className="k2bank__item" onClick={() => onPick(b)}>
                      <BankIcon bank={b} size={22.3} />
                      <span>{b.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!list.length && <p className="k2bank__empty">검색 결과가 없어요.</p>}
          </>
        )}
      </div>
      <i className="k2bank__bar" ref={bar} />
    </div>
  );
});

// ---------- 계좌번호 입력 (녹화에 없음 — 카카오뱅크 TransferScreen 의 NumberEntry 와 같음) ----------
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
