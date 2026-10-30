import { useStatusBar } from "../hooks/useStatusBar";

// i-ONE Bank 는 녹화에 라이트 모드만 있음 → 색은 라이트 하나 (ibk.css 변수)
// 상태바: 대부분 화면에서 #fafafa (앱 바탕 흰색과 따로, 녹화 y 0~28.44). 화면마다 바꿀 땐 bg 로
export const IBK_STATUS = "#fafafa";

export function useIbkStatusBar(bg: string = IBK_STATUS) {
  useStatusBar(bg, "dark");
}
