// 금액 화면(S4) 화면 안 숫자판 (transfer.md §2.4): y 574.3–838.3, 4줄 × 66, 3칸 × 121.2 (x 10.2 부터, 가운데 70.8 / 192.0 / 313.2)
//  1–9 / 00 0 ←, 숫자 30 R #c2c1c6, ← 20 × 17.6 화살표. 누름 표시는 녹화에 안 보임 (그대로 둠)
import type { PadKey } from "../../lib/keypad";

const KEYS: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"];

export function AmountKeypad({ onKey }: { onKey: (k: PadKey) => void }) {
  return (
    <div className="toss-send-pad" onMouseDown={(e) => e.preventDefault()}>
      {KEYS.map((k) => (
        <button key={k} type="button" className="toss-send-pad__key" onClick={() => onKey(k)} aria-label={k === "back" ? "지우기" : k}>
          {k === "back" ? (
            <svg width="20" height="17.6" viewBox="0 0 20 17.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 8.8H1.6M9.4 1 1.6 8.8l7.8 7.8" />
            </svg>
          ) : (
            k
          )}
        </button>
      ))}
    </div>
  );
}
