// 토스 화면 글자 모양 (account.md §4, transfer.md §4.3). 금액 · 날짜 · 조사
const nf = new Intl.NumberFormat("ko-KR");

export const num = (n: number) => nf.format(n);
// "1,234원" (음수면 "-1,234원")
export const won = (n: number) => `${nf.format(n)}원`;
// 부호 붙인 금액: 토스 목록은 들어온 돈에 "+" (plus=true), 다른 은행 목록은 안 붙임 (plus=false). 나간 돈은 늘 "-"
export const signedWon = (n: number, plus = true) => (n > 0 ? `${plus ? "+" : ""}${nf.format(n)}원` : n < 0 ? `-${nf.format(-n)}원` : "0원");

// ---------- 날짜 (서버 시각은 로컬 ISO "2026-10-27T11:37:12") ----------
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const parse = (iso: string) => {
  const [d, t = "00:00:00"] = iso.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm, ss] = t.split(":").map((v) => Number(v) || 0);
  return new Date(y, (m || 1) - 1, day || 1, hh, mm, ss);
};
const p2 = (n: number) => String(n).padStart(2, "0");
export const tossDate = parse;
// "11.3" (통장 mini 목록, 앞 0 없음)
export const md = (iso: string) => {
  const d = parse(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};
// "11월 3일" (거래내역 날짜 머리). 올해가 아니면 "2025년 11월 3일"
export const mwd = (iso: string, now = new Date()) => {
  const d = parse(iso);
  return `${d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}년 ` : ""}${d.getMonth() + 1}월 ${d.getDate()}일`;
};
// "11.03" (다른 은행 계좌 목록)
export const mmdd = (iso: string) => {
  const d = parse(iso);
  return `${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
};
// "3일 월요일" (소비 날짜 머리)
export const dayWeek = (iso: string) => {
  const d = parse(iso);
  return `${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
};
// "2026년 11월 3일 09:12" (상세)
export const fullDateTime = (iso: string) => {
  const d = parse(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
// "09:12"
export const hm = (iso: string) => {
  const d = parse(iso);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
// "YYYY-MM" (이번 달 등)
export const ym = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;

// ---------- 조사 ----------
// 마지막 글자에 받침이 있는지 (한글이 아니면 숫자 · 영문 읽기로 대략)
function finalConsonant(word: string): number | null {
  const s = word.trim();
  if (!s) return null;
  const c = s.charCodeAt(s.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28; // 0 = 받침 없음, 8 = ㄹ
  const ch = s[s.length - 1];
  if (/[0-9]/.test(ch)) return "0136781".includes(ch) ? (ch === "1" || ch === "7" || ch === "8" ? 8 : 1) : 0; // 영 일(ㄹ) 삼 육 칠(ㄹ) 팔(ㄹ)
  if (/[a-zA-Z]/.test(ch)) return /[lLrR]$/.test(ch) ? 8 : /[mnMN]$/.test(ch) ? 1 : 0;
  return 0;
}
// "통장으로" / "계좌로" / "토스머니로" / "하늘로" (ㄹ 받침은 "로")
export const ro = (word: string) => {
  const f = finalConsonant(word);
  return `${word}${f && f !== 8 ? "으로" : "로"}`;
};
export const roOnly = (word: string) => {
  const f = finalConsonant(word);
  return f && f !== 8 ? "으로" : "로";
};
// "통장을" / "계좌를"
export const eulReul = (word: string) => (finalConsonant(word) ? "을" : "를");
export const iGa = (word: string) => (finalConsonant(word) ? "이" : "가");
export const eunNeun = (word: string) => (finalConsonant(word) ? "은" : "는");
