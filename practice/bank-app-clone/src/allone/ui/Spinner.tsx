// 초록 all one 로딩 스피너 (plan.md §3.3, launch.md §2.8). 녹화: 유리 동전 Ø 61 (얼굴 #1AC66D, 바깥 고리 #16B758, 안쪽 얇은 밝은 테),
// 흰 "all NH one" 워드마크 (지름의 63 %). 세로축으로 한 바퀴 돌고(뒤로 돌면 유리 너머로 뒤집힌 글자) 흔들림 뒤 멈춤 — 1467 ms 마다, 30 fps
// (자세 하나가 두 프레임씩) → 44 자세를 steps 로 (CSS @keyframes, 매 자세 그대로 유지). 그림은 SVG · CSS 만 (녹화 프레임 안 씀).
// 켜질 때마다 동전 앞면부터: 새로 마운트되면 애니메이션이 0 부터 (Loading.tsx 가 onset 마다 key 를 바꿈).
// 두께: 앞 · 뒤 얼굴 사이 유리 테 여러 겹 + 옆에서 볼 때의 띠 (90° 근처에서 ≈ 15 pt 너비 리본처럼 보임)
import { AoWordmark } from "./Wordmark";

const LOOP_MS = 1467;
const POSES = 44; // 1467 ms × 30 fps
// [고리 안 시점 (0~1), rotateY (deg), scaleY] — launch.md §2.8 표: 0–0.05 s 정지, 0.23 s ≈ 40°, 0.37 s 옆면(살짝 부풂),
// 0.57 s 뒷면, 0.67 s 270°, 0.77 s 330°, 0.88 s 앞면, 1.10 s 까지 작은 흔들림, 그 뒤 정지
const CURVE: [number, number, number][] = [
  [0, 0, 1],
  [0.034, 0, 1],
  [0.157, 40, 1],
  [0.25, 90, 1.05],
  [0.39, 180, 1],
  [0.46, 270, 1],
  [0.525, 330, 1],
  [0.6, 360, 1],
  [0.64, 364, 1],
  [0.68, 357.5, 1],
  [0.72, 361, 1],
  [0.75, 360, 1],
  [1, 360, 1],
];

function pose(t: number): [number, number] {
  for (let i = 1; i < CURVE.length; i++) {
    const [t1, a1, s1] = CURVE[i];
    if (t <= t1) {
      const [t0, a0, s0] = CURVE[i - 1];
      const u = (t - t0) / (t1 - t0);
      return [a0 + (a1 - a0) * u, s0 + (s1 - s0) * u];
    }
  }
  return [360, 1];
}

// 자세마다 한 칸 (animation-timing-function steps(1, end) → 다음 칸까지 그대로 = 30 fps)
const KEYFRAMES =
  "@keyframes ao-spinner-turn{" +
  Array.from({ length: POSES + 1 }, (_, i) => {
    const [deg, sy] = pose(i / POSES);
    return `${+((i / POSES) * 100).toFixed(4)}%{transform:rotateY(${+deg.toFixed(2)}deg) scaleY(${+sy.toFixed(4)})}`;
  }).join("") +
  "}" +
  // 옆면 리본은 거의 옆으로 섰을 때만 (|cos| < 0.45 에서 서서히) — 리본이 두께보다 넓어 비스듬할 땐 얼굴을 뚫고 보이므로
  "@keyframes ao-spinner-band{" +
  Array.from({ length: POSES + 1 }, (_, i) => {
    const [deg] = pose(i / POSES);
    const o = Math.min(1, Math.max(0, (0.45 - Math.abs(Math.cos((deg * Math.PI) / 180))) / 0.25));
    return `${+((i / POSES) * 100).toFixed(4)}%{opacity:${+o.toFixed(3)}}`;
  }).join("") +
  "}";

const FACE = "#1ac66d";
const RING = "#16b758";
const EDGE_LAYERS = 7;

export function AoSpinner({ size = 61 }: { size?: number }) {
  const t = size * 0.16; // 유리 두께
  const band = size * 0.25; // 옆모습 리본 너비
  const persp = size * 4;
  const d = size * (1 - t / 2 / persp); // 앞 얼굴(z = +t/2)이 원근으로 커 보이는 만큼 줄여 화면에서 꼭 size
  const off = (size - d) / 2;
  const disc = { position: "absolute", left: off, top: off, width: d, height: d, borderRadius: "50%" } as const;
  const face = (back: boolean) => (
    <span style={{ ...disc, transform: `translateZ(${back ? -t / 2 : t / 2}px)` }}>
      <svg viewBox="0 0 100 100" width={d} height={d} style={{ position: "absolute", inset: 0, display: "block" }} aria-hidden>
        <circle cx="50" cy="50" r="50" fill={RING} opacity={back ? 0.8 : 1} />
        <circle cx="50" cy="50" r="46.6" fill={FACE} opacity={back ? 0.72 : 1} />
        <circle cx="50" cy="50" r="47.1" fill="none" stroke="#ffffff" strokeOpacity={back ? 0.2 : 0.38} strokeWidth="0.9" />
      </svg>
      <AoWordmark
        width={d * 0.633}
        color={back ? "rgba(225,245,232,0.55)" : "#ffffff"}
        style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      />
    </span>
  );
  return (
    <span aria-hidden className="ao-spinner" style={{ position: "relative", display: "inline-block", width: size, height: size, perspective: persp, flexShrink: 0 }}>
      <style href="ao-spinner" precedence="ao">
        {KEYFRAMES}
      </style>
      <span
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          animation: `ao-spinner-turn ${LOOP_MS}ms steps(1, end) infinite`,
        }}
      >
        {face(true)}
        {Array.from({ length: EDGE_LAYERS }, (_, i) => (
          <span
            key={i}
            style={{
              ...disc,
              transform: `translateZ(${-t / 2 + (t * (i + 1)) / (EDGE_LAYERS + 1)}px)`,
              background: `radial-gradient(circle, rgba(22,183,88,0) 62%, rgba(22,183,88,0.42) 90%, rgba(12,140,64,0.62) 100%)`,
            }}
          />
        ))}
        {/* 옆면 띠: 옆에서 볼 때(90° · 270°)만 보이는 유리 테. 녹화의 옆모습은 굴절로 두께보다 넓은 ≈ 15 pt 리본 → 지름의 25 % */}
        <span
          style={{
            position: "absolute",
            left: (size - band) / 2,
            top: (size - d * 0.94) / 2,
            width: band,
            height: d * 0.94,
            borderRadius: band / 2,
            opacity: 0,
            animation: `ao-spinner-band ${LOOP_MS}ms steps(1, end) infinite`,
            background: "linear-gradient(90deg, rgba(14,150,74,0.85), rgba(90,226,150,0.8) 50%, rgba(14,150,74,0.85))",
            transform: "rotateY(90deg)",
          }}
        />
        {face(false)}
      </span>
    </span>
  );
}
