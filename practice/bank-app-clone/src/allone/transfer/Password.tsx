// T3 계좌 비밀번호 입력 (transfer.md §2.4 · §5.7, C3 31.129–32.729): 네이티브 시트 (창 전체 막 .733), 한 프레임에 나타나고 사라짐.
// 점 Ø 20.3 초록 (자리 표시 없음, 누를수록 늘어남), 4열 숫자판 = 1–9 · 0 순서 + 빈 NH 키 2개(무작위 자리), 아래 ↻ · ⌫ · OK.
// 비밀번호는 보이는 것뿐: 숫자는 기억하지 않고 몇 개 눌렀는지만 이 화면 상태에 (보내지 · 저장하지 · 남기지 않음)
import { useState } from "react";
import { AO_PASSWORD_SHEET } from "../motion";
import { AoBackspaceIcon, AoNativeSheet, AoReshuffleIcon } from "../ui";

const COLS = [49.1, 147.4, 245.6, 343.9];
const ROWS = [219.7, 285.8, 351.8]; // 시트 위(368) 기준 숫자 잉크 가운데 587.7 / 653.8 / 719.8 (C3 32.4)
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

// 12칸 중 빈 키 두 자리 (Fisher–Yates 로 섞어 앞 둘)
function dummies(): [number, number] {
  const a = Array.from({ length: 12 }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return [a[0], a[1]];
}
function layout(d: [number, number]) {
  const cells: (string | null)[] = [];
  let k = 0;
  for (let i = 0; i < 12; i++) cells.push(d.includes(i) ? null : DIGITS[k++]);
  return cells;
}

export function PasswordSheet({ open, account, onClose, onDone }: { open: boolean; account: string; onClose: () => void; onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [blank, setBlank] = useState(dummies);
  const [busy, setBusy] = useState(false);
  // 열릴 때마다 처음부터 (점 없음 · 새 자리)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setCount(0);
    setBusy(false);
    if (open) setBlank(dummies());
  }

  const press = () => {
    if (busy || count >= 4) return;
    const n = count + 1;
    setCount(n);
    // 4번째 숫자 → 50ms 뒤 시트 + 막이 한 프레임에 사라지고 로딩 (C3 32.679 → 32.729)
    if (n === 4) {
      setBusy(true);
      window.setTimeout(onDone, AO_PASSWORD_SHEET.afterLastDigit);
    }
  };

  const cells = layout(blank);
  return (
    <AoNativeSheet open={open} level="password" title="계좌 비밀번호 입력" onClose={onClose} className="ao-send-pw">
      <p className="ao-send-pw__acct">{account}</p>
      <div className="ao-send-pw__dots" aria-label={`${count}자리 입력`}>
        {Array.from({ length: count }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      {cells.map((d, i) => (
        <button
          key={i}
          type="button"
          className={`ao-send-pw__key${d === "1" ? " ao-send-pw__key--one" : ""}`}
          style={{ left: COLS[i % 4] - 49.125, top: ROWS[Math.floor(i / 4)] - 32.75 }}
          aria-label={d ?? "빈 키"}
          onClick={d ? press : undefined}
        >
          {d ? <span className="ao-num">{d}</span> : <NhDummy />}
        </button>
      ))}
      <button type="button" className="ao-send-pw__fn ao-send-pw__fn--shuffle" aria-label="다시 섞기" onClick={() => setBlank(dummies())}>
        <AoReshuffleIcon variant="account" />
      </button>
      <button type="button" className="ao-send-pw__fn ao-send-pw__fn--back" aria-label="지우기" onClick={() => !busy && setCount((c) => Math.max(0, c - 1))}>
        <AoBackspaceIcon variant="tag" />
      </button>
      {/* OK: 4자리가 되면 저절로 넘어가므로 4자리 미만에서는 아무 일 없음 */}
      <button type="button" className="ao-send-pw__fn ao-send-pw__fn--ok">
        OK
      </button>
    </AoNativeSheet>
  );
}

// 빈 키의 NH 표시 (C3 32.4 잉크 18.65 × 21.67, #D4D4D8): 고리 + 양쪽 날개 + 가운데 거꾸로 된 세모 (윗변 V 홈).
// 세모 둘레의 틈은 흰색으로 덮어 냄 (시트 바탕이 흰색). 좌표는 녹화 px (3 px = 1 pt)
function NhDummy() {
  return (
    <svg width="18.67" height="21.67" viewBox="3 7 56 65" aria-hidden>
      <g fill="#d4d4d8">
        <circle cx="31" cy="43" r="28" />
        <path d="M3 8H8L21 16 27 27 12 22 3 19.5Z" />
        <path d="M59 8H54L41 16 35 27 50 22 59 19.5Z" />
      </g>
      <circle cx="31" cy="44" r="12.5" fill="#fff" />
      <path d="M16 6H46L31 34Z" fill="#fff" />
      <path d="M20 8H27L31 11 35 8H42L31 28Z" fill="#d4d4d8" />
    </svg>
  );
}
