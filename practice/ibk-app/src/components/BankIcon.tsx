import type { Bank } from "../api/types";
import { localAsset } from "../assets/Asset";
import { KakaoCircle } from "./art";

// 다른 은행 아이콘. src/assets/local/bank-<code>.png 가 있으면 그 로고를,
// 없으면 은행 대표색 원 + 짧은 이름을 그린다 (로고는 상표라 저장소엔 안 넣음).
// DB증권처럼 흰 바탕 아이콘도 있어서 흰 바탕 + 아주 옅은 테두리를 깔아 원 모양을 유지한다.
// (outline은 내용 위에 그려지므로 이미지 가장자리에도 보인다. box-shadow inset은 이미지에 가려짐)
export function BankIcon({ bank, size = 34 }: { bank: Bank; size?: number }) {
  const logo = localAsset(`bank-${bank.code}`);
  if (logo)
    return (
      <img
        src={logo}
        alt={bank.name}
        width={size}
        height={size}
        style={{
          borderRadius: "50%",
          flexShrink: 0,
          background: "#fff",
          outline: "1px solid rgba(0, 0, 0, 0.07)",
          outlineOffset: -1,
        }}
      />
    );
  // 카카오뱅크는 노란 원 + B 로고를 직접 그릴 수 있다
  if (bank.code === "kakao") return <KakaoCircle size={size} />;
  const mark = bank.short.replace(/(은행|증권|투자)$/, "").slice(0, 3);
  const fontSize = size * (mark.length >= 3 ? 0.27 : mark.length === 2 ? 0.33 : 0.46);
  return (
    <span
      aria-label={bank.name}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: bank.color,
        color: isLight(bank.color) ? "#1c1c1c" : "#fff",
        display: "grid",
        placeItems: "center",
        fontSize,
        fontWeight: 800,
        letterSpacing: "-0.04em",
      }}
    >
      {mark}
    </span>
  );
}

// 배경이 밝으면(토스뱅크 연하늘, 카카오 노랑…) 글자는 검정
function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  return r * 0.299 + g * 0.587 + b * 0.114 > 186;
}
