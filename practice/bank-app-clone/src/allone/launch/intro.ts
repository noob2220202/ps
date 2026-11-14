// NH올원뱅크 녹화 인트로 (launch.md §2.1–2.2, plan.md §1.1): 그린 아이폰 홈 화면 → all one 아이콘 누름 → 흰색으로 녹아 사라짐 (줌 아님).
// 녹화기(recorder.ts → ../intro.ts)가 부르는 약속 (plan.md §3.5):
//  showAlloneScene()             RESTART "off" 직후 — 장면이 폰 전체를 덮음 (녹화 첫 프레임). 상태바 글자 흰색
//  playAlloneIntro({ onStart })  녹화가 시작된 뒤 — 시각표를 돌림, D 에 aoSetLaunchAt(D) + 상태바 글자 → 검정(D+100 부터) + onStart()
//                                (= RESTART "start", 그 밑에 AlloneSplash 가 흰 화면으로 그려짐). 장면을 걷으면 끝나는 Promise
//                                (새 녹화에 밀려나면 onStart 없이 바로 끝남 — 이음새 ../intro.ts 가 밀려난 녹화의 onStart 를 막음)
// 시각표 (녹화 첫 프레임 t0 기준, C1 그대로): +650 아이콘 누름 (한 프레임에 색만 #034913 / #919291, 크기 그대로)
//   +900 = D 손 뗌 — 아이콘이 100ms ease-out 으로 원래 색, 장면 전체가 250ms 동안 흰색으로 (녹화에서 잰 곡선 AO_DISSOLVE_EASE)
//   D+100 상태바 글자 흰색 → 검정 (217ms, 녹화에서 잰 곡선). 누름 · 녹아 사라짐은 미리 걸어 둔 애니메이션이라 그 프레임에 DOM 변경이 없음
import { createElement } from "react";
import { aoHoldLaunch, aoSetLaunchAt } from "../launch";
import { AO_DISSOLVE_EASE, AO_INTRO } from "../motion";
import { aoNativeHost, setAoScene } from "../native";
import { setAoStatusFg } from "../statusFg";
import { AO_ICON_GREEN, AO_ICON_PRESSED_BG, AO_ICON_PRESSED_MARK } from "../ui/AppIcon";
import { sleep } from "./frame";
import { AlloneScene } from "./Scene";

// 녹화 첫 프레임 = 장면을 깐 뒤 한 프레임 지나 녹화를 시작하고(recorder.ts) 그다음 그려지는 프레임 ≈ 장면을 깐 때 + 24ms.
// 녹화기가 이 함수를 부르는 때("start" 알림 + 한 프레임)는 기기마다 늦어질 수 있어 장면을 깐 때를 기준으로 (없으면 부른 때 − 두 프레임)
const FIRST_FRAME_AFTER_SHOW = 24;
const FIRST_FRAME_LAG = 33;
// 상태바 글자 흰색 → 검정: 녹화 C1 의 시계 · LTE · 배터리 셋 다 D+100 에 움직이기 시작해 D+317 에 끝남 (motion.ts AO_INTRO.statusDelay ·
// statusMs · statusEase). 상태바는 지연을 부른 시각부터 잼 (statusFg.ts) → D 부터 지난 만큼만 뺌
// 장면을 걷는 때: 다 흰색(D+250)이 된 뒤 두 프레임 더 — 밑의 흰 시작화면이 이미 그려져 있음
const REMOVE_AFTER = AO_INTRO.dissolve + 50;

// 장면 글자(이름표 · 검색)를 미리 받아 둠 — 글꼴이 글자 묶음별로 나뉘어 있어 첫 녹화 프레임에 글자가 빠지지 않게
const SCENE_TEXT = "금융메모장날씨NH올원뱅크검색";
try {
  void document.fonts?.load('500 12px "Pretendard Variable"', SCENE_TEXT).catch(() => {});
  void document.fonts?.load('600 14px "Pretendard Variable"', "검색").catch(() => {});
} catch {
  /* 글꼴 API 가 없으면 그냥 */
}

