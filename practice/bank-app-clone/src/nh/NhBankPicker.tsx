import { useMemo, useState } from "react";
import type { Bank } from "../api/types";
import { localAsset } from "../assets/Asset";
import { nhBankList } from "./banks";
import { NhBankIcon, NhHeader } from "./common";
import "./nh-bankpicker.css";

// 은행선택·계좌번호 시트의 둥근 사각 은행 아이콘. 녹화1에서 잘라 온 nh-bank-<code>.png (scripts/nh-crops/picker.py).
// 없으면 공용 동그라미 아이콘
export function NhBankSquare({ bank, size }: { bank: Bank; size: number }) {
  const src = localAsset(`nh-bank-${bank.code}`);
  if (!src) return <NhBankIcon bank={bank} size={size} />;
  return <img className="nh-bank-sq" src={src} alt="" width={size} height={size} draggable={false} />;
}

// 돋보기: 고리 바깥지름 16.7, 굵기 1.5, 손잡이 45° (녹화1 30초에서 잰 모양)
function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="11.5" cy="10.85" r="7.6" />
      <path d="M16.9 16.2 20.8 20.1" />
    </svg>
  );
}

// ---------- 은행선택 (전체 화면) ----------
// 녹화1 29.5~48초: 위 X(헤더, 고정) 아래로 [검색칸 · 은행/증권사 탭 · 3칸 타일]이 함께 스크롤됨.
// 열릴 때 300ms 동안 서서히 나타남 (녹화2 4.53~4.79초)
export function NhBankPicker({ banks, onPick, onClose }: { banks: Bank[]; onPick: (b: Bank) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"bank" | "securities">("bank");
  const [query, setQuery] = useState("");
  const list = useMemo(() => nhBankList(banks, tab).filter((b) => b.label.includes(query.trim())), [banks, tab, query]);
  return (
    <div className="screen nh nh-banks">
      <NhHeader onClose={onClose} />
      <div className="nh-banks__scroll">
        <label className="nh-banks__search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="은행/증권사명을 입력해 주세요" />
          <SearchIcon />
        </label>
        <div className="nh-banks__tabs" role="tablist">
          <button role="tab" aria-selected={tab === "bank"} className={tab === "bank" ? "on" : ""} onClick={() => setTab("bank")}>
            은행
          </button>
          <button role="tab" aria-selected={tab === "securities"} className={tab === "securities" ? "on" : ""} onClick={() => setTab("securities")}>
            증권사
          </button>
        </div>
        <div className="nh-banks__grid">
          {list.map((b) => (
            <button key={b.code} data-code={b.code} onClick={() => onPick(b)}>
              <NhBankSquare bank={b} size={36} />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
        {!list.length && <p className="nh-empty">검색 결과가 없어요.</p>}
      </div>
    </div>
  );
}
