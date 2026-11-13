import { APP, KAKAO2 } from "../profile/session";

export type Theme = "light" | "dark";

const isTheme = (v: string | null): v is Theme => v === "light" || v === "dark";

function stored(): string | null {
  try {
    return localStorage.getItem("theme");
  } catch {
    return null;
  }
}

// 실제 앱처럼 기본은 "폰 설정(시스템 다크모드)"을 따르고, ?theme= 이나 PC 스위치로 고정할 수 있다.
const param = new URLSearchParams(location.search).get("theme");
if (param === "system") {
  try {
    localStorage.removeItem("theme");
  } catch {
    // 무시
  }
} else if (isTheme(param)) {
  try {
    localStorage.setItem("theme", param);
  } catch {
    // 저장 실패해도 이번 세션엔 적용
  }
}
const chosen = isTheme(param) ? param : param === "system" ? null : stored();

// 토스는 녹화가 다크 모드뿐 → 늘 다크 (kakao2 라이트 고정의 반대). 스위치 · 🔔 테마 · 프로필 테마를 숨기거나 무시
const darkOnly = APP === "toss";
// 테마 고정: 스위치(PhoneFrame OsSwitch) · 🔔 테마 칸을 숨김. ibk · kbank(lightOnly)는 예전처럼 스위치를 그대로 둠 (다른 앱 동작 그대로)
export const THEME_LOCK: Theme | null = KAKAO2 ? "light" : darkOnly ? "dark" : null;

// 개발자 패널에서 "시스템 / 라이트 / 다크" 중 지금 고른 값 표시용 (토스는 늘 다크 → 프로필에도 다크로 저장)
export const THEME_CHOICE: Theme | "system" = darkOnly ? "dark" : isTheme(chosen) ? chosen : "system";

// i-ONE Bank·케이뱅크는 녹화에 라이트 모드만 있어서 늘 라이트 (서버가 넣어 주는 앱 이름은 session.ts 와 같은 곳에서 읽음)
// kakao2 는 녹화 기기가 라이트 모드 (홈만 앱이 늘 어둡게 그림) → 라이트 고정
const lightOnly = KAKAO2 || ["ibk", "kbank"].includes(window.__BANK_APP__ ?? import.meta.env.VITE_APP ?? "");

export const THEME: Theme = lightOnly
  ? "light"
  : darkOnly
  ? "dark"
  : isTheme(chosen)
  ? chosen
  : matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

document.documentElement.dataset.theme = THEME;
