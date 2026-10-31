// 프로그램판(.exe, Electron) 전용 창구. 웹판에선 window.electronAPI 가 없으므로 isElectron이 false → 기존 그대로 동작.
export interface SaveRecordingResult {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

interface ElectronAPI {
  isElectron: true;
  saveRecording(buffer: ArrayBuffer, ext: string): Promise<SaveRecordingResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export const isElectron = typeof window !== "undefined" && window.electronAPI?.isElectron === true;

// 녹화 끝난 blob 앞에 인트로 영상을 붙여서(ffmpeg) 사용자가 고른 자리에 저장. 메인 프로세스가 처리.
export async function saveWithIntro(blob: Blob, ext: string): Promise<SaveRecordingResult> {
  if (!window.electronAPI) return { ok: false, error: "electron 없음" };
  const buffer = await blob.arrayBuffer();
  return window.electronAPI.saveRecording(buffer, ext);
}
