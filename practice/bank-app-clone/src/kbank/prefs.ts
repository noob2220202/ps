import { HAS_INTRO } from "../profile/session";
import { RESTART_EVENT } from "../platform/recorder";

// 케이뱅크 두 번째 녹화(광고 시트 · 홈 알약/AI 알약 두 번째 문구)의 켜기·끄기와 문구 고르기.
// 관리 패널(🔔)에서 바꾸고, 이 브라우저(localStorage)에 프로필별로 저장 — 저장이 막힌 브라우저면 기본값으로 동작.
// kbank2(첫 녹화 인트로 재현)는 첫 녹화와 어긋나지 않게 광고 시트 없음 · 첫 녹화 문구 고정.

export type KbVariant = "v1" | "v2"; // v1 = 첫 녹화 문구, v2 = 두 번째 녹화 문구
export type KbVariantMode = "alternate" | KbVariant; // alternate = 앱을 켤 때마다 번갈아

const DAY = 86_400_000;
const key = (k: string) => `kb-${k}-${sessionStorage.getItem("profile") ?? "none"}`;
function read(k: string): string | null {
  try {
    return localStorage.getItem(key(k));
  } catch {
    return null;
  }
}
function write(k: string, v: string | null) {
  try {
    if (v == null) localStorage.removeItem(key(k));
    else localStorage.setItem(key(k), v);
  } catch {
    /* 저장 막힘 → 이번 실행만 */
  }
}

// ----- 홈 첫 진입 광고 바텀시트 -----
let closedThisLaunch = false; // '닫기' = 이번 실행만
export const kbAdEnabled = () => read("ad") !== "off";
export const setKbAdEnabled = (on: boolean) => write("ad", on ? null : "off");
export const kbAdHiddenUntil = () => Number(read("ad-hide")) || 0;
export const kbAdHideWeek = () => write("ad-hide", String(Date.now() + 7 * DAY)); // '일주일간 보지 않기'
export const kbAdResetHide = () => write("ad-hide", null);
export const kbAdCloseForLaunch = () => {
  closedThisLaunch = true;
};
export const kbAdShouldShow = () => !HAS_INTRO && !closedThisLaunch && kbAdEnabled() && kbAdHiddenUntil() <= Date.now();

// ----- 문구 변형 (홈 머리줄 알약 · 이체 '어디로' AI 알약이 같은 값을 씀) -----
let launch: KbVariant | null = null;
export const kbVariantMode = (): KbVariantMode => {
  const m = read("variant");
  return m === "v1" || m === "v2" ? m : "alternate";
};
export const setKbVariantMode = (m: KbVariantMode) => {
  write("variant", m === "alternate" ? null : m);
  launch = null;
};
// 이번 실행의 문구 (처음 부를 때 정하고 실행 내내 같음)
export function kbLaunchVariant(): KbVariant {
  if (HAS_INTRO) return "v1";
  if (launch) return launch;
  const m = kbVariantMode();
  if (m !== "alternate") return (launch = m);
  launch = read("variant-last") === "v2" ? "v1" : "v2";
  write("variant-last", launch);
  return launch;
}

// ● 녹화로 앱을 새로 켠 것처럼 되돌릴 때 = 새 실행
window.addEventListener(RESTART_EVENT, () => {
  closedThisLaunch = false;
  launch = null;
});
