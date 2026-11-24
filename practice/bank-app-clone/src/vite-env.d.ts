/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP?: "kakao" | "nh" | "hana" | "ibk" | "kbank" | "toss" | "allone";
  readonly VITE_APK?: string; // "1" 이면 APK(서버 없는 로컬 모드) — 로그인 · 프로필 고르기 · 녹화 도구 없음 (npm run build:allone-apk, src/apk/)
  readonly VITE_INTRO?: string; // "1" 이면 녹화 인트로 (dev:kbank2 · dev:ibk2 · dev:kakao2 · dev:allone)
}
