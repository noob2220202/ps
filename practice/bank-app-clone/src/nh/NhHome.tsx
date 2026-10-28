import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { paths } from "../api/endpoints";
import type { HomeData } from "../api/types";
import { useApi } from "../api/useApi";
import { DevPanel } from "../dev-panel/DevPanel";
import { useStatusBar } from "../hooks/useStatusBar";
import { useNhGo } from "./loading";
import { NhImg, NhMenuIcon } from "./common";
import "./nh-home.css";

// 말풍선 "콕! 눌러 캐릭터를 바꿔보세요."는 앱을 켜고 처음 보는 홈에서만 (녹화1 10~13초에는 있고, 다른 화면에 갔다 온 홈(녹화2)엔 없음)
let tipSeen = false;

// 콕뱅크 홈 (스크린샷 2026-10-28 9:48, 녹화1 10~13초, 녹화2 36~38초).
// 위치는 모두 실제 화면에서 잰 dp (스크린샷 px ÷ 1.875). 이 화면의 top 0 = 상태바 아래(화면 위 28dp)
export function NhHome() {
  useStatusBar("#18171c", "light");
  const go = useNhGo(); // 누르면 점 3개 로딩 후 이동
  const home = useApi<HomeData>(paths.home);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tip, setTip] = useState(!tipSeen);
  const [firstEntry] = useState(!tipSeen); // 앱 켜고 처음 들어온 홈인지 (스켈레톤 반짝임 시작 위치가 다름)
  const [poke, setPoke] = useState(0);
  const ready = useMinDelay(160); // 실제 앱도 들어올 때마다 계좌 자리에 회색 상자(스켈레톤)가 160ms쯤 보였다가 바뀜
  const main = home.data?.accounts.find((a) => a.kind === "main");
  const shown = ready && !!main;

  useEffect(
    () => () => {
      tipSeen = true; // 홈을 떠나면 다음부터 말풍선 없음
    },
    [],
  );

  return (
    <div className="nh">
      <div className="screen nh nh-home">
        {/* 위 아이콘 3개: 가운데 x 268 / 308 / 348, y 24 (상태바 아래 48 높이 줄의 가운데) */}
        <Shot box={[478, 72, 49, 49]} shift={[-0.18, 0.93]} className="nh-home__icon">
          <MyIcon />
        </Shot>
        <Shot box={[552, 72, 51, 49]} shift={[0.5, 0.6]} className="nh-home__icon">
          <BellIcon />
        </Shot>
        <span className="nh-home__menu-icon">
          <NhMenuIcon />
        </span>
        <button className="nh-home__hit" style={hit(248, 0, 40, 48)} aria-label="MY" />
        <button className="nh-home__hit" style={hit(288, 0, 40, 48)} aria-label="관리 패널" onClick={() => setPanelOpen(true)} />
        <button className="nh-home__hit" style={hit(328, 0, 40, 48)} aria-label="메뉴" onClick={() => go("/accounts")} />

        {shown ? (
          <>
            <button className="nh-home__name" onClick={() => go(`/history/${main.id}`)}>
              {main.label}
              <svg className="nh-home__chev" viewBox="204.38 150.53 37 30" aria-hidden>
                <path d="M214.2 160.35 223.5 169.65 232.8 160.35" />
              </svg>
            </button>
            <button className="nh-home__balance" onClick={() => go(`/history/${main.id}`)}>
              <b>{main.balance.toLocaleString("ko-KR")}</b>
              <span>원</span>
            </button>
            <span className="nh-home__lock" />
            <LockCircle />
            <Shot box={[560, 140, 48, 48]} shift={[-0.87, -0.76]} className="nh-home__icon nh-home__late1">
              <RefreshIcon />
            </Shot>
            <Shot box={[640, 143, 25, 43]} shift={[0.38, 0.51]} className="nh-home__icon nh-home__late2">
              <MoreIcon />
            </Shot>
            <button className="nh-home__hit" style={hit(296, 76 - 28, 32, 24)} aria-label="새로고침" onClick={home.retry} />
            <button className="nh-home__hit" style={hit(334, 76 - 28, 28, 24)} aria-label="더보기" />
          </>
        ) : (
          <>
            <i className={`nh-home__skel nh-home__skel--1${firstEntry ? " nh-home__skel--first" : ""}`} />
            <i className={`nh-home__skel nh-home__skel--2${firstEntry ? " nh-home__skel--first" : ""}`} />
          </>
        )}

        {/* 캐릭터 (뒤 파란 빛은 CSS radial-gradient). 누르면 통통 (실제 앱은 캐릭터가 바뀜) */}
        <Px at={[248, 384]} className="nh-home__char">
          <NhImg name="nh-hero" w={225} h={266} className={poke ? "poke" : ""} key={poke} fallback={<span className="nh-home__char-fallback">👻</span>} />
        </Px>
        <button
          className="nh-home__hit"
          style={hit(140, 190, 104, 128)}
          aria-label="캐릭터"
          onClick={() => {
            setPoke((n) => n + 1);
            setTip(false);
          }}
        />
        {shown && tip && (
          <div className="nh-home__tip">
            {/* 말풍선 바탕 + 꼬리 + 둘레 빛: 잰 크기(소수 dp) 그대로 그리려고 SVG (CSS 상자는 1 CSS px 단위로 그려짐) */}
            <svg className="nh-home__tip-bg" viewBox="0 0 264 49" aria-hidden>
              <defs>
                {/* 흰 빛을 말풍선 바깥에만 (아래로 조금 치우침) */}
                <filter id="nh-home-tip-glow" x="-0.1" y="-0.6" width="1.2" height="2.2">
                  <feGaussianBlur in="SourceAlpha" stdDeviation={TIP_GLOW.blur} />
                  <feOffset dy={TIP_GLOW.dy} result="b" />
                  <feComposite in="b" in2="SourceAlpha" operator="out" result="g" />
                  <feFlood floodColor="#fff" floodOpacity={TIP_GLOW.a} />
                  <feComposite in2="g" operator="in" />
                </filter>
              </defs>
              <path d={TIP_PATH} filter="url(#nh-home-tip-glow)" />
              <path d={TIP_PATH} fill="rgba(0,0,0,.54)" />
            </svg>
            <NhImg name="nh-tip-emoji" w={25.6} h={25.6} className="nh-home__tip-emoji" fallback={<span>😘</span>} />
            <span>
              <b>콕!</b> 눌러 캐릭터를 바꿔보세요.
            </span>
            <button
              aria-label="닫기"
              onClick={() => {
                tipSeen = true;
                setTip(false);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M7.7 7.7 16.3 16.3M16.3 7.7 7.7 16.3" />
              </svg>
            </button>
          </div>
        )}

        {/* 메뉴카드·지식콕·금융콕·배너 바탕: 스크린샷 px 그대로 그림 (viewBox 1 = 기기 1px @1.875배, SVG 상자 left 24 · top 340 = 기기 45, 690).
            CSS 상자는 1 CSS px(1.875 기기 px) 단위로 그려져 가장자리·1px 테가 반 픽셀씩 걸치기 때문 */}
        <svg className="nh-home__cards" viewBox="45 690 630 735" aria-hidden>
          <defs>
            <linearGradient id="nh-home-menu-grad">
              <stop offset="0" stopColor="#2c3942" stopOpacity="0.74" />
              <stop offset="1" stopColor="#26323c" stopOpacity="0.74" />
            </linearGradient>
            <linearGradient id="nh-home-kok-grad">
              <stop offset="0" stopColor="#28323b" />
              <stop offset="1" stopColor="#222a32" />
            </linearGradient>
          </defs>
          {/* 메뉴카드 x 45~675, y 709~891, 모서리 37.5px, 반투명(0.74) 가로 그라데이션 + 1px 테 (뒤의 빛이 비침) */}
          <rect x="45" y="709" width="630" height="182" rx="37.5" fill="url(#nh-home-menu-grad)" />
          <rect x="45.5" y="709.5" width="629" height="181" rx="37" fill="none" stroke="rgba(48,55,63,.8)" />
          {/* 지식콕 / 금융콕 x 45~349 / 371~675, y 943~1172, 모서리 37px, 가로 #28323b → #222a32, 1px 테 #2d343c */}
          <rect x="45.5" y="943.5" width="303" height="228" rx="36.5" fill="url(#nh-home-kok-grad)" stroke="#2d343c" />
          <rect x="371.5" y="943.5" width="303" height="228" rx="36.5" fill="url(#nh-home-kok-grad)" stroke="#2d343c" />
          {/* 배너 x 45~675, y 1209~1418, 모서리 22.5px, #e3effb */}
          <rect x="45" y="1209" width="630" height="209" rx="22.5" fill="#e3effb" />
        </svg>
        <nav className="nh-home__menu">
          {(
            [
              ["send", "콕송금", () => main && go(`/send?from=${main.id}`)],
              ["myaccount", "내계좌조회", () => go("/accounts")],
              ["poke", "콕조르기", undefined],
              ["dutch", "콕더치페이", undefined],
            ] as const
          ).map(([key, label, onClick], k) => (
            // 칸: 폭 78.58, 왼쪽 여백 10.84 (아이콘은 아래에 따로)
            <button key={key} onClick={onClick} style={{ left: 10.84 + k * 78.58 }}>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {/* 메뉴 아이콘은 잘라 온 자리(스크린샷 px) 그대로: x 108 / 255 / 402 / 550, y 743 */}
        {(
          [
            ["send", 108, "⚡"],
            ["myaccount", 255, "🏦"],
            ["poke", 402, "💙"],
            ["dutch", 550, "➗"],
          ] as const
        ).map(([key, x, emoji]) => (
          <Px key={key} at={[x, 743]}>
            <NhImg name={`nh-menu-${key}`} w={62} h={62} fallback={<span>{emoji}</span>} />
          </Px>
        ))}

        <div className="nh-home__koks">
          <button className="nh-home__kok">
            <b>지식콕!</b>
          </button>
          <button className="nh-home__kok">
            <b>금융콕!</b>
          </button>
        </div>
        <Px at={[212, 1036]}>
          <NhImg name="nh-kok-bulb" w={112} h={110} fallback={<span>💡</span>} />
        </Px>
        <Px at={[556, 1040]}>
          <NhImg name="nh-kok-pig" w={88} h={106} fallback={<span>🐷</span>} />
        </Px>

        <button className="nh-home__banner">
          <small>이건 못 참지!</small>
          <b>꿀이자 예·적금으로</b>
          <b className="nh-home__banner-l2">
            FLEX<i className="nh-home__tilde">~</i>
          </b>
        </button>
        <Px at={[430, 1222]}>
          <NhImg name="nh-banner-char" w={234} h={182} fallback={<span style={{ fontSize: 40 }}>😎</span>} />
        </Px>

        <p className="nh-home__bgset">
          배경색상 설정 <i />
        </p>
      </div>
      <DevPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}

// 말풍선 모양 (dp, 말풍선 상자 왼쪽 위 = 화면 60.4, 156.8 기준). 녹화1 480px 에서 잰 가장자리:
// 알약 x 75.26~404.65, y 196.0~247.0 (화면 60.21~323.72, 156.8~197.6dp, 반지름 20.4)
// 꼬리: 왼쪽 변 세로 x 375.0 (화면 300.0dp), 위 폭 8.9, 빗변 45°, 끝은 1.4 폭으로 잘림, 아래 끝 205.1dp
const TIP_PATH = "M20.21 0H242.92A20.4 20.4 0 0 1 242.92 40.8H20.21A20.4 20.4 0 0 1 20.21 0ZM239.6 40.8H248.5L241 48.3H239.6Z";
const TIP_GLOW = { blur: 6.4, dy: 2.4, a: 0.073 }; // 녹화1 − 녹화2(말풍선 없음) 밝기 차에 맞춘 값

const S = 1.875; // 스크린샷 px / dp
const hit = (left: number, top: number, width: number, height: number): CSSProperties => ({ left, top, width, height });

// 스크린샷 px 좌표로 그린 SVG를 그 자리에 (viewBox = 스크린샷 영역, 앱 영역 top 0 = 화면 위 28dp)
// shift: 참고와 겹치도록 그림만 더 옮길 거리 (스크린샷 px). 상자는 기기 픽셀에 맞춰 두고 viewBox 로 옮김 (상자를 옮기면 픽셀 단위로 반올림됨)
function Shot({ box: [x, y, w, h], shift: [dx, dy] = [0, 0], className = "", children }: { box: [number, number, number, number]; shift?: [number, number]; className?: string; children: ReactNode }) {
  return (
    <svg className={className} style={{ left: x / S, top: y / S - 28, width: w / S, height: h / S }} viewBox={`${x - dx} ${y - dy} ${w} ${h}`} aria-hidden>
      {children}
    </svg>
  );
}

// 잘라 온 그림(스크린샷 px 크기 그대로, 안의 NhImg w/h = 그림 px)을 스크린샷 px 자리 (x, y)에 정확히.
// left/top 은 정수 CSS px (소수면 브라우저가 1 CSS px 단위로 반올림함), 나머지는 translate, 크기는 scale(1/1.875)
// (CSS 크기로 px/1.875 를 주면 1/64px 단위로 잘려 한 줄씩 빠짐)
function Px({ at: [x, y], className = "", children }: { at: [number, number]; className?: string; children: ReactNode }) {
  const l = Math.floor(x / S);
  const t = Math.floor(y / S);
  return (
    <span className={`nh-home__px ${className}`} style={{ left: l, top: t - 28, transform: `translate(${(x / S - l).toFixed(4)}px, ${(y / S - t).toFixed(4)}px) scale(${1 / S})` }}>
      {children}
    </span>
  );
}

// 처음 그린 때부터 ms 뒤 true. 시작 시각은 첫 렌더에서 잡아 둠 (effect 는 첫 그림 뒤에, 개발 모드 StrictMode 에선 한 번 더 늦게 돌기도 해서
// effect 에서 ms 를 그대로 기다리면 스켈레톤이 40~60ms 더 길어짐)
function useMinDelay(ms: number) {
  const [start] = useState(() => performance.now());
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), Math.max(0, ms - (performance.now() - start)));
    return () => clearTimeout(t);
  }, [ms, start]);
  return done;
}

// 아래 모양들은 스크린샷 px 좌표 (참고 이미지에 겹쳐 그려서 평균 밝기 차가 최소가 되게 맞춘 값)
function MyIcon() {
  return (
    <>
      <g fill="none" stroke="currentColor" strokeWidth="2.82">
        <circle cx="500.44" cy="87.74" r="6.39" />
        <path d="M506.46 100.01H496.38a9.1 9.1 0 0 0-9.1 9.1v1.57a2.89 2.89 0 0 0 2.89 2.89h4.08" />
      </g>
      <text x="498.24" y="114.58" fill="currentColor" fontWeight="810" fontSize="13.04" letterSpacing="-0.2">
        MY
      </text>
    </>
  );
}

function BellIcon() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2.77" strokeLinejoin="round">
      <path d="M566.64 92.22a10.62 10.62 0 0 1 21.24 0v5.47l5.01 9.98h-31.26l5.01-9.98Z" />
      <path d="M572.04 108.99a5.22 4.16 0 0 0 10.44 0" />
    </g>
  );
}

