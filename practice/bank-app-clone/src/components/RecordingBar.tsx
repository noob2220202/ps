import { useEffect, useState } from "react";
import { stopRecording, useRecorder } from "../platform/recorder";
import "./RecordingBar.css";

// 녹화 중 표시 + 정지 버튼. 폰 바깥(페이지 맨 위)에 떠서 녹화 영상에는 안 찍힌다
export function RecordingBar() {
  const rec = useRecorder();
  const [now, setNow] = useState(() => Date.now());
  const recording = rec.status === "recording";
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [recording]);
  if (!recording) return null;
  const sec = Math.max(0, Math.floor((now - rec.startedAt) / 1000));
  return (
    <div className="rec-bar" role="status">
      <span className="rec-bar__dot" />
      녹화 중 {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
      <button onClick={stopRecording}>정지</button>
    </div>
  );
}
