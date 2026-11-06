// kakao2 기기 화면 위 (녹화 아이폰, 393 × 852): 상태바 · 다이나믹 아일랜드 · 홈 인디케이터 (PhoneFrame 이 KAKAO2 일 때 그림).
// 상태바는 투명하게 화면 위에 겹침 (chrome.css) — 54pt 띠 색은 그 밑 화면이 칠하고, 여기선 글자 · 아이콘만. 글자색은 화면의 useStatusBar(bg, fg) 의 fg
// 좌표는 모두 녹화에서 잰 pt (device.md §3 · §4): 393 × 54 SVG 한 장에 그려 0.5px 씩 튀지 않게
import { useEffect, useId, useMemo, useState } from "react";
import { useStatusBarStyle } from "../hooks/useStatusBar";
import { useDeviceStatus, useNow } from "../platform/deviceStatus";
import { BLINK_MS, useBlinkEpoch, useIntro } from "../platform/intro";
import { clearK2ClockOnce, K2_ARROW_PATH, K2_ARROW_ROUND, K2_BUBBLE_ARROW, K2_CLOCK_MS, K2_MOON, pendingK2ClockMs, useK2Indicator } from "./chrome";
import { LAUNCH, useLaunchAt } from "./launch";
import "./chrome.css";

// 글자 잉크 폭 (상태바 SVG 글자와 같은 글꼴). 시계를 잉크 가운데 x 50.46 에 두고 화살표를 잉크 오른끝 + 5.0 에 붙이려고.
// measureText 의 actualBoundingBox 는 가변 글꼴에서 조절점 상자라 '10:47' 이 0.9pt 넓게 나옴 → 8배로 그려서 반 넘게 칠해진 칸으로 잼
type Font = readonly [weight: number, size: number];
// 시계 16.2px 600: 녹화 31초 '10:47' 과 3배로 겹쳐 잉크(30.31 – 70.61)와 굵기가 가장 맞는 값 (16px 은 0.67pt 좁음)
const CLOCK_FONT: Font = [600, 16.2];
const NUM_FONT: Font = [700, 11];
const K = 8;
let ctx: CanvasRenderingContext2D | null = null;
function inkOf(text: string, [weight, size]: Font, align: CanvasTextAlign) {
  ctx ??= Object.assign(document.createElement("canvas"), { width: 1200, height: 240 }).getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.font = `${weight} ${size * K}px "Pretendard Variable"`;
  ctx.textAlign = align;
  ctx.fillText(text, w / 2, h * 0.75);
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
  return { l: (w / 2 - x0) / K, r: (x1 + 1 - w / 2) / K };
}
// 그 글자들의 글꼴 조각을 받으면 다시 잼 (Pretendard 는 글자 범위별로 나눠 받음)
function useFontLoaded([weight, size]: Font, text: string) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts
      ?.load(`${weight} ${size}px "Pretendard Variable"`, text)
      .then(() => alive && setTick((t) => t + 1))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [weight, size, text]);
  return tick;
}
function useInk(text: string, font: Font, align: CanvasTextAlign) {
  const tick = useFontLoaded(font, text);
  return useMemo(() => inkOf(text, font, align), [text, font, align, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

const CLOCK_X = 50.46; // 시계 잉크 가운데 ('10:47' · '10:48' 둘 다)
const ARROW_X = 75.6; // '10:47' 일 때 화살표 잉크 왼끝 = 시계 잉크 오른끝 70.61 + 5.0 (시각 폭이 다르면 그만큼 옮김)
const BATT = { x: 339.4, y: 22.7, w: 23.6, h: 12.9, numX: 351.2 };

export function K2StatusBar() {
  const { fg } = useStatusBarStyle();
  const now = useNow();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  const { battery } = useDeviceStatus();
  const level = Math.max(0, Math.min(100, battery));
  const maskId = useId();

  // 시계만 서서히 바뀜 (기본 550ms, chrome.ts k2ClockOnce 로 다음 한 번만 200 · 0ms). 켜진 직후(0.3초)엔 바로
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 300);
    return () => clearTimeout(t);
  }, []);
  const [shown, setShown] = useState({ fg, ms: 0 });
  if (shown.fg !== fg) setShown({ fg, ms: settled ? (pendingK2ClockMs() ?? K2_CLOCK_MS) : 0 });
  useEffect(() => clearK2ClockOnce(), [shown.fg]);

  const clock = useInk(time, CLOCK_FONT, "center");
  const num = useInk(String(level), NUM_FONT, "center");
  const clockX = clock ? CLOCK_X - (clock.r - clock.l) / 2 : CLOCK_X;
  const dx = clock ? CLOCK_X + (clock.l + clock.r) / 2 + 5 - ARROW_X : 0;
  const numX = num ? BATT.numX - (num.r - num.l) / 2 : BATT.numX;

  return (
    <div className={`statusbar statusbar--${fg} k2sb k2sb--${fg}`} style={{ ["--k2-clock-ms" as string]: `${shown.ms}ms` }}>
      <svg className="k2sb__svg" width="393" height="54" viewBox="0 0 393 54" aria-hidden>
        <text className="k2sb__clock" x={clockX} y="34.97" textAnchor="middle">
          {time}
        </text>
        <g transform={dx ? `translate(${dx.toFixed(2)} 0)` : undefined}>
          <SbIndicator />
        </g>
        <g fill="currentColor">
          {/* 신호 4칸 중 2칸 (폭 3, 간격 5, 아래끝 34.97) */}
          <rect x="291.09" y="30.64" width="3" height="4.33" rx="0.75" />
          <rect x="296.09" y="28.31" width="3" height="6.66" rx="0.75" />
          <rect className="k2sb__off" x="301.08" y="25.98" width="3" height="8.99" rx="0.75" />
          <rect className="k2sb__off" x="306.08" y="23.31" width="3" height="11.66" rx="0.75" />
          {/* LTE: 좁은 굵은 글자 → 13.25px 620 을 가로 0.86 (잉크 315.07 – 333.39, 기준선 34.30 — 녹화 31초와 겹쳐 맞춤) */}
          <text className="k2sb__lte" transform="translate(314.65 34.3) scale(0.86 1)">
            LTE
          </text>
          {/* 배터리: 몸통 둥근 4, 잔량만큼 왼쪽부터 채움(오른끝은 각짐), 숫자는 뚫어서 밑 화면이 보임 */}
          <mask id={maskId} maskUnits="userSpaceOnUse" x="338" y="21" width="27" height="16">
            <rect x={BATT.x} y={BATT.y} width={BATT.w} height={BATT.h} rx="4" fill="#fff" />
            <text className="k2sb__num" x={numX} y="33.31" textAnchor="middle" fill="#000">
              {level}
            </text>
          </mask>
          <g mask={`url(#${maskId})`}>
            <rect className="k2sb__empty" x={BATT.x} y={BATT.y} width={BATT.w} height={BATT.h} />
            <rect className={level <= 20 ? "k2sb__low" : undefined} x={BATT.x} y={BATT.y} width={(BATT.w * level) / 100} height={BATT.h} />
          </g>
          <path className="k2sb__cap" d="M364 27.63A1.35 1.455 0 0 1 364 30.54Z" />
        </g>
      </svg>
    </div>
  );
}

