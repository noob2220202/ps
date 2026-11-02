// 화면 녹화: 화면을 받아서(getDisplayMedia) 폰 부분만 잘라 MediaRecorder로 녹화 → 파일 다운로드.
// 폰 아래 [● 녹화] 버튼으로 시작 → 녹화가 시작되면 앱을 처음(검은 화면 → 시작화면)부터 다시 띄워서 앱이 켜지는 모습까지 찍힘.
//
// 폰 부분만 자르는 방법:
//  1) PC 크롬/엣지 + "이 탭" 공유: Region Capture (CropTarget.fromElement(폰) → track.cropTo()). 가장 선명
//  2) 그 밖 (안드로이드 크롬은 탭이 아니라 '폰 화면 전체'가 들어옴): 화면 영상을 <video>로 받아
//     매 프레임 <canvas>에 폰 영역만 그려서 canvas 를 녹화. 안드로이드는 전체화면으로 바꿔서 화면 = 페이지가 되게 함
//     (주소창·상태바가 없어야 폰 위치를 정확히 계산할 수 있음)
// 코덱: 안드로이드 크롬의 mp4(H.264 하드웨어 인코더)는 프레임이 깨진 파일이 나와서 webm(VP9/VP8)으로 저장
import { useSyncExternalStore } from "react";
import { isCapture, setCapture } from "./capture";
import { isIntroOn, syncBlink } from "./intro";
import { setBattery, setClock } from "./deviceStatus";
import { OS } from "./platform";
import kbankIntroMp4 from "../assets/intro/kbank-open-intro.mp4";
import kbankIntroWebm from "../assets/intro/kbank-open-intro.webm";

// 케이뱅크 인트로 영상 = 녹화 cb67e5eb 3.03~5.60초 (30fps 로 고른 프레임 92~168, 77장 2.567초): 기기 홈 화면 → 금융 폴더 → K 탭 →
// 시작화면이 반쯤 밝아진 데까지. 같은 장면을 mp4(H.264 High 3.1)와 webm(VP9) 두 가지로 — H.264 를 못 트는 브라우저(오픈소스 Chromium 등)는 webm.
// 둘 다 녹화 원본에서 바로: ffmpeg -i 녹화.mp4 -vf "fps=30,trim=start_frame=91:end_frame=168,setpts=PTS-STARTPTS" -an -pix_fmt yuv420p
//   -colorspace bt709 -color_primaries bt709 -color_trc bt709 에 mp4 는 -c:v libx264 -profile:v high -level 3.1 -bf 0 -crf 20 -movflags +faststart,
//   webm 은 -c:v libvpx-vp9 -crf 24 -b:v 0 -row-mt 1. mp4 는 B 프레임 없이(-bf 0) — 있으면 첫 장면이 0.233초에서 시작해(편집 목록)
//   브라우저 시간·길이가 webm 과 달라짐. 프레임 평균 오차(녹화 30fps 프레임 대비) mp4 0.70 · webm 0.77 / 255
// 상태바 값도 영상 그대로 맞춰 둠 (영상이 끝나고 우리 상태바로 넘어갈 때 시각·배터리가 뚝 바뀌어 보이지 않게)
const INTRO = {
  sources: [
    { src: kbankIntroMp4, type: 'video/mp4; codecs="avc1.64001F"' },
    { src: kbankIntroWebm, type: 'video/webm; codecs="vp9"' },
  ],
  clock: "06:11",
  // 녹화 시계는 14.92초(영상 첫 장면 + 11.88초)에 6:11 → 6:12 (74.81초에 6:13). setClock 은 분까지라 그때 6:12 로 한 번 더 맞춤
  nextMinuteMs: 11_880,
  battery: 24,
  // 영상 끝(녹화 5.60초)에 캠코더 표시가 켜진 지: 영상 속 켜짐 2.200초(77장 중 67번째) → 끝 2.567초 = 0.37초째. 꺼짐은 녹화 5.713~5.738초 사이
  blinkOnMs: 370,
};

