// 떠 있는 아래 시트 (transfer §2.3 · §3.1 은행 선택). 화면 뿌리(TossPage)에 붙어 화면 전체(28dp 띠 포함)를 .61 로 덮고, 아래 내비 띠는 dim 모드
//  카드 x 11.2–372.8, 아래 ≈828 (띠 위 10.3), 모서리 24, #1f1e21. 손잡이 42.4 × 4 #363538 (카드 위 +12). 제목 20 B
//  열기: 막 230ms → 카드 +14dp → 0 + 나타남 100ms (막이 거의 다 덮였을 때). 닫기: 카드 +10dp + 사라짐, 막도 같이 100ms
//  여는 동안 방문 기록 한 칸 (갤럭시 뒤로 = 닫기)
import { type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTossBand } from "../band";
import { useTossBackStep } from "../nav";
import { TOSS_SHEET, useTossOverlayPhase, useTossPageRoot } from "./shared";

export interface TossSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  top?: number; // 카드 위끝 (화면 dp). 없으면 내용 높이
  className?: string;
  cardStyle?: CSSProperties;
  children?: ReactNode;
}

export function TossSheet({ open, onClose, title, top, className, cardStyle, children }: TossSheetProps) {
  const root = useTossPageRoot();
  const phase = useTossOverlayPhase(open, TOSS_SHEET.close);
  useTossBand(phase === "open" ? "dim" : null);
  useTossBackStep(open, onClose);
  if (phase === "closed") return null;
  const node = (
    <div className={`toss-sheet toss-sheet--${phase}${className ? ` ${className}` : ""}`}>
      <div className="toss-sheet__scrim" onClick={onClose} />
      <div className="toss-sheet__card" style={{ ...(top !== undefined && { top }), ...cardStyle }} role="dialog" aria-modal>
        <div className="toss-sheet__grabber" />
        {title && <div className="toss-sheet__title">{title}</div>}
        <div className="toss-sheet__body">{children}</div>
      </div>
    </div>
  );
  return root ? createPortal(node, root) : node;
}
