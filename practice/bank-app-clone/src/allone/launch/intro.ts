// [기초 단계 자리 — launch 영역이 이 파일을 진짜 녹화 인트로(그린 아이폰 홈 화면 → all one 아이콘 누름 → 흰색으로 녹아 사라짐)로 바꿈]
// 녹화기(recorder.ts)가 부르는 약속 (plan.md §3.5):
//  showAlloneScene(): void          RESTART "off" 직후 — 장면이 폰 전체를 덮음 (녹화 첫 프레임). 상태바 글자 흰색
//  playAlloneIntro({ onStart })     녹화가 시작된 뒤 — 장면을 돌리고, 녹아 사라지기 시작하는 D 에 aoSetLaunchAt(D) + onStart() (= RESTART "start",
//                                   그 밑에 AlloneSplash 가 흰 화면으로 그려짐), 장면이 다 사라지면 끝나는 Promise
// 지금 자리: 무늬 없는 회색 장면 → 900ms → 250ms 동안 흰색으로
import { createElement } from "react";
import { aoHoldLaunch, aoSetLaunchAt } from "../launch";
import { AO_DISSOLVE_EASE, AO_INTRO } from "../motion";
import { setAoScene } from "../native";
import { setAoStatusFg } from "../statusFg";

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export function showAlloneScene(): void {
  aoHoldLaunch();
  setAoStatusFg("light");
  setAoScene(createElement("div", { className: "ao-stub-scene" }));
}

export async function playAlloneIntro({ onStart }: { onStart(): void }): Promise<void> {
  await sleep(AO_INTRO.idle + AO_INTRO.press);
  aoSetLaunchAt(performance.now());
  setAoStatusFg(null, { iconsDelay: AO_INTRO.statusDelay, iconsMs: AO_INTRO.dissolve, clockDelay: AO_INTRO.statusDelay, clockMs: AO_INTRO.dissolve, easing: AO_DISSOLVE_EASE });
  onStart();
  setAoScene(createElement("div", { className: "ao-stub-scene ao-stub-scene--out" }));
  await sleep(AO_INTRO.dissolve);
  setAoScene(null);
}
