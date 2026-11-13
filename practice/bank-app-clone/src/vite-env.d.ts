/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP?: "kakao" | "nh" | "hana" | "ibk" | "kbank" | "toss";
  readonly VITE_INTRO?: string; // "1" 이면 녹화 인트로 (dev:kbank2 · dev:ibk2 · dev:kakao2)
}
