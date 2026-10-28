import type { ReactNode } from "react";
import { localAsset } from "../assets/Asset";
import { Icon } from "../components/icons/Icon";
import "./nh.css";

// 콕뱅크 화면들이 같이 쓰는 조각. 이미지는 src/assets/local/nh-*.png (scripts/extract-nh.py) 가 있으면 그걸, 없으면 대체 그림

export function NhImg({ name, w, h, fallback, className = "" }: { name: string; w: number; h?: number; fallback: ReactNode; className?: string }) {
  const src = localAsset(name);
  if (!src)
    return (
      <span className={`nh-img nh-img--fallback ${className}`} style={{ width: w, height: h ?? w }}>
        {fallback}
      </span>
    );
  return <img className={`nh-img ${className}`} src={src} alt="" width={w} height={h} draggable={false} />;
}

// 노란 농협 계좌 아이콘 (+ 대표계좌 별)
export function NhAccountIcon({ size = 26 }: { size?: number }) {
  return (
    <NhImg
      name="nh-account"
      w={size}
      h={size}
      className="nh-account-icon"
      fallback={<span style={{ fontSize: size * 0.55 }}>🟡</span>}
    />
  );
}

// 파랑·노랑·초록 점 3개가 통통 튀는 로딩 (콕뱅크 공통)
export function NhDots({ size = 9 }: { size?: number }) {
  return (
    <span className="nh-dots" style={{ ["--d" as string]: `${size}px` }}>
      <i />
      <i />
      <i />
    </span>
  );
}

export function NhHeader({
  title,
  onBack,
  onClose,
  home,
  menu,
}: {
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  home?: () => void;
  menu?: boolean;
}) {
  return (
    <header className="nh-header">
      {onBack && (
        <button className="nh-icon-btn" aria-label="뒤로" onClick={onBack}>
          <Icon name="back" size={24} stroke={1.8} />
        </button>
      )}
      {title && <h1>{title}</h1>}
      <span className="nh-header__right">
        {home && (
          <button className="nh-icon-btn" aria-label="홈" onClick={home}>
            <HomeLine />
          </button>
        )}
        {menu && (
          <button className="nh-icon-btn" aria-label="메뉴">
            <Icon name="menu" size={24} stroke={1.7} />
          </button>
        )}
        {onClose && (
          <button className="nh-icon-btn" aria-label="닫기" onClick={onClose}>
            <Icon name="close" size={24} stroke={1.6} />
          </button>
        )}
      </span>
    </header>
  );
}

// 표시 내용 줄: 왼쪽 이름, 오른쪽 입력칸 + ⓧ
export function EditRow({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <label className="nh-edit-row">
      <span>{label}</span>
      <input value={value} maxLength={20} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button aria-label="지우기" onClick={() => onChange("")}>
          <ClearDot />
        </button>
      )}
    </label>
  );
}

export function HomeLine() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20H4Z" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.5-2" />
      <path d="M12 14.5v2" />
    </svg>
  );
}

export function ClearDot() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r="8" fill="#5d6673" />
      <path d="m6.2 6.2 5.6 5.6m0-5.6-5.6 5.6" stroke="#1f252d" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BackArrowKey() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 12H5m6-7-7 7 7 7" />
    </svg>
  );
}
