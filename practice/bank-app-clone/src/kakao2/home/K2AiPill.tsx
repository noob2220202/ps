import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { K2_HOME } from "./content";
import { K2PillStar } from "./icons";
import "./K2AiPill.css";

// kakao2 홈 AI 알약 (intro.md §7, critic.md §2.1). 한 번의 바꿈 = 지우기 시작(at) 기준:
//   0 – 180ms   폭이 동그라미(48.3)로 줄며 옛 글자는 잘리고 흐려지고, 별은 작아져 사라짐
//   – 438ms     빈 동그라미
//   438ms –     새 글자를 33.3ms 마다 한 자씩 (폭은 글자마다 바로 늘어남, 오른쪽 여백만 5.35 → 17.1 로 233ms 동안 벌어짐),
//               글자 묶음은 166ms 동안 나타남.
//               같은 때 별 자리에 두 색 고리가 돌며 나타나 굵어졌다가 작아져 사라지고(– 988ms), 990ms 부터 별이 다시 커짐
// at 이 없으면(인트로가 켜짐을 잡아 둔 동안) 옛 글자 그대로. 애니메이션 지연은 그 요소가 처음 그려질 때 한 번만 잼
export function K2AiPill({ at, prev, next }: { at: number | null; prev: string; next: string }) {
  const [phase, setPhase] = useState<"prev" | "collapse" | "type">(() => phaseAt(at));
  useEffect(() => {
    if (at === null) return;
    const timers: number[] = [];
    const sync = () => setPhase(phaseAt(at));
    sync();
    const now = performance.now();
    // setTimeout 은 ms 아래를 버려 1ms 일찍 깰 수 있음 → 2ms 늦게
    for (const t of [at, at + K2_HOME.pillType]) if (t > now) timers.push(window.setTimeout(sync, t - now + 2));
    return () => timers.forEach(clearTimeout);
  }, [at]);

  if (at === null || phase === "prev") return <PillStatic text={prev} />;
  if (phase === "collapse") return <PillCollapse key={at} at={at} text={prev} />;
  return <PillTyping key={at} at={at} text={next} />;
}

const phaseAt = (at: number | null) => {
  if (at === null) return "prev";
  const e = performance.now() - at;
  return e < 0 ? "prev" : e < K2_HOME.pillType ? "collapse" : "type";
};

// 처음 그려질 때 한 번만 잰 지연 (ms, 음수 = 이미 지난 만큼 건너뜀). CSS 애니메이션은 그린 다음 프레임에 시작하므로 한 프레임(16ms) 앞당김
const useDelay = (t: number) => useState(() => `${Math.round(t - performance.now() - 16)}ms`)[0];

function PillStatic({ text }: { text: string }) {
  return (
    <div className="k2-pill k2-pill--glow">
      <span className="k2-pill__icon">
        <K2PillStar />
      </span>
      <span className="k2-pill__text">{text}</span>
    </div>
  );
}

function PillCollapse({ at, text }: { at: number; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const delay = useDelay(at);
  // 줄기 시작 폭 = 옛 글자 그대로의 폭. 그리기 전에 재서 애니메이션을 붙임 (첫 프레임부터 줄어드는 중)
  useLayoutEffect(() => {
    const el = ref.current!;
    el.style.setProperty("--k2-pill-w0", `${el.getBoundingClientRect().width}px`);
    el.classList.add("k2-pill--collapse");
  }, []);
  return (
    <div className="k2-pill" ref={ref} style={{ animationDelay: delay }}>
      <span className="k2-pill__icon k2-pill__icon--out" style={{ animationDelay: delay }}>
        <K2PillStar />
      </span>
      <span className="k2-pill__text k2-pill__text--out" style={{ animationDelay: delay }}>
        {text}
      </span>
    </div>
  );
}

// 글자 i 는 (지우기 시작 + 422 + 33.3 × i)ms 에, 다만 첫 글자만 16ms 늦게 438ms 에 (녹화: 후 1.183 · 불 1.200 · 교 1.233 …)
function PillTyping({ at, text }: { at: number; text: string }) {
  const start = at + K2_HOME.pillType;
  const beat = start - 16;
  const count = () => Math.min(text.length, Math.max(1, Math.floor((performance.now() - beat) / K2_HOME.pillChar) + 1));
  const [typed, setTyped] = useState(count);
  useEffect(() => {
    if (typed >= text.length) return;
    const id = setTimeout(() => setTyped(Math.max(typed + 1, count())), Math.max(0, beat + typed * K2_HOME.pillChar - performance.now()));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);
  const ring = useDelay(start);
  const star = useDelay(at + K2_HOME.pillStar - 15);
  const fade = useDelay(beat);
  const pad = useDelay(start);
  const glow = useDelay(at + K2_HOME.pillGlow);
  return (
    <div className="k2-pill k2-pill--glow" style={{ animationDelay: glow }}>
      <span className="k2-pill__ring" style={{ animationDelay: `${ring}, ${ring}` }} />
      <span className="k2-pill__icon k2-pill__icon--in" style={{ animationDelay: star }}>
        <K2PillStar />
      </span>
      <span className="k2-pill__text k2-pill__text--in" style={{ animationDelay: `${fade}, ${pad}` }}>
        {text.slice(0, typed)}
      </span>
    </div>
  );
}