function RefreshIcon() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2.81">
      <path d="M599.54 166.56A15.29 15.29 0 1 1 597.37 156.5" />
      <path d="M599.1 151.84v5.75h-6.58" />
    </g>
  );
}

function MoreIcon() {
  return (
    <g fill="currentColor">
      <circle cx="652.5" cy="153.25" r="2.8" />
      <circle cx="652.5" cy="164.55" r="2.8" />
      <circle cx="652.5" cy="175.85" r="2.8" />
    </g>
  );
}

// 잠금 동그라미 + 안의 열린 자물쇠. 스크린샷 px 좌표 그대로 (viewBox 1 = 기기 1px @1.875배):
// SVG 상자를 left 24 · top 84 (기기 45, 210 — 정수 CSS px 이면서 기기 픽셀 경계)에 두고 테두리는 x.5 선 → 1px 테가 또렷
// (CSS 상자의 테두리·그림자는 1 CSS px 단위로 맞춰 그려져서 53 × 52 기기 px 상자를 만들 수 없음)
function LockCircle() {
  return (
    <svg className="nh-home__lock-svg" viewBox="45 210 60 60" aria-hidden>
      {/* 바깥 상자 x 45~98, y 210~262 (53 × 52 px), 모서리 22.5px(12dp), 테 1px #828186 */}
      <rect x="45.5" y="210.5" width="52" height="51" rx="22" fill="#2f2e33" stroke="#828186" />
      <g className="nh-home__lock-glyph">
        <g fill="none" stroke="currentColor" strokeWidth="2.85">
          <rect x="59.21" y="232.12" width="25.44" height="17.45" rx="5.01" />
          <path d="M65.63 232.12v-4.2a6.35 6.35 0 0 1 12.43-1.82" />
        </g>
        {/* 열쇠 구멍: 1.5dp 폭 막대, 끝은 평평 */}
        <rect x="70.575" y="237.87" width="2.85" height="5.99" fill="currentColor" />
      </g>
    </svg>
  );
}
