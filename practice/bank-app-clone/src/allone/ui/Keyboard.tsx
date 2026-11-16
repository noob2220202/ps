// AoKeyboard (plan.md §3.3, home §2.19, transfer §5.4): iOS 26 키보드 — 네이티브 층(#ao-native-kb, z 56)에 그려서 아래 띠까지 덮음.
// 웹뷰 크기는 그대로 (내용이 키보드 밑에 가려짐). 입력칸은 영역이 그림 (가짜 칸 + AoCaret) — 글자는 이 키보드가 value / onChange 로 넣음.
//
// kind "ko" — 한국어 두벌식 (C3 41.80 쉴 때 잼, pt = px/3.0025 · y px/3):
//   보조 줄(흰 바탕 490–545): ∧ (잉크 x 31.64 y 504.67, #a9a9a9) · ∨ (x 85.6) · ✓ (x 342.71 y 501.33, 검정, 누르면 onDone)
//   유리 판 #f0f1f4 위 545 → 852, 위 모서리 27, 아래 모서리 타원 45 / 53 (기기 모서리를 따라감, 잉크 맞춤 오차 1pt)
//   키: 흰색, 둥글기 7.5, 높이 43, 그림자 없음, 누르면 #c9c8cb (말풍선 없음). 줄 위끝 569 / 623 / 677 / 731
//     1줄 x 6.66 부터 폭 32.64, 간격 38.6: ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ  · 2줄 x 25.65 부터: ㅁㄴㅇㄹㅎㅗㅓㅏㅣ
//     3줄 ⇧ 6.66–50.62 · ㅋㅌㅊㅍㅠㅜㅡ x 64.28 부터 · ⌫ 342.38–386.68 · 4줄 123 6.66–48.63 · 😀 54.62–96.92 · 띄어쓰기 102.91–290.09 (오른쪽 아래 회색 "한") · ↵ 296.09–386.68
//     맨 아래 🌐 (x 28.98 y 798.67) · 마이크 (x 341.05 y 796.67) — 키 바탕 없음, 누름 없음
//   글자: 자모 Pretendard 23.5/400 (녹화 ㅂ 잉크 13 × 11, ㅕ 6.3 × 20) · "123" 17.9/400 (자모는 Pretendard 보다 1.2 위로)
//   123 → 숫자 · 기호 판 (녹화에 없음, iOS 배열), #+= → 기호 판 2
// kind "num" — iOS 숫자 패드 (녹화에 없음, transfer §5.4): 판 #f0f1f4 위 600, 흰 키 4줄 × 3칸 (높이 46, 간격 6, 둥글기 8.5),
//   숫자 25/400 + 글자 10/600 (ABC…), 아래 줄: 빈칸 · 0 · ⌫. 보조 줄 545–600
// 움직임: 올라옴 290ms cubic-bezier(.2,.4,.2,1) (C3 41.146–41.513 프레임마다 잰 위치에 맞춤, 오차 rms 2pt),
//   내려감 250ms (invented). 보조 줄은 판과 한 덩어리로 움직임 (C3 41.31–41.51)
// 닫힘: ✓ · Esc · 바깥 누름 → onDone (영역이 open=false). 입력칸처럼 바깥으로 치지 않을 요소에는 data-ao-kb-field 를 붙임.
//   화면이 바뀌면 같이 사라짐 (portal). 녹화 다시 시작 · 로그아웃(aoNativeReset)도 onDone
// 진짜 키보드: 숨은 <input inputMode="none"> 이 받음 — 영문 자판은 두벌식 자모로 바꿔 조합, 한글 IME 로 친 글자는 완성된 글자로 붙임,
//   Backspace · Enter · Esc. 휴대폰의 화면 키보드는 뜨지 않음
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { AO_KEYBOARD } from "../motion";
import { onAoNativeReset } from "../native";
import { compose, isJamo } from "./hangul";
import { AoNativePortal } from "./NativePortal";

/** 한국어 키보드 유리 판 위끝 (화면 y). 보조 줄은 그 위 55pt (490–545) */
export const AO_KB_TOP = 545;
/** 숫자 패드 판 위끝 (화면 y). 보조 줄 545–600 */
export const AO_KB_NUM_TOP = 600;
/** 보조 줄 높이 (∧ ∨ ✓) */
export const AO_KB_ACCESSORY = 55;