type State = { status: "idle" } | { status: "arming" } | { status: "recording"; startedAt: number; fullscreen: boolean; fakeCursor: boolean };

let state: State = { status: "idle" };
const listeners = new Set<() => void>();
const set = (s: State) => {
  state = s;
  const d = document.documentElement.dataset;
  if (s.status === "recording") d.recording = "on";
  else delete d.recording;
  if (s.status === "recording" && s.fakeCursor) d.fakeCursor = "on";
  else delete d.fakeCursor;
  listeners.forEach((fn) => fn());
};
export const useRecorder = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => state,
  );

export const canRecord = () => typeof navigator.mediaDevices?.getDisplayMedia === "function" && typeof MediaRecorder !== "undefined";
const MOBILE = /Android|iPhone|iPad/i.test(navigator.userAgent);

let stopCurrent: (() => void) | null = null;
export const stopRecording = () => stopCurrent?.();
// 모바일: 화면 공유를 허락한 뒤 한 번 더 누르면(전체화면은 버튼 누름 안에서만 켤 수 있어서) 시작
let armed: (() => void) | null = null;
export const beginArmed = () => armed?.();

// 녹화가 실제로 시작될 때 앱을 처음부터 다시 띄우라는 신호 (App 이 받음)
export const RESTART_EVENT = "bank:restart";

function pickFormat() {
  const mp4 = ["video/mp4;codecs=avc1", "video/mp4"];
  const webm = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  // PC: mp4 가 되면 mp4 (휴대폰·카톡에서 바로 재생). 모바일: webm (mp4 는 깨짐)
  const types = MOBILE ? [...webm, ...mp4] : [...mp4, ...webm];
  const type = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  return { type, ext: type.startsWith("video/mp4") ? "mp4" : "webm" };
}