let gen = 0; // 녹화를 다시 시작하면 이전 시각표는 멈춤
let shownAt: number | null = null; // 장면을 깐 때 (performance.now)
let anims: Animation[] = []; // 지금 장면에 걸어 둔 애니메이션
const cancelAnims = () => {
  anims.forEach((a) => a.cancel());
  anims = [];
};

export function showAlloneScene(): void {
  gen++;
  cancelAnims();
  aoHoldLaunch();
  setAoStatusFg("light");
  setAoScene(createElement(AlloneScene, { key: gen })); // 녹화마다 새 DOM
  shownAt = performance.now();
}

export async function playAlloneIntro({ onStart }: { onStart(): void }): Promise<void> {
  const my = ++gen;
  const root = aoNativeHost("scene")?.querySelector<HTMLElement>(".ao-ln-scene") ?? null;
  const now = performance.now();
  const t0 = shownAt !== null && now - shownAt < 1000 ? Math.min(now, shownAt + FIRST_FRAME_AFTER_SHOW) : now - FIRST_FRAME_LAG;
  shownAt = null;
  const D = t0 + AO_INTRO.idle + AO_INTRO.press;

  // 누름 → 손 뗌: 1000ms 짜리 애니메이션 하나로 (0–65% 원래 색, 65% 에 한 프레임에 누른 색, 90% 부터 100ms ease-out 으로 원래 색)
  const press = AO_INTRO.idle / (AO_INTRO.idle + AO_INTRO.press + AO_INTRO.release);
  const release = (AO_INTRO.idle + AO_INTRO.press) / (AO_INTRO.idle + AO_INTRO.press + AO_INTRO.release);
  const total = AO_INTRO.idle + AO_INTRO.press + AO_INTRO.release;
  const swap = (prop: string, from: string, to: string): Keyframe[] => [
    { offset: 0, [prop]: from, easing: "step-end" },
    { offset: press, [prop]: to },
    { offset: release, [prop]: to, easing: "ease-out" },
    { offset: 1, [prop]: from },
  ];
  cancelAnims();
  const arm = (el: Element | null | undefined, frames: Keyframe[], o: KeyframeAnimationOptions) => {
    if (!el?.animate) return;
    const a = el.animate(frames, { fill: "both", ...o });
    a.startTime = t0;
    anims.push(a);
  };
  arm(root?.querySelector(".ao-ln-app > svg path"), swap("fill", AO_ICON_GREEN, AO_ICON_PRESSED_BG), { duration: total });
  arm(root?.querySelector(".ao-ln-app > span"), swap("backgroundColor", "#ffffff", AO_ICON_PRESSED_MARK), { duration: total });
  // 녹아 사라짐: 장면 맨 위 흰 막이 D 부터 250ms (밑의 앱이 무엇이든 흰색으로 끝남)
  arm(root?.querySelector(".ao-ln-scene__white"), [{ opacity: 0 }, { opacity: 1 }], {
    delay: AO_INTRO.idle + AO_INTRO.press,
    duration: AO_INTRO.dissolve,
    easing: AO_DISSOLVE_EASE,
  });

  await sleep(D - performance.now());
  if (my !== gen) return; // 새 녹화에 밀려남: 이음새가 지난 녹화의 onStart 를 막음
  // D: 앱이 켜짐 (홈 인디케이터 · 시작화면 시각표가 여기서부터). 상태바 글자는 D+100 부터 217ms 동안 검정 (녹화에서 잰 곡선)
  aoSetLaunchAt(D);
  const lag = performance.now() - D;
  const delay = Math.max(0, AO_INTRO.statusDelay - lag);
  setAoStatusFg("dark", { iconsDelay: delay, iconsMs: AO_INTRO.statusMs, clockDelay: delay, clockMs: AO_INTRO.statusMs, easing: AO_INTRO.statusEase });
  onStart();

  await sleep(D + REMOVE_AFTER - performance.now());
  if (my !== gen) return; // 이미 onStart 했음 — 새 장면은 그대로 둠
  setAoScene(null);
  cancelAnims();
  // 덮어쓰기를 풂: 시작화면(AlloneSplash)의 상태바도 검정이라 바뀌는 것 없음
  setAoStatusFg(null);
}
