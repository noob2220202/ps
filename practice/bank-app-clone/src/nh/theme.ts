import { localAsset } from "../assets/Asset";
import { useStatusBar } from "../hooks/useStatusBar";
import { THEME } from "../platform/theme";

// 콕뱅크 라이트/다크: 폰 설정을 따르고 🔔 패널에서 고정할 수 있음 (platform/theme.ts). 색은 nh-light.css
export const NH_LIGHT = THEME === "light";

// 화면 상태바: 다크는 화면 바탕색 + 밝은 글자, 라이트는 흰 바탕 + 어두운 글자.
// dim: 시트 막(0.6)이 덮인 상태 — 바탕만 어두워지고 글자색은 그대로
export function useNhStatusBar(
  dark: string,
  opts: { light?: string; dim?: boolean; black?: boolean } = {},
) {
  const { light = "#ffffff", dim = false, black = false } = opts;
  const bg = black
    ? "#000000"
    : NH_LIGHT
      ? dim
        ? "#666666"
        : light
      : dim
        ? "#0a090b"
        : dark;
  useStatusBar(bg, NH_LIGHT && !black ? "dark" : "light");
}

// 다크 화면에서 잘라 온 그림의 라이트용(바탕만 바꾼 *-light.png, scripts/nh-crops/light-variants.py)이 있으면 그 이름
export const nhPic = (name: string) =>
  NH_LIGHT && localAsset(`${name}-light`) ? `${name}-light` : name;
