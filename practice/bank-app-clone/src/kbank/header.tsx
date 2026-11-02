import type { ReactNode } from "react";

// 머리줄 (앱 영역 위 0~56): 왼쪽 ‹ 뒤로, 가운데 제목, 오른쪽 글자 버튼(관리·취소) 또는 ×.
// 녹화 dp: ‹ 잉크 x 22.8~32.5 · 화면 y 48.8~67.0 (앱 15.6~33.8), 제목 가운데 192, 한글 잉크 49.5~65.1, '관리' 잉크 311.1~
export function KbankHeader({
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
    <header className={`kb-header ${className}`}>
      {onBack && (
        <button className="kb-header__back" onClick={onBack} aria-label="뒤로">
          <svg width="44" height="56" viewBox="0 0 44 56" aria-hidden>
            <path d="M32.1 15.9 23.6 24.7l8.5 8.8" fill="none" stroke="#292929" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {title && <h1 className="kb-header__title">{title}</h1>}
      {right && <div className="kb-header__right">{right}</div>}
    </header>
  );
}

// 오른쪽 × (거래 상세 등): 잉크 343.0~358.0 · 화면 y 50.8~65.1
export function KbankClose({ onClick, label = "닫기" }: { onClick: () => void; label?: string }) {
  return (
    <button className="kb-header__x" onClick={onClick} aria-label={label}>
      <svg width="44" height="56" viewBox="0 0 44 56" aria-hidden>
        <path d="M15.5 17.6 29.5 31.8M29.5 17.6 15.5 31.8" stroke="#292929" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    </button>
  );
}
