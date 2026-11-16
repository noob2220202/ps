// 삼성 한글 자판 (두벌식) — 메모 화면(S6). 틀은 HanaKeyboard 와 같음 (transfer.md §2.8.1, B 104.140 에서 잰 칸)
//  도구줄 494.7–538.5 #252525 (동그라미 #404040 + 흰 아이콘) · 바탕 #090909 · 맨 아래 ⌨ / ∨ 793.6–838.3
//  키 줄: 숫자 546.4–580.8 / 글자 592.0–633.6 · 645.6–687.2 · 698.4–740.0 / 아래 751.2–793.6
//  글자 키 #2c2c2c, 기능 키(⇧ ⌫ !#1 한/영 완료) #161616, 누르면 위로 말풍선
import { useState, type CSSProperties, type PointerEvent } from "react";

export type KoKey = { t: "char"; v: string } | { t: "back" } | { t: "done" } | { t: "hide" };

const NUM = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const R2 = ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"];
const R2S = ["ㅃ", "ㅉ", "ㄸ", "ㄲ", "ㅆ", "ㅛ", "ㅕ", "ㅑ", "ㅒ", "ㅖ"];
const R3 = ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"];
const R4 = ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"];

type K = { id: string; x: number; w: number; label: string; fn?: boolean; key: KoKey | null; cls?: string };
const row = (xs: number, pitch: number, keys: string[], cls?: string): K[] => keys.map((v, i) => ({ id: v + i, x: xs + i * pitch, w: 32, label: v, key: { t: "char", v }, cls }));

export function KoreanKeyboard({ open, onKey }: { open: boolean; onKey: (k: KoKey) => void }) {
  const [shift, setShift] = useState(false);
  const [pop, setPop] = useState<{ id: string; label: string; x: number; w: number; y: number } | null>(null);
  const rows: { y: number; h: number; keys: K[] }[] = [
    { y: 51.7, h: 34.4, keys: row(8, 37.33, NUM, "num") },
    { y: 97.3, h: 41.6, keys: row(8, 37.33, shift ? R2S : R2) },
    { y: 150.9, h: 41.6, keys: row(27.2, 37.2, R3) },
    {
      y: 203.7,
      h: 41.6,
      keys: [
        { id: "shift", x: 8.8, w: 44, label: "", fn: true, key: null, cls: "shift" },
        ...row(64, 37.33, R4),
        { id: "back", x: 331.2, w: 44, label: "", fn: true, key: { t: "back" }, cls: "back" },
      ],
    },
    {
      y: 256.5,
      h: 42.4,
      keys: [
        { id: "sym", x: 8.8, w: 44.8, label: "!#1", fn: true, key: null, cls: "sym" },
        { id: "lang", x: 60, w: 31.2, label: "", fn: true, key: null, cls: "lang" },
        { id: "comma", x: 96.8, w: 32, label: ",", key: { t: "char", v: "," } },
        { id: "space", x: 134.4, w: 148, label: "", key: { t: "char", v: " " }, cls: "space" },
        { id: "dot", x: 288, w: 31.2, label: ".", key: { t: "char", v: "." } },
        { id: "done", x: 324.8, w: 50.4, label: "완료", fn: true, key: { t: "done" }, cls: "done" },
      ],
    },
  ];
  const down = (k: K, y: number, e: PointerEvent) => {
    e.preventDefault();
    if (k.key?.t === "char" && k.key.v !== " ") setPop({ id: k.id, label: k.label, x: k.x, w: k.w, y });
  };
  const up = (k: K) => {
    setPop(null);
    if (k.id === "shift") return setShift((s) => !s);
    if (!k.key) return;
    onKey(k.key);
    if (shift && k.key.t === "char") setShift(false);
  };
  return (
    <div className={`toss-send-kk${open ? " toss-send-kk--open" : ""}`} aria-hidden={!open} onMouseDown={(e) => e.preventDefault()}>
      <div className="toss-send-kk__tools">
        {TOOLS.map((Icon, i) => (
          <span key={i} className="toss-send-kk__tool" style={{ left: [33.6, 101.6, 168.4, 236, 303.2][i] }}>
            <Icon />
          </span>
        ))}
        <span className="toss-send-kk__more">···</span>
      </div>
      {rows.map((r) =>
        r.keys.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`toss-send-kk__key${k.fn ? " toss-send-kk__key--fn" : ""}${k.cls ? ` toss-send-kk__key--${k.cls}` : ""}${k.id === "shift" && shift ? " on" : ""}`}
            style={{ left: k.x, top: r.y, width: k.w, height: r.h } as CSSProperties}
            onPointerDown={(e) => down(k, r.y, e)}
            onPointerUp={() => up(k)}
            onPointerLeave={() => pop?.id === k.id && setPop(null)}
            aria-label={k.cls === "back" ? "지우기" : k.cls === "shift" ? "쉬프트" : k.cls === "space" ? "띄어쓰기" : k.cls === "lang" ? "한/영" : k.label}
          >
            {k.cls === "back" ? <BackKey /> : k.cls === "shift" ? <ShiftKey /> : k.cls === "space" ? <SpaceKey /> : k.cls === "lang" ? <LangKey /> : k.label}
          </button>
        )),
      )}
      {pop && (
        <span className="toss-send-kk__pop" style={{ left: pop.x + pop.w / 2 - 22, top: pop.y - 50 }} aria-hidden>
          {pop.label}
        </span>
      )}
      <div className="toss-send-kk__bottom">
        <KeyboardIcon />
        <button type="button" onClick={() => onKey({ t: "hide" })} aria-label="키보드 내리기">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 8 6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const ic = { width: 19, height: 19, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true };
