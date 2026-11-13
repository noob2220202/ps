// AoSwitch (plan.md §3.3): 켜짐 #0c8f2d · 꺼짐 #6d6d6d, 흰 손잡이. 색은 한 프레임에 바뀌고 손잡이만 미끄러짐
//  sm 28 × 18, 손잡이 Ø 14 (안쪽 2) — 거래내역조회 잔액 숨기기 (account §2.1, 손잡이 150ms)
//  lg 52.3 × 30.67, 손잡이 Ø 26 (안쪽 2.33) — 통합검색 자동완성 (C3 40.546 / 40.81 에서 잼: 트랙 x 86.93–139.22, 손잡이 250ms)
export interface AoSwitchProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  size?: "sm" | "lg";
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

export function AoSwitch({ checked, onChange, size = "sm", disabled, className, ...rest }: AoSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      className={`ao-switch ao-switch--${size}${checked ? " ao-switch--on" : ""}${className ? ` ${className}` : ""}`}
      onClick={() => onChange?.(!checked)}
    >
      <span className="ao-switch__knob" />
    </button>
  );
}
