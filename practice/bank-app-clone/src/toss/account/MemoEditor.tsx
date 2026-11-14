// 상세 '메모남기기' 화면 (지어낸 것 — plan.md §1.6: S6 받는 분에게 표시 와 같은 꼴, ≤ 20자, PATCH /api/transactions/:id {memo}).
// 화면 뿌리에 겹쳐 그리는 같은 화면 안의 칸 (주소는 그대로, 갤럭시 뒤로 = 닫기). ← 는 버림, 완료는 저장 뒤 닫힘.
// 입력은 기기 키보드 (토스 한글 자판은 송금 영역 것이라 가져오지 않음)
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tossApi } from "../api";
import { useTossBackStep } from "../nav";
import { BackIcon } from "../ui/icons";
import { TossPressable } from "../ui/Pressable";
import { useTossOverlayPhase, useTossPageRoot } from "../ui/shared";

const MEMO_MAX = 20;
const MEMO_ANIM = 150; // 들어올 때 · 나갈 때 (밑에서 살짝 + 흐림)

export function MemoEditor({ open, txId, value, onClose }: { open: boolean; txId: string; value: string; onClose: () => void }) {
  const root = useTossPageRoot();
  const phase = useTossOverlayPhase(open, MEMO_ANIM);
  useTossBackStep(open, onClose);
  if (phase === "closed") return null;
  const node = (
    <div className={`toss-acct-memo toss-acct-memo--${phase}`}>
      <MemoBody key={open ? "open" : "closing"} txId={txId} value={value} onClose={onClose} />
    </div>
  );
  return root ? createPortal(node, root) : node;
}

function MemoBody({ txId, value, onClose }: { txId: string; value: string; onClose: () => void }) {
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // 열리면 지금 메모 전체를 고른 채 커서 (첫 글자가 바꿔 씀 — S6 와 같음)
  useEffect(() => {
    const t = window.setTimeout(() => {
      input.current?.focus();
      input.current?.select();
    }, MEMO_ANIM);
    return () => window.clearTimeout(t);
  }, []);
  const save = () => {
    if (busy) return;
    setBusy(true);
    tossApi
      .updateTransaction(txId, { memo: text.trim() })
      .then(() => onClose())
      .catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요");
        setBusy(false);
      });
  };
  return (
    <>
      <div className="toss-acct-memo__bar">
        <TossPressable className="toss-acct-memo__back" radius={24} onPress={onClose} ariaLabel="뒤로">
          <BackIcon size={24} />
        </TossPressable>
        <TossPressable className="toss-acct-memo__done" radius={10} inset="-8px -10px" color="#2a2a2e" onPress={save}>
          완료
        </TossPressable>
      </div>
      <h1 className="toss-acct-memo__title">메모</h1>
      <input
        ref={input}
        className="toss-acct-memo__input"
        value={text}
        maxLength={MEMO_MAX}
        placeholder="메모를 남겨보세요"
        enterKeyHint="done"
        onChange={(e) => {
          setText(e.target.value.slice(0, MEMO_MAX));
          setErr("");
        }}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      <p className={`toss-acct-memo__cap${err ? " toss-acct-memo__cap--err" : ""}`}>{err || `${MEMO_MAX}자까지 입력할 수 있어요`}</p>
    </>
  );
}
