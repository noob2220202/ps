// kakao2 앱이 열리는 모습 (녹화 0.4167 → 0.833초, intro.md §5 · critic.md X20 간단한 판 + 상태바는 녹화대로). 녹화 인트로 영상이 끝나는 순간(H)부터 (recorder.ts):
// - 영상 속 앱 보관함을 뒤에 깔고 흐리게 · 어둡게. 상태바 줄은 바탕색으로 덮어 둠 (진짜 기기도 상태바 글자 · 아일랜드는 안 흐려짐)
// - 밑에 미리 그려 둔 홈(.phone__viewport = 앱 창)이 B 아이콘 자리에서 화면 전체로 350ms 동안 커짐 (모서리 55pt, 처음엔 어둡게).
//   처음 40ms 는 노란 B 아이콘이 창 위에 겹쳐 있다가 사라짐 (K2LaunchIcon). 홈은 녹화를 시작하기 전에 영상 밑에 다 그려 둠 (recorder.ts resumeUnder)
// - 화면 위 (시스템) 상태바는 옅어지고 앱 창 안엔 창과 함께 커지는 앱 자기 상태바 (intro.md §5.3), 316ms 에 다시 하나로.
//   시각 옆 달은 번지며 0.567초에 사라짐. 416ms 에 모서리가 각지고 뒤 그림을 걷음
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { BMark } from "../components/art";
import { setK2Indicator } from "./chrome";
import "./Launch.css";

// 앱 창 (H 기준 ms, 화면 pt): 창 왼 · 위 · 오른 · 아래, 모서리 (intro.md §5.2) + 창 속 홈의 밝기 · 배율 · 왼끝 · 위끝 — 녹화 프레임마다 잰 값.
// 0ms 는 커지기 시작한 아이콘 모양 (녹화 0.417초: 27.3 – 137 × 486 – 626). 홈은 가로 · 세로 같은 배율로 줄어 창 왼쪽 위 가까이 붙고 창 밖은 잘림
// (밝기 · 배율 · 자리는 녹화 속 통장 카드(233,201,186)의 색 · 크기 · 자리로 잼: 배율은 창 폭 / 393 보다 조금 크고 위끝은 창보다 몇 pt 아래)
type Win = [ms: number, l: number, t: number, r: number, b: number, radius: number, bright: number, scale: number, cl: number, ct: number];
const WIN: Win[] = [
  [0, 27.3, 486, 137, 626, 26, 0.46, 0.279, 27.3, 486],
  [45, 12, 224, 262, 678, 70, 0.46, 0.664, 9.4, 235.1],
  [85, 6, 142, 309, 740, 69, 0.585, 0.782, 6.1, 151.7],
  [133, 2.3, 60.6, 356, 794, 63, 0.74, 0.902, 3.2, 66.8],
  [150, 1.3, 35.3, 368, 815, 60, 0.81, 0.942, 1.9, 39.1],
  [175, 1, 24, 375.5, 820, 59.5, 0.84, 0.958, 1.3, 27.4],
  [200, 0.7, 14, 383, 834, 56.5, 0.897, 0.974, 1.1, 15.7],
  [241, 0.3, 5.3, 388, 844, 55.5, 0.952, 0.989, 1.1, 6.4],
  [283, 0.3, 2.7, 390.5, 847.3, 55, 0.985, 0.994, 1.1, 3],
  [316, 0, 0.7, 391.7, 850, 55, 0.996, 0.996, 0.7, 1],
  [350, 0, 0, 393, 852, 55, 1, 1, 0, 0],
];
// 뒤 그림 (H 기준 ms, 흐림 pt, 밝기) — intro.md §5.1
const BACK: [ms: number, blur: number, bright: number][] = [
  [0, 1.3, 0.92],
  [45, 10, 0.69],
  [85, 16, 0.62],
  [133, 18, 0.54],
  [175, 18, 0.5],
  [200, 18, 0.48],
  [416, 18, 0.45],
];
export const K2_LAUNCH_MS = 416; // 모서리가 각지고 뒤 그림을 걷는 때 (녹화 0.833초)
// 화면 위 상태바 (H 기준 ms, 투명도, intro.md §5.3): 0.400초부터 옅어져 0.633초에 없음. 그동안 앱 창 안의 상태바(창과 함께 커짐)가 보이다가
// SB_BACK 에 다시 화면 위 상태바 하나로 (창이 0.997 배 · 위끝 0.7pt 라 1pt 안쪽으로 겹치고, 위치 표시가 나타나기 시작하는 때)
const SB: [ms: number, opacity: number][] = [
  [-17, 1],
  [0, 0.92],
  [45, 0.87],
  [85, 0.77],
  [133, 0.57],
  [150, 0.45],
  [175, 0.36],
  [200, 0.08],
  [216, 0],
];
const SB_BACK = 316;
// 달 (H 기준 ms, 상태바 투명도에 곱하는 투명도 · 번짐 pt): 녹화 속 달 투명도 .86 · .68 · .44 · .15 · 0 (0.417 – 0.567초) 를 상태바 투명도로 나눈 값.
// 사라지며 번짐 (녹화 0.46 – 0.55초)
const MOON: [ms: number, opacity: number, blur: number][] = [
  [-17, 1, 0],
  [0, 0.93, 0.5],
  [45, 0.78, 1],
  [85, 0.57, 1.6],
  [133, 0.26, 2],
  [150, 0, 2],
];
const MOON_MS = 150; // 달이 다 사라진 뒤 시각 옆 칸을 위치 표시(launch.ts 시각표)로 넘김
const HOME_BG = "#1f1f1f"; // kakao2 홈 바탕 (창 자체 바탕)
const PAD = 54; // 흐린 뒤 그림 가장자리가 검게 번지지 않게 사방으로 늘여 둔 폭 (pt, 흐림 18 의 3배)
const SB_ROW = 57; // 이 줄(pt, 아일랜드 아래끝 48 과 '앱 보관함' 검색칸 사이 평평한 회색)을 늘여 상태바 줄을 덮음
const FW = 393;
const FH = 852;

