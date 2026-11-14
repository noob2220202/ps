// 이체 영역 안에서만 쓰는 조각 (transfer.md): 받는 분 줄 · 금액 키패드 · 키패드 ←. 도우미 함수는 util.ts. 다른 영역은 가져다 쓰지 않음
import type { CSSProperties, ReactNode } from "react";
import type { Bank } from "../../api/types";
import { AoBankLogo } from "../ui";
import { logoBank, type PadKey } from "./util";
import "./transfer.css";

// ---------- 받는 분 줄 (T1 · T6 · 출금계좌 시트) ----------
// 36pt 은행 타일 x 24, 이름 16.3/500 x 71, 둘째 줄 14.3/400 #808080. 줄 높이 h (T1 · T6 63 — 녹화 C3 27.500 · C2 21.200 의 ☆ · 타일 간격 189px = 63pt), 타일은 가운데
export function SendRow({
  code,
  bank,
  name,
  sub,
  h = 63,
  onPress,
  right,
  className,
}: {
  code: string;
  bank?: Bank | null;
  name: ReactNode;
  sub: ReactNode;
  h?: number;
  onPress?: () => void;
  right?: ReactNode;
  className?: string;
}) {
  const logoTop = (h - 36) / 2;
  return (
    <div className={`ao-send-row${className ? ` ${className}` : ""}`} style={{ height: h, "--ao-send-logo": `${logoTop}px` } as CSSProperties}>
      <button type="button" className="ao-send-row__hit" onClick={() => onPress?.()}>
        <AoBankLogo code={code} bank={logoBank(bank)} style={{ position: "absolute", left: 24, top: logoTop }} />
        <span className="ao-send-row__name">{name}</span>
        <span className="ao-send-row__sub">{sub}</span>
      </button>
      {right}
    </div>
  );
}

// ---------- 금액 키패드 3 × 4 (T2 판 · T7 시트) ----------
// 1–9 · 00 · 0 · ←. 칸 가운데 cols × rows (키패드 상자 기준 pt), 숫자 Roboto 700. 녹화에 누름 표시 없음
const PAD: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "back"];
export function AmountPad({
  cols,
  rows,
  cellH,
  size,
  back,
  onKey,
  className,
}: {
  cols: [number, number, number];
  rows: [number, number, number, number];
  cellH: number;
  size: number;
  back: { left: number; top: number }; // ← 잉크 상자 왼쪽 위 (키패드 상자 기준)
  onKey: (k: PadKey) => void;
  className?: string;
}) {
  return (
    <div className={`ao-send-pad${className ? ` ${className}` : ""}`}>
      {PAD.map((k, i) => {
        const cx = cols[i % 3];
        const cy = rows[Math.floor(i / 3)];
        return (
          <button
            key={k}
            type="button"
            className={`ao-send-pad__key${k === "back" ? " ao-send-pad__key--back" : ""}`}
            aria-label={k === "back" ? "지우기" : k}
            style={{ left: cx - 65.5, top: cy - cellH / 2, width: 131, height: cellH, fontSize: size }}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => onKey(k)}
          >
            {k === "back" ? (
              <PadBackIcon style={{ position: "absolute", left: back.left - (cx - 65.5), top: back.top - (cy - cellH / 2) }} />
            ) : (
              <span className="ao-num">{k}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ← (T2 C3 29.5: 잉크 18 × 14, 두께 1.5 둥근 끝) — 공용 AoKeypadBackIcon 은 17.32 × 13.33 이라 여기서 잰 크기로
export function PadBackIcon({ style }: { style?: CSSProperties }) {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
      <path d="M.75 7H17.25M7 .75.75 7 7 13.25" />
    </svg>
  );
}
