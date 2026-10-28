// 화면 녹화: 브라우저 탭 화면을 받아서(getDisplayMedia) 폰 부분만 잘라 MediaRecorder로 녹화 → 파일 다운로드.
//
// 폰 부분만 자르는 방법 두 가지:
//  1) Region Capture (크롬/엣지): CropTarget.fromElement(폰) → track.cropTo() 하면 브라우저가 알아서 잘라 줌. 가장 선명
//  2) 그 밖의 브라우저: 탭 화면을 <video>로 받아 매 프레임 <canvas>에 폰 영역만 그리고, canvas를 녹화
// 폰(모바일 브라우저)은 getDisplayMedia가 없어서 녹화 불가 → 폰 자체 화면녹화를 쓰도록 안내.
import { useSyncExternalStore } from "react";

type State = { status: "idle" } | { status: "recording"; startedAt: number };

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

let stopCurrent: (() => void) | null = null;
export const stopRecording = () => stopCurrent?.();

// mp4가 되면 mp4 (휴대폰·카톡에서 바로 재생), 아니면 webm
function pickFormat() {
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const type = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  return { type, ext: type.startsWith("video/mp4") ? "mp4" : "webm" };
}

const pad = (n: number) => String(n).padStart(2, "0");
function fileName(ext: string) {
  const d = new Date();
  return `bank-clone_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
}

// 이 브라우저 탭을 고르게 하고, 폰 요소만 잘라서 녹화 시작. 버튼 클릭 안에서 바로 불러야 함(사용자 동작 필요)
export async function startRecording(target: HTMLElement, onStop?: () => void) {
  if (state.status === "recording") return;
  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      // 크기를 안 정하면 브라우저가 720p 정도로 낮춰서 줌 → 화면 원래 해상도까지 받도록 크게 요청
      video: { frameRate: 60, width: { ideal: 3840 }, height: { ideal: 2160 } },
      audio: false,
      // 크롬: 지금 탭을 먼저 보여 주고, 다른 탭/창 대신 이 탭을 고르기 쉽게
      preferCurrentTab: true,
      selfBrowserSurface: "include",
    } as DisplayMediaStreamOptions);
  } catch {
    set({ status: "idle" }); // 사용자가 공유 창에서 취소
    onStop?.();
    return;
  }

  const [track] = display.getVideoTracks();
  const isThisTab = track.getSettings().displaySurface === "browser";
  let recordStream: MediaStream = display;
  let cleanupCanvas = () => {};

  const regionCapture = "CropTarget" in window && "cropTo" in track;
  if (isThisTab && regionCapture) {
    // 1) Region Capture
    const W = window as unknown as { CropTarget: { fromElement(el: Element): Promise<unknown> } };
    const cropTarget = await W.CropTarget.fromElement(target);
    await (track as unknown as { cropTo(t: unknown): Promise<void> }).cropTo(cropTarget);
  } else if (isThisTab) {
    // 2) canvas로 직접 자르기
    const video = document.createElement("video");
    video.srcObject = display;
    video.muted = true;
    await video.play();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    const draw = () => {
      const r = target.getBoundingClientRect();
      const k = video.videoWidth / window.innerWidth; // 탭 영상 px ÷ CSS px
      if (canvas.width !== Math.round(r.width * k)) {
        canvas.width = Math.round(r.width * k);
        canvas.height = Math.round(r.height * k);
      }
      ctx.drawImage(video, r.left * k, r.top * k, r.width * k, r.height * k, 0, 0, canvas.width, canvas.height);
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
  const recorder = new MediaRecorder(recordStream, { ...(type && { mimeType: type }), videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    cleanupCanvas();
    display.getTracks().forEach((t) => t.stop());
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
  // 브라우저의 "공유 중지" 버튼으로 멈춰도 저장되게
  track.addEventListener("ended", () => stopCurrent?.());

  recorder.start(1000);
  set({ status: "recording", startedAt: Date.now() });
}