export interface AoKeyboardProps {
  open: boolean;
  kind?: "ko" | "num";
  value: string;
  onChange: (value: string) => void;
  maxLength?: number; // 글자 수 (조합 중인 글자도 한 자)
  onDone?: () => void; // ✓ · Esc · 바깥 누름 → 입력칸을 떠남
  onEnter?: () => void; // ↵ (없으면 onDone)
  accessory?: boolean; // ∧ ∨ ✓ 줄 (기본 true)
  onPrev?: () => void; // ∧ (없으면 회색, 누름 없음)
  onNext?: () => void; // ∨
  dismissOnOutside?: boolean; // 기본 true
}

type Phase = "closed" | "open" | "closing";
type Layer = "ko" | "sym" | "sym2";
type Act = { t: "jamo"; v: string } | { t: "char"; v: string } | { t: "back" } | { t: "enter" } | { t: "shift" } | { t: "layer"; v: Layer } | { t: "none" };
interface Key {
  id: string;
  x: number;
  y: number; // 판 기준 (화면 y − 판 위끝)
  w: number;
  h: number;
  act: Act;
  label?: ReactNode;
  cls?: string;
  bare?: boolean; // 바탕 없는 키 (숫자 패드 빈칸 · ⌫)
}

const KB_SLIDE_IN = `ao-kb-in ${AO_KEYBOARD.slide}ms ${AO_KEYBOARD.ease} both`;

// 두벌식 영문 자판 → 자모 (진짜 키보드)
const DUBEOL: Record<string, string> = {
  q: "ㅂ", w: "ㅈ", e: "ㄷ", r: "ㄱ", t: "ㅅ", y: "ㅛ", u: "ㅕ", i: "ㅑ", o: "ㅐ", p: "ㅔ",
  a: "ㅁ", s: "ㄴ", d: "ㅇ", f: "ㄹ", g: "ㅎ", h: "ㅗ", j: "ㅓ", k: "ㅏ", l: "ㅣ",
  z: "ㅋ", x: "ㅌ", c: "ㅊ", v: "ㅍ", b: "ㅠ", n: "ㅜ", m: "ㅡ",
  Q: "ㅃ", W: "ㅉ", E: "ㄸ", R: "ㄲ", T: "ㅆ", O: "ㅒ", P: "ㅖ",
};

const R1 = ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"];
const R1S = ["ㅃ", "ㅉ", "ㄸ", "ㄲ", "ㅆ", "ㅛ", "ㅕ", "ㅑ", "ㅒ", "ㅖ"];
const R2 = ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"];
const R3 = ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"];
const SYM1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const SYM2 = ["-", "/", ":", ";", "(", ")", "₩", "&", "@", '"'];
const SYM3 = [".", ",", "?", "!", "'"];
const SYMB1 = ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="];
const SYMB2 = ["_", "\\", "|", "~", "<", ">", "$", "€", "£", "•"];

// 한국어 판 (위끝 545) 기준 줄 위끝: 569 / 623 / 677 / 731
const KY = [24, 78, 132, 186];
const KH = 43;
const KW = 32.64;
// 모음은 녹화 글꼴과 Pretendard 의 세로 자리가 달라서 자모마다 맞춤 (C3 41.80 잉크 위끝 기준, pt)
const VOFF: Record<string, number> = { ㅛ: 1.2, ㅗ: 1.33, ㅕ: -1.17, ㅑ: -1.17, ㅐ: -1.17, ㅔ: -1.17, ㅒ: -1.17, ㅖ: -1.17, ㅓ: -1.17, ㅏ: -1.17, ㅣ: -1.17, ㅠ: -1.5, ㅜ: -1.5 };
const glyph = (v: string) => (VOFF[v] ? <span style={{ position: "relative", top: VOFF[v] }}>{v}</span> : v);
const row = (x0: number, pitch: number, y: number, chars: string[], jamo: boolean): Key[] =>
  chars.map((v, i) => ({ id: `${y}-${i}-${v}`, x: x0 + i * pitch, y, w: KW, h: KH, act: jamo && isJamo(v) ? { t: "jamo", v } : { t: "char", v }, label: jamo ? glyph(v) : v }));

