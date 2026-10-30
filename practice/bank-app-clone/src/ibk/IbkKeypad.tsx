import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import "./ibk-send.css";

// i-ONE Bank 숫자 자판 (금액 화면 — specB/amount.md 6). 입력칸을 누르면 애니메이션 없이 한 프레임에 나타나고(20.333초),
// '확인'을 떼면 한 프레임에 사라짐(23.733초). 흰 판(위 모서리 r28, 윗변 1px rgba(0,0,0,.06)) 위에
// 칩 줄(+1만 +5만 +10만 +100만 전액) → 숫자 칸 3열 × 4행(1 2 3 / 4 5 6 / 7 8 9 / 00 0 ←) → 파란 '확인'.
// 숫자 칸 누름 = 물결(누른 점에서 원이 퍼져 칸(r12)을 채움, 반투명 검정 .067 이라 빨리 두 번 누르면 더 진해짐),
// 숫자는 누르고 67ms 뒤(아직 누르는 중)에 들어감. 계좌번호 입력(받는 분 화면, PC)에선 칩 없이 씀.
// 좌표: 판 안 x = 클론 x + 2.98 (판 왼끝 = 녹화 −2.7 → 클론 −2.98), y = 녹화 y − 447.94 (판 윗변)
export type IbkKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "00" | "back";
const KEYS: IbkKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"];

// 칩 (6-1): 녹화 x 55.9→107.2 … 286.1→337.4 → 클론 54.24~329.09, 폭 50.09 (+100만 56.83), 사이 4.49
export const IBK_CHIPS = [
  { label: "+1만", add: 10_000 },
  { label: "+5만", add: 50_000 },
  { label: "+10만", add: 100_000 },
  { label: "+100만", add: 1_000_000 },
  { label: "전액", add: null },
] as const;

interface Ripple {
  id: number;
  x: number; // 누른 점 (칸 안)
  y: number;
  dx: number; // 누른 점 → 칸 가운데 (퍼지면서 원 중심이 칸 가운데로 옮겨 감)
  dy: number;
  r: number; // 칸 가운데에서 모서리까지 (다 퍼졌을 때 칸을 덮는 반지름)
  out: boolean; // 사라지는 중
}

function Key({ k, onKey }: { k: IbkKey; onKey: (k: IbkKey) => void }) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (f: () => void, ms: number) => timers.current.push(window.setTimeout(f, ms));
  const release = () => {
    setRipples((rs) => rs.map((r) => (r.out ? r : { ...r, out: true })));
    later(() => setRipples((rs) => rs.filter((r) => !r.out)), 160);
  };
  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    const r = Math.hypot(b.width / 2, b.height / 2);
    setRipples((rs) => [...rs, { id: ++seq.current, x, y, dx: b.width / 2 - x, dy: b.height / 2 - y, r, out: false }]);
    later(() => onKey(k), 67); // 물결 시작 → 67ms 뒤 숫자 (녹화 21.033 → 21.133, 113.1 → 113.133)
  };
  return (
    <button
      className={`ibs-kp__key ibs-kp__key--${k}`}
      onPointerDown={down}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onClick={(e) => e.detail === 0 && onKey(k)} // 키보드(Enter·Space)로 누른 경우만
      aria-label={k === "back" ? "지우기" : k}
    >
      {ripples.map((r) => (
        <i
          key={r.id}
          className={`ibs-kp__ripple ${r.out ? "ibs-kp__ripple--out" : ""}`}
          style={{
            left: r.x - r.r,
            top: r.y - r.r,
            width: r.r * 2,
            height: r.r * 2,
            ["--dx" as string]: `${r.dx}px`,
            ["--dy" as string]: `${r.dy}px`,
          }}
        />
      ))}
      {k === "back" ? (
        // ← (6-2): 꼭짓점 녹화 (320.2, 683.0) → 클론 (312.29, 683.0), 팔 끝 클론 x 319.22 (y ±8.1), 가로선 끝 329.87, 둥근 끝 (녹화 1.6 → 잉크 양을 맞춰 1.45)
        <svg className="ibs-kp__back" width="17.58" height="16.2" viewBox="0 0 17.58 16.2" overflow="visible" aria-hidden>
          <path d="M6.93 0 0 8.1l6.93 8.1M0 8.1h17.58" fill="none" stroke="#000" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span>{k}</span>
      )}
    </button>
  );
}

export function IbkKeypad({
  onKey,
  onDone,
  chips = false,
  onChip,
  doneLabel = "확인",
}: {
  onKey: (k: IbkKey) => void;
  onDone: () => void; // 아래 '확인'
  chips?: boolean; // 금액 화면만
  onChip?: (add: number | null) => void; // null = 전액
  doneLabel?: string;
}) {
  // PC: 실제 키보드 숫자·Backspace·Enter 도 받음
  const keyRef = useRef(onKey);
  const doneRef = useRef(onDone);
  useEffect(() => {
    keyRef.current = onKey;
    doneRef.current = onDone;
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // 입력칸이 직접 받는 경우
      if (/^[0-9]$/.test(e.key)) keyRef.current(e.key as IbkKey);
      else if (e.key === "Backspace") keyRef.current("back");
      else if (e.key === "Enter") doneRef.current();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return (
    <div className="ibs-kp" onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
      {chips && (
        <div className="ibs-kp__chips">
          {IBK_CHIPS.map((c) => (
            <button key={c.label} className="ibs-kp__chip" onClick={() => onChip?.(c.add)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="ibs-kp__keys">
        {KEYS.map((k) => (
          <Key key={k} k={k} onKey={onKey} />
        ))}
      </div>
      <button className="ibk-btn ibs-kp__done" onClick={onDone}>
        {doneLabel}
      </button>
    </div>
  );
}