// 녹화 인트로 (recorder.ts). 녹화를 시작하기 전, 홈을 영상(맨 위) 밑에 다 그려 둔 뒤 prepareK2Launch: 열리는 모습의 첫 모습(B 아이콘 자리의
// 작은 창)을 깔아 둠 — 뒤 그림 캔버스(영상 첫 장면)를 넣고 앱 창 움직임을 먼 훗날 시작으로 걸어 둠 (밑에 미리 그려 둠).
// 영상은 0.999 로 아주 조금 비치게: 완전히 가려진 층은 크롬이 그려 두지 않음.
// 영상이 끝나기 0.1초 전 arm(at): 영상 숨기기 · 뒤 그림 · 앱 창 · B 아이콘 · 녹화 점 · 달을 모두 at(앱이 켜진 때 H, launch.ts 와 같은 시각)에
// 시작하도록 걸어 둠 → H 프레임엔 DOM · React 변경이 없고 걸어 둔 애니메이션이 한 칸 나아갈 뿐 (앱 창 clip-path · 뒤 그림 blur 는 크롬이
// 컴포지터로 못 돌려 메인 스레드에서 돎 — 매 프레임 가벼움). 영상을 H 에 DOM 에서 걷으면 그 변경이 녹화에 2~3장 늦게 찍혀 마지막 장면이
// 그만큼 더 남았음 (시험 녹화). start(): H 무렵, 416ms 뒤 모두 걷고 끝
export function prepareK2Launch(phone: HTMLElement, video: HTMLVideoElement) {
  const viewport = phone.querySelector<HTMLElement>(".phone__viewport");
  const d = document.documentElement.dataset;
  const timing: KeyframeAnimationOptions = { duration: K2_LAUNCH_MS, fill: "both" };
  // at 전에는 아무 효과 없이 (뒤 그림 흐림을 영상 밑에서 미리 계산하지 않게)
  const from: KeyframeAnimationOptions = { duration: K2_LAUNCH_MS, fill: "forwards" };
  const anims: Animation[] = [];
  const begin = (a: Animation | undefined, t: number) => {
    if (!a) return;
    a.startTime = t;
    anims.push(a);
  };
  video.style.opacity = "0.999";
  // 앱 보관함: 영상 첫 장면을 캔버스에 옮겨 그려 앱 창 밑에. 끝 장면(0.400초)과는 시계 앱 초침만 달라서(흐려지면 안 보임) 다시 그리지 않음.
  // 못 그리면 영상 그대로 뒤 그림으로
  const canvas = document.createElement("canvas");
  const back = drawBackdrop(canvas, video) ? canvas : null;
  if (back) {
    back.className = "k2-launch-bg";
    phone.appendChild(back);
  }
  // 앱 창: 지금부터 첫 모습. 시작 시각은 arm 에서. 줄인 홈 위끝이 창 위끝보다 몇 pt 아래라 그 틈은 창 위로 삐져나온 홈 바탕색 띠로 채움
  // (그동안 창은 넘침을 자르지 않음 — clip-path 가 자름. 창 자체 바탕도 같은 색: 줄인 홈 위끝에 밝은 바탕이 섞인 줄이 생기지 않게).
  // 창 내용 어둡게는 창 안 맨 위 검은 막(1 − 밝기)으로 — 창 안 상태바는 녹화처럼 그 위라 밝음. 매 프레임 다시 칠할 것이 없음
  const win = viewport?.animate(windowFrames(viewport.offsetWidth / FW, viewport.offsetHeight / FH), timing);
  const dim = viewport ? document.createElement("div") : null;
  const gap = viewport ? document.createElement("div") : null;
  if (viewport && dim && gap) {
    Object.assign(viewport.style, { background: HOME_BG, overflow: "visible" });
    gap.className = "k2-launch-gap";
    dim.className = "k2-launch-dim";
    viewport.append(gap, dim);
  }
  const dimAnim = dim?.animate(
    WIN.map(([ms, , , , , , br]) => ({ offset: ms / K2_LAUNCH_MS, opacity: 1 - br })),
    timing,
  );
  // 상태바: 지금 모습(시각 · 달 · 배터리)을 베껴 앱 창 맨 위(어둡게 하는 막 위)에 미리 깔아 둠 (녹화 속 창 안 상태바는 어두워진 창 내용과 달리
  // 밝음). 화면 위 상태바가 옅어지는 동안 보이다가 SB_BACK 에 한 프레임에 다시 화면 위 상태바로 (arm)
  const sb = phone.querySelector<HTMLElement>(".phone > .statusbar");
  const inner = sb && viewport ? copyStatusBar(sb) : null;
  if (viewport && inner) viewport.appendChild(inner);
  const innerAnim = inner?.animate([{ opacity: 1 }, { opacity: 1, offset: 1 - 1 / SB_BACK }, { opacity: 0 }], { duration: SB_BACK, fill: "forwards" });
  const [s0] = SB[0];
  const sbFade = inner ? sb?.animate([...SB, [SB_BACK, 0]].map(([ms, opacity]) => ({ offset: (ms - s0) / (SB_BACK - s0), opacity })), SB_BACK - s0) : undefined;
  const later = performance.now() + 600_000;
  [win, dimAnim, innerAnim, sbFade].forEach((a) => begin(a, later));

  let at = 0;
  let over = false;
  let moon = 0;
  const end = () => {
    if (over) return;
    over = true;
    clearTimeout(moon);
    setK2Indicator(null);
    anims.forEach((a) => a.cancel());
    inner?.remove();
    dim?.remove();
    gap?.remove();
    if (viewport) Object.assign(viewport.style, { background: "", overflow: "" });
    back?.remove();
    video.remove();
    setIconAt(null);
    delete d.k2Launch;
  };
  return {
    // 영상이 끝나기 0.1초 전: 앱이 켜질 때가 정해짐 → 모든 움직임을 그때 시작하도록. 우리 신호 · LTE · 아일랜드도 지금부터 영상 위에
    // (영상 속 것과 같은 자리 · 같은 모양이라 겹쳐도 안 보임 — H 에 한꺼번에 바꾸면 늦게 찍힘, chrome.css [data-k2-launch])
    arm: (t: number) => {
      at = t;
      d.k2Launch = "arm";
      [win, dimAnim, innerAnim].forEach((a) => a && (a.startTime = at));
      if (sbFade) sbFade.startTime = at + s0; // 화면 위 상태바: 옅어지다 SB_BACK 에 창 안 상태바와 한 프레임에 바뀜
      const backFrames = BACK.map(([ms, blur, br]) => ({ offset: ms / K2_LAUNCH_MS, filter: `blur(${blur}px) brightness(${br})` }));
      if (back) {
        begin(video.animate([{ opacity: 0 }, { opacity: 0 }], from), at);
        begin(back.animate(backFrames, from), at);
      } else begin(video.animate(backFrames, from), at); // 캔버스가 없으면 start() 에서 영상을 뒤로
      // 아일랜드 녹화 점: 녹화가 막 시작돼 번져 보이던 점(H 에 13.7pt)이 200ms 동안 12pt 로
      begin(phone.querySelector(".k2-rec")?.animate([{ scale: "1.13" }, { scale: "1" }], { duration: 200, easing: "ease-out", fill: "backwards" }), at);
      // 달: 녹화 0.400 → 0.567초에 번지며 사라짐 (창 안 상태바의 달은 같은 빠르기로 옅어지기만). 다 사라지면 시각 옆 칸을 위치 표시로
      const [m0] = MOON[0];
      const moonLen = MOON[MOON.length - 1][0] - m0;
      const moonFrames = MOON.map(([ms, opacity, blur]) => ({ offset: (ms - m0) / moonLen, opacity, filter: `blur(${blur}px)` }));
      begin(sb?.querySelector(".k2sb__moon")?.animate(moonFrames, { duration: moonLen, fill: "forwards" }), at + m0);
      const innerMoon = MOON.map(([ms, opacity]) => ({ offset: (ms - m0) / moonLen, opacity }));
      begin(inner?.querySelector(".k2sb__moon")?.animate(innerMoon, { duration: moonLen, fill: "forwards" }), at + m0);
      moon = window.setTimeout(() => setK2Indicator(null), Math.max(0, at + MOON_MS - performance.now()));
      // 노란 B 아이콘
      flushSync(() => setIconAt(at));
    },
    // H 무렵 (영상이 끝남): 416ms 에 앱 창 모서리가 각지면 뒤 그림 · 영상을 걷음
    start: () => {
      d.k2Launch = "on";
      if (!back) video.style.zIndex = "-1"; // 가장자리는 조금 어둡게 번짐
      if (win) win.finished.then(end, end);
      else setTimeout(end, Math.max(0, at + K2_LAUNCH_MS - performance.now()));
    },
  };
}

