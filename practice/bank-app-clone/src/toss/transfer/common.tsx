// 이체 화면들이 같이 쓰는 작은 부품 (영역 안에서만)
import type { CSSProperties, ReactNode } from "react";
import type { Bank } from "../../api/types";
import { localAsset } from "../../assets/Asset";
import { TossBankLogo } from "../ui";

// 목록 줄 은행 아이콘: 은행 색을 꽉 채운 둥근 네모(40, 모서리 14) + 글리프 (transfer.md §2.1, B 8.500 · 88.750 · A 118.056 에서 뽑은 색)
//  하나 · NH 는 흰 글리프, KB 는 어두운 글리프. 그 밖의 은행은 옅은 바탕 + 은행 글리프 그대로
const LOGO: Record<string, { fill: string; glyph: number; tone?: "white" | "dark" }> = {
  hana: { fill: "#008f75", glyph: 0.56, tone: "white" },
  nh: { fill: "#f9b212", glyph: 0.6, tone: "white" },
  woori: { fill: "#cae5f1", glyph: 0.64 },
  kb: { fill: "#fccb00", glyph: 0.6, tone: "dark" },
  kakao: { fill: "#f7df02", glyph: 0.62 },
  ibk: { fill: "#0058aa", glyph: 0.62 },
  toss: { fill: "#2b3f59", glyph: 0.58 },
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

// 은행 고르기 시트 · 칩: 바탕 없는 글리프
export function BankGlyph({ code, size }: { code: string; size: number }) {
  const src = localAsset(code === "toss" ? "toss-symbol" : `hana-bank-${code}`);
  return <span className="toss-send-glyph" style={{ width: size, height: size }}>{src && <img src={src} alt="" draggable={false} />}</span>;
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

// 파란 방패 (사기계좌 조회 끝): 12.8 × 15.2, #2e7ff4
export function Shield() {
  return (
    <svg className="toss-send-shield" width="12.8" height="15.2" viewBox="0 0 12.8 15.2" aria-hidden>
      <path d="M6.4 0 12.8 2.3v5.2c0 3.6-2.6 6.4-6.4 7.7C2.6 13.9 0 11.1 0 7.5V2.3Z" fill="#2e7ff4" />
    </svg>
  );
}
