import type { Bank } from "../api/types";
import { localAsset } from "../assets/Asset";

// 다른 은행 아이콘. src/assets/local/bank-<code>.png 가 있으면 그 로고를,
// 없으면 은행 대표색 원 + 짧은 이름을 그린다 (로고는 상표라 저장소엔 안 넣음).
export function BankIcon({ bank, size = 34 }: { bank: Bank; size?: number }) {
  const logo = localAsset(`bank-${bank.code}`);
  if (logo)
    return <img src={logo} alt={bank.name} width={size} height={size} style={{ borderRadius: "50%", flexShrink: 0 }} />;
  const fontSize = size * (bank.short.length >= 3 ? 0.27 : bank.short.length === 2 ? 0.33 : 0.46);
  return (
    <span
      aria-label={bank.name}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: bank.color,
        color: bank.text,
        display: "grid",
        placeItems: "center",
        fontSize,
        fontWeight: 800,
        letterSpacing: "-0.04em",
      }}
    >
      {bank.short}
    </span>
  );
}
