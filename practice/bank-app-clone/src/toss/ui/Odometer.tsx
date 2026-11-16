// 숫자 굴림 (home §3.6 · assets §3.5): 바뀐 자리 숫자가 세로로 굴러 (옛 숫자는 위로 나가고 새 숫자가 아래에서, 사이 숫자를 거침),
// 왼쪽 자리부터 60–80ms 씩 먼저 멈춤, 전체 420–500ms ease-out (자산 화면은 duration 900). 쉼표 · '원' 은 그대로.
// 자릿수가 바뀌면 모든 자리가 굴러감. 마지막으로 그린 값은 id 로 기억 → 다음에 다른 값으로 그려질 때만 굴러감 (처음엔 그냥)
import { useEffect, useState, type CSSProperties } from "react";

const last = new Map<string, number>();
const nf = new Intl.NumberFormat("ko-KR");

export interface TossOdometerProps {
  id: string; // 기억 칸 (예: "home:balance:main")
  value: number;
  duration?: number; // 전체 ms (기본 460)
  stagger?: number; // 자리마다 먼저 멈추는 ms (기본 70)
  prefix?: string;
  suffix?: string; // 기본 "원"
  format?: (n: number) => string;
  className?: string;
  style?: CSSProperties;
}

type Roll = { from: number; to: number; n: number };

export function TossOdometer({ id, value, duration = 460, stagger = 70, prefix = "", suffix = "원", format = (n) => nf.format(n), className, style }: TossOdometerProps) {
  const [roll, setRoll] = useState<Roll | null>(() => {
    const prev = last.get(id);
    return prev !== undefined && prev !== value ? { from: prev, to: value, n: 1 } : null;
  });
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setRoll({ from: roll ? roll.to : shown, to: value, n: (roll?.n ?? 0) + 1 });
  }
  useEffect(() => {
    last.set(id, value);
  }, [id, value]);
  // 다 굴러가면 보통 글자로 (가장 오른쪽 자리가 duration 에 멈춤)
  useEffect(() => {
    if (!roll) return;
    const t = window.setTimeout(() => setRoll(null), duration + 50);
    return () => window.clearTimeout(t);
  }, [roll, duration]);

  const text = format(value);
  if (!roll) {
    return (
      <span className={`toss-odo${className ? ` ${className}` : ""}`} style={style}>
        {prefix}
        {text}
        {suffix}
      </span>
    );
  }
  const oldDigits = format(roll.from).replace(/\D/g, "");
  const newDigits = text.replace(/\D/g, "");
  const sizeChanged = oldDigits.length !== newDigits.length;
  const up = roll.to >= roll.from;
  const cols = newDigits.length;
  // 자리마다 (왼쪽부터): 굴러갈 숫자 차례. 가장 오른쪽 굴림이 duration 에 멈추고, 그 왼쪽 굴림은 stagger 씩 먼저
  const plan = [...newDigits].map((ch, k) => {
    const oldCh = oldDigits[oldDigits.length - cols + k];
    const to = Number(ch);
    const from = oldCh === undefined ? 0 : Number(oldCh);
    if (!sizeChanged && from === to) return null;
    const steps = from === to ? 10 : up ? (to - from + 10) % 10 : (from - to + 10) % 10;
    return Array.from({ length: steps + 1 }, (_, s) => (up ? (from + s) % 10 : (from - s + 10) % 10));
  });
  const rolling = plan.filter(Boolean).length;
  let di = 0; // 몇 번째 숫자 자리 (왼쪽부터)
  let ri = 0; // 몇 번째 굴림 (왼쪽부터)
  return (
    <span className={`toss-odo toss-odo--rolling${className ? ` ${className}` : ""}`} style={style} key={roll.n}>
      {prefix}
      {[...text].map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i}>{ch}</span>;
        const seq = plan[di++];
        if (!seq) return <span key={i}>{ch}</span>;
        const ms = Math.max(200, duration - (rolling - 1 - ri++) * stagger);
        return (
          <span key={i} className="toss-odo__col">
            <span className="toss-odo__ghost">{ch}</span>
            <span className="toss-odo__strip" style={{ ["--toss-odo-n" as string]: seq.length - 1, animationDuration: `${ms}ms` }}>
              {seq.map((d, s) => (
                <span key={s}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
      {suffix}
    </span>
  );
}
