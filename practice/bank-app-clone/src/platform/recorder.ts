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

type State = { status: "idle" } | { status: "arming" } | { status: "recording"; startedAt: number; fullscreen: boolean };

let state: State = { status: "idle" };
const listeners = new Set<() => void>();
const set = (s: State) => {
  state = s;
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
        : { frameRate: 60, width: { ideal: 3840 }, height: { ideal: 2160 } },
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
  const regionCapture = isThisTab && "CropTarget" in window && "cropTo" in track;
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
  if (regionCapture) {
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

  // 앱을 검은 화면으로 돌려 놓고, 그 모습이 한 프레임 그려진 뒤 녹화 시작 → 시작화면부터
  window.dispatchEvent(new CustomEvent(RESTART_EVENT, { detail: "off" }));
  await nextFrame();
  recorder.start();
  set({ status: "recording", startedAt: Date.now(), fullscreen });
  await sleep(600);
  window.dispatchEvent(new CustomEvent(RESTART_EVENT, { detail: "start" }));
}

// 폰 화면 녹화 (폰 아래 [● 녹화] / 🔔 패널): 녹화하는 동안은 캡쳐모드로 테두리를 숨겼다가 끝나면 원래대로
export function recordPhone() {
  const phone = document.querySelector<HTMLElement>(".phone");
  if (!phone) return;
  const wasCapture = isCapture();
  setCapture(true);
  startRecording(phone, () => setCapture(wasCapture));
}
