// 안내창 (transfer §2.5 "계좌번호를 찾을 수 없어요"). 웹 영역만 어둡게 (81.6–838.33, .61) — 머리줄 · 상태바 · 아래 띠는 그대로
//  카드 x 32.1–351.8, 모서리 24, #2a2a34, 왼쪽 여백 22.4. 제목 20 B #e2e1e7, 본문 15 M #9796a0, 오른쪽 글자 버튼 17 B #317ceb (누르면 #292731 바탕)
//  열기: 나타남 + scale .96 → 1, 160ms. 닫기 130ms. 여는 동안 방문 기록 한 칸 (갤럭시 뒤로 = 닫기)
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTossBackStep } from "../nav";
import { TossPressable } from "./Pressable";
import { TOSS_DIALOG, useTossOverlayPhase, useTossPageRoot } from "./shared";

export interface TossDialogAction {
  label: string;
  onPress: () => void;
  tone?: "blue" | "grey";
}
export interface TossDialogProps {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  actions?: TossDialogAction[]; // 없으면 [확인 → onClose]
  onClose: () => void; // 뒤로 · 막 누름
  dismissible?: boolean; // 막을 누르면 닫힘 (기본 true)
  fullScrim?: boolean; // 화면 전체를 덮음 (기본: 웹 영역만)
}

export function TossDialog({ open, title, body, actions, onClose, dismissible = true, fullScrim }: TossDialogProps) {
  const root = useTossPageRoot();
  const phase = useTossOverlayPhase(open, TOSS_DIALOG.out);
  useTossBackStep(open, onClose);
  if (phase === "closed") return null;
  const list = actions ?? [{ label: "확인", onPress: onClose }];
  const node = (
    <div className={`toss-dialog toss-dialog--${phase}${fullScrim ? " toss-dialog--full" : ""}`}>
      <div className="toss-dialog__scrim" onClick={() => dismissible && onClose()} />
      <div className="toss-dialog__card" role="alertdialog" aria-modal>
        <div className="toss-dialog__title">{title}</div>
        {body && <div className="toss-dialog__body">{body}</div>}
        <div className="toss-dialog__actions">
          {list.map((a) => (
            <TossPressable key={a.label} className={`toss-dialog__action toss-dialog__action--${a.tone ?? "blue"}`} radius={10} color="#292731" onPress={a.onPress} fadeOut={120}>
              {a.label}
            </TossPressable>
          ))}
        </div>
      </div>
    </div>
  );
  return root ? createPortal(node, root) : node;
}
