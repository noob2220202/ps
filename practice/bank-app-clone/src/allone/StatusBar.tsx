// NH올원뱅크 상태바 (녹화 아이폰 393 × 852, PhoneFrame 이 ALLONE 일 때 그림). kakao2 K2StatusBar 를 옮겨 와 올원 녹화에 맞춤 (infra.md §1.2, plan.md §3.1):
//  - 393 × 54 SVG 한 장, 화면 위에 겹친 층 (z 70). 흰 띠(0–59)는 PhoneFrame 의 .ao-band--top 이 칠함
//  - 시계 "H:MM" Pretendard 600 16.2, 잉크 가운데 x 60.0 (옆 표시 없음 — 위치 화살표 · 달 없음), 기준선 34.97
//  - 신호: 듀얼 SIM — 위 4칸 막대(폭 3, x 292.09 / 297.09 / 302.08 / 307.08, 아래끝 30.64, 위끝 26.64 / 25.98 / 24.31 / 22.65)
//          + 아래 점 4개(3 × 3.67, y 31.97–35.64), 모두 채움
//  - LTE 잉크 316.07–334.39 × 24.98–34.30 (K2 와 같은 글꼴 · 배율, +1.0)
//  - 배터리 몸통 340.72–364.36 × 22.65–35.64, 잔량/100 만큼 왼쪽부터 채움, 빈 칸 .333, 꼭지 365.36–366.69, 숫자는 뚫어서 가운데 352.54
// 글자색: 화면의 useStatusBar fg, 네이티브 막이 덮어쓰면 그 값 (statusFg.ts — 아이콘 · 시계 따로 지연 · 길이)
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStatusBarStyle } from "../hooks/useStatusBar";
import { useDeviceStatus, useNow } from "../platform/deviceStatus";
import { useAoStatusFg, type AoFg, type AoStatusFgState } from "./statusFg";