// 시각 옆 칸: chrome.ts setK2Indicator 로 정한 것, 아니면 앱이 켜진 때부터 파란 위치 표시 → 화살표 (critic.md §2.1 · C7)
function SbIndicator() {
  const forced = useK2Indicator();
  const launchAt = useLaunchAt();
  if (forced === "moon") return <SbMoon />;
  if (forced === "bubble") return <SbBubble />;
  if (forced === "arrow" || launchAt === null) return <SbArrow />;
  return <SbLaunchIndicator key={launchAt} at={launchAt} />;
}
// 켜진 때 기준으로 CSS 애니메이션을 그 자리부터 (음수 지연) — 4.3초 지난 뒤면 화살표만
function SbLaunchIndicator({ at }: { at: number }) {
  const [delay] = useState(() => at - performance.now());
  if (delay < -LAUNCH.arrowShown) return <SbArrow />;
  const style = { animationDelay: `${delay}ms` };
  return (
    <>
      <g className="k2sb__bubble" style={style}>
        <SbBubble />
      </g>
      <g className="k2sb__arrow-in" style={style}>
        <SbArrow />
      </g>
    </>
  );
}
const SbArrow = () => <path d={K2_ARROW_PATH} stroke="currentColor" strokeWidth={K2_ARROW_ROUND} strokeLinejoin="round" fill="currentColor" />;
const SbBubble = () => (
  <>
    <circle cx="81.93" cy="29.31" r="8" fill="#0187ff" />
    <path d={K2_ARROW_PATH} transform={K2_BUBBLE_ARROW} fill="#fff" stroke="#fff" strokeWidth={K2_ARROW_ROUND} strokeLinejoin="round" />
  </>
);
function SbMoon() {
  const id = useId();
  const m = K2_MOON;
  return (
    <g className="k2sb__moon">
      <mask id={id} maskUnits="userSpaceOnUse" x="75" y="23" width="13" height="14">
        <circle cx={m.cx} cy={m.cy} r={m.r} fill="#fff" />
        <circle cx={m.cutX} cy={m.cutY} r={m.cutR} fill="#000" />
      </mask>
      <circle cx={m.cx} cy={m.cy} r={m.r} fill="currentColor" mask={`url(#${id})`} />
    </g>
  );
}

// 다이나믹 아일랜드: 화면 녹화 중(녹화 인트로를 켰거나 지금 녹화 중)이면 녹화 아이폰처럼 넓어지고(171.83 × 36.77, 가운데에서 왼쪽으로 치우침)
// 왼쪽에 빨간 점이 1.5초 주기로 밝아졌다 어두워짐 (k2-rec, 위상은 intro.ts syncBlink). 아니면 보통 아일랜드 126 × 37.33
export function K2Island({ recording }: { recording: boolean }) {
  const intro = useIntro();
  const rec = intro || recording;
  return <div className={`dynamic-island${rec ? " dynamic-island--k2rec" : ""}`}>{rec && <K2RecDot />}</div>;
}
function K2RecDot() {
  const epoch = useBlinkEpoch();
  return <K2RecDotAt key={epoch} epoch={epoch} />;
}
function K2RecDotAt({ epoch }: { epoch: number }) {
  const [delay] = useState(() => -((performance.now() - epoch) % BLINK_MS));
  return <i className="k2-rec" style={{ animationDelay: `${delay}ms` }} />;
}

// 홈 인디케이터: 앱이 켜진 직후에만 (흰색, 0.70 → 1.15초 나타남 · 1.902 → 2.168초 사라짐), 그 뒤로는 늘 숨김 (device.md §6)
export function K2HomeIndicator() {
  const at = useLaunchAt();
  return at === null ? null : <K2HomeIndicatorAt key={at} at={at} />;
}
function K2HomeIndicatorAt({ at }: { at: number }) {
  const [delay] = useState(() => at - performance.now());
  if (delay < -LAUNCH.homeIndicatorGone) return null;
  return <div className="phone__home-indicator phone__home-indicator--k2" style={{ animationDelay: `${delay}ms` }} />;
}
