// 공용 부품이 같이 쓰는 값 · 훅 (부품 파일은 부품만 내보내야 개발 서버 빠른 새로고침이 됨 — oxlint only-export-components)
import { createContext, useContext, useEffect, useState } from "react";

// ---------- 화면 뿌리 (Page.tsx) ----------
// 시트 · 안내창(Sheet.tsx · Dialog.tsx)은 이 화면 뿌리(.toss-page)에 붙어서 띠까지 덮음
export const TossPageContext = createContext<HTMLElement | null>(null);
export const useTossPageRoot = () => useContext(TossPageContext);

// ---------- 시간 (ms) ----------
// 진행 막대 (ProgressBar.tsx): 나타남 delay 뒤 회색 줄 track, 파랑 70% 까지 jump, ready 뒤 fill, 그다음 fadeOut
export const TOSS_PROGRESS = { delay: 150, track: 200, jump: 80, fill: 300, fadeOut: 400 } as const;
// 시트 (Sheet.tsx): 막 230 → 카드는 130 뒤 100 동안, 닫기 100
export const TOSS_SHEET = { scrim: 230, cardDelay: 130, card: 100, close: 100 } as const;
// 안내창 (Dialog.tsx): 열기 160 · 닫기 130
export const TOSS_DIALOG = { in: 160, out: 130 } as const;

// 시트 · 안내창 열림 단계: 닫을 때 closeMs (+40) 동안 "closing" 으로 남아 나가는 움직임을 그림
type Phase = "closed" | "open" | "closing";
export function useTossOverlayPhase(open: boolean, closeMs: number) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  if (open && phase !== "open") setPhase("open");
  if (!open && phase === "open") setPhase("closing");
  useEffect(() => {
    if (phase !== "closing") return;
    const t = window.setTimeout(() => setPhase("closed"), closeMs + 40);
    return () => window.clearTimeout(t);
  }, [phase, closeMs]);
  return phase;
}

// ---------- 은행 로고 바탕 (BankLogo.tsx) ----------
// 잰 값: 토스 #1f355e (화면) / #283c68 (카드) · 하나 #132225 / #1e2a29 · 카카오 #363017 / #3d3a20 · NH #112946. 그 밖은 color-mix(브랜드색 20%, 바탕)
const FILL: Record<string, [page: string, card: string]> = {
  toss: ["#1f355e", "#283c68"],
  hana: ["#132225", "#1e2a29"],
  kakao: ["#363017", "#3d3a20"],
  nh: ["#112946", "#1a3050"],
};
export const TOSS_LOGO_SURFACE = { page: "#171619", card: "#201f22", tile: "#100f12" } as const;
export type TossLogoSurface = keyof typeof TOSS_LOGO_SURFACE;
export function tossBankFill(code: string, surface: TossLogoSurface = "page", brand?: string) {
  if (surface === "tile") return TOSS_LOGO_SURFACE.tile;
  const f = FILL[code];
  if (f) return surface === "card" ? f[1] : f[0];
  return `color-mix(in srgb, ${brand ?? "#8a8a90"} 20%, ${TOSS_LOGO_SURFACE[surface]})`;
}
