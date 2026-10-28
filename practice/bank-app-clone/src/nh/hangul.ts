// 금액을 한글로 읽기: 1 → "일원", 12345 → "일만이천삼백사십오원" (콕뱅크 금액 입력 아래 작은 글씨)
const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL = ["", "십", "백", "천"];
const BIG = ["", "만", "억", "조"];

export function hangulAmount(n: number) {
  if (!n) return "";
  let out = "";
  for (let g = 0; n > 0; g++, n = Math.floor(n / 10000)) {
    const chunk = n % 10000;
    if (!chunk) continue;
    let part = "";
    String(chunk)
      .padStart(4, "0")
      .split("")
      .forEach((d, i) => {
        const v = Number(d);
        if (v) part += DIGITS[v] + SMALL[3 - i];
      });
    out = part + BIG[g] + out;
  }
  return `${out}원`;
}

// 금액: "1,234원"
export const nhWon = (n: number) => `${n.toLocaleString("ko-KR")}원`;
