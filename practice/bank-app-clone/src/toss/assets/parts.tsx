// 자산 영역(소비 · 자산 · 내 계좌)에서 같이 쓰는 작은 그림: 은행 로고 둥근 네모 · 카드 그림 · 소비 분류 아이콘 · ◂ ▸ · ⋯ · +
// 전부 SVG / CSS (녹화 화면을 잘라 쓰지 않음, plan.md §5.6). 값은 assets.md §2.2.5 · §7 의 잰 값
import type { CSSProperties, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { localAsset } from "../../assets/Asset";
import { TossBankLogo } from "../ui/BankLogo";
import { TossPressable } from "../ui/Pressable";
import { useTossPageRoot } from "../ui/shared";
import { TossSymbol } from "../ui/TossSymbol";
import type { PullPhase } from "./usePullRefresh";

// ---------- 은행 로고 둥근 네모 (자산 · 내 계좌, 30.4) ----------
// 바탕 (잰 값): 화면 위 page / 자산 카드 위 card. 글리프: 토스 = 파란 심볼, 하나 = 초록 사람 + 빨간 점, 카카오뱅크 = 노란 B, NH = 파란 NH 글자
const LOGO_FILL: Record<string, [page: string, card: string]> = {
  toss: ["#1f355e", "#283c68"],
  hana: ["#132225", "#1e2a29"],
  kakao: ["#363017", "#3d3a20"],
  nh: ["#112946", "#1b2e48"],
};

// 카카오뱅크 'B' (세로 틈 하나): 24 상자
export function KakaoB({ size = 14, color = "#f7e64f", slit = "transparent" }: { size?: number; color?: string; slit?: string }) {
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 19.2 24" aria-hidden style={{ display: "block" }}>
      <path
        d="M1.2 1.2h9.6c4 0 6.4 2.1 6.4 5.3 0 1.9-.9 3.4-2.5 4.2 2.2.7 3.4 2.6 3.4 4.9 0 4-2.8 7.2-7.4 7.2H1.2ZM6.4 6.6v10.8h2.6V6.6Z"
        fill={color}
        fillRule="evenodd"
      />
      {slit !== "transparent" && <path d="M6.4 6.6v10.8h2.6V6.6Z" fill={slit} />}
    </svg>
  );
}

// NH 글자 (굵은 산세리프 두 자)
function NhMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 24 12" aria-hidden style={{ display: "block" }}>
      <path d="M1 1h3.1l4.9 6.6V1h2.9v10H8.8L3.9 4.4V11H1ZM13.4 1h3v3.8h4.3V1h3v10h-3V7.2h-4.3V11h-3Z" fill="#0493df" />
    </svg>
  );
}

