// 거래내역조회의 두 시트 (녹화에 없음 — invented, account.md §5.1 · §5.2). 둘 다 공용 웹 시트(AoSheet): 291ms 올라옴, ×는 150ms 내려감.
//  계좌 선택  : 계좌 블록(▾)을 누르면. 내 계좌 전부 (홈 순서), 지금 계좌에 초록 ✓. 다른 계좌를 누르면 거래내역조회가 그 계좌로 (History 가 로딩 막 밑에서 바꿈)
//  조회 조건  : 조건 줄(1개월 · 전체 · 최신순 ▾)을 누르면. 조회기간 1주일 / 1개월 / 3개월 / 6개월, 거래구분 전체 / 입금 / 출금, 정렬 최신순 / 과거순, 초록 조회
import { useState } from "react";
import { useApi } from "../../api/useApi";
import { aoPaths, type AoAccount, type AoHome } from "../api";
import { aoBankName } from "../bank";
import { aoAccountNumber } from "../format";
import { AoBankLogo, AoButton, AoSheet } from "../ui";
import { ACCT_ORDERS, ACCT_PERIODS, ACCT_TYPES, type AcctFilter } from "./list";

// ✓ (선택한 계좌)
function AcctCheck() {
  return (
    <svg className="ao-acct-sheet__check" width="16" height="12" viewBox="0 0 16 12" aria-hidden>
      <path d="M1.2 6.2 5.8 10.6 14.8 1.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccountRows({ current, onPick }: { current: string; onPick: (a: AoAccount) => void }) {
  const home = useApi<AoHome>(aoPaths.home);
  const list = home.data?.accounts ?? [];
  return (
    <div className="ao-acct-sheet__list">
      {list.map((a) => (
        <button key={a.id} type="button" className="ao-acct-sheet__row" onClick={() => onPick(a)}>
          <AoBankLogo code={a.bank.code} size={36} />
          <span className="ao-acct-sheet__text">
            <span className="ao-acct-sheet__name">{a.label}</span>
            <span className="ao-acct-sheet__sub">
              {aoBankName(a.bank)} {aoAccountNumber(a)}
            </span>
          </span>
          {a.id === current && <AcctCheck />}
        </button>
      ))}
    </div>
  );
}

// exit: × · 배경막은 "slide" (150ms 내려감), 고른 뒤에는 "cut" (로딩 막 밑에서 한 프레임에 사라짐)
export function AcctAccountSheet({
  open,
  exit,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  exit: "slide" | "cut";
  current: string;
  onClose: () => void;
  onPick: (a: AoAccount) => void;
}) {
  return (
    <AoSheet open={open} exit={exit} onClose={onClose} title="계좌 선택" className="ao-acct-sheet" bodyClassName="ao-acct-sheet__body">
      <AccountRows current={current} onPick={onPick} />
    </AoSheet>
  );
}

function Chips<K extends string>({ title, list, value, onChange }: { title: string; list: readonly (readonly [K, string])[]; value: K; onChange: (v: K) => void }) {
  return (
    <section className="ao-acct-filter__sec">
      <h3 className="ao-acct-filter__h">{title}</h3>
      <div className="ao-acct-filter__chips" role="radiogroup" aria-label={title}>
        {list.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === value}
            className={`ao-acct-chip${k === value ? " ao-acct-chip--on" : ""}`}
            onClick={() => onChange(k)}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

// 시트를 열 때마다 지금 조건에서 시작 (닫으면 고르던 것은 버림)
function FilterBody({ value, onApply }: { value: AcctFilter; onApply: (f: AcctFilter) => void }) {
  const [f, setF] = useState(value);
  return (
    <>
      <div className="ao-acct-filter">
        <Chips title="조회기간" list={ACCT_PERIODS} value={f.period} onChange={(period) => setF({ ...f, period })} />
        <Chips title="거래구분" list={ACCT_TYPES} value={f.type} onChange={(type) => setF({ ...f, type })} />
        <Chips title="정렬" list={ACCT_ORDERS} value={f.order} onChange={(order) => setF({ ...f, order })} />
      </div>
      <div className="ao-acct-filter__foot">
        <AoButton onPress={() => onApply(f)}>조회</AoButton>
      </div>
    </>
  );
}

export function AcctFilterSheet({
  open,
  exit,
  value,
  onClose,
  onApply,
}: {
  open: boolean;
  exit: "slide" | "cut";
  value: AcctFilter;
  onClose: () => void;
  onApply: (f: AcctFilter) => void;
}) {
  return (
    <AoSheet open={open} exit={exit} onClose={onClose} title="조회 조건" className="ao-acct-sheet" bodyClassName="ao-acct-sheet__body">
      <FilterBody value={value} onApply={onApply} />
    </AoSheet>
  );
}
