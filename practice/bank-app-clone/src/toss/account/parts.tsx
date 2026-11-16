// 통장 영역 안에서 같이 쓰는 작은 그림 · 줄 (통장 · 거래내역 · 상세 · 다른 은행 계좌). 값은 account.md 의 잰 값
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { TossPressable } from "../ui/Pressable";
import { acctImg, type AcctTxKind } from "./data";

// 그림 하나 (없으면 같은 크기 빈 칸)
export function AcctPic({ name, w, h = w, className, style }: { name: string; w: number; h?: number; className?: string; style?: CSSProperties }) {
  const src = acctImg(name);
  if (!src) return <span className={className} style={{ display: "block", width: w, height: h, ...style }} aria-hidden />;
  return <img className={className} src={src} alt="" draggable={false} style={{ display: "block", width: w, height: h, ...style }} />;
}

// › : 잉크 상자(w × h) 기준으로 그림. 선 굵기 s (둥근 끝이라 잉크가 s/2 씩 더 나옴 → 상자 안쪽에 맞춤)
export function AcctChevron({ w = 5.6, h = 10.4, s = 1.7, color = "#7a797e", className, style }: { w?: number; h?: number; s?: number; color?: string; className?: string; style?: CSSProperties }) {
  const p = s / 2;
  return (
    <svg className={className} style={style} width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
      <path d={`M${p} ${p}L${w - p} ${h / 2}L${p} ${h - p}`} stroke={color} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
// ⌄ : 잉크 w × h
export function AcctChevronDown({ w = 8.8, h = 5.6, s = 1.6, color = "#7b7a7f", className, style }: { w?: number; h?: number; s?: number; color?: string; className?: string; style?: CSSProperties }) {
  const p = s / 2;
  return (
    <svg className={className} style={style} width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
      <path d={`M${p} ${p}L${w / 2} ${h - p}L${w - p} ${p}`} stroke={color} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 이자 줄 동그라미: 회색 #8f949e (녹화 A 22.0) ⌀26.4 + 어두운 번개 (account.md §2.2 T2 — SVG 로 그림)
export function AcctBolt({ size = 26.4, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 26.4 26.4" aria-hidden>
      <circle cx="13.2" cy="13.2" r="13.2" fill="#8f949e" />
      <path d="M14.9 5.6 8.4 14.3h4.7l-1.5 6.5 6.6-8.9h-4.8l1.5-6.3Z" fill="#17171c" stroke="#17171c" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

// 40dp 동그라미 (그림은 43.2dp 칸에 동그라미가 가운데 — 칸을 1.6dp 씩 밖으로)
export function AcctTxIcon({ kind, size = 40, className }: { kind: AcctTxKind; size?: number; className?: string }) {
  const k = size / 40;
  return (
    <span className={`toss-acct-txicon${className ? ` ${className}` : ""}`} style={{ width: size, height: size }} aria-hidden>
      <AcctPic name={`tx-${kind}`} w={43.2 * k} style={{ margin: -1.6 * k }} />
    </span>
  );
}

// 지어낸 광고 로고 (진짜 광고주 로고는 쓰지 않음): 둥근 네모 + 글자 / 선물 상자
export function AcctAdLogo({ kind, size, className }: { kind: "letter" | "gift" | "cup"; size: number; className?: string }) {
  return (
    <span className={`toss-acct-adlogo toss-acct-adlogo--${kind}${className ? ` ${className}` : ""}`} style={{ width: size, height: size }} aria-hidden>
      {kind === "letter" ? (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 20 20">
          <path d="M14.6 5.2C13.5 4 12 3.4 10.2 3.4 7.4 3.4 5.4 5 5.4 7.2c0 2.3 1.9 3.1 4.4 3.7 2.2.5 3.2 1 3.2 2.2 0 1.2-1.2 2-2.9 2-1.6 0-3-.7-3.9-1.8" fill="none" stroke="#1d1d22" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      ) : kind === "gift" ? (
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
          <rect x="3.5" y="9" width="17" height="11.5" rx="1.8" fill="#fff" />
          <rect x="2.5" y="6.5" width="19" height="4" rx="1.4" fill="#fff" />
          <path d="M12 6.5v14" stroke="#1fa37a" strokeWidth="2" />
          <path d="M12 6.5c-1-2.6-4.4-3.8-5.2-2-.6 1.4 1.8 2 5.2 2Zm0 0c1-2.6 4.4-3.8 5.2-2 .6 1.4-1.8 2-5.2 2Z" fill="none" stroke="#fff" strokeWidth="1.6" />
        </svg>
      ) : (
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24">
          <path d="M5.5 8h11l-1.3 11.2a1.8 1.8 0 0 1-1.8 1.6H8.6a1.8 1.8 0 0 1-1.8-1.6Z" fill="#fff" />
          <path d="M16.3 10.2h1.4a2.6 2.6 0 0 1 0 5.2h-1.9" fill="none" stroke="#fff" strokeWidth="1.6" />
          <path d="M8.5 5.6c0-1 1-1 1-2M12 5.6c0-1 1-1 1-2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

// 누르는 줄 (account.md §3.7, 녹화 A 43.40–44.10): 누르는 동안 둥근 바탕(좌우 안쪽, 100ms 에 나타남) · 떼면 바탕은 250ms 에 사라지고
// 이동하는 줄(onPress)은 내용이 .96 으로 줄어든 채 다음 화면을 기다림 (600ms 뒤 제자리 — 돌아왔을 때 원래대로)
export function AcctRow({
  onPress,
  inset = "0 8px",
  radius = 12,
  color = "rgba(255,255,255,0.09)",
  className,
  style,
  children,
  ariaLabel,
}: {
  onPress?: () => void;
  inset?: string;
  radius?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const [tapped, setTapped] = useState(false);
  useEffect(() => {
    if (!tapped) return;
    const t = window.setTimeout(() => setTapped(false), 600);
    return () => window.clearTimeout(t);
  }, [tapped]);
  return (
    <TossPressable
      className={`${className ?? ""}${tapped ? " toss-acct-row--tapped" : ""}`}
      style={style}
      onPress={
        onPress &&
        (() => {
          setTapped(true);
          onPress();
        })
      }
      inset={inset}
      radius={radius}
      color={color}
      fadeIn={100}
      fadeOut={250}
      ariaLabel={ariaLabel}
    >
      {children}
    </TossPressable>
  );
}

// 회색 · 파란 버튼 (채우기 / 보내기 / 복사 / 받기 / 더보기): 누르면 8% 어두워지고 .97 (녹화엔 없음 — 토스 기본 동작)
export function AcctButton({ onPress, className, style, children, ariaLabel }: { onPress?: () => void; className?: string; style?: CSSProperties; children: ReactNode; ariaLabel?: string }) {
  return (
    <TossPressable className={`toss-acct-btn${className ? ` ${className}` : ""}`} pressedClassName="toss-acct-btn--on" style={style} onPress={onPress} color="transparent" fadeOut={150} ariaLabel={ariaLabel}>
      {children}
    </TossPressable>
  );
}
