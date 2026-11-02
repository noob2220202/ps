// 금액 숫자판 (녹화 24~29초, 프레임 760): 3열 × 4줄 1~9 · 00 · 0 · ←, 위에 +1만/+10만/+100만/전액 칩.
// 칸 가운데: 열 x 63.8 / 192.0 / 320.2 (피치 128.2), 줄 앱 y 473.5 / 540.8 / 608.9 / 676.6 (피치 67.7) — 녹화 잉크 가운데 ÷ 1.53646
export type KbankKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "00" | "0" | "back";
const KEYS: KbankKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"];
const KB_CHIPS: { label: string; add: number | null }[] = [
  { label: "+1만", add: 10_000 },
  { label: "+10만", add: 100_000 },
  { label: "+100만", add: 1_000_000 },
  { label: "전액", add: null },
];

export function KbankKeypad({ onKey, onChip }: { onKey: (k: KbankKey) => void; onChip: (add: number | null) => void }) {
  return (
    <div className="kbs-pad">
      <div className="kbs-chips">
        {KB_CHIPS.map((c) => (
          <button key={c.label} className="kbs-chip" onClick={() => onChip(c.add)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="kbs-keys">
        {KEYS.map((k) => (
          <button key={k} className="kbs-key" onClick={() => onKey(k)} aria-label={k === "back" ? "지우기" : k}>
            {k === "back" ? (
              // ← : 잉크 x 307.9~332.6 · y 665.8~687.9 (프레임 760), 가는 선
              <svg width="25" height="23" viewBox="0 0 25 23" aria-hidden>
                <path d="M23.6 11.5H2.2M11.6 1.6 1.7 11.5l9.9 9.9" fill="none" stroke="#181818" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              k
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
