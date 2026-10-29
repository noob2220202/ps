import type { ReactNode } from "react";
import { localAsset } from "../assets/Asset";
import type { Bank } from "../api/types";
import { BankIcon } from "../components/BankIcon";
import { useNhLoading } from "./loading";
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

// 콕뱅크 앱 아이콘. 잘라낸 이미지(nh-app-icon)가 없으면 초록 그라데이션 + 흰 "콕"으로 그림
export function NhAppIcon({ size = 46 }: { size?: number }) {
  return (
    <NhImg
      name="nh-app-icon"
      w={size}
      h={size}
      className="nh-app-icon"
      fallback={
        <svg width={size} height={size} viewBox="0 0 48 48" aria-label="NH콕뱅크">
          <defs>
            <linearGradient id="nh-app-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2bc46a" />
              <stop offset="1" stopColor="#0b8f9e" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="13" fill="url(#nh-app-g)" />
          <text x="24" y="32" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800" fontFamily="inherit">
            콕
          </text>
        </svg>
      }
    />
  );
}

// 노란 농협 계좌 아이콘 (+ 대표계좌 별). plain: 별 없는 것 (콕송금 출금계좌)
export function NhAccountIcon({ size = 26, plain = false }: { size?: number; plain?: boolean }) {
  return (
    <NhImg
      name={plain && localAsset("nh-account-plain") ? "nh-account-plain" : "nh-account"}
      w={size}
      h={size}
      className="nh-account-icon"
      fallback={<span style={{ fontSize: size * 0.55 }}>🟡</span>}
    />
  );
}

// 은행 동그라미 아이콘. 카카오뱅크에서 잘라 온 로고는 가장자리에 흰 테두리가 남아 있어서
// 어두운 콕뱅크 화면에선 살짝 확대해서 원 밖으로 잘라냄. 농협은 콕뱅크의 노란 동그라미(nh-bank)
export function NhBankIcon({ bank, size = 34 }: { bank: Bank; size?: number }) {
  const logo = localAsset(bank.code === "nh" ? "nh-bank" : `bank-${bank.code}`);
  if (!logo) return <BankIcon bank={bank} size={size} />;
  return (
    <span className="nh-bank-icon" style={{ width: size, height: size }}>
      <img src={logo} alt={bank.name} draggable={false} />
    </span>
  );
}

// '빠른송금' 앞 아이콘: 회색 원호 + 노란 번개 (녹화에서 18px라 잘라 쓰면 흐려서 직접 그림)
export function QuickSendIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d="M13.5 4.2A7 7 0 1 0 12 16.6" fill="none" stroke="#7d8794" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.6 6.5 10.8 11.6h2.6l-1.6 5.4 4.4-6.1h-2.7l1.4-4.4Z" fill="#ffc21a" />
    </svg>
  );
}

// 폰 전체(상태바 포함)를 어둡게 + 점 3개 (useNhGo / withNhLoading 이 켬). App이 PhoneFrame 위에 한 장만 그림
export function NhLoadingLayer() {
  if (!useNhLoading()) return null;
  return (
    <div className="nh-loading nh-loading--phone">
      <span>
        <NhDots />
      </span>
    </div>
  );
}

// 파랑·노랑·초록 점 3개가 통통 튀는 로딩 (콕뱅크 공통)
// size를 안 주면 실제 크기(지름 12.7)
export function NhDots({ size }: { size?: number }) {
  return (
    <span className="nh-dots" style={size ? { ["--d" as string]: `${size}px` } : undefined}>
      <i />
      <i />
      <i />
    </span>
  );
}

