import { useStatusBar } from "../hooks/useStatusBar";
import { THEME } from "../platform/theme";

// 하나원큐 라이트/다크: 폰 설정을 따르고 🔔 패널에서 고정할 수 있음 (platform/theme.ts). 색은 hana.css 의 변수
export const HANA_LIGHT = THEME === "light";

// 화면 바탕색 (녹화에서 뽑은 값): 라이트 흰색 / 다크 #191a1c
export const HANA_BG = HANA_LIGHT ? "#ffffff" : "#191a1c";

// 상태바: 라이트는 어두운 글자, 다크는 밝은 글자. bg 를 안 주면 화면 바탕색
export function useHanaStatusBar(bg?: { light: string; dark: string }) {
  useStatusBar(bg ? (HANA_LIGHT ? bg.light : bg.dark) : HANA_BG, HANA_LIGHT ? "dark" : "light");
}
