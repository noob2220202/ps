// 녹화 인트로의 아이폰 홈 화면 (launch.md §2.1, plan.md §6.2 Q3). 녹화 C1 0~0.9초의 자리 · 크기만 따르고 내용은 모두 새로 그림:
//  배경은 만든 그라데이션(그림 없음), 1열 = 폴더 "금융"(파스텔 작은 칸) · "메모장" · "날씨" · NH올원뱅크 아이콘, 검색 알약, 독 유리 + 이름 없는 아이콘 4개.
//  알림 숫자 없음. 그림 파일은 앱 아이콘의 워드마크(allone-wordmark) 하나만 — 나머지는 CSS · SVG.
// 자리는 화면 pt (녹화 y 는 px / 3.000). 누름 · 녹아 사라짐은 intro.ts 가 이 DOM 에 애니메이션을 걺 (.ao-ln-app · .ao-ln-scene__white)
import type { ReactNode } from "react";
import { AlloneAppIcon, AoSquircle } from "../ui/AppIcon";
import "./launch.css";

// 1열 아이콘 왼끝 (pt, 폭 64, 위끝 80.0) · 독 아이콘 왼끝 (위끝 753.3 = 아래끝에서 34.7)
const ROW = [28.7, 119.6, 210.5, 301.4];
const DOCK = [34.6, 121.6, 208.5, 295.4];

// 폴더 안 3 × 3 작은 칸 (로고 없는 파스텔 색)
const MINI = ["#f6b8c8", "#f9d38f", "#bfe3a3", "#a9d6f0", "#c8b9f1", "#f4e2a0", "#9fd8cb", "#f3b6a5", "#b9c7f2"];

// 1열은 위에서(top), 독은 아래에서(bottom) — 393 × 852 틀에선 같은 자리, 키가 다른 폰 화면에선 위 · 아래에 붙음
function Tile({ left, top, bottom, label, children }: { left: number; top?: number; bottom?: number; label?: string; children: ReactNode }) {
  return (
    <div className="ao-ln-tile" style={{ left, top, bottom }}>
      {children}
      {label && <span className="ao-ln-tile__label">{label}</span>}
    </div>
  );
}

// 그라데이션 칸 + 흰 그림 (64 × 64 좌표)
function Glyph({ id, from, to, children }: { id: string; from: string; to: string; children: ReactNode }) {
  return (
    <>
      <svg className="ao-ln-defs" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
      </svg>
      <AoSquircle size={64} fill={`url(#${id})`} />
      <svg className="ao-ln-glyph" viewBox="0 0 64 64" width={64} height={64} aria-hidden>
        {children}
      </svg>
    </>
  );
}

function Folder() {
  const size = 13.4;
  const gap = 4.3;
  const pad = (64 - size * 3 - gap * 2) / 2;
  return (
    <>
      <AoSquircle size={64} fill="rgba(206, 218, 232, 0.78)" />
      {MINI.map((c, i) => (
        <AoSquircle
          key={c}
          size={size}
          fill={c}
          className="ao-ln-mini"
          style={{ left: pad + (i % 3) * (size + gap), top: pad + Math.floor(i / 3) * (size + gap) }}
        />
      ))}
    </>
  );
}

// 메모장: 따뜻한 노랑 바탕 + 줄 친 흰 종이
const Memo = () => (
  <Glyph id="ao-ln-g-memo" from="#ffd977" to="#f7b733">
    <rect x="15" y="12" width="34" height="40" rx="5" fill="#fff" />
    <path d="M21 23h22M21 30h22M21 37h22M21 44h13" stroke="#f2b84b" strokeWidth="2.2" strokeLinecap="round" />
  </Glyph>
);