const TOOLS = [
  () => (
    <svg {...ic}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7 11.8c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" strokeLinecap="round" />
      <circle cx="7.5" cy="8.2" r=".6" fill="currentColor" />
      <circle cx="12.5" cy="8.2" r=".6" fill="currentColor" />
    </svg>
  ),
  () => (
    <svg {...ic}>
      <path
        d="M8.6 2.4h2.8l.4 2.1 1.5.8 2-.8 1.4 2.4-1.6 1.4v1.4l1.6 1.4-1.4 2.4-2-.8-1.5.8-.4 2.1H8.6l-.4-2.1-1.5-.8-2 .8-1.4-2.4 1.6-1.4V8.3L3.3 6.9l1.4-2.4 2 .8 1.5-.8Z"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  ),
  () => (
    <svg {...ic}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13 13 4 4" strokeLinecap="round" />
    </svg>
  ),
  () => (
    <svg {...ic}>
      <rect x="3" y="3" width="9" height="9" rx="1.5" />
      <rect x="8" y="8" width="9" height="9" rx="1.5" />
    </svg>
  ),
  () => (
    <svg {...ic}>
      <rect x="7.5" y="2.5" width="5" height="9.5" rx="2.5" />
      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" strokeLinecap="round" />
    </svg>
  ),
];
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
    <svg width="27" height="20" viewBox="0 0 28 22" aria-hidden>
      <path d="M9 2h14.5a2.5 2.5 0 0 1 2.5 2.5v13a2.5 2.5 0 0 1-2.5 2.5H9L2 11Z" fill="none" stroke="#f2f2f2" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m12.8 7.4 7.2 7.2m0-7.2-7.2 7.2" stroke="#f2f2f2" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ShiftKey() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <path d="M10 2.8 2.8 10.4h3.9v6.4h6.6v-6.4h3.9Z" />
    </svg>
  );
}
function SpaceKey() {
  return (
    <svg width="34" height="10" viewBox="0 0 34 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M1.5 2v5.5h31V2" />
    </svg>
  );
}
function LangKey() {
  return (
    <span className="toss-send-kk__lang">
      <i>한</i>
      <b />
      <i>영</i>
    </span>
  );
}