export function AssetsLogo({ code, size = 30.4, surface = "page", className, style }: { code: string; size?: number; surface?: "page" | "card"; className?: string; style?: CSSProperties }) {
  const fill = LOGO_FILL[code];
  if (!fill) return <TossBankLogo code={code} size={size} surface={surface} className={className} style={style} />;
  let glyph: ReactNode = null;
  if (code === "toss") glyph = <TossSymbol size={size * 0.6} />;
  else if (code === "hana") {
    const src = localAsset("hana-bank-hana");
    glyph = src ? <img src={src} alt="" draggable={false} style={{ display: "block", width: size * 0.56, height: size * 0.58 }} /> : null;
  } else if (code === "kakao") glyph = <KakaoB size={size * 0.56} />;
  else if (code === "nh") glyph = <NhMark size={size * 0.68} />;
  return (
    <span
      className={`toss-assets-logo${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, borderRadius: size * 0.34, background: fill[surface === "card" ? 1 : 0], ...style }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}

// ---------- 카드 그림 (세로 29.6 × 43.2, 모서리 2.4) ----------
// 프렌즈 체크카드 = 노랑 + 검은 B, Young Hana+ = 민트 그라데이션 + 작은 글자 줄, 토스뱅크 체크카드 · 토스유스카드 = 지어낸 색
export function AssetsCardPlate({ art, bankCode, className }: { art: string | null; bankCode: string; className?: string }) {
  const kind = art ?? `bank-${bankCode}`;
  const cls = `toss-assets-plate${className ? ` ${className}` : ""}`;
  if (kind === "kakao-friends" || kind === "bank-kakao")
    return (
      <span className={`${cls} toss-assets-plate--kakao`} aria-hidden>
        <span className="toss-assets-plate__b">
          <KakaoB size={13.6} color="#1a1a1a" />
        </span>
      </span>
    );
  if (kind === "hana-young" || kind === "bank-hana")
    return (
      <span className={`${cls} toss-assets-plate--mint`} aria-hidden>
        <i className="toss-assets-plate__word" />
        <i className="toss-assets-plate__word toss-assets-plate__word--2" />
        <i className="toss-assets-plate__line" />
        <i className="toss-assets-plate__line toss-assets-plate__line--2" />
        <i className="toss-assets-plate__line toss-assets-plate__line--3" />
      </span>
    );
  if (kind === "toss-youth")
    return (
      <span className={`${cls} toss-assets-plate--youth`} aria-hidden>
        <i className="toss-assets-plate__ring" />
      </span>
    );
  if (kind === "toss-check" || kind === "bank-toss")
    return (
      <span className={`${cls} toss-assets-plate--toss`} aria-hidden>
        <TossSymbol size={9} className="toss-assets-plate__sym" />
      </span>
    );
  return (
    <span className={`${cls} toss-assets-plate--other`} aria-hidden>
      <TossBankLogo code={bankCode} size={16} surface="card" className="toss-assets-plate__logo" />
    </span>
  );
}

// ---------- 소비 목록 아이콘 (36 둥근 네모) ----------
const SQ = (fill: string) => <rect width="36" height="36" rx="12.2" fill={fill} />;
const won = (stroke: string, w = 2.1) => (
  <>
    <path d="m12.8 14 2.3 8.2 2.9-6.5 2.9 6.5 2.3-8.2" fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11.6 18.2h12.8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
  </>
);
// 분류마다 지어낸 색 · 흰 그림 (서버 색표와 같은 색)
const CAT: Record<string, { fill: string; glyph: ReactNode }> = {
  식비: {
    fill: "#d9822b",
    glyph: <path d="M10 17.5h16a8 8 0 0 1-16 0ZM14.5 9.5v4.5M18 8.5v5.5M21.5 9.5v4.5" fill="#fff" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  },
  "카페·간식": {
    fill: "#b0703a",
    glyph: (
      <>
        <path d="M10.5 14h12v5.5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5Z" fill="#fff" />
        <path d="M22.5 15.5h1.4a2.6 2.6 0 0 1 0 5.2h-1.6" fill="none" stroke="#fff" strokeWidth="1.8" />
        <path d="M14 9.2v2.4M17.5 8.6v3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  쇼핑: {
    fill: "#8a5cf5",
    glyph: (
      <>
        <path d="M10.5 14h15l-1 12h-13Z" fill="#fff" />
        <path d="M14.5 15.5V12.6a3.5 3.5 0 0 1 7 0v2.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  교통: {
    fill: "#27a5a0",
    glyph: (
      <>
        <path d="M11 20.5l1.8-6.2A2 2 0 0 1 14.7 13h6.6a2 2 0 0 1 1.9 1.3l1.8 6.2v3.5a1 1 0 0 1-1 1H12a1 1 0 0 1-1-1Z" fill="#fff" />
        <circle cx="14.2" cy="21.2" r="1.4" fill="#27a5a0" />
        <circle cx="21.8" cy="21.2" r="1.4" fill="#27a5a0" />
      </>
    ),
  },
  "문화·여가": {
    fill: "#d6458f",
    glyph: <path d="M10 13h16v3a2 2 0 0 0 0 4v3H10v-3a2 2 0 0 0 0-4Z" fill="#fff" />,
  },
  교육: {
    fill: "#804b20",
    glyph: (
      <>
        <path d="M18 12.5c-2-1.4-4.8-1.8-7.5-1.3v12.6c2.7-.5 5.5-.1 7.5 1.3 2-1.4 4.8-1.8 7.5-1.3V11.2c-2.7-.5-5.5-.1-7.5 1.3Z" fill="#fff" />
        <path d="M18 12.5v12.6" stroke="#804b20" strokeWidth="1.3" />
      </>
    ),
  },
};

export function SpendIcon({ icon, bankColor }: { icon: string; bankColor?: (code: string) => string | undefined }) {
  // 이체 · 캐시백 받은 돈: 파란 네모 + 흰 동그라미 + 파란 ₩ (녹화의 '프렌즈 체크카드 캐시백' 줄도 이 그림)
  if (icon === "transfer" || icon === "cashback")
    return (
      <svg className="toss-assets-sicon" width="36" height="36" viewBox="0 0 36 36" aria-hidden>
        {SQ("#3182f6")}
        <circle cx="18" cy="18" r="11" fill="#fff" />
        {won("#3182f6")}
      </svg>
    );
  // 편의점·마트: 노란 네모, 흰 차양 두 줄 + 옅은 노랑 가게 (문)
  if (icon === "store")
    return (
      <svg className="toss-assets-sicon" width="36" height="36" viewBox="0 0 36 36" aria-hidden>
        {SQ("#ffc21a")}
        <rect x="9" y="11" width="18" height="3.4" rx="1" fill="#fff" />
        <rect x="9" y="15.6" width="18" height="2.6" rx="0.8" fill="#fff" />
        <path d="M10.5 19.4h15v6.1a1 1 0 0 1-1 1h-4.6v-3.6a1.9 1.9 0 0 0-3.8 0v3.6h-4.6a1 1 0 0 1-1-1Z" fill="#ffe28a" />
      </svg>
    );
  // 이자: 지어낸 그림 (청록 네모 + 흰 동전 + %)
  if (icon === "interest")
    return (
      <svg className="toss-assets-sicon" width="36" height="36" viewBox="0 0 36 36" aria-hidden>
        {SQ("#14a38b")}
        <circle cx="18" cy="18" r="10" fill="#fff" />
        <path d="m14.2 21.8 7.6-7.6" stroke="#14a38b" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="14.9" cy="14.9" r="1.7" fill="#14a38b" />
        <circle cx="21.1" cy="21.1" r="1.7" fill="#14a38b" />
      </svg>
    );
  // 카드값 자동이체 등: 은행 색 네모 + 은행 원 로고 (하나 = 청록 + 흰 사람)
  if (icon.startsWith("bank:")) {
    const code = icon.slice(5);
    const src = localAsset(`bank-${code}`);
    const color = bankColor?.(code);
    if (src && color)
      return (
        <span className="toss-assets-sicon toss-assets-sicon--bank" style={{ background: color }} aria-hidden>
          <img src={src} alt="" draggable={false} />
        </span>
      );
    return <TossBankLogo code={code} size={36} className="toss-assets-sicon" />;
  }
  const cat = icon.startsWith("cat:") ? CAT[icon.slice(4)] : undefined;
  if (cat)
    return (
      <svg className="toss-assets-sicon" width="36" height="36" viewBox="0 0 36 36" aria-hidden>
        {SQ(cat.fill)}
        {cat.glyph}
      </svg>
    );
  // 카테고리 없음 · 모르는 분류: 회색 네모 + 점 세 개
  return (
    <svg className="toss-assets-sicon" width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      {SQ("#4a494d")}
      <circle cx="12.5" cy="18" r="1.9" fill="#e8e7ea" />
      <circle cx="18" cy="18" r="1.9" fill="#e8e7ea" />
      <circle cx="23.5" cy="18" r="1.9" fill="#e8e7ea" />
    </svg>
  );
}

// 캐시백 줄: #2f6ad0 네모 + 흰 둥근 화살표 둘 + 옅은 ₩
export function CashbackIcon() {
  return (
    <svg className="toss-assets-sicon" width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      {SQ("#2f6ad0")}
      <path d="M10.3 15.4a8.4 8.4 0 0 1 15.9.9M25.7 20.6a8.4 8.4 0 0 1-15.9-.9" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <path d="m23.4 14.9 2.9 2.4 2.1-3.1M12.6 21.1l-2.9-2.4-2.1 3.1" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(18 18) scale(0.82) translate(-18 -18)">{won("#d3dcf6", 2.2)}</g>
    </svg>
  );
}

// ---------- 작은 선 그림 (잉크 상자 기준) ----------
// ◂ ▸ : 채운 삼각형 잉크 7.2 × 12.8
export function TriIcon({ dir, color }: { dir: "left" | "right"; color: string }) {
  return (
    <svg width="7.2" height="12.8" viewBox="0 0 7.2 12.8" aria-hidden style={{ display: "block" }}>
      <path d={dir === "left" ? "M7.2 0v12.8L0 6.4Z" : "M0 0v12.8l7.2-6.4Z"} fill={color} />
    </svg>
  );
}
// 돋보기: 잉크 20.8 × 21.6, 선 2
export function SearchGlyph({ color = "#8f8e91" }: { color?: string }) {
  return (
    <svg width="20.8" height="21.6" viewBox="0 0 20.8 21.6" fill="none" aria-hidden style={{ display: "block" }}>
      <circle cx="9.1" cy="9.1" r="8.1" stroke={color} strokeWidth="2" />
      <path d="m15 15.4 4.8 5.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
// ⋯ : 점 ⌀4, 간격 7.6 (잉크 19.2 × 4)
export function DotsGlyph({ color = "#8f8e91" }: { color?: string }) {
  return (
    <svg width="19.2" height="4" viewBox="0 0 19.2 4" aria-hidden style={{ display: "block" }}>
      <circle cx="2" cy="2" r="2" fill={color} />
      <circle cx="9.6" cy="2" r="2" fill={color} />
      <circle cx="17.2" cy="2" r="2" fill={color} />
    </svg>
  );
}
// ⌄ / ⌃ : 잉크 w × h, 선 s (둥근 끝이 잉크에 들어가게 안쪽으로)
export function VChevron({ w = 16.8, h = 6.4, s = 2, color = "#8c8d92", up = false }: { w?: number; h?: number; s?: number; color?: string; up?: boolean }) {
  const p = s / 2;
  const d = up ? `M${p} ${h - p}L${w / 2} ${p}L${w - p} ${h - p}` : `M${p} ${p}L${w / 2} ${h - p}L${w - p} ${p}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden style={{ display: "block" }}>
      <path d={d} stroke={color} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
// › : 잉크 7.2 × 12, 선 1.8
export function RChevron({ w = 7.2, h = 12, s = 1.8, color = "#8a898c" }: { w?: number; h?: number; s?: number; color?: string }) {
  const p = s / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden style={{ display: "block" }}>
      <path d={`M${p} ${p}L${w - p} ${h / 2}L${p} ${h - p}`} stroke={color} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
// + : 16 × 16, 선 1.8
export function PlusGlyph({ color = "#8a898c" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ display: "block" }}>
      <path d="M8 .9v14.2M.9 8h14.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// 당겨서 새로고침 고리 (usePullRefresh 가 크기 · 자리 · 투명도를 직접 바꿈) + 끝날 때 고리 자리에서 퍼지는 옅은 빛 고리 (화면 전체 위, 화면 뿌리에 붙임)
export function PullBlob({ phase, blobRef }: { phase: PullPhase; blobRef: RefObject<HTMLSpanElement | null> }) {
  const root = useTossPageRoot();
  return (
    <>
      <span ref={blobRef} className={`toss-assets-ptr toss-assets-ptr--${phase}`} style={{ "--ptr-d": "20px", "--ptr-y": "-40px", opacity: 0 } as CSSProperties} aria-hidden>
        <i />
      </span>
      {phase === "finish" && root && createPortal(<span className="toss-assets-ptr-glow" aria-hidden />, root)}
    </>
  );
}

// 받지 못함: 다시 시도
export function AssetsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="toss-assets-error toss-assets-error--inline">
      <p>자산을 불러오지 못했어요</p>
      <TossPressable className="toss-assets-error__retry" radius={8} onPress={onRetry}>
        다시 시도
      </TossPressable>
    </div>
  );
}
