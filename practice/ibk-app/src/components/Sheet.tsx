import type { ReactNode } from "react";
import type { PadKey } from "../lib/keypad";
import "./Sheet.css";

// 아래에서 올라오는 시트 (은행선택, 계좌번호 입력, 이체 확인 …).
// 닫혀 있어도 DOM은 남겨 두고 transform으로만 내렸다 올린다 → 닫히는 애니메이션도 자연스럽고 60fps.
// 상태바까지 어둡게 덮이는 건 화면 쪽에서 useStatusBar로 처리 (영상에서 상태바도 회색이 됨)
export function Sheet({
  open,
  onClose,
  children,
  className = "",
  kind,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  kind?: string; // 시트 종류 (바깥 div에 sheet--<kind>. 콕뱅크 키패드 시트는 막·속도가 다름)
}) {
  return (
    <div className={`sheet ${open ? "sheet--open" : ""} ${kind ? `sheet--${kind}` : ""}`} aria-hidden={!open}>
      <div className="sheet__backdrop" onClick={onClose} />
      <section className={`sheet__panel ${className}`} role="dialog">
        {children}
      </section>
    </div>
  );
}

// 가운데 뜨는 알림창 (계좌를 못 찾았을 때, 한도 초과 …). onCancel을 주면 [취소][확인] 두 버튼
export function Dialog({
  message,
  onClose,
  onCancel,
  okLabel = "확인",
  cancelLabel = "취소",
}: {
  message: string | null;
  onClose: () => void;
  onCancel?: () => void;
  okLabel?: string;
  cancelLabel?: string;
}) {
  if (!message) return null;
  return (
    <div className="dialog">
      <div className="dialog__box" role="alertdialog">
        <p>{message}</p>
        <div className="dialog__buttons">
          {onCancel && (
            <button className="dialog__cancel" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button onClick={onClose}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}

// 숫자 키패드. 왼쪽 아래 칸은 금액 입력에선 "00", 계좌번호 입력에선 빈칸 (콕뱅크는 "콕")
export function Keypad({
  onKey,
  doubleZero = false,
  kok = false,
  rowHeight = 60,
  back,
  kokLabel = "콕",
}: {
  onKey: (k: PadKey) => void;
  doubleZero?: boolean;
  kok?: boolean;
  rowHeight?: number;
  back?: ReactNode; // 지우기 키 모양 (기본: ⌫)
  kokLabel?: ReactNode; // '콕' 키 모양 (콕뱅크는 그림 글리프)
}) {
  const keys: (PadKey | null)[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", doubleZero ? "00" : kok ? "kok" : null, "0", "back"];
  return (
    <div className="keypad" style={{ gridAutoRows: rowHeight }}>
      {keys.map((k, i) =>
        k ? (
          <button key={k} className={`keypad__key keypad__key--${k}`} data-key={k} onClick={() => onKey(k)} aria-label={k === "back" ? "지우기" : k === "kok" ? "콕" : k}>
            {k === "back" ? (back ?? <BackspaceIcon />) : k === "kok" ? kokLabel : k}
          </button>
        ) : (
          <span key={`empty-${i}`} />
        ),
      )}
    </div>
  );
}

function BackspaceIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M8.5 5H20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8.5L2.8 12Z" />
      <path d="m11.5 9.5 5 5m0-5-5 5" strokeLinecap="round" />
    </svg>
  );
}
