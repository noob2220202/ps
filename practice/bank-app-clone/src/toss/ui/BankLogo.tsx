// 은행 로고 둥근 네모 (transfer §2.1 · assets §2.2.5 · cert §2.3): 모서리 ≈ 0.33 × 크기, 은행 색을 옅게 깐 바탕 + 은행 글리프
//  글리프: 토스뱅크 = toss-symbol, 나머지 = hana-bank-<code>.png (61개 은행 다 있음). 없으면 공용 동그라미(BankIcon)
//  바탕 (잰 값): 토스 #1f355e (화면) / #283c68 (카드) · 하나 #132225 / #1e2a29 · 카카오 #363017 / #3d3a20 · NH #112946
//  그 밖은 color-mix(브랜드색 20%, 바탕). tile = 증명서 계좌 타일 (#100f12)
//  크기: 24 · 28 (증명서 타일) · 30 · 30.4 · 36 · 40
import type { CSSProperties } from "react";
import type { Bank } from "../../api/types";
import { localAsset } from "../../assets/Asset";
import { BankIcon } from "../../components/BankIcon";
import { tossBankFill, type TossLogoSurface } from "./shared";

export interface TossBankLogoProps {
  code: string;
  bank?: Bank; // 없는 글리프 대신 그릴 동그라미 · 브랜드 색
  size?: number;
  surface?: TossLogoSurface; // 놓이는 바탕 (바탕색을 고름)
  fill?: string; // 바탕색 직접
  glyph?: number; // 글리프 상자 / 크기 (기본 .6)
  className?: string;
  style?: CSSProperties;
}

export function TossBankLogo({ code, bank, size = 40, surface = "page", fill, glyph = 0.6, className, style }: TossBankLogoProps) {
  const src = localAsset(code === "toss" ? "toss-symbol" : `hana-bank-${code}`);
  const g = size * glyph;
  return (
    <span
      className={`toss-banklogo${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, borderRadius: size * 0.33, background: fill ?? tossBankFill(code, surface, bank?.color), ...style }}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" draggable={false} style={{ width: g, height: g }} />
      ) : bank ? (
        <BankIcon bank={bank} size={g} />
      ) : null}
    </span>
  );
}