// 창 위치를 앱 창(.phone__viewport, 기준 393 × 852) 변환으로: 홈을 배율만큼 줄여 (cl, ct) 에 두고, 창 사각형(모서리 radius)만 보이게 자름.
// 자르는 사각형은 줄인 홈 좌표 (창이 홈 위끝보다 위로 나오면 음수 — 그 틈은 창 안 위로 삐져나온 띠, Launch.css .k2-launch-gap)
function windowFrames(kx: number, ky: number): Keyframe[] {
  const f = (n: number) => n.toFixed(2);
  const frames = WIN.map(([ms, l, t, r, b, radius, , sc, cl, ct]) => ({
    offset: ms / K2_LAUNCH_MS,
    transformOrigin: "0 0",
    transform: `translate(${f(cl * kx)}px, ${f(ct * ky)}px) scale(${sc})`,
    clipPath: `inset(${f((ky * (t - ct)) / sc)}px ${f(kx * (FW - (r - cl) / sc))}px ${f(ky * (FH - (b - ct) / sc))}px ${f((kx * (l - cl)) / sc)}px round ${f(radius / sc)}px)`,
  }));
  // 416ms 에 모서리가 각짐 (끝 모습으로 남겨 두어 걷기 전 프레임부터 각지게)
  const last = frames[frames.length - 1];
  return [...frames, { ...last, offset: 1 - 1 / K2_LAUNCH_MS }, { ...last, offset: 1, clipPath: "inset(0px 0px 0px 0px round 0px)" }];
}

