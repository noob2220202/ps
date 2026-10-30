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

// 이 서버가 어느 앱인지. 서버 하나는 앱 하나만 연다 (카카오뱅크 9101, 콕뱅크 9103, 하나원큐 9105 — 데이터도 따로)
// 배포 땐 서버가 index.html에 window.__BANK_APP__ 을 넣어 주고, 개발 땐 VITE_APP=nh (npm run dev:nh) / hana (npm run dev:hana)
export type AppName = "kakao" | "nh" | "hana";
declare global {
  interface Window {
    __BANK_APP__?: AppName;
  }
}
const appName = window.__BANK_APP__ ?? import.meta.env.VITE_APP;
export const APP: AppName = appName === "nh" || appName === "hana" ? appName : "kakao";

// 화면에 쓰는 앱 이름
export const APP_NAME: Record<AppName, string> = { kakao: "카카오뱅크", nh: "NH콕뱅크", hana: "하나원큐" };