// 날씨: 하늘색 바탕 + 해와 구름
const Weather = () => (
  <Glyph id="ao-ln-g-weather" from="#5aa9f5" to="#2f6fd6">
    <circle cx="25" cy="25" r="9" fill="#ffd54a" />
    <path d="M20 46h25a8 8 0 0 0 0-16a11 11 0 0 0-21 3a6.5 6.5 0 0 0-4 13z" fill="#fff" />
  </Glyph>
);

// 독: 수화기 · 말풍선 · 나침반 · 음표 (이름 없음)
const Handset = () => (
  <Glyph id="ao-ln-g-call" from="#6be38a" to="#1fb84a">
    <path
      d="M22.5 15.5c1.6-.9 3.4-.3 4.3 1.2l3 5.2c.8 1.4.5 3.1-.7 4.1l-2.3 1.9c1.7 3.9 4.6 6.9 8.4 8.6l1.9-2.3c1-1.2 2.8-1.5 4.1-.7l5.2 3c1.5.9 2.1 2.8 1.2 4.3l-1.7 2.9c-1.2 2-3.6 3-5.9 2.3C29 45 19 35 15.9 23.7c-.6-2.3.3-4.7 2.3-5.9z"
      fill="#fff"
    />
  </Glyph>
);
const Bubble = () => (
  <Glyph id="ao-ln-g-chat" from="#69e27e" to="#24bd45">
    <path d="M32 14c-10.5 0-19 6.9-19 15.4c0 5 2.9 9.4 7.4 12.2c-.4 2.6-1.8 5-3.6 6.6c3.9-.1 7.6-1.6 10.3-3.9c1.6.4 3.2.5 4.9.5c10.5 0 19-6.9 19-15.4S42.5 14 32 14z" fill="#fff" />
  </Glyph>
);
const Compass = () => (
  <Glyph id="ao-ln-g-compass" from="#ffffff" to="#e9eef5">
    <circle cx="32" cy="32" r="21" fill="url(#ao-ln-g-compass-face)" />
    <defs>
      <linearGradient id="ao-ln-g-compass-face" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3fa2ff" />
        <stop offset="1" stopColor="#1661d8" />
      </linearGradient>
    </defs>
    <path d="M42.5 21.5L35 35l-13.5 7.5L29 29z" fill="#fff" />
    <path d="M42.5 21.5L35 35l-6-6z" fill="#ff4a3d" />
  </Glyph>
);
const Note = () => (
  <Glyph id="ao-ln-g-note" from="#ff6b78" to="#f0263d">
    <path d="M27 18l18-4v24.5a5.5 5.5 0 1 1-3-4.9V21.6l-12 2.7v18.2a5.5 5.5 0 1 1-3-4.9z" fill="#fff" />
  </Glyph>
);

const Magnifier = () => (
  <svg className="ao-ln-search__icon" viewBox="0 0 12 12" width={11.5} height={11.5} aria-hidden>
    <circle cx="5" cy="5" r="3.9" fill="none" stroke="#fff" strokeWidth="1.6" />
    <path d="M7.9 7.9l3 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export function AlloneScene() {
  return (
    <div className="ao-ln-scene" aria-hidden>
      <div className="ao-ln-scene__wall" />
      <div className="ao-ln-scene__stage">
        <Tile left={ROW[0]} top={80} label="금융">
          <Folder />
        </Tile>
        <Tile left={ROW[1]} top={80} label="메모장">
          <Memo />
        </Tile>
        <Tile left={ROW[2]} top={80} label="날씨">
          <Weather />
        </Tile>
        <Tile left={ROW[3]} top={80} label="NH올원뱅크">
          <AlloneAppIcon size={64} className="ao-ln-app" />
        </Tile>
        <div className="ao-ln-search">
          <Magnifier />
          <span>검색</span>
        </div>
        <div className="ao-ln-dock" />
        {[Handset, Bubble, Compass, Note].map((G, i) => (
          <Tile key={i} left={DOCK[i]} bottom={34.7}>
            <G />
          </Tile>
        ))}
      </div>
      <div className="ao-ln-scene__white" />
    </div>
  );
}
