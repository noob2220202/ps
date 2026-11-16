// 🔔 관리 패널 토스 칸에서 같이 쓰는 입력 조각 (DevPanel.tsx 의 것과 같은 클래스 — 모양은 DevPanel.css 가 그림)
import type { ReactNode } from "react";

export function PanelField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

// 둘 이상 중 하나 고르기 (label 로 감싸지 않음 — 안내 글을 누르면 첫 버튼이 눌리지 않게)
export function PanelSeg<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const seg = (
    <div className="seg">
      {options.map(([v, text]) => (
        <button key={v} type="button" className={v === value ? "on" : ""} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
  if (!label) return seg;
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {seg}
    </div>
  );
}

// 금액: "12,000" 처럼 쉼표, 값은 숫자. 아래 칩으로 더하기
export function PanelMoney({ value, onChange, quick = [1000, 10000, 100000] }: { value: number; onChange: (n: number) => void; quick?: number[] }) {
  return (
    <div className="money">
      <div className="money__box">
        <input
          inputMode="numeric"
          value={value ? value.toLocaleString("ko-KR") : ""}
          placeholder="0"
          onChange={(e) => onChange(Math.min(Number(e.target.value.replace(/\D/g, "")) || 0, 1_000_000_000))}
        />
        <span>원</span>
      </div>
      <div className="chips-row">
        {quick.map((q) => (
          <button key={q} type="button" className="chip-btn" onClick={() => onChange(value + q)}>
            +{q >= 10000 ? `${q / 10000}만` : q >= 1000 ? `${q / 1000}천` : q}
          </button>
        ))}
        <button type="button" className="chip-btn chip-btn--ghost" onClick={() => onChange(0)}>
          지우기
        </button>
      </div>
    </div>
  );
}

// − N + (0~max)
export function PanelCount({ value, onChange, max = 99, unit }: { value: number; onChange: (n: number) => void; max?: number; unit: string }) {
  return (
    <>
      <button type="button" className="chip-btn" onClick={() => onChange(Math.max(0, value - 1))}>
        −
      </button>
      <span className="count-value">
        {value}
        {unit}
      </span>
      <button type="button" className="chip-btn" onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </>
  );
}
