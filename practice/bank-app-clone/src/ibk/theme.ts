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
