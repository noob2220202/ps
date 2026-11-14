// 두벌식 한글 조합 — src/toss/transfer/hangul.ts 를 그대로 베낌 (영역끼리 가져다 쓰지 않으므로 복사, AoKeyboard 가 씀)
// 두벌식 한글 조합 (삼성 키보드처럼): 자모를 차례로 넣으면 글자로 묶음. 조합 중에 ⌫ 는 자모 하나씩 지움
// 자모 열(seq)을 통째로 다시 묶는 방식 — "안녕" = ㅇㅏㄴㄴㅕㅇ, ⌫ → ㅇㅏㄴㄴㅕ = "안녀"
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = " ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"; // 0 = 받침 없음
// 겹모음 · 겹받침
const VV: Record<string, string> = { ㅗㅏ: "ㅘ", ㅗㅐ: "ㅙ", ㅗㅣ: "ㅚ", ㅜㅓ: "ㅝ", ㅜㅔ: "ㅞ", ㅜㅣ: "ㅟ", ㅡㅣ: "ㅢ" };
const CC: Record<string, string> = { ㄱㅅ: "ㄳ", ㄴㅈ: "ㄵ", ㄴㅎ: "ㄶ", ㄹㄱ: "ㄺ", ㄹㅁ: "ㄻ", ㄹㅂ: "ㄼ", ㄹㅅ: "ㄽ", ㄹㅌ: "ㄾ", ㄹㅍ: "ㄿ", ㄹㅎ: "ㅀ", ㅂㅅ: "ㅄ" };
const SPLIT: Record<string, [string, string]> = Object.fromEntries(Object.entries(CC).map(([k, v]) => [v, [k[0], k[1]] as [string, string]]));

export const isConsonant = (c: string) => CHO.includes(c) || c in SPLIT;
export const isVowel = (c: string) => JUNG.includes(c);
export const isJamo = (c: string) => c.length === 1 && (isConsonant(c) || isVowel(c));

type Syl = { cho?: string; jung?: string; jong?: string };
const make = (s: Syl) => {
  if (s.cho && s.jung) return String.fromCharCode(0xac00 + (CHO.indexOf(s.cho) * 21 + JUNG.indexOf(s.jung)) * 28 + (s.jong ? JONG.indexOf(s.jong) : 0));
  return (s.cho ?? "") + (s.jung ?? "");
};

// 자모 열 → 글자. 마지막 글자가 조합 중인 글자
export function compose(seq: string[]): string {
  const out: Syl[] = [];
  let cur: Syl = {};
  const push = () => {
    if (cur.cho || cur.jung) out.push(cur);
    cur = {};
  };
  for (const j of seq) {
    if (isVowel(j)) {
      if (cur.cho && !cur.jung) cur.jung = j;
      else if (cur.jung && !cur.jong && VV[cur.jung + j]) cur.jung = VV[cur.jung + j];
      else if (cur.jong) {
        // 받침이 다음 글자 첫소리로 넘어감 (겹받침이면 뒤쪽만)
        const sp = SPLIT[cur.jong];
        const move = sp ? sp[1] : cur.jong;
        cur.jong = sp ? sp[0] : undefined;
        push();
        cur = { cho: move, jung: j };
      } else {
        push();
        cur = { jung: j };
      }
    } else {
      if (cur.cho && cur.jung && !cur.jong && JONG.includes(j) && j !== " ") cur.jong = j;
      else if (cur.jong && CC[cur.jong + j]) cur.jong = CC[cur.jong + j];
      else {
        push();
        cur = { cho: j };
      }
    }
  }
  push();
  return out.map(make).join("");
}
