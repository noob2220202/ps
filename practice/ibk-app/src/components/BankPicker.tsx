import { useMemo, useState } from "react";
import type { Bank } from "../api/types";
import { BankIcon } from "./BankIcon";
import { Icon } from "./icons/Icon";
import "./BankPicker.css";

// 은행선택 목록 (🔔 관리 패널: 다른 은행 계좌 추가 · 받는 분 등록에서 씀)
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
        {!list.length && <p className="bank-sheet__empty">검색 결과가 없어요.</p>}
      </div>
    </>
  );
}
