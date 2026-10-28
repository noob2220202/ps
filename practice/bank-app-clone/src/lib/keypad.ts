export type PadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "00" | "back";

// 키패드 입력 계산을 한 곳에서: 숫자 문자열 + 누른 키 → 새 숫자 문자열 (앞자리 0 제거, 최대 길이)
export function applyKey(value: string, key: PadKey, maxLength: number) {
  if (key === "back") return value.slice(0, -1);
  return (value + key).replace(/^0+(?=\d)/, "").slice(0, maxLength);
}
