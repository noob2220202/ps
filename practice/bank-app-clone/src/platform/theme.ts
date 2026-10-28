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
if (isTheme(param)) {
  try {
    localStorage.setItem("theme", param);
  } catch {
    // 저장 실패해도 이번 세션엔 적용
  }
}
const chosen = isTheme(param) ? param : stored();

export const THEME: Theme = isTheme(chosen)
  ? chosen
  : matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

document.documentElement.dataset.theme = THEME;