// 글자 잉크 폭 (상태바 SVG 글자와 같은 글꼴, 8배로 그려 반 넘게 칠한 칸으로 잼 — kakao2 StatusBar 와 같은 방법)
type Font = readonly [weight: number, size: number];
const CLOCK_FONT: Font = [600, 16.2];
const NUM_FONT: Font = [700, 11];
const K = 8;
let ctx: CanvasRenderingContext2D | null = null;
function inkOf(text: string, [weight, size]: Font) {
  ctx ??= Object.assign(document.createElement("canvas"), { width: 1200, height: 240 }).getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.font = `${weight} ${size * K}px "Pretendard Variable"`;
  ctx.textAlign = "center";
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
function useInk(text: string, font: Font) {
  const [tick, setTick] = useState(0);
  const [weight, size] = font;
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
  return useMemo(() => inkOf(text, font), [text, font, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

const CLOCK_X = 60.0; // 시계 잉크 가운데
const CLOCK_Y = 34.97;
const COLS = [292.09, 297.09, 302.08, 307.08];
const BAR_TOPS = [26.64, 25.98, 24.31, 22.65];
const BAR_BOTTOM = 30.64;
const DOT = { y: 31.97, h: 3.67 };
const BATT = { x: 340.72, y: 22.65, w: 23.64, h: 12.99, numX: 352.54, numY: 33.31 };

type Shown = { icons: AoFg; clock: AoFg; iconsMs: number; clockMs: number; easing: string };
const NO_DELAY: AoStatusFgState["timing"] = { iconsDelay: 0, iconsMs: 0, clockDelay: 0, clockMs: 0, easing: "linear" };

export function AlloneStatusBar() {
  const style = useStatusBarStyle();
  const ov = useAoStatusFg();
  const target: AoFg = ov.fg ?? style.fg;
  const now = useNow();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  const { battery } = useDeviceStatus();
  const level = Math.max(0, Math.min(100, battery));
  const maskId = useId();

  // 아이콘 · 시계를 따로: 덮어쓰기(statusFg)가 바뀐 때는 그 지연 · 길이. 덮어쓰기를 풀었는데(null) 화면 fg 가 조금 뒤에 바뀌는 경우
  // (인트로: 덮어쓰기를 푼 다음 프레임에 AlloneSplash 가 "dark") 도 그 값으로 — 0.5초 안에 실제로 바뀌는 첫 번째에만. 그 밖의 화면 fg 바뀜은 한 프레임에
  const [shown, setShown] = useState<Shown>(() => ({ icons: target, clock: target, iconsMs: 0, clockMs: 0, easing: "linear" }));
  const seen = useRef(ov.seq);
  const applied = useRef<AoFg>(target);
  const pending = useRef<{ timing: AoStatusFgState["timing"]; until: number } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  useLayoutEffect(() => {
    const now = performance.now();
    if (seen.current !== ov.seq) {
      seen.current = ov.seq;
      pending.current = { timing: ov.timing, until: now + 500 };
    }
    if (target === applied.current) return;
    applied.current = target;
    const t = pending.current && now <= pending.current.until ? pending.current.timing : NO_DELAY;
    pending.current = null;
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    const apply = (part: "icons" | "clock", delay: number, ms: number) => {
      const fn = () =>
        setShown((s) => (part === "icons" ? { ...s, icons: target, iconsMs: ms, easing: t.easing } : { ...s, clock: target, clockMs: ms, easing: t.easing }));
      if (delay > 0) timers.current.push(window.setTimeout(fn, delay));
      else fn();
    };
    apply("icons", t.iconsDelay, t.iconsMs);
    apply("clock", t.clockDelay, t.clockMs);
  }, [target, ov.seq, ov.timing]);

  const clock = useInk(time, CLOCK_FONT);
  const num = useInk(String(level), NUM_FONT);
  const clockX = clock ? CLOCK_X - (clock.r - clock.l) / 2 : CLOCK_X;
  const numX = num ? BATT.numX - (num.r - num.l) / 2 : BATT.numX;

  return (
    <div
      className={`statusbar statusbar--${shown.icons} ao-sb ao-sb--icons-${shown.icons} ao-sb--clock-${shown.clock}`}
      style={{
        ["--ao-sb-icons-ms" as string]: `${shown.iconsMs}ms`,
        ["--ao-sb-clock-ms" as string]: `${shown.clockMs}ms`,
        ["--ao-sb-ease" as string]: shown.easing,
      }}
    >
      <svg className="ao-sb__svg" width="393" height="54" viewBox="0 0 393 54" aria-hidden>
        <text className="ao-sb__clock" x={clockX} y={CLOCK_Y} textAnchor="middle">
          {time}
        </text>
        <g className="ao-sb__icons" fill="currentColor">
          {/* 듀얼 SIM 신호: 위 막대 4칸 + 아래 점 4개 */}
          {COLS.map((x, i) => (
            <rect key={`b${x}`} x={x} y={BAR_TOPS[i]} width="3" height={(BAR_BOTTOM - BAR_TOPS[i]).toFixed(2)} rx="0.75" />
          ))}
          {COLS.map((x) => (
            <rect key={`d${x}`} x={x} y={DOT.y} width="3" height={DOT.h} rx="1" />
          ))}
          {/* LTE: 13.25px 620 을 가로 0.86 (kakao2 와 같은 글자, 1.0pt 오른쪽) */}
          <text className="ao-sb__lte" transform="translate(315.65 34.3) scale(0.86 1)">
            LTE
          </text>
          {/* 배터리: 몸통 둥근 4, 잔량만큼 왼쪽부터 채움, 숫자는 뚫어서 밑(흰 띠)이 보임 */}
          <mask id={maskId} maskUnits="userSpaceOnUse" x="339" y="21" width="28" height="16">
            <rect x={BATT.x} y={BATT.y} width={BATT.w} height={BATT.h} rx="4" fill="#fff" />
            <text className="ao-sb__num" x={numX} y={BATT.numY} textAnchor="middle" fill="#000">
              {level}
            </text>
          </mask>
          <g mask={`url(#${maskId})`}>
            <rect className="ao-sb__empty" x={BATT.x} y={BATT.y} width={BATT.w} height={BATT.h} />
            <rect className={level <= 20 ? "ao-sb__low" : undefined} x={BATT.x} y={BATT.y} width={(BATT.w * level) / 100} height={BATT.h} />
          </g>
          <path className="ao-sb__cap" d="M365.36 27.32A1.33 1.64 0 0 1 365.36 30.6Z" />
        </g>
      </svg>
    </div>
  );
}
