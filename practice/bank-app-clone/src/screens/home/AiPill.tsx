import { useEffect, useRef, useState } from "react";
import { TIMING } from "../../config/timing";
import { useTypewriter } from "../../hooks/useTypewriter";
import { AiDiamond, CoinIcon, RingSpinner } from "../../components/art";
import { Icon } from "../../components/icons/Icon";

const MESSAGES = [
  { icon: "ai", text: "원금 지키는 펀드, 정말 가능할까요?", closable: false },
  { icon: "coin", text: "지난 달, 모임통장\n어디에 제일 많이 썼을까요?", closable: true },
  { icon: "coin", text: "회비 안 낸 모임멤버\n한 번에 모아봤어요", closable: true },
] as const;

// 홈에 들어올 때마다 다음 문구로 바뀐다(영상 34초, 39.7초).
// 언마운트돼도 유지돼야 하므로 state가 아니라 모듈 변수.
let visits = 0;

type Stage = "previous" | "spinner" | "typing";

export function AiPill({ ready }: { ready: boolean }) {
  const [visit, setVisit] = useState<number | null>(null);
  // 렌더 중엔 읽기만 한다(visits 값 = 이번이 몇 번째 방문인지). 증가는 아래 effect에서.
  const [stage, setStage] = useState<Stage>(() => (visits > 0 ? "previous" : "spinner"));
  const [closed, setClosed] = useState(false);
  const counted = useRef(false);

  // 방문 횟수는 effect에서 센다. StrictMode(개발 모드)는 effect를 "마운트→정리→마운트"로
  // 두 번 돌리는데, ref는 그 사이에도 유지되므로 counted로 중복 카운트를 막는다.
  // (렌더 중에 visits++ 하면 StrictMode의 이중 렌더 때문에 2씩 올라감)
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    setVisit(visits++);
  }, []);

  useEffect(() => {
    if (!ready || visit === null) return;
    const lead = visit > 0 ? 350 : 0; // 재방문: 이전 문구를 잠깐 보여주고 스피너로
    const timers = [
      setTimeout(() => setStage("spinner"), lead),
      setTimeout(() => setStage("typing"), lead + TIMING.pillSpinner),
    ];
    return () => timers.forEach(clearTimeout);
  }, [ready, visit]);

  const v = visit ?? visits;
  const current = MESSAGES[v % MESSAGES.length];
  const previous = MESSAGES[(v + MESSAGES.length - 1) % MESSAGES.length];
  const { typed } = useTypewriter(current.text, stage === "typing");

  if (closed) return <div />;

  const shown = stage === "previous" ? previous : current;
  const text = stage === "previous" ? previous.text : stage === "typing" ? typed : "";

  return (
    <div className={`ai-pill ${text.includes("\n") ? "ai-pill--two" : ""}`}>
      <span className="ai-pill__icon">
        {stage === "spinner" ? (
          <RingSpinner size={20} />
        ) : shown.icon === "ai" ? (
          <AiDiamond size={18} />
        ) : (
          <CoinIcon size={20} />
        )}
      </span>
      {text && <span className="ai-pill__text">{text}</span>}
      {stage !== "spinner" && shown.closable && (
        <button className="ai-pill__close" aria-label="닫기" onClick={() => setClosed(true)}>
          <Icon name="close" size={13} stroke={2} />
        </button>
      )}
    </div>
  );
}
