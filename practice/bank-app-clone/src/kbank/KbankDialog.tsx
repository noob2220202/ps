import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useKbankBackStep } from "./sendback";
import "./kbank-dialog.css";

// 가운데 확인창: 막 + 흰 상자(글 + 취소·확인). 두 번째 녹화 29.3~31.1초 프레임 880~934 (중복 이체, KbankSend).
//   열림: 막 0 → .70 300ms linear, 상자는 50ms 늦게 42 아래에서 250ms 에 올라오며 진해짐 (프레임 884 상자 위끝 495px → 889 477px)
//   닫힘: 손 뗀 순간 막 300ms linear, 상자 250ms 에 42 내려가며 사라짐 → 다 닫히면 onClosed
// 막·상자 몸통 누름은 무반응. 안드로이드·브라우저 뒤로(녹화에 없음) = 취소. 두 번 눌러도 한 번만
const CLOSE_MS = 300;

export function KbankDialog({
  lines,
  className = "",
  onChoose,
  onClosed,
}: {
  lines: string[]; // 글 줄 (줄바꿈 고정)
  className?: string; // 글(.kbdlg-msg)에 붙일 이름 — 줄별 위치 손질용
  onChoose: (ok: boolean) => void; // 손 뗀 순간 (닫힘 시작)
  onClosed: (ok: boolean) => void; // 닫힘 움직임이 끝난 뒤
}) {
  const [closing, setClosing] = useState(false);
  const chosen = useRef(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const choose = (ok: boolean) => {
    if (chosen.current) return;
    chosen.current = true;
    setClosing(true);
    onChoose(ok);
    timer.current = window.setTimeout(() => onClosed(ok), CLOSE_MS);
  };
  useKbankBackStep(!closing, () => choose(false));
  // 읽기 도우미: 글을 설명으로 잇고, 열리면 '확인'에 초점 (막 아래 화면으로 탭 이동이 새지 않게 확인창 안에서만 돎)
  const msgId = useId();
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => okRef.current?.focus({ preventScroll: true }), []);
  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const btns = [...e.currentTarget.querySelectorAll("button")];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    e.preventDefault();
    btns[(i + (e.shiftKey ? btns.length - 1 : 1)) % btns.length]?.focus();
  };
  return (
    <div className={`kbdlg ${closing ? "kbdlg--out" : ""}`} role="alertdialog" aria-modal aria-describedby={msgId} onKeyDown={trap}>
      <div className="kbdlg-dim">
        <div className="kbdlg-box">
          <p id={msgId} className={`kbdlg-msg ${className}`}>
            {lines.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </p>
          <div className="kbdlg-btns">
            <button className="kbdlg-cancel" onClick={() => choose(false)}>
              취소
            </button>
            <button ref={okRef} className="kbdlg-ok" onClick={() => choose(true)}>
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