function koKeys(layer: Layer, shift: boolean): Key[] {
  const bottom: Key[] = [
    { id: "emoji", x: 54.62, y: KY[3], w: 42.3, h: KH, act: { t: "none" }, label: <EmojiGlyph />, cls: "icon" },
    { id: "space", x: 102.91, y: KY[3], w: 187.18, h: KH, act: { t: "char", v: " " }, label: <span className="ao-kb__han">한</span>, cls: "space" },
    { id: "enter", x: 296.09, y: KY[3], w: 90.59, h: KH, act: { t: "enter" }, label: <ReturnGlyph />, cls: "icon" },
  ];
  const back: Key = { id: "back", x: 342.38, y: KY[2], w: 44.3, h: KH, act: { t: "back" }, label: <BackGlyph />, cls: "icon" };
  if (layer === "ko")
    return [
      ...row(6.66, 38.6, KY[0], shift ? R1S : R1, true),
      ...row(25.65, 38.63, KY[1], R2, true),
      { id: "shift", x: 6.66, y: KY[2], w: 43.96, h: KH, act: { t: "shift" }, label: <ShiftGlyph on={shift} />, cls: "icon" },
      ...row(64.28, 38.63, KY[2], R3, true),
      back,
      { id: "123", x: 6.66, y: KY[3], w: 41.97, h: KH, act: { t: "layer", v: "sym" }, label: "123", cls: "fn" },
      ...bottom,
    ];
  const wide = (264.45 - 4 * 6) / 5; // . , ? ! ' 다섯 키 (iOS 기호 판처럼 넓게)
  return [
    ...row(6.66, 38.6, KY[0], layer === "sym" ? SYM1 : SYMB1, false),
    ...row(6.66, 38.6, KY[1], layer === "sym" ? SYM2 : SYMB2, false),
    { id: "symswap", x: 6.66, y: KY[2], w: 43.96, h: KH, act: { t: "layer", v: layer === "sym" ? "sym2" : "sym" }, label: layer === "sym" ? "#+=" : "123", cls: "fn" },
    ...SYM3.map((v, i): Key => ({ id: `p${i}`, x: 64.28 + i * (wide + 6), y: KY[2], w: wide, h: KH, act: { t: "char", v }, label: v })),
    back,
    { id: "abc", x: 6.66, y: KY[3], w: 41.97, h: KH, act: { t: "layer", v: "ko" }, label: "ㄱㄴㄷ", cls: "fn fn-ko" },
    ...bottom,
  ];
}

// 숫자 패드 (판 위끝 600 기준): 줄 위 8 / 60 / 112 / 164, 칸 x 6.66 · 135.22 · 263.78 폭 122.56
const NUM_LETTERS = ["", "ABC", "DEF", "GHI", "JKL", "MNO", "PQRS", "TUV", "WXYZ"];
function numKeys(): Key[] {
  const xs = [6.66, 135.22, 263.78];
  const ys = [8, 60, 112, 164];
  const w = 122.56;
  const h = 46;
  const keys: Key[] = [];
  for (let d = 1; d <= 9; d++) {
    const c = (d - 1) % 3;
    const r = Math.floor((d - 1) / 3);
    keys.push({ id: `n${d}`, x: xs[c], y: ys[r], w, h, act: { t: "char", v: String(d) }, label: <NumLabel d={String(d)} letters={NUM_LETTERS[d - 1]} />, cls: "num" });
  }
  keys.push({ id: "n0", x: xs[1], y: ys[3], w, h, act: { t: "char", v: "0" }, label: <NumLabel d="0" letters="" />, cls: "num" });
  keys.push({ id: "nback", x: xs[2], y: ys[3], w, h, act: { t: "back" }, label: <BackGlyph />, cls: "icon", bare: true });
  return keys;
}

const pct = (x: number) => `${+((x / 393) * 100).toFixed(4)}%`;
const chars = (s: string) => [...s];

