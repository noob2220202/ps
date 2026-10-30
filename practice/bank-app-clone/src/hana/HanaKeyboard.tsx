import { useEffect } from "react";
import { OS } from "../platform/platform";

// 갤럭시(삼성 키보드) 숫자 자판. 하나원큐 계좌번호 칸을 누르면 아래에서 올라옴 — 라이트모드에서도 키보드는 다크.
// 녹화(480px) y 618~1066: 위 도구줄 44dp(#252525) → 키 4줄(55.2dp, 간격 8) → 아래 ⌨ · ⌄ 줄.
// 키 열 x 9.6 / 102.4 / 196 / 289.6, 폭 84.8 (녹화 12–118, 128–234, 245–352, 362–469px)
export type KbKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "back" | "enter" | "hide";

const ROWS: (KbKey | "dot" | "comma" | null)[][] = [
  ["1", "2", "3", "back"],
  ["4", "5", "6", "enter"],
  ["7", "8", "9", "dot"],
  [null, "0", null, "comma"],
];

export function HanaKeyboard({ open, onKey }: { open: boolean; onKey: (k: KbKey) => void }) {
  // 키보드가 떠 있는 동안 제스처바도 키보드 색으로
  useEffect(() => {
    if (!open || OS === "ios") return;
    document.documentElement.dataset.hanaKb = "on";
    return () => void delete document.documentElement.dataset.hanaKb;
  }, [open]);
  if (OS === "ios") return <IosPad open={open} onKey={onKey} />;
  return (
    <div className={`hana-kb ${open ? "hana-kb--open" : ""}`} aria-hidden={!open} onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
      <div className="hana-kb__tools">
        {[EmojiIcon, GearIcon, SearchIcon, TranslateIcon, MicIcon].map((Icon, i) => (
          <span key={i} className="hana-kb__tool">
            <Icon />
          </span>
        ))}
        <span className="hana-kb__more">···</span>
      </div>
      <div className="hana-kb__keys">
        {ROWS.flat().map((k, i) =>
          k === null ? (
            <span key={i} className="hana-kb__key hana-kb__key--blank" />
          ) : (
            <button
              key={i}
              className={`hana-kb__key hana-kb__key--${k}`}
              onClick={() => (k === "dot" || k === "comma" ? undefined : onKey(k))}
              aria-label={k === "back" ? "지우기" : k === "enter" ? "완료" : k}
            >
              {k === "back" ? <BackKey /> : k === "enter" ? <EnterKey /> : k === "dot" ? ".-" : k === "comma" ? "," : k}
            </button>
          ),
        )}
      </div>
      <div className="hana-kb__bottom">
        <KeyboardIcon />
        <button onClick={() => onKey("hide")} aria-label="키보드 내리기">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 8 6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// 아이폰 숫자 자판 (inputmode="numeric"): 흰 키 3열 × 4줄, 숫자 아래 영문, 왼쪽 아래 빈칸 · 오른쪽 아래 ⌫. 바깥을 누르면 내려감
const LETTERS: Record<string, string> = { "2": "ABC", "3": "DEF", "4": "GHI", "5": "JKL", "6": "MNO", "7": "PQRS", "8": "TUV", "9": "WXYZ" };
const IOS_KEYS: (KbKey | null)[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", "back"];
function IosPad({ open, onKey }: { open: boolean; onKey: (k: KbKey) => void }) {
  return (
    <div className={`hana-kb hana-kb--ios ${open ? "hana-kb--open" : ""}`} aria-hidden={!open} onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
      <div className="hana-ios-keys">
        {IOS_KEYS.map((k, i) =>
          k === null ? (
            <span key={i} />
          ) : (
            <button key={i} className={`hana-ios-key ${k === "back" ? "hana-ios-key--back" : ""}`} onClick={() => onKey(k)} aria-label={k === "back" ? "지우기" : k}>
              {k === "back" ? (
                <svg width="26" height="20" viewBox="0 0 26 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
                  <path d="M8 1.5h15a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H8L1.5 10Z" />
                  <path d="m11.5 6 7 8m0-8-7 8" strokeLinecap="round" />
                </svg>
              ) : (
                <>
                  <b>{k}</b>
                  {LETTERS[k] && <small>{LETTERS[k]}</small>}
                </>
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

const ic = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.4, "aria-hidden": true };
function EmojiIcon() {
  return (
    <svg {...ic}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7 11.8c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" strokeLinecap="round" />
      <circle cx="7.5" cy="8.2" r=".6" fill="currentColor" />
      <circle cx="12.5" cy="8.2" r=".6" fill="currentColor" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg {...ic}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg {...ic}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13 13 4 4" strokeLinecap="round" />
    </svg>
  );
}
function TranslateIcon() {
  return (
    <svg {...ic}>
      <rect x="3" y="3" width="9" height="9" rx="1.5" />
      <rect x="8" y="8" width="9" height="9" rx="1.5" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg {...ic}>
      <rect x="7.5" y="2.5" width="5" height="9.5" rx="2.5" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" strokeLinecap="round" />
    </svg>
  );
}
function KeyboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {[5, 8, 11, 14, 17].map((x) => (
        <rect key={x} x={x - 0.8} y="8" width="1.6" height="1.6" rx=".3" />
      ))}
      {[6.5, 9.5, 12.5, 15.5, 18.5].map((x) => (
        <rect key={x} x={x - 0.8} y="11" width="1.6" height="1.6" rx=".3" />
      ))}
      <rect x="7" y="14" width="10" height="1.6" rx=".3" />
    </svg>
  );
}
function BackKey() {
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden>
      <path d="M9 2.5h14.5a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5H9L2 11Z" />
      <path d="m12.5 7.5 7 7m0-7-7 7" strokeLinecap="round" />
    </svg>
  );
}
function EnterKey() {
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 3v6.5a3 3 0 0 1-3 3H5M10 7.5l-5 5 5 5" />
    </svg>
  );
}
