// 토스 녹화 기기(갤럭시 One UI, 다크) 상태바 — PhoneFrame 이 TOSS 일 때 그림 (plan.md §3.1, infra.md §1.2).
// 상태바는 화면 위에 겹친 투명한 층 (toss.css): 28dp 띠 색은 그 밑 화면(TossPage 띠)이 칠하고, 여기선 글자 · 아이콘만 (#f0f0f2).
// 그래서 시트 배경막이 띠를 어둡게 해도 시계 · 아이콘은 밝은 그대로 (B 33.5). 384 × 28 SVG 한 장에 dp 좌표로 그림 (반 픽셀씩 튀지 않게)
//  시계: 잉크 왼끝 x 28, 숫자 잉크 y 8.0–18.4, Pretendard 14/400, 12시간 "h:mm" (오전/오후 없음 — 토스만)
//  화면 녹화 표시(모서리 괄호 + 1초 주기로 깜빡이는 캠코더, x 60–71.2): ● 녹화 중일 때만. 시계 폭이 바뀌면 그만큼 옮김
//  오른쪽 (잉크 x): 배터리 보호 241.6–249.6 · 알람 255.2–266.4 · 무음 271.2–282.4 · 와이파이 ↑↓ 286.4–303.2 · 신호 4칸 306.4–316.0
//                  · "NN%" 오른끝 346.4 · 충전 중 배터리 348.8–356.8. 다른 앱 알림 아이콘 · 엣지 패널 손잡이는 그리지 않음
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDeviceStatus, useNow } from "../platform/deviceStatus";
import { useRecorder } from "../platform/recorder";
import { useTossPhoneFit, useTossPhoneSnap } from "./phoneSnap";

const FONT = { weight: 400, size: 14 } as const;
const CLOCK_X = 28; // 시계 잉크 왼끝
const BASE_Y = 18.3; // 숫자 기준선 (잉크 y 8.0–18.4)
const PCT_RIGHT = 346.4; // "NN%" 잉크 오른끝
const REC_GAP = 7; // 시계 잉크 오른끝 → 녹화 표시 괄호 왼끝 (녹화: 시계 오른끝 ≈53, 괄호 60)
const REC_X = 60; // 녹화 표시 괄호 왼끝 (괄호 · 캠코더 좌표의 기준)

// 글자 잉크 범위 (텍스트 원점 기준 왼 · 오른, dp). 가변 글꼴의 measureText 상자는 넓게 나와서 8배로 그려 반 넘게 칠한 칸으로 잼 (kakao2 StatusBar 와 같은 방법)
const K = 8;
let ctx: CanvasRenderingContext2D | null = null;
const inkCache = new Map<string, { l: number; r: number }>();
function inkOf(text: string, loaded: number) {
  const key = `${text}|${loaded}`;
  const hit = inkCache.get(key);
  if (hit) return hit;
  ctx ??= Object.assign(document.createElement("canvas"), { width: 480, height: 200 }).getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.font = `${FONT.weight} ${FONT.size * K}px "Pretendard Variable"`;
  ctx.textAlign = "left";
  ctx.fillText(text, 40, h * 0.8);
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let x1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] >= 128) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
  if (x1 < 0) return null;
  const out = { l: (x0 - 40) / K, r: (x1 + 1 - 40) / K };
  inkCache.set(key, out);
  return out;
}
function useInk(text: string) {
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts
      ?.load(`${FONT.weight} ${FONT.size}px "Pretendard Variable"`, text)
      .then(() => alive && setLoaded((n) => n + 1))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [text]);
  return useMemo(() => inkOf(text, loaded), [text, loaded]);
}