export function AoKeyboard({ open, kind = "ko", value, onChange, maxLength, onDone, onEnter, accessory = true, onPrev, onNext, dismissOnOutside = true }: AoKeyboardProps) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  if (open && phase !== "open") setPhase("open");
  if (!open && phase === "open") setPhase("closing");
  useEffect(() => {
    if (phase !== "closing") return;
    const t = window.setTimeout(() => setPhase("closed"), AO_KEYBOARD.out + 20);
    return () => window.clearTimeout(t);
  }, [phase]);

  const [layer, setLayer] = useState<Layer>("ko");
  const [shift, setShift] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  // 열릴 때마다 한글 판 · 쉬프트 꺼짐으로
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLayer("ko");
      setShift(false);
    }
  }

  // 조합 상태: base = 조합 전 글자들, seq = 조합 중인 자모 열. 값이 밖에서 바뀌면 새로 시작
  const st = useRef({ base: value, seq: [] as string[], last: value });
  const latest = useRef({ value, onChange, maxLength, onDone, onEnter, kind });
  useEffect(() => {
    latest.current = { value, onChange, maxLength, onDone, onEnter, kind };
  });

  const emit = useCallback((next: string) => {
    st.current.last = next;
    latest.current.onChange(next);
  }, []);
  const sync = useCallback(() => {
    const v = latest.current.value;
    if (v !== st.current.last) st.current = { base: v, seq: [], last: v };
  }, []);
  const fits = (s: string) => latest.current.maxLength === undefined || chars(s).length <= latest.current.maxLength;

  const run = useCallback(
    (a: Act) => {
      const L = latest.current;
      if (a.t === "jamo") {
        sync();
        const seq = [...st.current.seq, a.v];
        const next = st.current.base + compose(seq);
        if (!fits(next)) return;
        st.current.seq = seq;
        emit(next);
        setShift(false);
      } else if (a.t === "char") {
        if (L.kind === "num" && !/^\d$/.test(a.v)) return;
        sync();
        const next = L.value + a.v;
        if (!fits(next)) return;
        st.current.base = next;
        st.current.seq = [];
        emit(next);
      } else if (a.t === "back") {
        sync();
        if (st.current.seq.length) {
          const seq = st.current.seq.slice(0, -1);
          st.current.seq = seq;
          emit(st.current.base + compose(seq));
        } else if (L.value) {
          const next = chars(L.value).slice(0, -1).join("");
          st.current.base = next;
          emit(next);
        }
      } else if (a.t === "enter") {
        (L.onEnter ?? L.onDone)?.();
      } else if (a.t === "shift") {
        setShift((s) => !s);
      } else if (a.t === "layer") {
        setLayer(a.v);
        setShift(false);
      }
    },
    [emit, sync],
  );

  // ⌫ 를 누르고 있으면 0.5초 뒤부터 0.1초마다 지움
  const repeat = useRef<{ t: number; i: number } | null>(null);
  const stopRepeat = () => {
    if (!repeat.current) return;
    window.clearTimeout(repeat.current.t);
    window.clearInterval(repeat.current.i);
    repeat.current = null;
  };
  useEffect(() => stopRepeat, []);

  const down = (k: Key, e: RPointerEvent) => {
    e.preventDefault(); // 숨은 입력칸의 포커스를 지킴
    setPressed(k.id);
    if (k.act.t === "back") {
      stopRepeat();
      const r = { t: 0, i: 0 };
      r.t = window.setTimeout(() => {
        r.i = window.setInterval(() => run({ t: "back" }), 100);
      }, 500);
      repeat.current = r;
      run({ t: "back" });
    }
  };
  const up = (k: Key) => {
    stopRepeat();
    if (pressed !== k.id) return;
    setPressed(null);
    if (k.act.t !== "back") run(k.act);
  };
  const leave = (k: Key) => {
    if (pressed === k.id) {
      setPressed(null);
      stopRepeat();
    }
  };

  // 바깥 누름 → onDone
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase !== "open" || !dismissOnOutside) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || root.current?.contains(t) || t.closest?.("[data-ao-kb-field]")) return;
      latest.current.onDone?.();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [phase, dismissOnOutside]);

  // 녹화 다시 시작 · 로그아웃
  useEffect(() => onAoNativeReset(() => latest.current.onDone?.()), []);

  // 진짜 키보드: 숨은 입력칸에 포커스
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (phase === "open") input.current?.focus({ preventScroll: true });
    else input.current?.blur();
  }, [phase]);
  const feed = (text: string) => {
    for (const c of chars(text)) run(isJamo(c) && latest.current.kind === "ko" ? { t: "jamo", v: c } : { t: "char", v: c });
  };

  if (phase === "closed") return null;
  const isNum = kind === "num";
  const panelTop = isNum ? AO_KB_NUM_TOP : AO_KB_TOP;
  const accTop = accessory ? panelTop - AO_KB_ACCESSORY : panelTop;
  const keys = isNum ? numKeys() : koKeys(layer, shift);
  const style = { height: 852 - accTop, ...(phase === "open" && { animation: KB_SLIDE_IN }) } as CSSProperties;

  return (
    <AoNativePortal layer="keyboard">
      <div ref={root} className={`ao-kb ao-kb--${kind} ao-kb--${phase}`} style={style} onPointerDown={(e) => e.target !== input.current && e.preventDefault()}>
        <input
          ref={input}
          className="ao-kb__input"
          inputMode="none"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          tabIndex={-1}
          aria-hidden
          defaultValue=""
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.key === "Process" || e.keyCode === 229) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const L = latest.current;
            if (e.key === "Backspace") run({ t: "back" });
            else if (e.key === "Enter") run({ t: "enter" });
            else if (e.key === "Escape") L.onDone?.();
            else if (e.key.length === 1) {
              const j = L.kind === "ko" ? (DUBEOL[e.key] ?? DUBEOL[e.key.toLowerCase()]) : undefined;
              run(j ? { t: "jamo", v: j } : { t: "char", v: e.key });
            } else return;
            e.preventDefault();
          }}
          onCompositionEnd={(e) => {
            feed(e.data);
            e.currentTarget.value = "";
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            if ((e.nativeEvent as InputEvent).isComposing) return;
            if (el.value) feed(el.value);
            el.value = "";
          }}
        />
        {accessory && (
          <div className="ao-kb__acc">
            <button type="button" className={`ao-kb__acc-btn ao-kb__acc-up${onPrev ? " ao-kb__acc-btn--on" : ""}`} aria-label="이전 입력칸" onClick={() => onPrev?.()}>
              <svg width="18.32" height="10.66" viewBox="0 0 18.32 10.66" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M.7 9.96 9.16.7l8.46 9.26" />
              </svg>
            </button>
            <button type="button" className={`ao-kb__acc-btn ao-kb__acc-down${onNext ? " ao-kb__acc-btn--on" : ""}`} aria-label="다음 입력칸" onClick={() => onNext?.()}>
              <svg width="18.31" height="10.67" viewBox="0 0 18.31 10.67" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M.7.7 9.16 9.97 17.61.7" />
              </svg>
            </button>
            <button type="button" className="ao-kb__acc-btn ao-kb__acc-done" aria-label="완료" onClick={() => latest.current.onDone?.()}>
              <svg width="18.66" height="18.34" viewBox="0 0 18.66 18.34" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M.95 10.1 6.6 17.39 17.71.95" />
              </svg>
            </button>
          </div>
        )}
        <div className="ao-kb__panel" style={{ top: panelTop - accTop }}>
          {keys.map((k) => (
            <button
              key={k.id}
              type="button"
              tabIndex={-1}
              className={`ao-kb__key${k.cls ? ` ${k.cls.split(" ").map((c) => `ao-kb__key--${c}`).join(" ")}` : ""}${k.bare ? " ao-kb__key--bare" : ""}${pressed === k.id ? " ao-kb__key--down" : ""}${k.id === "shift" && shift ? " ao-kb__key--on" : ""}`}
              style={{ left: pct(k.x), top: k.y, width: pct(k.w), height: k.h }}
              onPointerDown={(e) => down(k, e)}
              onPointerUp={() => up(k)}
              onPointerLeave={() => leave(k)}
              onPointerCancel={() => leave(k)}
              aria-label={k.id === "back" || k.id === "nback" ? "지우기" : k.id === "space" ? "띄어쓰기" : k.id === "enter" ? "입력" : k.id === "shift" ? "쉬프트" : k.id === "emoji" ? "이모티콘" : undefined}
            >
              {k.label}
            </button>
          ))}
          {!isNum && (
            <>
              <span className="ao-kb__globe" aria-hidden>
                <GlobeGlyph />
              </span>
              <span className="ao-kb__mic" aria-hidden>
                <MicGlyph />
              </span>
            </>
          )}
        </div>
      </div>
    </AoNativePortal>
  );
}

