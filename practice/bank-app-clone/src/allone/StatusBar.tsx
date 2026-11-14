// NH올원뱅크 상태바 (녹화 아이폰 393 × 852, PhoneFrame 이 ALLONE 일 때 그림). kakao2 K2StatusBar 를 옮겨 와 올원 녹화에 맞춤 (infra.md §1.2, plan.md §3.1):
//  - 393 × 54 SVG 한 장, 화면 위에 겹친 층 (z 70). 흰 띠(0–59)는 PhoneFrame 의 .ao-band--top 이 칠함
//  - 시계 "H:MM" Pretendard 600 16.2, 잉크 가운데 x 60.0 (옆 표시 없음 — 위치 화살표 · 달 없음), 기준선 34.97
//  - 신호: 막대 4칸 (폭 3, x 292.09 / 297.09 / 302.08 / 307.08, 아래끝 30.64, 위끝 26.64 / 25.98 / 24.31 / 22.65), 모두 채움
//          (kakao2 K2StatusBar 와 같은 모양 — 점 4개짜리 듀얼 SIM 표시는 안 그림)
//  - LTE 잉크 316.07–334.39 × 24.98–34.30 (K2 와 같은 글꼴 · 배율, +1.0)
//  - 배터리 몸통 340.72–364.36 × 22.65–35.64, 잔량/100 만큼 왼쪽부터 채움, 빈 칸 .333, 꼭지 365.36–366.69, 숫자는 뚫어서 가운데 352.54
// 글자색: 화면의 useStatusBar fg, 네이티브 막이 덮어쓰면 그 값 (statusFg.ts — 아이콘 · 시계 따로 지연 · 길이, 부른 때부터 잼)
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
const BATT = { x: 340.72, y: 22.65, w: 23.64, h: 12.99, numX: 352.54, numY: 33.31 };

const NO_DELAY: AoStatusFgState["timing"] = { iconsDelay: 0, iconsMs: 0, clockDelay: 0, clockMs: 0, easing: "linear" };
const COLOR: Record<AoFg, string> = { dark: "#000000", light: "#ffffff" };
const EMPTY_OPACITY: Record<AoFg, number> = { dark: 0.333, light: 0.46 }; // allone.css .ao-sb__empty
const CAP_OPACITY: Record<AoFg, number> = { dark: 0.31, light: 0.43 }; // allone.css .ao-sb__cap

export function AlloneStatusBar() {
  const style = useStatusBarStyle();
  const ov = useAoStatusFg();
  const target: AoFg = ov.fg ?? style.fg;
  const now = useNow();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  const { battery } = useDeviceStatus();
  const level = Math.max(0, Math.min(100, battery));
  const maskId = useId();

  // 글자색은 같은 커밋에 바로 target 클래스로 바꾸고, 지연 · 길이는 Web Animations 로 옛 색을 붙잡았다가 바꿈 — 시작 시각(startTime)을
  // setAoStatusFg 를 부른 때로 박으므로 타이머 · React 의 그리기 차례 · 프레임 위상과 상관없이 "부른 때 + 지연" 에 정확히 (T7 +600 / +667, 인트로 D+100).
  // 아이콘 · 시계를 따로. 덮어쓰기를 풀었는데(null) 화면 fg 가 조금 뒤에 바뀌는 경우(0.5초 안의 첫 번째)도 그 지연 · 길이로, 시각은 바뀐 때부터.
  // 그 밖의 화면 fg 바뀜은 한 프레임에
  const icons = useRef<SVGGElement>(null);
  const clockEl = useRef<SVGTextElement>(null);
  const empty = useRef<SVGRectElement>(null);
  const cap = useRef<SVGPathElement>(null);
  const seen = useRef(ov.seq);
  const applied = useRef<AoFg>(target);
  const pending = useRef<{ timing: AoStatusFgState["timing"]; until: number } | null>(null);
  const anims = useRef<Animation[]>([]);
  useEffect(() => () => anims.current.forEach((a) => a.cancel()), []);
  useLayoutEffect(() => {
    const t0 = performance.now();
    let at = t0;
    if (seen.current !== ov.seq) {
      seen.current = ov.seq;
      pending.current = { timing: ov.timing, until: t0 + 500 };
      at = ov.at; // 덮어쓰기와 같은 커밋에 바뀜 → 부른 때부터
    }
    if (target === applied.current) return;
    const from = applied.current;
    applied.current = target;
    const t = pending.current && t0 <= pending.current.until ? pending.current.timing : NO_DELAY;
    pending.current = null;
    // 아직 움직이는 중이면 지금 보이는 색에서 이어감
    const running = anims.current.filter((a) => a.playState === "running");
    const live = (el: Element | null, prop: "color" | "fill") => (el && running.length ? getComputedStyle(el)[prop] : COLOR[from]);
    const fromIcons = live(icons.current, "color");
    const fromClock = live(clockEl.current, "fill");
    anims.current.forEach((a) => a.cancel());
    anims.current = [];
    const hold = (el: Element | null, frames: Keyframe[], delay: number, duration: number) => {
      if (!el?.animate || (delay <= 0 && duration <= 0)) return;
      // fill "backwards": 지연 동안 옛 값, 끝나면 클래스(새 값)
      const a = el.animate(frames, { delay, duration, easing: duration > 0 ? t.easing : "linear", fill: "backwards" });
      a.startTime = at;
      anims.current.push(a);
    };
    hold(icons.current, [{ color: fromIcons }, { color: COLOR[target] }], t.iconsDelay, t.iconsMs);
    hold(empty.current, [{ fillOpacity: EMPTY_OPACITY[from] }, { fillOpacity: EMPTY_OPACITY[from] }], t.iconsDelay, 0);
    hold(cap.current, [{ fillOpacity: CAP_OPACITY[from] }, { fillOpacity: CAP_OPACITY[from] }], t.iconsDelay, 0);
    hold(clockEl.current, [{ fill: fromClock }, { fill: COLOR[target] }], t.clockDelay, t.clockMs);
  }, [target, ov.seq, ov.timing, ov.at]);

  const clock = useInk(time, CLOCK_FONT);
  const num = useInk(String(level), NUM_FONT);
  const clockX = clock ? CLOCK_X - (clock.r - clock.l) / 2 : CLOCK_X;
  const numX = num ? BATT.numX - (num.r - num.l) / 2 : BATT.numX;

  return (
    <div className={`statusbar statusbar--${target} ao-sb ao-sb--icons-${target} ao-sb--clock-${target}`}>
      <svg className="ao-sb__svg" width="393" height="54" viewBox="0 0 393 54" aria-hidden>
        <text ref={clockEl} className="ao-sb__clock" x={clockX} y={CLOCK_Y} textAnchor="middle">
          {time}
        </text>
        <g ref={icons} className="ao-sb__icons" fill="currentColor">
          {/* 신호 막대 4칸 (kakao2 와 같은 모양) */}
          {COLS.map((x, i) => (
            <rect key={`b${x}`} x={x} y={BAR_TOPS[i]} width="3" height={(BAR_BOTTOM - BAR_TOPS[i]).toFixed(2)} rx="0.75" />
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
            <rect ref={empty} className="ao-sb__empty" x={BATT.x} y={BATT.y} width={BATT.w} height={BATT.h} />
            <rect className={level <= 20 ? "ao-sb__low" : undefined} x={BATT.x} y={BATT.y} width={(BATT.w * level) / 100} height={BATT.h} />
          </g>
          <path ref={cap} className="ao-sb__cap" d="M365.36 27.32A1.33 1.64 0 0 1 365.36 30.6Z" />
        </g>
      </svg>
    </div>
  );
}
