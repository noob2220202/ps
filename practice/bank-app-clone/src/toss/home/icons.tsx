// 홈 영역 SVG 그림 (녹화 A 10.698 에서 잉크를 재서 그림 — home.md §2.3–§2.5, plan.md §5.2).
// 대부분 화면 좌표(dp) 그대로 viewBox 를 잡아 그림 → CSS 는 상자 자리만 둠
import type { CSSProperties, ReactNode } from "react";
import { TAB_CX, type HomeTab } from "./boot";

const line = (w: number) => ({ fill: "none", stroke: "currentColor", strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

function Svg({ vb, w, h, className, style, children }: { vb: string; w: number; h: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <svg className={className} style={style} width={w} height={h} viewBox={vb} aria-hidden focusable="false">
      {children}
    </svg>
  );
}

// 머리줄 회색 토스 표시: 파란 심볼의 밝기를 회색으로 옮김 (녹화의 회색 표시도 윗왼쪽 조각은 가운데로 갈수록 밝고, 아래오른쪽 조각은
// 아래로 갈수록 어두움 — 한 색 그라데이션이 아님). A 10.698 평균 프레임에 맞춘 직선 식: R = .77·L + 36.7, G = .745·L + 45.3, B = .686·L + 60.9
// (L = 심볼의 sRGB 밝기 .2126R + .7152G + .0722B). 같은 id 가 두 번 그려져도(전환 중 두 층) 내용이 같아 상관없음
export const GREY_MARK_FILTER = "toss-home-grey-mark";
export const GreyMarkFilter = () => (
  <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden focusable="false">
    <filter id={GREY_MARK_FILTER} colorInterpolationFilters="sRGB">
      <feColorMatrix
        type="matrix"
        values="0.1637 0.5507 0.0556 0 0.1439  0.1584 0.5328 0.0538 0 0.1776  0.1458 0.4906 0.0495 0 0.2388  0 0 0 1 0"
      />
    </filter>
  </svg>
);

// 머리줄 '토스뱅크' 옆 › : 잉크 x 116.0–121.6, y 52.0–61.6 (선 1.6, #83888d)
export const HeadChevron = () => (
  <Svg className="toss-home-head__chev" vb="114 50 10 14" w={10} h={14}>
    <path d="M116.9 52.9 120.7 56.8 116.9 60.7" {...line(1.6)} />
  </Svg>
);

// Pay: 네 모서리 괄호 (A 10.698 평균 프레임: 선 가운데 x 283.0–315.4 · y 44.4–64.4, 선 1.9, 모서리 반지름 3.6,
// 가로 팔은 289.2 / 309.2 까지, 세로 팔은 49.5 / 58.5 까지) — 잉크 x 281.6–316.8, y 43.2–65.6. 글자 'Pay' 는 HTML (CSS)
export const PayBrackets = () => (
  <Svg className="toss-home-pay__br" vb="0 0 35.2 22.4" w={35.2} h={22.4}>
    <path
      d="M1.4 6.3V4.8A3.6 3.6 0 0 1 5 1.2H7.6M27.6 1.2H30.2A3.6 3.6 0 0 1 33.8 4.8V6.3M33.8 15.3V17.6A3.6 3.6 0 0 1 30.2 21.2H27.6M7.6 21.2H5A3.6 3.6 0 0 1 1.4 17.6V15.3"
      {...line(1.9)}
    />
  </Svg>
);

// 종 (윤곽, 선 1.7): 잉크 x 336.8–357.2, y 43.6–66.4 (가운데 347). 빨간 점 ⌀7.8 가운데 (359.2, 42.4), 잰 색 #d52a44
export const Bell = ({ dot }: { dot: boolean }) => (
  <Svg className="toss-home-bell" vb="334 36 30 32" w={30} h={32}>
    <path
      d="M347 44.5C342.4 44.5 339 47.8 339 52.6V56.4C339 57.6 338.5 58.6 337.7 59.4C337 60.1 337.3 61 338.2 61H355.8C356.7 61 357 60.1 356.3 59.4C355.5 58.6 355 57.6 355 56.4V52.6C355 47.8 351.6 44.5 347 44.5Z"
      {...line(1.7)}
    />
    <path d="M344.4 62.6A2.7 2.7 0 0 0 349.8 62.6" {...line(1.7)} />
    {dot && <circle cx={359.2} cy={42.4} r={3.9} fill="#d52a44" />}
  </Svg>
);

// 리워드 배너 얼굴 인식 그림 (A 10.698 평균 프레임에서 잰 선 가운데): 잉크 x 40.8–64.0, y 115.2–137.6, 파랑.
// 모서리 괄호 (x 42.2–62.4 · y 116.6–136.4, 반지름 4.4, 가로 팔 48.8 / 55.8 까지 · 세로 팔 123.4 / 129.6 까지) +
// 왼눈 (47.8, 124.6) · 오른눈 (55.8, 125.4) + 코 (위에서 오른쪽으로 꺾인 'ㄱ' 거울꼴) + 오른쪽에서 내려와 왼쪽으로 가는 입
export const FaceId = () => (
  <Svg className="toss-home-banner__icon" vb="40 114.4 24.8 24" w={24.8} h={24}>
    <g {...line(1.9)}>
      <path d="M42.2 123.4V121A4.4 4.4 0 0 1 46.6 116.6H48.8M55.8 116.6H58A4.4 4.4 0 0 1 62.4 121V123.4M62.4 129.6V132A4.4 4.4 0 0 1 58 136.4H55.8M48.8 136.4H46.6A4.4 4.4 0 0 1 42.2 132V129.6" />
      <path d="M57 121.5H52.6L51.5 128.3" />
      <path d="M56 129.3C56 130.9 54.9 131.6 53.3 131.6H51.1" />
    </g>
    <circle cx={47.8} cy={124.6} r={1.3} fill="currentColor" />
    <circle cx={55.8} cy={125.4} r={1.35} fill="currentColor" />
  </Svg>
);

// 계좌 줄 아이콘: 30dp 초타원 (x 32.7–62.4). 포인트: #1e273c 바탕 + ⌀18.6 #307bec 동그라미 (가운데 47.6, 308.0 — 초타원 가운데보다
// 0.8 아래) + 흰 P (잉크 x 45.2–51.6, y 303.2–312.0) — A 10.698 평균 프레임
export const PointIcon = () => (
  <svg className="toss-home-row__ic" width={29.7} height={29.7} viewBox="0 0 30 30" aria-hidden>
    <rect width="30" height="30" rx="10" fill="#1e273c" />
    <circle cx="15" cy="15.8" r="9.3" fill="#307bec" />
    <path d="M13 19V12H15.2C16.8 12 17.5 12.9 17.5 14.2 17.5 15.5 16.8 16.4 15.2 16.4H13" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 목록 › (카드 3 · 목록 카드): 잉크 x 340.8–346.4 (5.6 × 10.4), 선 1.8, #b2b6bf
export const RowChevron = ({ className = "toss-home-chev" }: { className?: string }) => (
  <svg className={className} width={9.6} height={13.6} viewBox="0 0 9.6 13.6" aria-hidden>
    <path d="M3.3 2.6 7.5 6.8 3.3 11" {...line(1.8)} />
  </svg>
);

// 배너 닫기 × (8 × 8, 선 1.5)
export const SmallClose = () => (
  <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden>
    <path d="M2.15 2.15 7.85 7.85M7.85 2.15 2.15 7.85" {...line(1.5)} />
  </svg>
);

// ---------- 카드 3 오른쪽 36dp 그림 (녹화의 상품 사진 · 방문 서비스는 개인 기록이라 지어서 그림) ----------
// 최근 본 상품 (지어낸 '바삭 감자칩'): 흰 초타원 위 노란 과자 봉지
export const SnackThumb = () => (
  <svg className="toss-home-thumb" width={36} height={36} viewBox="0 0 36 36" aria-hidden>
    <rect width="36" height="36" rx="12" fill="#ffffff" />
    <path d="M11 8.5C14.5 7.4 21.5 7.4 25 8.5L24.2 11.5 25.6 24.6 25 27.5C21.5 28.6 14.5 28.6 11 27.5L10.4 24.6 11.8 11.5Z" fill="#ffc83d" />
    <path d="M11 8.5C14.5 7.4 21.5 7.4 25 8.5L24.6 10C21 9.1 15 9.1 11.4 10ZM11 27.5C14.5 28.6 21.5 28.6 25 27.5L24.6 26C21 26.9 15 26.9 11.4 26Z" fill="#e8a317" />
    <ellipse cx="18" cy="18.4" rx="4.6" ry="3.9" fill="#f2b84b" stroke="#c98a12" strokeWidth="0.9" />
    <path d="M14.6 13.4H21.4" stroke="#d6451f" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
// 방문한 서비스 (예시 데이터 '토스쇼핑'): 짙은 산호색 초타원 + 쇼핑백
export const ShopThumb = () => (
  <svg className="toss-home-thumb" width={36} height={36} viewBox="0 0 36 36" aria-hidden>
    <rect width="36" height="36" rx="12" fill="#3a2427" />
    <path d="M14.2 14V12.6A3.8 3.8 0 0 1 21.8 12.6V14" fill="none" stroke="#c9c9cf" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M10.6 14.6H25.4L24.3 25.1C24.2 26.2 23.3 27 22.2 27H13.8C12.7 27 11.8 26.2 11.7 25.1Z" fill="#f96167" />
  </svg>
);

// 광고 카드 오른쪽 36dp (지어낸 광고주): 흰 초타원 + 초록 게이지
export const AdThumb = () => (
  <svg className="toss-home-ad__thumb" width={36.8} height={36.8} viewBox="0 0 36 36" aria-hidden>
    <rect width="36" height="36" rx="12" fill="#ffffff" />
    <path d="M9.5 22.5A8.5 8.5 0 0 1 26.5 22.5" fill="none" stroke="#e5e8eb" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M9.5 22.5A8.5 8.5 0 0 1 22.6 15.3" fill="none" stroke="#1fbf73" strokeWidth="3.4" strokeLinecap="round" />
    <circle cx="18" cy="22.5" r="1.8" fill="#4e5968" />
  </svg>
);

// 반쪽 카드 왼쪽 '대출 조건 1분 만에 비교' 그림 (지어냄): 기운 서류 + 돋보기, 54 × 56 dp 에 맞춰 그림 (오른쪽 아래, 카드 밑으로 조금 잘림).
// 브랜드콘 3D 그림 옆이라 밝기를 낮춘 회청색 종이 · 파란 돋보기. 같은 id 가 두 번 그려져도(전환 중 두 층) 내용이 같아 상관없음
export const LoanArt = () => (
  <svg className="toss-home-half__art toss-home-half__art--loan" width={54} height={56} viewBox="0 0 54 56" aria-hidden focusable="false">
    <defs>
      <linearGradient id="toss-home-loan-paper" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#e4e9f2" />
        <stop offset="1" stopColor="#8d98ae" />
      </linearGradient>
      <linearGradient id="toss-home-loan-side" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5f6a82" />
        <stop offset="1" stopColor="#323a4d" />
      </linearGradient>
      <linearGradient id="toss-home-loan-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#67a6fb" />
        <stop offset="1" stopColor="#1b4fb4" />
      </linearGradient>
      <linearGradient id="toss-home-loan-handle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2f6ddc" />
        <stop offset="1" stopColor="#0e2f78" />
      </linearGradient>
      <radialGradient id="toss-home-loan-glass" cx="0.35" cy="0.3" r="0.85">
        <stop offset="0" stopColor="#cfe2ff" stopOpacity="0.7" />
        <stop offset="1" stopColor="#5d8fdc" stopOpacity="0.35" />
      </radialGradient>
    </defs>
    <g transform="rotate(-12 20 30)">
      <rect x="7.6" y="9.6" width="26" height="36" rx="4.2" fill="url(#toss-home-loan-side)" />
      <rect x="5.6" y="7.6" width="26" height="36" rx="4.2" fill="url(#toss-home-loan-paper)" />
      <rect x="10" y="13" width="10" height="3.2" rx="1.6" fill="#3182f6" />
      <rect x="10" y="19.6" width="17" height="2.3" rx="1.15" fill="#97a3ba" />
      <rect x="10" y="24.6" width="14" height="2.3" rx="1.15" fill="#97a3ba" />
      <rect x="10" y="29.6" width="16" height="2.3" rx="1.15" fill="#97a3ba" />
    </g>
    <path d="M40.2 42.6 47.8 50.2" stroke="url(#toss-home-loan-handle)" strokeWidth="6.4" strokeLinecap="round" />
    <circle cx="31.6" cy="34" r="11" fill="url(#toss-home-loan-glass)" />
    <circle cx="31.6" cy="34" r="11" fill="none" stroke="url(#toss-home-loan-rim)" strokeWidth="4.2" />
    <path d="M25.8 30.6a6.8 6.8 0 0 1 4.8-3.7" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

// 목록 카드 지어낸 줄 (내 신용점수 보기 · 자산 추가하기) 24dp 아이콘
export const GaugeIcon = () => (
  <svg className="toss-home-li__svg" width={24} height={24} viewBox="0 0 24 24" aria-hidden>
    <path d="M3.5 16.5A8.5 8.5 0 0 1 20.5 16.5" fill="none" stroke="#2c4a3d" strokeWidth="3.6" strokeLinecap="round" />
    <path d="M3.5 16.5A8.5 8.5 0 0 1 16.6 9.3" fill="none" stroke="#2fca7f" strokeWidth="3.6" strokeLinecap="round" />
    <circle cx="12" cy="16.5" r="1.9" fill="#d5d4d9" />
  </svg>
);
export const PlusSquircle = () => (
  <svg className="toss-home-li__svg" width={24} height={24} viewBox="0 0 24 24" aria-hidden>
    <rect x="1.5" y="1.5" width="21" height="21" rx="7" fill="#3182f6" />
    <path d="M12 7.6V16.4M7.6 12H16.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

// ---------- 탭바 그림 (A 10.698 잉크를 따라 그림, 화면 좌표). 홈 = 채움, 나머지 = 윤곽 (고르면 채움) ----------

const HOUSE =
  "M50 790.6C50.6 790.6 51.2 790.8 51.7 791.2L58.8 796.6C59.6 797.2 60 798 60 799V808.2C60 809.4 59 810.4 57.8 810.4H52.6V806.4C52.6 805.4 51.8 804.6 50.8 804.6H49.2C48.2 804.6 47.4 805.4 47.4 806.4V810.4H42.2C41 810.4 40 809.4 40 808.2V799C40 798 40.4 797.2 41.2 796.6L48.3 791.2C48.8 790.8 49.4 790.6 50 790.6Z";
const GEM = "M115.2 791.2H125.6C126.3 791.2 126.9 791.6 127.2 792.2L130.4 798.4C130.7 799 130.6 799.7 130.2 800.2L121.4 809.6C120.6 810.4 119.4 810.4 118.6 809.6L109.8 800.2C109.4 799.7 109.3 799 109.6 798.4L112.8 792.2C113.1 791.6 113.7 791.2 114.4 791.2Z";
const BAG = "M181.6 795.2H199.6C200.2 795.2 200.6 795.7 200.5 796.3L198.9 808.1C198.7 809.2 197.8 810 196.7 810H184.5C183.4 810 182.5 809.2 182.3 808.1L180.7 796.3C180.6 795.7 181 795.2 181.6 795.2Z";
const BOX = "M251.2 799.6V807.2C251.2 808.3 252.1 809.2 253.2 809.2H268.4C269.5 809.2 270.4 808.3 270.4 807.2V792.2C270.4 791.2 269.2 790.8 268.6 791.6L262.4 797.4L257.6 793.4L251.6 798.8C251.3 799 251.2 799.3 251.2 799.6Z";

export function TabGlyph({ tab, filled }: { tab: HomeTab; filled: boolean }) {
  const cx = TAB_CX[tab];
  const fill = filled ? { fill: "currentColor", stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round" as const } : line(1.7);
  const knock = "var(--toss-home-tab-bg, #171619)";
  return (
    <svg className="toss-home-tab__ic" width={28} height={26} viewBox={`${cx - 14} 787.6 28 26`} aria-hidden>
      {tab === "home" && <path d={HOUSE} {...fill} />}
      {tab === "benefit" && (
        <>
          <path d={GEM} {...fill} />
          <path d="M116.8 795.2H123.2" {...line(1.7)} stroke={filled ? knock : "currentColor"} />
        </>
      )}
      {tab === "shopping" && (
        <>
          <path d="M186.4 797.8V793.6A4.2 4.2 0 0 1 194.8 793.6V797.8" {...line(1.7)} />
          <path d={BAG} {...fill} />
          {filled && <path d="M186.4 797.8V796.2M194.8 797.8V796.2" {...line(1.7)} stroke={knock} />}
        </>
      )}
      {tab === "stock" && <path d={BOX} {...fill} />}
      {tab === "all" && <path d="M323.3 793.4H339.1M323.3 800.4H339.1M323.3 807.4H339.1" {...line(1.8)} />}
    </svg>
  );
}