// 앱 창 안 상태바: 지금 상태바 SVG 를 베낀 것 (마스크 id 는 겹치지 않게 바꿈). 색은 상태바와 같은 k2sb 글자색 클래스로 (Launch.css)
function copyStatusBar(sb: HTMLElement) {
  const svg = sb.querySelector("svg")?.cloneNode(true) as SVGSVGElement | undefined;
  if (!svg) return null;
  svg.querySelectorAll("[id]").forEach((el) => {
    const ref = `url(#${el.id})`;
    el.id += "-k2l";
    svg.querySelectorAll("[mask]").forEach((m) => m.getAttribute("mask") === ref && m.setAttribute("mask", `url(#${el.id})`));
  });
  const bar = document.createElement("div");
  bar.className = ["k2-launch-sb", ...[...sb.classList].filter((c) => c.startsWith("k2sb"))].join(" ");
  bar.appendChild(svg);
  return bar;
}

// 영상 지금 장면 → 사방 PAD 만큼 가장자리를 늘인 캔버스. 상태바 줄(위 SB_ROW pt)은 그 아래 한 줄을 늘여 바탕색으로. 못 그리면 false
function drawBackdrop(c: HTMLCanvasElement, video: HTMLVideoElement) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;
  const k = vw / FW;
  const p = Math.round(PAD * k);
  if (c.width !== vw + 2 * p) c.width = vw + 2 * p;
  if (c.height !== vh + 2 * p) c.height = vh + 2 * p;
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  ctx.imageSmoothingEnabled = true;
  try {
    ctx.drawImage(video, p, p, vw, vh);
  } catch {
    return false;
  }
  ctx.imageSmoothingEnabled = false;
  const row = Math.round(SB_ROW * k);
  ctx.drawImage(c, p, p + row, vw, 1, p, p, vw, row);
  ctx.drawImage(c, p, p, 1, vh, 0, p, p, vh);
  ctx.drawImage(c, p + vw - 1, p, 1, vh, p + vw, p, p, vh);
  ctx.drawImage(c, 0, p, c.width, 1, 0, 0, c.width, p);
  ctx.drawImage(c, 0, p + vh - 1, c.width, 1, 0, p + vh, c.width, p);
  return true;
}

