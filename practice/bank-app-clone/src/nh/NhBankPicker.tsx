import { useMemo, useState } from "react";
import type { Bank } from "../api/types";
import { Icon } from "../components/icons/Icon";
import { nhBankList } from "./banks";
import { NhBankIcon, NhHeader } from "./common";
import "./nh-bankpicker.css";

// ---------- 은행선택 (전체 화면) ----------
export function NhBankPicker({ banks, onPick, onClose }: { banks: Bank[]; onPick: (b: Bank) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"bank" | "securities">("bank");
  const [query, setQuery] = useState("");
  const list = useMemo(() => nhBankList(banks, tab).filter((b) => b.label.includes(query.trim())), [banks, tab, query]);
  return (
    // 녹화1 30~45초: 오른쪽 위 X / "은행/증권사명을 입력해 주세요" 밑줄 검색칸 / 은행·증권사 탭 / 3칸 타일
    <div className="screen nh nh-banks">
      <NhHeader onClose={onClose} />
      <div className="nh-banks__search">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="은행/증권사명을 입력해 주세요" />
        <Icon name="search" size={22} stroke={1.9} />
      </div>
      <div className="nh-pill-tabs">
        <button className={tab === "bank" ? "on" : ""} onClick={() => setTab("bank")}>
          은행
        </button>
        <button className={tab === "securities" ? "on" : ""} onClick={() => setTab("securities")}>
          증권사
        </button>
      </div>
      <div className="nh-banks__grid">
        {list.map((b) => (
          <button key={b.code} onClick={() => onPick(b)}>
            <NhBankIcon bank={b} size={30} />
            <span>{b.label}</span>
          </button>
        ))}
      </div>
      {!list.length && <p className="nh-empty">검색 결과가 없어요.</p>}
    </div>
  );
}