export function TossStatusBar() {
  const now = useNow();
  const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}`;
  const { battery } = useDeviceStatus();
  const level = Math.max(0, Math.min(100, battery));
  const pct = `${level}%`;
  const recording = useRecorder().status === "recording";
  const clock = useInk(time);
  const pctInk = useInk(pct);
  const clockX = clock ? CLOCK_X - clock.l : CLOCK_X - 0.6;
  const recX = clock ? CLOCK_X + (clock.r - clock.l) + REC_GAP : REC_X;
  const pctX = pctInk ? PCT_RIGHT - pctInk.r : PCT_RIGHT - 25;
  const root = useRef<HTMLDivElement>(null);
  useTossPhoneSnap(root); // 폰 테두리를 기기 화소에 맞춤
  useTossPhoneFit(); // 진짜 폰 화면: 384 폭을 창 폭에 맞춤
  return (
    <div ref={root} className="statusbar toss-sb" aria-hidden>
      <svg className="toss-sb__svg" width="384" height="28" viewBox="0 0 384 28">
        <text className="toss-sb__text" x={clockX.toFixed(2)} y={BASE_Y}>
          {time}
        </text>
        {recording && <RecIndicator dx={recX - REC_X} />}
        <RightIcons level={level} />
        <text className="toss-sb__text" x={pctX.toFixed(2)} y={BASE_Y}>
          {pct}
        </text>
      </svg>
    </div>
  );
}

// 화면 녹화 중: 모서리 괄호 (x 60–71.2 · y 8–19, 선 1.1) + 안의 캠코더 (몸통 62.2–66.8 × 11.3–15.9 선, 렌즈 66.9–69.3), 캠코더만 1초 주기 반 켜짐
function RecIndicator({ dx }: { dx: number }) {
  return (
    <g transform={dx ? `translate(${dx.toFixed(2)} 0)` : undefined} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
      <path d="M60.6 10.9V9.6a1 1 0 0 1 1-1h1.5M68.3 8.6h1.5a1 1 0 0 1 1 1v1.3M70.8 16.1v1.3a1 1 0 0 1-1 1h-1.5M63.1 18.4h-1.5a1 1 0 0 1-1-1v-1.3" />
      <g className="toss-sb__rec">
        <rect x="62.5" y="11.5" width="4.3" height="4.2" rx="0.6" strokeWidth="1" />
        <path d="M67 13.1 69.1 11.7v4L67 14.3Z" fill="currentColor" strokeWidth="0.6" strokeLinejoin="round" />
      </g>
    </g>
  );
}

function RightIcons({ level }: { level: number }) {
  const id = useId();
  const cut = `${id}-cut`;
  const batt = `${id}-batt`;
  const fillTop = 9.6 + (18.8 - 9.6) * (1 - level / 100);
  return (
    <g fill="currentColor">
      {/* 배터리 보호 (241.6–249.6): 채운 세로 배터리 + 뚫린 순환 화살표 */}
      <mask id={cut} maskUnits="userSpaceOnUse" x="240" y="7" width="12" height="13">
        <rect x="240" y="7" width="12" height="13" fill="#fff" />
        <path d="M243.9 15.6a1.9 1.9 0 0 1 1.1-2.9M246.9 12.9a1.9 1.9 0 0 1 .2 2.8M245.9 16.6h-1.6" stroke="#000" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        <path d="M244.6 12.1l.8.6-.9.5ZM247.7 15.1l-.2 1-.8-.5ZM245.5 17.1l-.7-.5.7-.5Z" fill="#000" />
      </mask>
      <g mask={`url(#${cut})`}>
        <rect x="243.6" y="8.4" width="4" height="1.6" rx="0.5" />
        <rect x="241.6" y="9.6" width="8" height="9.2" rx="1.5" />
      </g>
      {/* 알람 (255.2–266.4) */}
      <circle cx="260.8" cy="14.2" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M260.8 12v2.4h1.8" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M255.3 10.6a2.6 2.6 0 0 1 3-2.6ZM266.3 10.6a2.6 2.6 0 0 0-3-2.6Z" />
      <path d="M257.7 18 256.7 19.2M263.9 18l1 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* 무음 (271.2–282.4): 스피커 + 사선 */}
      <path d="M271.4 11.9h2.3l3.4-2.9v9.8l-3.4-2.9h-2.3Z" />
      <path d="m272.1 8.9 9.8 9.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {/* 와이파이 (286.4–300.6) + 데이터 ↓↑ (296.8–303.2) */}
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M287.1 11.9a9 9 0 0 1 12.8 0" strokeWidth="1.5" />
        <path d="M289.4 14.3a5.8 5.8 0 0 1 8.2 0" strokeWidth="1.5" />
      </g>
      <circle cx="293.5" cy="16.8" r="1.25" />
      <path d="M297.6 14v4.5m-1.3-1.4 1.3 1.4 1.3-1.4M301.6 18.6v-4.5m-1.3 1.4 1.3-1.4 1.3 1.4" fill="none" stroke="currentColor" strokeWidth="0.95" strokeLinecap="round" strokeLinejoin="round" />
      {/* 신호 4칸 (306.4–316.0) */}
      <rect x="306.4" y="16.1" width="1.3" height="2.5" rx="0.4" />
      <rect x="309.1" y="14.1" width="1.3" height="4.5" rx="0.4" />
      <rect x="311.9" y="9.2" width="1.3" height="9.4" rx="0.4" />
      <rect x="314.7" y="8.6" width="1.3" height="10" rx="0.4" />
      {/* 충전 중 배터리 (348.8–356.8): 빈 칸 옅게, 잔량만큼 아래부터 채움, 번개는 뚫림 */}
      <mask id={batt} maskUnits="userSpaceOnUse" x="347" y="7" width="12" height="13">
        <rect x="347" y="7" width="12" height="13" fill="#fff" />
        <path d="M353.4 10.9 350.9 14.7h1.9l-.6 3 2.6-4h-2Z" fill="#000" />
      </mask>
      <g mask={`url(#${batt})`}>
        <rect x="350.9" y="8.4" width="3.8" height="1.6" rx="0.5" opacity="0.45" />
        <rect x="348.8" y="9.6" width="8" height="9.2" rx="1.5" opacity="0.45" />
        <clipPath id={`${batt}-c`}>
          <rect x="348.8" y="9.6" width="8" height="9.2" rx="1.5" />
        </clipPath>
        <rect x="348.8" y={fillTop.toFixed(2)} width="8" height={(18.8 - fillTop).toFixed(2)} clipPath={`url(#${batt}-c)`} />
      </g>
    </g>
  );
}