// ---------- 노란 B 아이콘: 앱 창 첫 45ms 자리를 따라 커지며 40ms 동안 사라짐 (PhoneFrame 이 그림) ----------
let iconAt: number | null = null;
const iconListeners = new Set<() => void>();
const setIconAt = (v: number | null) => {
  iconAt = v;
  iconListeners.forEach((fn) => fn());
};
const subscribeIcon = (fn: () => void) => (iconListeners.add(fn), () => void iconListeners.delete(fn));

export function K2LaunchIcon() {
  const at = useSyncExternalStore(subscribeIcon, () => iconAt);
  return at === null ? null : <LaunchIcon key={at} at={at} />;
}
function LaunchIcon({ at }: { at: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    const kx = el.parentElement!.clientWidth / FW;
    const ky = el.parentElement!.clientHeight / FH;
    // 자리 · 크기는 0ms 아이콘 그대로 두고 45ms 창까지 transform 으로 (컴포지터에서 돌게)
    const [[, l0, t0, r0, b0], [, l1, t1, r1, b1]] = WIN;
    const move = el.animate(
      [{ transform: "none" }, { transform: `translate(${(l1 - l0) * kx}px, ${(t1 - t0) * ky}px) scale(${(r1 - l1) / (r0 - l0)}, ${(b1 - t1) / (b0 - t0)})` }],
      { duration: 45, fill: "both" },
    );
    const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 40, fill: "both" });
    move.startTime = at;
    fade.startTime = at;
    fade.finished.then(() => setIconAt(null), () => {});
    return () => {
      move.cancel();
      fade.cancel();
    };
  }, [at]);
  // 녹화 0.417초: B 51.6 × 64.6pt, 가운데가 아이콘 폭 52.7% · 높이 40.9% (아이콘이 아래로 늘어나서 위쪽에 붙음)
  const [, l, t, r, b, radius] = WIN[0];
  return (
    <div
      className="k2-launch-icon"
      ref={ref}
      style={{ left: `${(l / FW) * 100}%`, top: `${(t / FH) * 100}%`, width: `${((r - l) / FW) * 100}%`, height: `${((b - t) / FH) * 100}%`, borderRadius: radius }}
    >
      <BMark size={51.6} color="#212020" hole="#d2b70b" />
    </div>
  );
}
