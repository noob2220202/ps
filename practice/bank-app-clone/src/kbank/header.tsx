import type { ReactNode } from "react";

// 머리줄 (앱 영역 위 0~56): 왼쪽 ‹ 뒤로, 가운데 제목, 오른쪽 글자 버튼(관리·취소) 또는 ×.
// 녹화(프레임 691 이체 · 1500/1771 계좌 · 1800 상세) 잉크를 앱 dp 로 옮긴 값. 가운데 줄은 앱 y 24.1 (화면 88px)
//   ‹ 잉크 화면 x 35~49 · y 74~102px → 선 가운데 꼭짓점 (23.8, 24.2), 끝 (31.2, 16.3)·(31.2, 32.4), 굵기 1.75, #282828
//   제목 '듀얼K 입출금통장' 잉크 x 199~390px (125dp 폭 → Pretendard 18px), 가운데 192
//   '관리' 잉크 x 517~557 · y 77~99px → 오른쪽 끝 362.5dp, 17px
//   × 잉크 x 527~549 · y 78~100px → 선 (344.0, 18.5)~(356.3, 30.9), 굵기 1.75
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
          <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
            <path d="M31.2 16.3 23.8 24.2l7.4 8.2" fill="none" stroke="#282828" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {title && <h1 className="kb-header__title">{title}</h1>}
      {right && <div className="kb-header__right">{right}</div>}
    </header>
  );
}

// 오른쪽 × (거래 상세 등): 버튼 상자 x 328~376, 선은 상자 안 (16, 18.5)~(28.3, 30.9)
export function KbankClose({ onClick, label = "닫기" }: { onClick: () => void; label?: string }) {
  return (
    <button className="kb-header__x" onClick={onClick} aria-label={label}>
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
        <path d="M16 18.5 28.3 30.9M28.3 18.5 16 30.9" stroke="#29282b" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </button>
  );
}