/** iOS 입력칸 커서 (깜박임). 통합검색 파랑 ≈ 2 × 28 (home §2.19), T1 계좌번호 초록 #0c8f2d (transfer §5.4) */
export function AoCaret({ height = 28, width = 2, color = "#007aff", className, style }: { height?: number; width?: number; color?: string; className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={`ao-caret${className ? ` ${className}` : ""}`} style={{ height, width, background: color, ...style }} />;
}

// ---------- 키 그림 (녹화 C3 41.80 의 잉크 상자, 키 왼쪽 위 기준 자리는 ui.css) ----------
function NumLabel({ d, letters }: { d: string; letters: string }) {
  return (
    <span className="ao-kb__numlabel">
      <span className="ao-kb__numd">{d}</span>
      {letters && <span className="ao-kb__numl">{letters}</span>}
    </span>
  );
}
const sv = (w: number, h: number, s: number, children: ReactNode, cls: string) => (
  <svg className={`ao-kb__glyph ${cls}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" stroke="currentColor" strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
// ⇧ 20 × 17.34 (키 안 12.32, 13.33)
function ShiftGlyph({ on }: { on: boolean }) {
  return sv(20, 17.34, 1.5, <path d="M10 .9 19.1 9.6H14.1V16.6H5.9V9.6H.9Z" fill={on ? "currentColor" : "none"} />, "ao-kb__g-shift");
}
// ⌫ 20.31 × 17 (키 안 11.33, 13.67) — iOS 꼬리표 + ×
function BackGlyph() {
  return sv(
    20.31,
    17,
    1.5,
    <>
      <path d="M.75 8.5 6.6.75H16.56Q19.56.75 19.56 3.75V13.25Q19.56 16.25 16.56 16.25H6.6Z" />
      <path d="M10.3 5.3l6 6M16.3 5.3l-6 6" />
    </>,
    "ao-kb__g-back",
  );
}
// 😀 19 × 19 (키 안 11.66, 11.33) — 테두리 얼굴
function EmojiGlyph() {
  return sv(
    19,
    19,
    1.5,
    <>
      <circle cx="9.5" cy="9.5" r="8.75" />
      <ellipse cx="6.6" cy="7" rx=".9" ry="1.4" fill="currentColor" stroke="none" />
      <ellipse cx="12.4" cy="7" rx=".9" ry="1.4" fill="currentColor" stroke="none" />
      <path d="M4.6 10.6H14.4Q14 15.2 9.5 15.2T4.6 10.6Z" />
    </>,
    "ao-kb__g-emoji",
  );
}
// ↵ 19.65 × 17 (키 안 35.63, 12.67)
function ReturnGlyph() {
  return sv(19.65, 17, 1.75, <path d="M12.6.9H16.9Q18.8.9 18.8 2.8V9.3Q18.8 11.2 16.9 11.2H1.1M6.3 6 1.1 11.2l5.2 5.2" />, "ao-kb__g-return");
}
// 🌐 27 × 26.67 (화면 x 28.98, y 798.67)
function GlobeGlyph() {
  return sv(
    27,
    26.67,
    1.6,
    <>
      <circle cx="13.5" cy="13.33" r="12.55" />
      <ellipse cx="13.5" cy="13.33" rx="5.6" ry="12.55" />
      <path d="M13.5.8V25.9M.95 13.33H26.05M2.7 7.1H24.3M2.7 19.56H24.3" />
    </>,
    "ao-kb__g-globe",
  );
}
// 마이크 18.65 × 28.33 (화면 x 341.05, y 796.67)
function MicGlyph() {
  return sv(
    18.65,
    28.33,
    1.75,
    <>
      <rect x="5.45" y=".875" width="7.75" height="17.2" rx="3.875" />
      <path d="M.875 12.6A8.45 8.45 0 0 0 17.775 12.6M9.33 21.1V26.6M4.8 27.45H13.85" />
    </>,
    "ao-kb__g-mic",
  );
}