const pad = (n: number) => String(n).padStart(2, "0");
function fileName(ext: string) {
  const d = new Date();
  return `bank-clone_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 버튼 클릭 안에서 바로 불러야 함(사용자 동작 필요). onStop: 끝나면 (저장 후)
export async function startRecording(target: HTMLElement, onStop?: () => void) {
  if (state.status !== "idle") return;
  const dpr = window.devicePixelRatio || 1;
  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      // 크기를 안 정하면 브라우저가 720p 정도로 낮춰서 줌 → 화면 원래 해상도까지 받도록 크게 요청
      video: MOBILE
        ? { frameRate: 60, width: { ideal: Math.round(screen.width * dpr) }, height: { ideal: Math.round(screen.height * dpr) } }
        : ({ frameRate: 60, width: { ideal: 3840 }, height: { ideal: 2160 }, cursor: "never" } as MediaTrackConstraints),
      audio: false,
      // 크롬: 지금 탭을 먼저 보여 주고, 다른 탭/창 대신 이 탭을 고르기 쉽게
      preferCurrentTab: true,
      selfBrowserSurface: "include",
    } as DisplayMediaStreamOptions);
  } catch {
    onStop?.(); // 사용자가 공유 창에서 취소
    return;
  }

  const [track] = display.getVideoTracks();
  const surface = track.getSettings().displaySurface;
  const isThisTab = surface === "browser";
  // Element Capture (크롬 132+): 폰 요소와 그 안쪽만 녹화 — 폰 위에 겹친 다른 요소(가짜 포인터)는 안 찍힘
  const elementCapture = isThisTab && "RestrictionTarget" in window && "restrictTo" in track;
  const regionCapture = !elementCapture && isThisTab && "CropTarget" in window && "cropTo" in track;
  const wholeScreen = surface === "monitor" || (MOBILE && !isThisTab);

  // 모바일(화면 전체): 한 번 더 눌러 전체화면으로 → 그다음 시작
  let fullscreen = false;
  if (wholeScreen && MOBILE && document.documentElement.requestFullscreen) {
    set({ status: "arming" });
    const go = await new Promise<boolean>((resolve) => {
      armed = () => resolve(true);
      track.addEventListener("ended", () => resolve(false), { once: true });
    });
    armed = null;
    if (!go) {
      set({ status: "idle" });
      onStop?.();
      return;
    }
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      fullscreen = true;
      await sleep(350); // 전체화면으로 바뀐 뒤 화면 배치가 끝날 때까지
    } catch {
      // 전체화면이 안 되면 그냥 (위치가 조금 어긋날 수 있음)
    }
  }

  let recordStream: MediaStream = display;
  let cleanupCanvas = () => {};
  let fakeCursor = false;
  if (elementCapture) {
    // 0) Element Capture: 진짜 포인터는 폰 위에서 숨기고(녹화에 찍히므로), 폰 바깥 요소로 그린 가짜 포인터를 보여 줌
    const W = window as unknown as { RestrictionTarget: { fromElement(el: Element): Promise<unknown> } };
    try {
      const restrictionTarget = await W.RestrictionTarget.fromElement(target);
      await (track as unknown as { restrictTo(t: unknown): Promise<void> }).restrictTo(restrictionTarget);
      fakeCursor = true;
    } catch {
      const W2 = window as unknown as { CropTarget?: { fromElement(el: Element): Promise<unknown> } };
      if (W2.CropTarget && "cropTo" in track) await (track as unknown as { cropTo(t: unknown): Promise<void> }).cropTo(await W2.CropTarget.fromElement(target));
    }
  } else if (regionCapture) {
    // 1) Region Capture
    const W = window as unknown as { CropTarget: { fromElement(el: Element): Promise<unknown> } };
    const cropTarget = await W.CropTarget.fromElement(target);
    await (track as unknown as { cropTo(t: unknown): Promise<void> }).cropTo(cropTarget);
  } else if (isThisTab || wholeScreen) {
    // 2) canvas 로 직접 자르기. 화면 영상 px ÷ 페이지 CSS px = k
    const video = document.createElement("video");
    video.srcObject = display;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    const draw = () => {
      const r = target.getBoundingClientRect();
      const vv = window.visualViewport;
      const vw = vv?.width ?? window.innerWidth;
      const k = video.videoWidth / (isThisTab ? window.innerWidth : vw * (vv?.scale ?? 1));
      const scale = isThisTab ? 1 : (vv?.scale ?? 1);
      const ox = isThisTab ? 0 : (vv?.offsetLeft ?? 0);
      const oy = isThisTab ? 0 : (vv?.offsetTop ?? 0);
      const w = Math.round(r.width * scale * k);
      const h = Math.round(r.height * scale * k);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.drawImage(video, (r.left - ox) * scale * k, (r.top - oy) * scale * k, w, h, 0, 0, w, h);
      frame = requestAnimationFrame(draw);
    };
    draw();
    recordStream = canvas.captureStream(60);
    cleanupCanvas = () => {
      cancelAnimationFrame(frame);
      video.srcObject = null;
    };
  }
  // 다른 탭/창을 골랐으면 자르지 않고 고른 화면 그대로 녹화

  const { type, ext } = pickFormat();
  const recorder = new MediaRecorder(recordStream, { ...(type && { mimeType: type }), videoBitsPerSecond: 16_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const onFsChange = () => !document.fullscreenElement && stopCurrent?.();
  recorder.onstop = () => {
    cleanupCanvas();
    display.getTracks().forEach((t) => t.stop());
    document.removeEventListener("fullscreenchange", onFsChange);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const blob = new Blob(chunks, { type: type || "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName(ext);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    stopCurrent = null;
    set({ status: "idle" });
    onStop?.();
  };
  stopCurrent = () => recorder.state !== "inactive" && recorder.stop();
  // 브라우저·폰의 "공유 중지"나 전체화면 나가기(뒤로가기)로 멈춰도 저장되게
  track.addEventListener("ended", () => stopCurrent?.());
  if (fullscreen) document.addEventListener("fullscreenchange", onFsChange);

  // 인트로(kbank2): 실제 기기 영상(홈 화면 → 금융 폴더 → K 탭)을 폰 위에 덮어 첫 장면까지 받아 둔 뒤 녹화 시작
  // → 녹화 첫 프레임이 영상 첫 장면 (받는 동안의 검은 화면이 녹화 앞에 붙지 않게)
  // 영상은 갤럭시 기기 화면이라 아이폰 모드(?os=ios)에선 틀지 않음
  const intro = isIntroOn() && OS === "android" ? await loadIntro(target) : null;
  // 앱을 검은 화면으로 돌려 놓고, 그 모습이 한 프레임 그려진 뒤 녹화 시작 → 시작화면부터
  window.dispatchEvent(new CustomEvent(RESTART_EVENT, { detail: "off" }));
  await nextFrame();
  const started = new Promise((r) => recorder.addEventListener("start", r, { once: true }));
  recorder.start();
  set({ status: "recording", startedAt: Date.now(), fullscreen, fakeCursor });
  if (intro) {
    // 녹화기가 첫 프레임을 받기 시작한 뒤에 틀어야 영상 첫 장면부터 찍힘 (바로 틀면 앞 5장쯤이 빠졌음, 시험 녹화 rec1)
    await started;
    await nextFrame();
    // 영상을 틀고, 끝나면 바로 시작화면 (영상과 폰 틀이 같은 기기·같은 비율이라 상태바·손잡이가 안 끊기고 한 번의 녹화로 이어짐)
    setClock(INTRO.clock);
    setBattery(INTRO.battery);
    const minute = setTimeout(() => state.status === "recording" && setClock("06:12"), INTRO.nextMinuteMs);
    const stopKeep = keepCapturing(target);
    recorder.addEventListener("stop", () => (clearTimeout(minute), stopKeep()), { once: true });
    await playIntro(intro, target);
  } else {
    await sleep(600);
    window.dispatchEvent(new CustomEvent(RESTART_EVENT, { detail: "start" }));
  }
}

// 녹화가 끊기지 않게: 인트로 영상(2.6초 동안 화면 전체가 30fps 로 바뀜)이 끝나면 크롬 화면 캡처가 '움직이는 영역'을 그 영상으로 잡은 채
// 0.4초 동안 새 프레임을 안 내보내고(시작화면 첫 0.4초·상태바가 바뀌는 모습이 빠짐), 그 뒤로도 0.5~0.75초 간격으로만 찍었음
// (시험 녹화: 영상 끝 → 시작화면 첫 프레임 +0.40초, 언제 영상을 걷든 같음). 폰 전체를 덮는 거의 투명한 흰 막의 투명도를
// 매 프레임 0.001 ↔ 0.002 로 바꿔(색 차이 0.5 단계 미만이라 안 보임) 녹화가 끝날 때까지 매 프레임 찍히게 함. 인트로가 있는 녹화만
function keepCapturing(target: HTMLElement) {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;inset:0;z-index:998;pointer-events:none;background:#fff;opacity:0.001";
  target.appendChild(el);
  const anim = el.animate([{ opacity: 0.001 }, { opacity: 0.002 }], { duration: 1000 / 60, iterations: Infinity, direction: "alternate" });
  return () => {
    anim.cancel();
    el.remove();
  };
}

// 틀 수 있는 영상부터 (canPlayType 이 "" 이면 뺌. 다 "" 이면 그래도 차례로 시도)
function introSources() {
  const probe = document.createElement("video");
  const ok = INTRO.sources.filter((s) => probe.canPlayType(s.type) !== "");
  return ok.length ? ok : INTRO.sources;
}

// 인트로 영상을 폰 위에 덮고 끝까지 받아 둠(첫 장면이 보이는 채 멈춤). 이 형식을 못 틀면 다음 형식, 다 안 되거나 5초 안에 못 받으면 null (인트로 없이)
function loadIntro(target: HTMLElement) {
  return new Promise<HTMLVideoElement | null>((resolve) => {
    const list = introSources();
    let i = 0;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:999;";
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("error", onError);
      if (!ok) video.remove();
      resolve(ok ? video : null);
    };
    const onReady = () => finish(true);
    const onError = () => {
      if (++i >= list.length) return finish(false);
      video.src = list[i].src;
      video.load();
    };
    const timer = setTimeout(() => finish(false), 5000);
    video.addEventListener("canplaythrough", onReady);
    video.addEventListener("error", onError);
    video.src = list[0].src;
    target.appendChild(video);
  });
}

// 영상을 끝까지 틀고 바로 시작화면으로. 마지막 장면(2.533초)이 나오는 순간 시작화면을 영상 밑에 미리 띄워 두고, 그 장면이 1/30초
// 보인 뒤 곧바로 영상을 걷음 → 녹화 원본처럼 마지막 장면(5.566초, 반쯤 밝아진 회색) 다음 장면이 흰 시작화면 (사이에 검은 화면·같은 장면 반복 없이).
// 'ended' 는 마지막 장면이 나오고 38ms 뒤에야 와서(시험 녹화) 기다리면 회색 장면이 한 장 더 찍힘 → 장면 시각으로 맞추고 'ended' 는 대비로만
const oneFrame = () => new Promise((r) => requestAnimationFrame(r));
function playIntro(video: HTMLVideoElement, target: HTMLElement) {
  return new Promise<void>((resolve) => {
    let mounted = false;
    const mount = () => {
      if (mounted) return;
      mounted = true;
      window.dispatchEvent(new CustomEvent(RESTART_EVENT, { detail: "start" }));
    };
    const lastFrame = video.duration - 1.5 / 30;
    const onFrame = (_now: number, meta: { mediaTime: number; expectedDisplayTime: number }) => {
      if (meta.mediaTime < lastFrame) return video.requestVideoFrameCallback(onFrame);
      mount();
      // 마지막 장면이 화면에 나온 때 + 1/30초 − 반 프레임(8ms): 그다음 그리는 프레임부터 시작화면
      setTimeout(done, Math.max(0, meta.expectedDisplayTime + 1000 / 30 - 8 - performance.now()));
    };
    if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(onFrame);

    let ended = false;
    const done = async () => {
      if (ended) return;
      ended = true;
      const endAt = performance.now();
      clearTimeout(guard);
      // 상태바가 영상 속 흰 글자(어두운 기기 홈 화면 테마)에서 #494949 로 서서히 바뀜 (PhoneFrame.css [data-intro-end]). 영상이 끝난 때부터
      const d = document.documentElement.dataset;
      d.introEnd = "on";
      setTimeout(() => delete d.introEnd, 600); // 가장 긴 손잡이 410ms 가 끝난 뒤
      mount();
      // 시작화면이 그려질 때까지 (대개 이미 그려져 있음. 로그인·프로필 고르기 중이면 그냥 넘어감)
      for (let i = 0; i < 6 && !target.querySelector(".kb-splash"); i++) await oneFrame();
      // 영상 속 캠코더 깜빡임을 우리 상태바가 같은 위상으로 이어 받음 (영상이 끝난 때 기준 — 기다린 만큼 더함)
      syncBlink(INTRO.blinkOnMs + (performance.now() - endAt));
      video.remove();
      resolve();
    };
    // 영상이 멈춰 버려도(디코딩·네트워크) 녹화가 영상에 갇히지 않게
    const guard = setTimeout(done, (Number.isFinite(video.duration) ? video.duration * 1000 : 3000) + 3000);
    video.addEventListener("ended", done, { once: true });
    video.addEventListener("error", done, { once: true });
    video.play().catch(done);
  });
}

// 폰 화면 녹화 (폰 아래 [● 녹화] / 🔔 패널): 녹화하는 동안은 캡쳐모드로 테두리를 숨겼다가 끝나면 원래대로
export function recordPhone() {
  const phone = document.querySelector<HTMLElement>(".phone");
  if (!phone) return;
  const wasCapture = isCapture();
  setCapture(true);
  startRecording(phone, () => setCapture(wasCapture));
}