// 상단 헤더 (높이 48). 아이콘은 실제 앱에서 잰 모양: 각진 선끝, 굵기 1.5~1.6, 24px 상자 중심 x 36 / 308 / 348
export function NhHeader({
  title,
  onBack,
  onClose,
  home,
  menu,
  onMenu,
  tools,
}: {
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  home?: () => void;
  menu?: boolean;
  onMenu?: () => void;
  tools?: boolean; // 콕송금: 음성·스캔 아이콘 (2026-10-29 녹화부터 보임)
}) {
  return (
    <header className="nh-header">
      {onBack && (
        <button className="nh-icon-btn" aria-label="뒤로" onClick={onBack}>
          <NhBackIcon />
        </button>
      )}
      {title && <h1>{title}</h1>}
      <span className="nh-header__right">
        {tools && (
          <>
            <button className="nh-icon-btn nh-header__tool" aria-label="음성으로 송금">
              <NhMicIcon />
            </button>
            <button className="nh-icon-btn nh-header__tool" aria-label="스캔">
              <NhScanIcon />
            </button>
          </>
        )}
        {home && (
          <button className="nh-icon-btn" aria-label="홈" onClick={home}>
            <HomeLine />
          </button>
        )}
        {(menu || onMenu) && (
          <button className="nh-icon-btn" aria-label="메뉴" onClick={onMenu}>
            <NhMenuIcon />
          </button>
        )}
        {onClose && (
          <button className="nh-icon-btn" aria-label="닫기" onClick={onClose}>
            <NhCloseIcon />
          </button>
        )}
      </span>
    </header>
  );
}

// 마이크 (잉크 16 × 20, 상자 가운데 x 308·y 22.4) / 스캔 (네 귀퉁이 + 가운데 줄, 20 × 20, x 347.6)
function NhMicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <rect x="8.6" y="1.75" width="6.8" height="11.6" rx="3.4" />
      <path d="M4.75 9.9a7.25 7.25 0 0 0 14.5 0M12 17.15v3.6M8.7 20.75h6.6" />
    </svg>
  );
}
function NhScanIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2.75 7.4V5.25a2.5 2.5 0 0 1 2.5-2.5H7.4M16.6 2.75h2.15a2.5 2.5 0 0 1 2.5 2.5V7.4M21.25 16.6v2.15a2.5 2.5 0 0 1-2.5 2.5H16.6M7.4 21.25H5.25a2.5 2.5 0 0 1-2.5-2.5V16.6" />
      <path d="M6.6 12h10.8" strokeWidth="1.7" />
    </svg>
  );
}

export function NhBackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M19.75 12H5.2M11.6 5.6 5.2 12l6.4 6.4" />
    </svg>
  );
}

export function NhMenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2.2 5h19.6M2.2 12h19.6M2.2 19h19.6" />
    </svg>
  );
}

export function NhCloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4.8 4.8 19.2 19.2M19.2 4.8 4.8 19.2" />
    </svg>
  );
}

// 공유 (거래상세 왼쪽 아래 정사각 버튼)
export function NhShareIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="5.1" cy="11.2" r="3.3" />
      <circle cx="18.4" cy="3.8" r="3.3" />
      <circle cx="18.4" cy="18.6" r="3.3" />
      <path d="M8 9.6l7.5-4.2M8 12.8l7.5 4.2" />
    </svg>
  );
}

// 송금 완료 왼쪽 아래 '=' (두 줄)
export function NhEqualsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M1.45 6.7h21.1M1.45 17.3h21.1" />
    </svg>
  );
}

// 키패드 '콕' 키: 글자가 아니라 그림 (ㅋ 가운데 획이 x 7.7에서 꺾여 사선으로 ㅡ에 붙음). 18.4 × 27.2, 굵기 2.85
// (녹화1 '콕' 키 8장 평균에 맞춘 모양 — 계좌번호 시트의 글리프와 같음)
export function NhKokKey() {
  return (
    <svg width="18.4" height="27.2" viewBox="0 0 18.4 27.2" fill="none" stroke="currentColor" strokeWidth="2.85" aria-label="콕">
      <path d="M0.45 1.05H11.25a1.7 1.7 0 0 1 1.7 1.7V10.6" />
      <path d="M0.45 6.6H7.7L2.25 12.9" strokeLinejoin="round" />
      <path d="M0.4 13.8H17.95" />
      <path d="M0.45 18.45H11.3a1.7 1.7 0 0 1 1.7 1.7V26.8" />
    </svg>
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

// 홈 (18dp 폭, 굵기 1.5, 둥근 모서리, 가운데 문)
export function HomeLine() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M3 9.1 12 2.75l9 6.35v9.9a1.75 1.75 0 0 1-1.75 1.75H4.75A1.75 1.75 0 0 1 3 19Z" />
      <path d="M9 20.75v-7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7" />
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

// 키패드 지우기 ← (21.6 × 16, 굵기 2.4, 각진 끝)
export function BackArrowKey() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M22.8 12H2.6M8.8 4.9 2.2 12l6.6 7.1" />
    </svg>
  );
}
