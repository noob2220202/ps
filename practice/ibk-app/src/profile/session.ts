// 지금 고른 프로필 id. sessionStorage라서 탭/창을 새로 열면 사라짐 → 넷플릭스처럼 들어올 때마다 고르기
// (새로고침은 같은 세션이라 유지됨 → 기기/테마를 바꾸려고 다시 불러올 때 또 묻지 않음)
const KEY = "profile";

export function currentProfileId(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setCurrentProfile(id: string | null) {
  try {
    if (id) sessionStorage.setItem(KEY, id);
    else sessionStorage.removeItem(KEY);
  } catch {
    // 저장 못 하면 이번 페이지에서만 유효
  }
}

// IBK기업은행 i-ONE Bank 단독 앱 (포트 9107)
export type AppName = "ibk";
declare global {
  interface Window {
    __BANK_APP__?: AppName;
  }
}
export const APP: AppName = "ibk";

// 화면에 쓰는 앱 이름
export const APP_NAME: Record<AppName, string> = { ibk: "i-ONE Bank" };
