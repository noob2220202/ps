import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { localAsset } from "../assets/Asset";
import type { Bank } from "../api/types";
import { BankIcon } from "../components/BankIcon";
import { useIbkLoading } from "./loading";
import { useIbkBackHandler } from "./nav";
import "./ibk.css";

// i-ONE Bank 화면들이 같이 쓰는 조각. 값은 실제 앱 녹화(384×832, 1px = 1dp)에서 잰 것.
// 녹화는 가로로 1.0242배 늘어나 있어서 x 는 모두 클론 좌표로 바꾼 값 (클론 x = (녹화 x − 0.35) / 1.0242, 세로는 그대로).
// 앱 영역 안의 y = 녹화 y − 29.4 (상태바 높이). 쓰는 법은 scratchpad/ibk/COMMON.md

// 앱 아이콘 (런처). 그림이 없으면 파란 둥근 사각 + "i-ONE"
export function IbkAppIcon({ size = 46 }: { size?: number }) {
  const src = localAsset("ibk-app-icon");
  if (src) return <img src={src} alt="i-ONE Bank" width={size} height={size} draggable={false} style={{ display: "block" }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="i-ONE Bank">
      <rect width="48" height="48" rx="13" fill="#1f5fc8" />
      <text x="24" y="29" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800" fontFamily="inherit">
        i-ONE
      </text>
    </svg>
  );
}

