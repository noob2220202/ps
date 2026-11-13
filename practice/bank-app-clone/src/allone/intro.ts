// NH올원뱅크 녹화 인트로 이음새 (recorder.ts 가 부름). 장면 자체 · 시각표는 launch 영역 (src/allone/launch/intro.ts) — 영상이 아니라 그린 장면.
//  녹화기 순서: prepareAlloneIntro() (글꼴 · 워드마크 그림을 다 받음) → RESTART "off" → showAlloneIntro() → 한 프레임 → recorder.start()
//              → 녹화 첫 프레임을 받은 뒤 한 프레임 → keepCapturing · syncBlink → await runAlloneIntro(onStart)
//  onStart = RESTART "start" (그 밑에 AlloneSplash 가 흰 화면으로 그려짐). D(앱이 켜진 때)는 인트로가 aoSetLaunchAt 으로 정하고, 안 정했으면 여기서
import { localAsset } from "../assets/Asset";
import { aoHoldLaunch, aoLaunchHeld, aoSetLaunchAt } from "./launch";
import { playAlloneIntro, showAlloneScene } from "./launch/intro";

// 녹화 점(k2-rec, 1.5초 주기) 위상: 가장 어두운 때(82.5%)가 녹화 0.62초에 오게 (launch.md §2.3) — 녹화 시작 직후 syncBlink 에 넘김
export const AO_INTRO_BLINK_ON_MS = 618;

const timeout = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

// 녹화 첫 프레임에 글자 · 워드마크가 빠지지 않게: 글꼴 + allone-wordmark.png 를 다 받을 때까지 (늦어도 3초)
export function prepareAlloneIntro(): Promise<void> {
  const fonts = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  const url = localAsset("allone-wordmark");
  const mask = url
    ? new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
        img.decode?.().then(resolve, resolve);
      })
    : Promise.resolve();
  return Promise.race([Promise.all([fonts, mask]).then(() => undefined), timeout(3000)]);
}

// RESTART "off" 직후: 장면이 폰 전체를 덮음 (홈 인디케이터는 D 까지 멈춤)
export function showAlloneIntro() {
  aoHoldLaunch();
  showAlloneScene();
}

// 녹화가 시작된 뒤: 장면을 돌리고 D 에 onStart. 장면이 다 사라지면 끝
export function runAlloneIntro(onStart: () => void): Promise<void> {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    if (aoLaunchHeld()) aoSetLaunchAt();
    onStart();
  };
  return playAlloneIntro({ onStart: start })
    .catch(() => {})
    .then(start); // 인트로가 onStart 를 안 부르고 끝나도 앱은 켬
}
