// "다른 금융 계좌"로 추가할 수 있는 은행 목록.
// color = 은행 대표색(원형 아이콘 배경), text = 아이콘 글자색, pattern = 계좌번호 자리수 묶음(하이픈 위치).
// 로고 이미지는 상표라 저장소에 넣지 않고, 대표색 원 + 짧은 이름으로 그린다.
// (src/assets/local/bank-<code>.png 를 넣으면 실제 로고로 바뀜)
export const BANKS = [
  { code: "kb", name: "국민은행", short: "국민", color: "#FFBC00", text: "#4B4031", pattern: [6, 2, 6] },
  { code: "shinhan", name: "신한은행", short: "신한", color: "#0046FF", text: "#FFFFFF", pattern: [3, 3, 6] },
  { code: "woori", name: "우리은행", short: "우리", color: "#0067AC", text: "#FFFFFF", pattern: [4, 3, 6] },
  { code: "hana", name: "하나은행", short: "하나", color: "#009490", text: "#FFFFFF", pattern: [3, 6, 5] },
  { code: "nh", name: "농협은행", short: "농협", color: "#33A54E", text: "#FFD640", pattern: [3, 4, 4, 2] },
  { code: "ibk", name: "기업은행", short: "기업", color: "#0D5EAF", text: "#FFFFFF", pattern: [3, 6, 2, 3] },
  { code: "toss", name: "토스뱅크", short: "토스", color: "#3182F6", text: "#FFFFFF", pattern: [4, 4, 4] },
  { code: "kbank", name: "케이뱅크", short: "K", color: "#2B2B80", text: "#FFFFFF", pattern: [3, 3, 6] },
  { code: "post", name: "우체국", short: "우체국", color: "#E21B23", text: "#FFFFFF", pattern: [6, 2, 6] },
  { code: "mg", name: "새마을금고", short: "MG", color: "#1F63B5", text: "#FFFFFF", pattern: [4, 2, 6, 1] },
  { code: "sc", name: "SC제일은행", short: "SC", color: "#0473EA", text: "#FFFFFF", pattern: [3, 2, 6] },
  { code: "suhyup", name: "수협은행", short: "수협", color: "#0072BC", text: "#FFFFFF", pattern: [3, 2, 6] },
];

export const bankByCode = (code) => BANKS.find((b) => b.code === code);

// 숫자만 남기고 은행 형식에 맞춰 하이픈을 넣는다: "30200001234501" → "302-0000-1234-50" ...
export function formatAccountNumber(code, raw) {
  const bank = bankByCode(code);
  const digits = String(raw).replace(/\D/g, "");
  if (!bank) return digits;
  const parts = [];
  let i = 0;
  for (const len of bank.pattern) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + len));
    i += len;
  }
  return parts.join("-");
}

export const digitCount = (code) => bankByCode(code)?.pattern.reduce((a, b) => a + b, 0) ?? 0;