// ---------- 선 아이콘 ----------
// 상자(w × h) = 선 '중심'이 지나는 상자 (클론 dp). 잉크는 선 두께 절반만큼 더 넓음 (svg overflow: visible).
// 크기를 바꿔도(w/h/scale) 선 두께는 sw 그대로 (vector-effect: non-scaling-stroke). 색은 currentColor
interface IconDef {
  w: number;
  h: number;
  sw?: number; // 선 두께 (없으면 채움 아이콘)
  cap?: "butt" | "round";
  join?: "miter" | "round";
  vb?: string; // viewBox 가 상자와 다를 때
  draw: ReactNode;
}
const ICONS = {
  // 머리줄 ← (who 2.2 / confirm 3-1 / history 3-1 평균): 꼭짓점 녹화 (22.7, 55.5), 끝 (30.6, 47.6 / 63.4), 1.5, 끝 각짐
  back: { w: 7.71, h: 15.8, sw: 1.5, cap: "butt", join: "miter", draw: <path d="M7.71 0 0 7.9l7.71 7.9" /> },
  // ≡ (who 2.2): 녹화 x 358.4~375.8 → 길이 17.0, 줄 y 49.4 / 55.5 / 61.6, 두께 1.5
  menu: { w: 17, h: 12.2, sw: 1.5, cap: "butt", draw: <path d="M0 0h17M0 6.1h17M0 12.2h17" /> },
  // ✕ (메뉴 머리줄 357.5~374.5 × 47~64 / 상세 시트 351.5~367.5 × 267.5~283.5 — 같은 크기): 선 중심 15.6 × 16, 1.5
  close: { w: 15.6, h: 16, sw: 1.5, cap: "butt", draw: <path d="M0 0l15.6 16M15.6 0 0 16" /> },
  // ⌄ ⌃ (who 2.8 / 2.9 섹션 머리): 선 중심 폭 12.2, 높이 6.25, 1.2. 다른 크기는 w·h 로 (금액 ⌄ 13.7×6.8, 자세히보기 10×5.1 …)
  "chevron-down": { w: 12.2, h: 6.25, sw: 1.2, cap: "round", join: "round", draw: <path d="M0 0l6.1 6.25L12.2 0" /> },
  "chevron-up": { w: 12.2, h: 6.25, sw: 1.2, cap: "round", join: "round", draw: <path d="M0 6.25 6.1 0l6.1 6.25" /> },
  // > (확인 카드 행 3-4): 6.3 × 12.3, 1.35. 홈 바로가기 > 는 w 4.4 h 9 sw 1.4
  "chevron-right": { w: 6.3, h: 12.3, sw: 1.35, cap: "round", join: "round", draw: <path d="M0 0l6.3 6.15L0 12.3" /> },
  // ⧉ 복사 (완료 카드 5-5): 앞 네모 9.1 × 9 r1.5 + 뒤 네모의 왼쪽·위 변만, 1.25. 홈 카드 복사(#838383)는 scale 0.95 · sw 1.1
  copy: {
    w: 11.67,
    h: 11.45,
    sw: 1.25,
    cap: "butt",
    draw: (
      <>
        <rect x="2.59" y="2.45" width="9.08" height="9" rx="1.5" />
        <path d="M0 9.3V3.2Q0 0 3.12 0h5.96" />
      </>
    ),
  },
  // 공유 (이체결과조회 행): 고리 3개(선 중심 반지름 1.45) + 잇는 선 2개, 1.3. 녹화 잉크 348~361 × 437~450
  share: {
    w: 11.94,
    h: 12.4,
    sw: 1.3,
    cap: "butt",
    draw: (
      <>
        <circle cx="1.45" cy="6.35" r="1.45" />
        <circle cx="10.49" cy="1.45" r="1.45" />
        <circle cx="10.49" cy="10.95" r="1.45" />
        <path d="M2.73 5.66 9.21 2.14M2.73 7.01l6.48 3.28" />
      </>
    ),
  },
  // ☆ (완료 5-3): 바깥 반지름 8.8, 안쪽 비 0.51, 1.35, 꺾임 둥글게
  star: {
    w: 16.74,
    h: 15.92,
    sw: 1.35,
    join: "round",
    draw: <path d="M8.37 0 11.01 5.17 16.74 6.08 12.64 10.19 13.54 15.92 8.37 13.29 3.2 15.92 4.1 10.19 0 6.08 5.73 5.17Z" />,
  },
  // 돋보기 (받는 분 '계좌 검색' 4-5): 원 반지름 5.2 + 손잡이, 1.35. 메뉴 검색칸(가늘고 회색)은 scale 1.05 · sw 1.2,
  // 이체결과조회(굵은)는 scale 1.27 · sw 2
  search: {
    w: 11.45,
    h: 11.9,
    sw: 1.35,
    cap: "round",
    draw: (
      <>
        <circle cx="5.2" cy="5.2" r="5.2" />
        <path d="M8.75 8.85 11.45 11.9" />
      </>
    ),
  },
  // 카메라 (받는 분 입력칸 4-3): 몸통 19 × 13.4 r2 + 위 사다리꼴 혹 + 렌즈 원 r3.3 + 플래시 점, 1.5
  camera: {
    w: 19.04,
    h: 16.6,
    sw: 1.5,
    join: "round",
    draw: (
      <>
        <path d="M2 3.2h2.2L6.06 0h5.86l1.85 3.2h3.27q2 0 2 2v9.4q0 2-2 2H2q-2 0-2-2V5.2q0-2 2-2Z" />
        <circle cx="9.08" cy="9.7" r="3.3" />
        <circle cx="15.91" cy="5.7" r="0.75" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // 연락처 (받는 분 '연락처 이체' 4-4): 둥근 사각 10.2 × 11.3 + 왼쪽 바인더 돌기 2개 + 사람(머리 원·어깨), 1.15
  contact: {
    w: 10.15,
    h: 11.3,
    sw: 1.15,
    cap: "round",
    join: "round",
    draw: (
      <>
        <rect width="10.15" height="11.3" rx="2" />
        <path d="M-1 2.7h1M-1 8.7h1" />
        <circle cx="5.18" cy="3.9" r="1.7" />
        <path d="M2.4 9.7 3.1 6.9h4l.7 2.8Z" />
      </>
    ),
  },
  // ↻ 새로고침 (홈 잔액 옆): 안드로이드 머티리얼 refresh 모양 (원호 + 오른쪽 위 직각 삼각 화살촉), 잉크 12.1
  refresh: {
    w: 12.1,
    h: 12.1,
    vb: "4 4 16 16",
    draw: (
      <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z" />
    ),
  },
  // ⋮ (홈 카드): 점 지름 2.7, 간격 6.4
  more: {
    w: 2.7,
    h: 15.5,
    draw: (
      <>
        <circle cx="1.35" cy="1.35" r="1.35" />
        <circle cx="1.35" cy="7.75" r="1.35" />
        <circle cx="1.35" cy="14.15" r="1.35" />
      </>
    ),
  },
  // 종 (홈 머리줄, 중심 클론 276.0): 둥근 지붕 + 아래로 벌어지는 옷자락 + 밑줄 + 작은 반원 추, 1.6
  bell: {
    w: 17,
    h: 17.3,
    sw: 1.6,
    join: "round",
    draw: (
      <>
        <path d="M2.05 11.6V6.5a6.45 6.5 0 0 1 12.9 0v5.1q0 2.4 2.05 3.3H0q2.05-.9 2.05-3.3Z" />
        <path d="M6.2 15.1a2.2 2.2 0 0 0 4.4 0" />
      </>
    ),
  },
  // 상담 헤드셋 (홈 머리줄, 중심 클론 317.1): 머리띠 호 + 양쪽 귀 패드 + 눈 2점·웃는 입 + 오른쪽에서 내려온 마이크, 1.6
  headset: {
    w: 22.26,
    h: 19.4,
    sw: 1.6,
    cap: "round",
    join: "round",
    draw: (
      <>
        <path d="M4.3 13V7.25a7.08 7.25 0 0 1 14.15 0v6.05q0 4.6-4.1 4.7" />
        <rect y="6.2" width="4.3" height="6.8" rx="1.6" />
        <rect x="18.45" y="6.2" width="3.81" height="6.8" rx="1.6" />
        <path d="M8.79 10.6q2.54 2 5.08 0" />
        <circle cx="8.79" cy="6.4" r="0.85" fill="currentColor" stroke="none" />
        <circle cx="13.67" cy="6.4" r="0.85" fill="currentColor" stroke="none" />
        <circle cx="12.6" cy="17.8" r="1.6" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // 할 일 체크 (홈 머리줄 '할 일' 옆, #65696f): 둥근 네모(오른쪽 위가 끊김) + 오른쪽 위로 삐져나간 체크, 1.4
  todo: {
    w: 17.87,
    h: 15.3,
    sw: 1.4,
    cap: "round",
    join: "round",
    draw: (
      <>
        <path d="M11.9 0H3Q0 0 0 3v9.3q0 3 3 3h8.9q3 0 3-3V6.6" />
        <path d="m4.2 5.3 4.4 4.5 9.27-9.5" />
      </>
    ),
  },
  // ⌂ 집 (전체메뉴 머리줄, 중심 클론 271.1): 지붕 + 벽 + 바닥 가운데 아치 문, 1.5
  home: {
    w: 15.67,
    h: 16.5,
    sw: 1.5,
    join: "round",
    draw: <path d="M6.4 16.5v-4.05a1.8 1.8 0 0 1 3.6 0v4.05h4.2q1.47 0 1.47-1.5V5.75L8.05 0 0 5.75V15q0 1.5 1.46 1.5Z" />,
  },
  // ⚙ 톱니 (전체메뉴 머리줄, 중심 클론 314.0): 톱니 8개 윤곽 + 가운데 원, 1.5
  gear: {
    w: 18,
    h: 18,
    sw: 1.5,
    join: "round",
    draw: (
      <>
        <path d="M7.04 2.59 7.65.51h2.7l.61 2.08 1.19.49 1.9-1.04 1.91 1.91-1.04 1.9.49 1.19 2.08.61v2.7l-2.08.61-.49 1.19 1.04 1.9-1.91 1.91-1.9-1.04-1.19.49-.61 2.08h-2.7l-.61-2.08-1.19-.49-1.9 1.04-1.91-1.91 1.04-1.9-.49-1.19-2.08-.61v-2.7l2.08-.61.49-1.19-1.04-1.9 1.91-1.91 1.9 1.04Z" />
        <circle cx="9" cy="9" r="2.8" />
      </>
    ),
  },
  // + (홈 맞춤메뉴 '추가' 타일, #7a7d84): 16 × 16, 1.6
  plus: { w: 16, h: 16, sw: 1.6, cap: "butt", draw: <path d="M8 0v16M0 8h16" /> },
  // ← 지우기 (금액 자판): 꼭짓점 녹화 (320.3, 682.6), 팔 끝 x 329, 가로선 끝 338.5, 1.3, 끝 둥글게, #000
  backspace: { w: 17.77, h: 16.5, sw: 1.3, cap: "round", join: "round", draw: <path d="M8.49 0 0 8.1l8.49 8.4M0 8.1h17.77" /> },
  // ▸ (확인 화면 로고 사이, #808080): 채운 삼각형 6.25 × 10.5
  "triangle-right": { w: 6.25, h: 10.5, draw: <path d="M0 0v10.5l6.25-5.25Z" /> },
  // ---- 홈 탭바 (#95979b, 1.4) — 잉크 상자 (클론): 자산 40.6~59.3 × 746.3~765, 상품 112.2~129.4 × 747.6~763.9,
  //      혜택 254.4~271 × 746.8~764.5, 주식 324.6~342.5 × 747.9~764.6 (녹화 y). 선은 1.55 로 그려야 녹화 잉크 양과 같음
  "tab-asset": {
    w: 17.4,
    h: 17.6,
    sw: 1.55,
    cap: "round",
    join: "round",
    draw: (
      <>
        <path d="M8.2 2.4a7.6 7.6 0 1 0 7.6 7.6" />
        <path d="M10.4 7.8V.8a7 7 0 0 1 7 7Z" />
      </>
    ),
  },
  "tab-product": {
    w: 15.8,
    h: 14.9,
    sw: 1.55,
    join: "round",
    draw: (
      <>
        <rect width="15.8" height="14.9" rx="2.5" />
        <path d="M4.5 0v1.7a3.4 3.4 0 0 0 6.8 0V0" />
      </>
    ),
  },
  "tab-gift": {
    w: 15.2,
    h: 16.6,
    sw: 1.55,
    join: "round",
    draw: (
      <>
        <rect y="3.7" width="15.2" height="4" rx="1" />
        <path d="M1.2 7.7v7.9q0 1 1 1h10.8q1 0 1-1V7.7M7.6 3.7v12.9" />
        <path d="M7.6 3.7C7.6.5 2.9-.4 2.9 1.9c0 1.4 2.4 1.8 4.7 1.8m0 0C7.6.5 12.3-.4 12.3 1.9c0 1.4-2.4 1.8-4.7 1.8" />
      </>
    ),
  },
  "tab-stock": {
    w: 16.5,
    h: 15.3,
    sw: 1.55,
    join: "round",
    draw: <path d="M0 6.3 5.6 1.5l3.9 3.6L14.3.5q.6-.5 1.4-.5h.8v13.3q0 2-2 2H2q-2 0-2-2Z" />,
  },
} satisfies Record<string, IconDef>;
export type IbkIconName = keyof typeof ICONS;

export function IbkIcon({
  name,
  w,
  h,
  scale = 1,
  sw,
  color,
  className = "",
  style,
}: {
  name: IbkIconName;
  w?: number; // 상자 폭 (선 중심 기준, dp)
  h?: number;
  scale?: number; // w·h 를 안 줄 때 배율
  sw?: number; // 선 두께 (dp)
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const d: IconDef = ICONS[name];
  const W = w ?? d.w * scale;
  const H = h ?? d.h * scale;
  const stroke = d.sw !== undefined;
  return (
    <svg
      className={`ibk-icon ${className}`}
      width={W}
      height={H}
      viewBox={d.vb ?? `0 0 ${d.w} ${d.h}`}
      preserveAspectRatio="none"
      overflow="visible"
      fill={stroke ? "none" : "currentColor"}
      stroke={stroke ? "currentColor" : undefined}
      strokeWidth={stroke ? (sw ?? d.sw) : undefined}
      strokeLinecap={d.cap ?? "butt"}
      strokeLinejoin={d.join ?? "miter"}
      style={{ color, ...style }}
      aria-hidden
    >
      {d.draw}
    </svg>
  );
}

// 완료 화면 체크 원 (5-1): 지름 47.4, #1253cf, 흰 체크 3px (원 중심 기준 (−9.52, −0.52) → (−2.88, 6.88) → (9.42, −7.12))
export function IbkCheckCircle({ size = 47.4 }: { size?: number }) {
  return (
    <svg className="ibk-check-circle" width={size} height={size} viewBox="0 0 47.4 47.4" aria-hidden>
      <circle cx="23.7" cy="23.7" r="23.7" fill="#1253cf" />
      <polyline points="14.18,23.18 20.82,30.58 33.12,16.58" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- 머리줄 ----------
// 흰 바탕 높이 52 (녹화 29.4~81.5), 아래 선·그림자 없음. ← 와 제목은 왼쪽, 오른쪽은 아이콘(IbkHeaderIcon) · 글자(IbkHeaderText).
// 제목: Noto Sans KR 600 16.5px, 글자 상자 왼쪽 클론 52.2, 기준선 녹화 61.5 (이체 · 거래내역조회 · 이체결과조회)
export function IbkHeader({
  title,
  onBack,
  left,
  right,
  bg,
  height,
  className = "",
  children,
}: {
  title?: ReactNode;
  onBack?: () => void;
  left?: ReactNode; // ← 대신 왼쪽에 둘 것 (전체메뉴 '로그아웃', 홈 '할 일')
  right?: ReactNode; // IbkHeaderIcon · IbkHeaderText (절대 위치)
  bg?: string; // 기본 흰색. 전체메뉴처럼 투명이면 "transparent"
  height?: number; // 기본 52
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={`ibk-header ${className}`} style={{ background: bg, height }}>
      {onBack && (
        <button className="ibk-header__back" onClick={onBack} aria-label="뒤로">
          <IbkIcon name="back" />
        </button>
      )}
      {left}
      {title !== undefined && <h1 className="ibk-header__title">{title}</h1>}
      {right}
      {children}
    </header>
  );
}

// 머리줄 오른쪽 아이콘 버튼. cx = 아이콘 가운데 x (클론). 세로 가운데는 녹화 y 55.5 (앱 영역 26.1)
//   이체·거래내역 ≡ 358.1 / 홈 종 276.0 · 상담 317.1 · ≡ 358.1 / 전체메뉴 ⌂ 271.1 · ⚙ 314.0 · ✕ 357.0
export function IbkHeaderIcon({
  name,
  cx = 358.1,
  onClick,
  label,
  sw,
}: {
  name: IbkIconName;
  cx?: number;
  onClick?: () => void;
  label?: string;
  sw?: number;
}) {
  // 화면에 붙는 위치(left·top)는 정수 픽셀로 반올림돼 0.5px 까지 어긋남 → 누름 칸은 정수 위치, 아이콘은 transform 으로 소수점까지
  const d: IconDef = ICONS[name];
  const left = Math.round(cx - 22);
  return (
    <button className="ibk-header__icon" style={{ left }} onClick={onClick} aria-label={label ?? name}>
      <IbkIcon name={name} sw={sw} style={{ transform: `translate(${cx - d.w / 2 - left}px, calc(${26.1 - d.h / 2}px + var(--ib-y0)))` }} />
    </button>
  );
}

// 머리줄 오른쪽 글자 ('취소' — 확인 3-1: 600 12.75px #5d5f64, 오른쪽 끝 클론 365.6, 기준선 녹화 60.5)
export function IbkHeaderText({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button className="ibk-header__text" onClick={onClick}>
      <span>{children}</span>
    </button>
  );
}

// ---------- 로딩 점 ----------
// 녹화 6-6 (30fps): 점 4개 ⌀8.8, 위에서부터 시계 방향 #1f96f2 → #2874e3 → #03abef → #02bdd0 (겹치면 #1f96f2 가 맨 위).
// 한 주기 1.5초: 중심에서 반지름 0 → 12.1(0.78초) → 0, 그동안 시계 방향 180° (반지름이 클 때 빠름). 나타날 땐 다 모인 한 점부터
const DOTS = [
  { a: 90, c: "#2874e3" },
  { a: 180, c: "#03abef" },
  { a: 270, c: "#02bdd0" },
  { a: 0, c: "#1f96f2" },
];
export function IbkSpinner({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`ibk-spinner ${className}`} style={style} role="progressbar" aria-label="불러오는 중">
      <div className="ibk-spinner__rot">
        {DOTS.map((d) => (
          <i key={d.a} style={{ rotate: `${d.a}deg` }}>
            <b style={{ background: d.c }} />
          </i>
        ))}
      </div>
    </div>
  );
}

// 폰 위 로딩 막 (loading.ts 상태): 앱 영역(상태바·3버튼 바 제외)을 cover 색으로 덮고, 가운데(클론 192, 녹화 y 408.8)에 점.
// 점이 꺼질 땐 100ms 페이드아웃 (녹화 14.167 100% → 14.20 55% → 14.233 19% → 14.267 없음)
export function IbkLoadingLayer() {
  const { spin, key, cover } = useIbkLoading();
  const [fadeKey, setFadeKey] = useState<number | null>(null); // 꺼지는 중(100ms)인 점
  const [prev, setPrev] = useState({ spin, key });
  if (prev.spin !== spin || prev.key !== key) {
    setPrev({ spin, key });
    setFadeKey(prev.spin > 0 && spin === 0 ? prev.key : null);
  }
  useEffect(() => {
    if (fadeKey === null) return;
    const t = window.setTimeout(() => setFadeKey(null), 100);
    return () => clearTimeout(t);
  }, [fadeKey]);
  const dots = spin > 0 ? key : fadeKey;
  if (dots === null && !cover) return null;
  return (
    <div className={`ibk ibk-loading ${cover ? "ibk-loading--cover" : ""}`} style={{ background: cover ?? undefined }}>
      {dots !== null && <IbkSpinner key={dots} className={spin > 0 ? "" : "ibk-spinner--out"} />}
    </div>
  );
}

// ---------- 바닥 시트 ----------
// 상세거래내역 시트 (history 4·5): 누르면 딤(rgba(0,0,0,.6), 앱 영역만)이 즉시 켜지고 ≈300ms 뒤 시트가 아래에서 올라옴
// (340ms, cubic-bezier(.5,1,.89,1)). 닫을 땐 130ms 내려가고(cubic-bezier(.4,0,1,1)) 다 내려간 뒤 딤이 즉시 꺼짐.
// 흰 판, 위 두 모서리 r14, 그림자 없음, 아래끝 = 앱 영역 아래, 높이 = 내용. 딤 누름·안드로이드 뒤로 = 닫기
// (화면이 스크롤돼도 앱 영역에 붙도록 가장 가까운 화면 층(.layer)에 그림)
export function IbkSheet({
  open,
  onClose,
  children,
  wait = 300,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wait?: number; // 딤이 켜지고 시트가 올라오기 시작할 때까지 ms
  className?: string;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  useLayoutEffect(() => {
    const el = anchor.current;
    setHost(el ? (el.closest(".layer") ?? el.closest(".phone__viewport")) : null);
  }, []);
  const [phase, setPhase] = useState<"closed" | "dim" | "open" | "closing">("closed");
  const [was, setWas] = useState(open);
  if (open !== was) {
    setWas(open);
    setPhase(open ? "dim" : phase === "closed" ? "closed" : "closing");
  }
  useEffect(() => {
    if (phase === "dim") {
      let raf = 0;
      const t = window.setTimeout(() => (raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setPhase("open"))))), wait);
      return () => {
        clearTimeout(t);
        cancelAnimationFrame(raf);
      };
    }
    if (phase === "closing") {
      const t = window.setTimeout(() => setPhase("closed"), 130);
      return () => clearTimeout(t);
    }
  }, [phase, wait]);
  useIbkBackHandler(open, onClose);
  const sheet =
    phase === "closed" ? null : (
      <div className={`ibk ibk-sheet ibk-sheet--${phase}`}>
        <div className="ibk-sheet__dim" onClick={onClose} />
        <section className={`ibk-sheet__panel ${className}`} role="dialog">
          {children}
        </section>
      </div>
    );
  return (
    <>
      <span hidden ref={anchor} />
      {host && sheet && createPortal(sheet, host)}
    </>
  );
}

// ---------- 은행 로고 원 ----------
// 받는 분 목록(who 5)·금액·확인·완료의 은행 로고. 녹화에 나온 은행은 녹화에서 잘라 4배로 키운 원 (ibk-bank-<code>, 지름 30 원에 꽉 참),
// 기업은행은 ibk-logo-ibk.svg (IBK CI 심볼을 녹화의 원에 맞춰 원으로 자른 벡터, 원이 그림에 꽉 참), 녹화에 없는 은행은 공용 BankIcon
export function IbkBankLogo({ bank, size = 30, className = "" }: { bank: Pick<Bank, "code"> & Partial<Bank>; size?: number; className?: string }) {
  const box: CSSProperties = { width: size, height: size };
  if (bank.code === "ibk") {
    const src = localAsset("ibk-logo-ibk");
    if (src)
      return (
        <span className={`ibk-logo ${className}`} style={box}>
          <img src={src} alt="기업" draggable={false} style={box} />
        </span>
      );
  }
  const src = localAsset(`ibk-bank-${bank.code}`);
  if (src)
    return (
      <span className={`ibk-logo ${className}`} style={box}>
        <img src={src} alt={bank.short ?? ""} draggable={false} style={box} />
      </span>
    );
  if (bank.name && bank.short && bank.color && bank.section)
    return (
      <span className={`ibk-logo ${className}`} style={box}>
        <BankIcon bank={bank as Bank} size={size} />
      </span>
    );
  const other = localAsset(`bank-${bank.code}`); // 은행 정보가 code 뿐이면 공용 로고 그림만
  return (
    <span className={`ibk-logo ibk-logo--empty ${className}`} style={box}>
      {other && <img src={other} alt="" draggable={false} style={box} />}
    </span>
  );
}

// ---------- 안내(오류) 화면 ----------
// 금액 '다음' 뒤 받는 은행 오류 때 나온 전체 화면 (amount 7, 27.73~28.97초): 머리줄 없음, 흰 바탕,
// 연파랑 원 안 파란 '!' → 제목 2줄(20.5px 500) → 본문(15px #60656a, 글자 단위 줄바꿈) → 오류코드 상자 → 상담 상자 → 아래 '확인'
export function IbkNotice({
  title,
  message,
  code,
  consult = true,
  onConfirm,
  onConsult,
}: {
  title: string; // 줄바꿈은 \n ("아래 내용을\n확인해주세요")
  message: string;
  code?: string; // 오류코드 (예: "ECBKEXT10625")
  consult?: boolean; // 상담 상자
  onConfirm: () => void;
  onConsult?: () => void;
}) {
  return (
    <div className={`ibk ibk-notice ${code ? "" : "ibk-notice--nocode"}`}>
      <svg className="ibk-notice__icon" width="45.2" height="45.2" viewBox="0 0 45.2 45.2" aria-hidden>
        <circle cx="22.6" cy="22.6" r="22.6" fill="#e2f0fd" />
        <path d="M22.6 15.45v7.4" stroke="#4092ef" strokeWidth="3.3" strokeLinecap="round" />
        <circle cx="22.6" cy="30.1" r="1.8" fill="#4092ef" />
      </svg>
      <h1 className="ibk-notice__title">{title}</h1>
      <p className="ibk-notice__msg">{message}</p>
      {code && (
        <div className="ibk-notice__code">
          <span>오류코드</span>
          <b>{code}</b>
        </div>
      )}
      {consult && (
        <div className="ibk-notice__consult">
          <b>상담을 원하시면, 아래 버튼을 클릭해 주세요.</b>
          <span>전화상담은 평일 09:00~18:00까지만 가능해요.</span>
          <button onClick={onConsult}>상담예약</button>
        </div>
      )}
      <div className="ibk-bottom">
        <button className="ibk-btn ibk-btn--scale" onClick={onConfirm}>
          확인
        </button>
      </div>
    </div>
  );
}

// ---------- 홈 아래 탭바 ----------
// home 3-10: 흰 바 윗변 녹화 y 731.7 (위 모서리 r15), 가운데 혹(원 R31.2, 꼭대기 716.7, 필렛 r23.8), 그림자 위로 옅게.
// 열 가운데 클론 49.8 / 120.6 / 192 / 262.4 / 333.4, 아이콘 #95979b, 라벨 Noto 600 11px #76777b (기준선 녹화 779.3),
// 가운데 톡톡송금 원 ⌀44.5 (중심 192, 744.6) — 정지한 최종 모습 (나타날 때의 로티는 홈 쪽)
const TABS = [
  { label: "자산", x: 49.8, icon: "tab-asset" as const, ix: 41.3, iy: 747.0 },
  { label: "상품", x: 120.6, icon: "tab-product" as const, ix: 112.9, iy: 748.3 },
  { label: "톡톡송금", x: 192 },
  { label: "혜택", x: 262.4, icon: "tab-gift" as const, ix: 255.1, iy: 747.0 },
  { label: "주식", x: 333.4, icon: "tab-stock" as const, ix: 325.3, iy: 748.6 },
];
export function IbkTabBar({ onTab, className = "", center }: { onTab?: (label: string) => void; className?: string; center?: ReactNode }) {
  return (
    <nav className={`ibk-tabbar ${className}`}>
      <svg className="ibk-tabbar__bg" width="384" height="71.3" viewBox="0 716.7 384 71.3" aria-hidden>
        <path d="M0,746.7 A15,15 0 0 1 15,731.7 H154.3 A23.8,23.8 0 0 0 170.6,725.2 A31.2,31.2 0 0 1 213.4,725.2 A23.8,23.8 0 0 0 229.7,731.7 H369 A15,15 0 0 1 384,746.7 V788 H0 Z" fill="#fff" />
      </svg>
      {TABS.map((t) =>
        t.icon ? (
          <button key={t.label} className="ibk-tabbar__tab" style={{ left: t.x - 35 }} onClick={() => onTab?.(t.label)}>
            <IbkIcon name={t.icon} style={{ left: t.ix - (t.x - 35), top: t.iy - 731.7 }} />
            <span>{t.label}</span>
          </button>
        ) : (
          <button key={t.label} className="ibk-tabbar__tab ibk-tabbar__tab--on" style={{ left: t.x - 35 }} onClick={() => onTab?.(t.label)}>
            {center ?? <IbkTalkButton />}
            <span>{t.label}</span>
          </button>
        ),
      )}
    </nav>
  );
}

// 가운데 톡톡송금 버튼 (정지 모습): 파란 원 + 흰 말풍선(왼쪽 아래 꼬리) 안 파란 ₩ + 말풍선 왼쪽 흰 속도선 2개
export function IbkTalkButton() {
  return (
    <svg className="ibk-tabbar__talk" width="44.5" height="44.5" viewBox="0 0 44.5 44.5" aria-hidden>
      <defs>
        <linearGradient id="ibk-talk-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c85ee" />
          <stop offset="1" stopColor="#2977e5" />
        </linearGradient>
      </defs>
      <circle cx="22.25" cy="22.25" r="22.25" fill="url(#ibk-talk-g)" />
      <circle cx="23.2" cy="21.9" r="9.9" fill="#fff" />
      <path d="M15 25.5 12.6 30.6l6.3-2.2Z" fill="#fff" />
      <path d="M8.4 25.4h4.4M9.3 29h3.9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18.4 19.4l1.75 5.6 2.5-5.1 2.5 5.1 1.75-5.6M17.6 21.3h11.2" fill="none" stroke="#2b72d6" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- 홈 뼈대 (스켈레톤) ----------
// home 1-D·6-7 (148.20~150.57초): 바탕 #eff4f3 위 회색(#dfe3e9) 상자들, 각 상자 안을 어두운 띠가 오른쪽 → 왼쪽으로 지나감(2초 주기).
// 상자 = [클론 x0, 녹화 y0, x1, y1, 반경]. 탭바는 따로 (IbkTabBar)
const SKELETON: [number, number, number, number, number][] = [
  [313.3, 91.0, 365.7, 143.2, 4], // SQ (배너 그림 자리)
  [18.4, 96.6, 149.0, 119.0, 3], // H1
  [18.4, 121.0, 201.7, 143.2, 3], // H2
  [18.1, 173.1, 365.9, 427.3, 16], // CARD (파란 그림자)
  [18.4, 457.0, 365.7, 507.9, 16], // QUICK
  [18.3, 537.7, 124.8, 559.9, 3], // TITLE
  [18.3, 582.7, 96.9, 658.9, 14],
  [108.0, 582.7, 186.0, 658.9, 14],
  [197.7, 582.7, 275.9, 658.9, 14],
  [286.9, 582.7, 365.7, 658.9, 14],
  [18.3, 677.9, 96.9, 754.1, 14],
  [108.0, 677.9, 186.0, 754.1, 14],
  [197.7, 677.9, 275.9, 754.1, 14],
  [286.9, 677.9, 365.7, 754.1, 14],
];
export function IbkHomeSkeleton() {
  return (
    <div className="ibk-skeleton" aria-hidden>
      {SKELETON.map(([x0, y0, x1, y1, r], i) => (
        <i
          key={i}
          className={i === 3 ? "ibk-skeleton__card" : undefined}
          style={{ left: x0, top: y0 - 29.4, width: x1 - x0, height: y1 - y0, borderRadius: r }}
        />
      ))}
    </div>
  );
}
