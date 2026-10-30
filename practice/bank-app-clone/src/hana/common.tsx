import type { ReactNode } from "react";
import { localAsset } from "../assets/Asset";
import type { Bank } from "../api/types";
import { BankIcon } from "../components/BankIcon";
import { useHanaLoading } from "./loading";
import "./hana.css";

// 하나원큐 화면들이 같이 쓰는 조각. 그림은 src/assets/local/hana-*.png (scripts/hana-crops/crops.py)
// 값은 실제 앱 녹화(480px, 1dp = 1.25px)·스크린샷(720px, 1dp = 1.875px)에서 잰 것. 프레임 384 × 853.33dp

// 은행 로고 (은행선택 타일에서 잘라 낸 투명 PNG, 51.2 × 35.2dp 상자 가운데에 로고). 없으면 공용 동그라미
export function HanaBankLogo({ code, bank, scale = 1 }: { code: string; bank?: Bank; scale?: number }) {
  const src = localAsset(code.startsWith("tax") ? `hana-${code}` : `hana-bank-${code}`);
  if (!src) return bank ? <BankIcon bank={bank} size={26 * scale} /> : null;
  return <img className="hana-logo" src={src} alt="" style={{ width: 51.2 * scale, height: 35.2 * scale }} draggable={false} />;
}

// 회색 동그라미 안 은행 로고 (이체 '최근' 목록·받는 분 입력 칸)
export function HanaBankBadge({ bank, size = 38.4 }: { bank: Bank; size?: number }) {
  return (
    <span className="hana-badge" style={{ width: size, height: size }}>
      <HanaBankLogo code={bank.code} bank={bank} scale={size / 48} />
    </span>
  );
}

// ---------- 머리줄 ----------
// 높이 51.2dp, 제목 17dp 가운데 (녹화 제목 잉크 가운데 y 67px@480 → 상태바 아래 25.6dp)
export function HanaHeader({
  title,
  onBack,
  right,
  className = "",
}: {
  title?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`hana-header ${className}`}>
      {onBack && (
        <button className="hana-header__back" onClick={onBack} aria-label="뒤로">
          <Ic name="back" w={12.3} h={20.3} />
        </button>
      )}
      {title && <h1>{title}</h1>}
      {right && <div className="hana-header__right">{right}</div>}
    </header>
  );
}

export function HeaderText({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button className="hana-header__text" onClick={onClick}>
      {children}
    </button>
  );
}

export function HeaderClose({ onClick }: { onClick: () => void }) {
  return (
    <button className="hana-header__icon" onClick={onClick} aria-label="닫기">
      <Ic name="close" w={20.8} h={20.8} />
    </button>
  );
}

// ---------- 아이콘 (녹화에서 본 모양대로 그림) ----------
export function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 4.5 7.5 12l7.5 7.5" />
    </svg>
  );
}

export function CloseIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3.4 3.4 20.6 20.6M20.6 3.4 3.4 20.6" />
    </svg>
  );
}


export function ChevronRight({ size = 20, stroke = 1.7 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m7.5 4 6 6-6 6" />
    </svg>
  );
}

export function ChevronDown({ size = 20, stroke = 1.7 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m4 7.5 6 6 6-6" />
    </svg>
  );
}

export function SearchIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m17 17 4.5 4.5" />
    </svg>
  );
}

export function StarIcon({ on = false, size = 22 }: { on?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? "#ffc53d" : "none"} stroke={on ? "#ffc53d" : "currentColor"} strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="m12 2.8 2.75 5.75 6.25.85-4.55 4.35 1.12 6.2L12 16.95l-5.57 3 1.12-6.2L3 9.4l6.25-.85Z" />
    </svg>
  );
}

export function PersonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="9" cy="6.5" r="3.6" />
      <path d="M2.5 17.5c.6-3.5 3.2-5.4 6.5-5.4 1.6 0 3 .4 4.1 1.2M13 15.5h5M15.5 13v5" strokeLinecap="round" />
    </svg>
  );
}

// 입력칸 오른쪽 ⓧ (회색 원 + 흰 ×)
export function ClearIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path d="m6.6 6.6 6.8 6.8m0-6.8-6.8 6.8" stroke="var(--hn-bg)" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M10 3v14M3 10h14" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" aria-hidden>
      <path d="M4 12.2 14 4.5l10 7.7v9.3a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 4 21.5Z" />
      <path d="M10.5 18.8h7" strokeLinecap="round" />
    </svg>
  );
}

// 초록 원호 로딩 (녹화: 금액 화면 출금계좌·확인 시트 '이체' 누른 뒤)
// 원호 굵기: 금액 화면 출금계좌 스피너 ø34dp 굵기 4dp (D/0089) → viewBox 28 기준 3.3
export function HanaSpinner({ size = 28, stroke = 3.3 }: { size?: number; stroke?: number }) {
  return (
    <svg className="hana-spinner" width={size} height={size} viewBox="0 0 28 28" aria-label="불러오는 중">
      <circle cx="14" cy="14" r="11" fill="none" stroke="var(--hn-green)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray="22 60" />
    </svg>
  );
}

// '한도계좌' 파란 테두리 배지
export function LimitBadge() {
  return <span className="hana-limit">한도계좌</span>;
}



// 하나원큐 앱 아이콘 (다크 녹화 시작 장면의 런처 아이콘). 없으면 초록 둥근 사각 + "1Q"
export function HanaAppIcon({ size = 46 }: { size?: number }) {
  const src = localAsset("hana-app-icon");
  if (src) return <img src={src} alt="하나원큐" width={size} height={size} draggable={false} style={{ display: "block" }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="하나원큐">
      <rect width="48" height="48" rx="13" fill="#008c7e" />
      <text x="24" y="30" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="800" fontFamily="inherit">
        1Q
      </text>
    </svg>
  );
}

// 실제 앱에서 잘라 온 아이콘 (scripts/hana-crops/icons.py → hana-ic-*.png, 검은 알파 마스크).
// mask 로 쓰고 currentColor 로 칠해서 라이트/다크 어디서나 글자색을 따라감. 크기는 잘라 낸 상자(dp, 2px 여백 포함)
export function Ic({ name, w, h, className = "" }: { name: string; w: number; h: number; className?: string }) {
  const src = localAsset(`hana-ic-${name}`);
  if (!src) return <span className={`hana-ic hana-ic--missing ${className}`} style={{ width: w, height: h }} />;
  return <i className={`hana-ic ${className}`} style={{ width: w, height: h, maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` }} aria-hidden />;
}

// 화면 사이 로딩 페이지 (loading.ts): 상태바는 그대로 두고 앱 영역만 빈 바탕으로 덮고, 처음엔 가운데 초록 원호
// (라이트 녹화 원호 가운데 x 192dp, 화면 위에서 414dp → 앱 영역 386; 다크 D/0036 도 같은 자리)
export function HanaLoadingLayer() {
  const phase = useHanaLoading();
  if (!phase) return null;
  return (
    <div className="hana hana-loading" aria-hidden>
      {phase === "spinner" && <HanaSpinner size={30} />}
    </div>
  );
}

// 불러오기 실패: 가운데 안내 + 다시 시도 (콕뱅크 NhHistory 와 같은 문구 — 실제 하나원큐 오류 화면 자료는 없음)
export function HanaRetry({ onRetry, message = "일시적인 오류가 발생했어요" }: { onRetry: () => void; message?: string }) {
  return (
    <div className="hana-retry">
      <b>{message}</b>
      <span>잠시 후 다시 시도해 주세요</span>
      <button onClick={onRetry}>다시 시도</button>
    </div>
  );
}
