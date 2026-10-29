import { useEffect, useState } from "react";
import { beginArmed, stopRecording, useRecorder } from "../platform/recorder";
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
  // 폰: 화면 공유를 허락한 뒤 한 번 더 눌러야 전체화면으로 시작 (전체화면은 누름 안에서만 켤 수 있음)
  if (rec.status === "arming")
    return (
      <button className="rec-arm" onClick={beginArmed}>
        <span className="rec-bar__dot" />
        화면을 누르면 녹화 시작
        <small>전체화면으로 바뀌고 앱이 처음부터 켜져요. 끝낼 때는 뒤로가기</small>
      </button>
    );
  // 전체화면 녹화(폰) 중엔 막대를 숨김 — 끝내기는 뒤로가기(전체화면 나가기)
  if (!recording || rec.fullscreen) return null;
  const sec = Math.max(0, Math.floor((now - rec.startedAt) / 1000));
  return (
    <div className="rec-bar" role="status">
      <span className="rec-bar__dot" />
      녹화 중 {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
      <button onClick={stopRecording}>정지</button>
    </div>
  );
}

// 녹화 중 가짜 마우스 포인터: 폰 위에선 진짜 포인터를 숨기고(녹화에 찍히므로) 이걸 대신 보여 줌.
// 폰 요소 밖(페이지 맨 위)에 그려서 Element Capture 녹화엔 안 찍힘
export function FakeCursor() {
  const rec = useRecorder();
  const on = rec.status === "recording" && rec.fakeCursor;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!on) return;
    const move = (e: PointerEvent) => {
      const phone = document.querySelector(".phone");
      const over = !!phone && phone.contains(e.target as Node);
      setPos(over ? { x: e.clientX, y: e.clientY } : null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", move);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      setPos(null);
    };
  }, [on]);
  if (!on || !pos) return null;
  return (
    <svg className="fake-cursor" style={{ left: pos.x, top: pos.y }} width="20" height="26" viewBox="0 0 20 26" aria-hidden>
      <path d="M1.5 1.5v19.2l5-4.6 3.4 7.6 3.3-1.5-3.3-7.4h6.8Z" fill="#fff" stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
