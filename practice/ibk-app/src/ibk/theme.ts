import { useStatusBar } from "../hooks/useStatusBar";

// i-ONE Bank 는 녹화에 라이트 모드만 있음 → 색은 라이트 하나 (ibk.css 변수)
// 상태바: 대부분 화면에서 #fafafa (앱 바탕 흰색과 따로, 녹화 y 0~29.4). 화면마다 바꿀 땐 bg 로
// (전체메뉴처럼 그라데이션이 상태바까지 이어지면 bg 에 "linear-gradient(...)" 를 넘겨도 됨)
export const IBK_STATUS = "#fafafa";
export const IBK_MINT = "#eff4f3"; // 홈 바탕 · 세그먼트 · 회색 띠 · 뼈대 로딩 바탕

export function useIbkStatusBar(bg: string = IBK_STATUS) {
  useStatusBar(bg, "dark");
}

// 녹화 좌표 → 클론 좌표. 녹화는 가로로 1.0242배 늘어나 있고 오른쪽 9px 이 잘림 (spec/home.md 전역-1), 세로는 같음.
// 폭·반경처럼 '길이'는 ibkW 로 (÷1.0242). 앱 영역 안 y 는 녹화 y − IBK_TOP
export const ibkX = (recX: number) => (recX - 0.35) / 1.0242;
export const ibkW = (recW: number) => recW / 1.0242;
export const IBK_TOP = 29.4; // 상태바 아래끝 = 앱 영역 위끝 (녹화 y)
export const IBK_APP_H = 758.6; // 앱 영역 높이 29.4 ~ 788.0

// .ibk-bl(line-height 0) 글자를 녹화 기준선에 놓는 top (담는 상자 기준 px). 화면(Chrome)에선 글자 상자 위가 정수 픽셀로 반올림되고
// 기준선은 그 c = floor(A − (A+D)/2) 아래 (A·D = Roboto 올림 0.927734em · 내림 0.244141em 을 각각 반올림) → 기준선 = round(녹화 기준선).
// boxRecY = 담는 상자 위끝의 녹화 y (앱 영역 29.4 · 머리줄 아래 본문 81.4 …). 'top = 기준선 − 0.3418 × 크기' 는 1.45px 까지 위로 뜸
// (실험 scratchpad/ibk/menuimpl/blt.cjs · scratchpad/ibk/A/bltest.cjs: 10.75~22.25px × 소수 .0~.8 × 상자 두 가지 80개 모두 round(기준선) 에 놓임).
// 이미 녹화와 겹쳐 맞춰 둔 화면 값은 이 식으로 다시 쓰지 말 것 — 새로 놓는 글자에만
export function ibkBlTop(recBaseline: number, fs: number, boxRecY: number) {
  const A = Math.round(0.927734 * fs);
  const D = Math.round(0.244141 * fs);
  const c = Math.floor(A - (A + D) / 2);
  return Math.round((Math.round(recBaseline) - c - boxRecY) * 100) / 100;
}
