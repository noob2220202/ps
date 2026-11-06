// kakao2 앱이 열리는 모습 (녹화 0.4167 → 0.833초, intro.md §5 · critic.md X20 간단한 판). 녹화 인트로 영상이 끝나는 순간(H)부터 (recorder.ts):
// - 영상 마지막 장면(앱 보관함)을 뒤에 깔고 흐리게 · 어둡게. 상태바 줄은 바탕색으로 덮어 둠 (진짜 기기도 상태바 글자 · 아일랜드는 안 흐려짐)
// - 밑에 미리 그려 둔 홈(.phone__viewport = 앱 창)이 B 아이콘 자리에서 화면 전체로 350ms 동안 커짐 (모서리 55pt, 처음엔 어둡게).
//   처음 40ms 는 노란 B 아이콘이 창 위에 겹쳐 있다가 사라짐 (K2LaunchIcon)
// - 상태바는 커지지 않고 그대로, 시각 옆 달만 0.4 → 0.6초에 사라짐 (chrome.css [data-k2-launch]). 416ms 에 모서리가 각지고 뒤 그림을 걷음
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
const MOON_MS = 200; // 달이 다 사라진 뒤 시각 옆 칸을 위치 표시(launch.ts 시각표)로 넘김
const PAD = 54; // 흐린 뒤 그림 가장자리가 검게 번지지 않게 사방으로 늘여 둔 폭 (pt, 흐림 18 의 3배)
const SB_ROW = 57; // 이 줄(pt, 아일랜드 아래끝 48 과 '앱 보관함' 검색칸 사이 평평한 회색)을 늘여 상태바 줄을 덮음
const FW = 393;
const FH = 852;

// 녹화 인트로 영상이 끝나기 0.1초 전 (recorder.ts): 열리는 모습을 영상(맨 위) 밑에 미리 다 깔아 둠 — 뒤 그림 캔버스를 넣고, 앱 창 · 뒤 그림 · B 아이콘 ·
// 녹화 점 움직임을 at(앱이 켜진 때, launch.ts 와 같은 시각)에 시작하도록 걸어 둠 (그 전엔 첫 모습). H 에 한꺼번에 하면 그 프레임이 늦게 그려졌음.
// 마지막 장면이 나오면 frame() 으로 뒤 그림을 그 장면으로, H 반 프레임 전에 start() 로 영상을 걷음 → 416ms 뒤 모두 걷고 끝
export function prepareK2Launch(phone: HTMLElement, video: HTMLVideoElement, at: number) {
  const viewport = phone.querySelector<HTMLElement>(".phone__viewport");
  const d = document.documentElement.dataset;
  const backFrames = BACK.map(([ms, blur, br]) => ({ offset: ms / K2_LAUNCH_MS, filter: `blur(${blur}px) brightness(${br})` }));
  const timing: KeyframeAnimationOptions = { duration: K2_LAUNCH_MS, fill: "both" };
  const anims: Animation[] = [];
  const begin = (a: Animation | undefined) => {
    if (!a) return;
    a.startTime = at;
    anims.push(a);
  };
  // 앱 보관함: 영상 장면을 캔버스에 옮겨 그려 앱 창 밑에 (못 그리면 H 에 영상 그대로 뒤로)
  const canvas = document.createElement("canvas");
  const back = drawBackdrop(canvas, video) ? canvas : null;
  if (back) {
    back.className = "k2-launch-bg";
    phone.appendChild(back);
    begin(back.animate(backFrames, timing));
  }
  const win = viewport?.animate(windowFrames(viewport.offsetWidth / FW, viewport.offsetHeight / FH), timing);
  begin(win);
  // 아일랜드 녹화 점: 녹화가 막 시작돼 번져 보이던 점(H 에 13.7pt)이 200ms 동안 12pt 로
  begin(phone.querySelector(".k2-rec")?.animate([{ scale: "1.13" }, { scale: "1" }], { duration: 200, easing: "ease-out", fill: "backwards" }));
  // 노란 B 아이콘
  flushSync(() => setIconAt(at));

  let over = false;
  let moon = 0;
  const end = () => {
    if (over) return;
    over = true;
    clearTimeout(moon);
    setK2Indicator(null);
    anims.forEach((a) => a.cancel());
    back?.remove();
    video.remove();
    delete d.k2Launch;
  };
  return {
    // 마지막 장면이 화면에 나옴: 뒤 그림을 그 장면으로
    frame: () => back && drawBackdrop(back, video),
    // H 반 프레임 전: 영상을 걷고(캔버스가 없으면 영상을 뒤로) 상태바 달을 지움 → 걸어 둔 움직임이 그대로 보임
    start: () => {
      d.k2Launch = "on";
      if (back) video.remove();
      else {
        video.style.zIndex = "-1"; // 가장자리는 조금 어둡게 번짐
        begin(video.animate(backFrames, timing));
      }
      moon = window.setTimeout(() => setK2Indicator(null), Math.max(0, at + MOON_MS - performance.now()));
      // 앱 창 움직임이 끝나는 때 (416ms) 모서리가 각지고 뒤 그림을 걷음
      if (win) win.finished.then(end, end);
      else setTimeout(end, Math.max(0, at + K2_LAUNCH_MS - performance.now()));
    },
  };
}

// 창 위치를 앱 창(.phone__viewport, 기준 393 × 852) 변환으로: 홈을 배율만큼 줄여 (cl, ct) 에 두고, 창 사각형(모서리 radius)만 보이게 자름.
// 자르는 사각형은 줄인 홈 좌표 (창이 홈 위끝보다 위로 나오면 음수)
function windowFrames(kx: number, ky: number): Keyframe[] {
  const f = (n: number) => n.toFixed(2);
  const frames = WIN.map(([ms, l, t, r, b, radius, br, sc, cl, ct]) => ({
    offset: ms / K2_LAUNCH_MS,
    transformOrigin: "0 0",
    transform: `translate(${f(cl * kx)}px, ${f(ct * ky)}px) scale(${sc})`,
    clipPath: `inset(${f((ky * (t - ct)) / sc)}px ${f(kx * (FW - (r - cl) / sc))}px ${f(ky * (FH - (b - ct) / sc))}px ${f((kx * (l - cl)) / sc)}px round ${f(radius / sc)}px)`,
    filter: `brightness(${br})`,
  }));
  // 416ms 에 모서리가 각짐 (끝 모습으로 남겨 두어 걷기 전 프레임부터 각지게)
  const last = frames[frames.length - 1];
  return [...frames, { ...last, offset: 1 - 1 / K2_LAUNCH_MS }, { ...last, offset: 1, clipPath: "inset(0px 0px 0px 0px round 0px)" }];
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
    const phone = el.parentElement!;
    const kx = phone.clientWidth / FW;
    const ky = phone.clientHeight / FH;
    const rect = WIN.slice(0, 2).map(([ms, l, t, r, b, radius]) => ({
      offset: ms / 45,
      left: `${l * kx}px`,
      top: `${t * ky}px`,
      width: `${(r - l) * kx}px`,
      height: `${(b - t) * ky}px`,
      borderRadius: `${radius}px`,
    }));
    const move = el.animate(rect, { duration: 45, fill: "both" });
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
  return (
    <div className="k2-launch-icon" ref={ref}>
      <BMark size={51.6} color="#212020" hole="#d2b70b" />
    </div>
  );
}
