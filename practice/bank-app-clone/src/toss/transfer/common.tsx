// 이체 화면들이 같이 쓰는 작은 부품 (영역 안에서만)
import type { CSSProperties, ReactNode } from "react";
import type { Bank } from "../../api/types";
import { localAsset } from "../../assets/Asset";
import { TossBankLogo } from "../ui";

// 목록 줄 은행 아이콘: 은행 색을 꽉 채운 둥근 네모(40, 모서리 14) + 글리프 (transfer.md §2.1, B 8.500 · 88.750 · A 118.056 에서 뽑은 색)
//  하나 · NH 는 흰 글리프, KB 는 어두운 글리프 + 아래 작은 'KB국민은행' 글자. 그 밖의 은행은 옅은 바탕 + 은행 글리프 그대로
//  글리프 크기는 녹화 잉크에 맞춤 (하나 20.8 × 22.4 · NH 17.6 × 20.8 · 카카오 B 16 × 20 · 우리 24 × 23.2 · 토스머니 26.4 × 24)
//  카카오 글리프 그림은 노란 네모째라 거의 꽉 채우고 바탕과 같은 노랑으로 맞춤
const LOGO: Record<string, { fill: string; glyph: number; tone?: "white" | "kb" | "kakao" }> = {
  hana: { fill: "#008f75", glyph: 0.52, tone: "white" },
  nh: { fill: "#f9b212", glyph: 0.54, tone: "white" },
  woori: { fill: "#cae5f1", glyph: 0.6 },
  kb: { fill: "#fccb00", glyph: 0.52, tone: "kb" },
  kakao: { fill: "#f3dc00", glyph: 0.9, tone: "kakao" },
  ibk: { fill: "#0058aa", glyph: 0.62 },
  toss: { fill: "#2b3f59", glyph: 0.63 },
  shinhan: { fill: "#1d4fd8", glyph: 0.66 },
};
export function SendLogo({ bank, size = 40 }: { bank: Bank; size?: number }) {
  const l = LOGO[bank.code];
  return (
    <TossBankLogo
      code={bank.code}
      bank={bank}
      size={size}
      glyph={l?.glyph ?? 0.62}
      fill={l?.fill ?? `color-mix(in srgb, ${bank.color} 14%, #f2f3f5)`}
      className={`toss-send-logo${l?.tone ? ` toss-send-logo--${l.tone}` : ""}`}
      style={{ borderRadius: size * 0.35 }}
    />
  );
}

// 은행 고르기 시트 · 칩: 바탕 없는 글리프 (w: 가로로 긴 글리프가 쓸 수 있는 폭, 기본 = size)
export function BankGlyph({ code, size, w }: { code: string; size: number; w?: number }) {
  const src = localAsset(code === "toss" ? "toss-symbol" : `hana-bank-${code}`);
  return <span className="toss-send-glyph" style={{ width: w ?? size, height: size }}>{src && <img src={src} alt="" draggable={false} />}</span>;
}

// 깜빡이는 파란 입력 막대 (2dp)
export function Caret({ h, style }: { h: number; style?: CSSProperties }) {
  return <i className="toss-send-caret" style={{ height: h, ...style }} aria-hidden />;
}

// "잔액 로딩중" · "사기계좌 조회중": 아주 옅은 둥근 칸 안의 회색 글자
export function LoadChip({ children }: { children: ReactNode }) {
  return <span className="toss-send-loadchip">{children}</span>;
}

// 작은 > (확인 화면 줄 오른쪽): 6.4 × 10.4, #b0b6bc
export function RowChevron() {
  return (
    <svg className="toss-send-rowchev" width="6.4" height="10.4" viewBox="0 0 6.4 10.4" fill="none" aria-hidden>
      <path d="M1 1l4.2 4.2L1 9.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 파란 방패 (사기계좌 조회 끝): 12.8 × 15.2, #2e7ff4. check = 안의 흰 체크가 그려졌다 사라지기를 되풀이 (녹화 로티, send.css)
//  "amt" 금액 화면 (B 46.08–49.13: 0.2초 뒤 그려짐, 0.7초 머묾, 2.1초마다) · "cf" 확인 화면 (B 97.54–100.0: 1.04초마다)
//  hidden = 자리만 차지 (조회 중엔 번호만 먼저 보임, B 45.03)
export function Shield({ check, hidden }: { check?: "amt" | "cf"; hidden?: boolean }) {
  return (
    <svg className={`toss-send-shield${check ? ` toss-send-shield--${check}` : ""}`} width="12.8" height="15.2" viewBox="0 0 12.8 15.2" style={hidden ? { visibility: "hidden" } : undefined} aria-hidden>
      <path d="M6.4 0 12.8 2.3v5.2c0 3.6-2.6 6.4-6.4 7.7C2.6 13.9 0 11.1 0 7.5V2.3Z" fill="#2e7ff4" />
      {check && <path className="toss-send-shield__chk" d="M3.7 7.5 5.8 9.6 9.4 5.7" fill="none" stroke="#eef6ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />}
    </svg>
  );
}
