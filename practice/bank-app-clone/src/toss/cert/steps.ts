// 증명서 화면들이 같이 쓰는 움직임: 다시 그리기 기억 · 단계별 나타남 · 다음 단계로 (점 3개)
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { prefetchMissing } from "../../api/useApi";
import { useLayerActive } from "../../platform/LayerContext";
import { TOSS_NAV, useTossGo, type TossGoOptions } from "../nav";
import { CERT_T } from "./data";

// ScreenStack 은 맨 위 화면만 붙여 두므로 뒤로 오면 화면을 새로 만듦 (고른 것도 이때 비워짐 — 녹화 A 97.85 · 98.51).
// 이 칸(location.key)을 전에 그렸고 POP 으로 왔으면 기다림 없이 끝 모습으로 (녹화: 쌓여 있던 화면은 그대로 보임, cert.md §3.2)
const drawn = new Set<string>();
const scrollAt = new Map<string, number>();
export function useCertRevisit() {
  const { key } = useLocation();
  const navType = useNavigationType();
  const [revisit] = useState(() => navType === "POP" && drawn.has(key));
  useEffect(() => {
    drawn.add(key);
  }, [key]);
  const [savedScroll] = useState(() => (revisit ? (scrollAt.get(key) ?? 0) : 0));
  const saveScroll = useCallback((st: number) => scrollAt.set(key, st), [key]);
  return { revisit, savedScroll, saveScroll };
}

// 들어온 때부터 steps[i] ms 에 phase i+1. ready 가 늦으면 그때부터 남은 간격으로. revisit 이면 처음부터 끝
export function useCertPhase(steps: readonly number[], ready = true, revisit = false) {
  const [phase, setPhase] = useState(revisit ? steps.length : 0);
  const t0 = useRef(0);
  useEffect(() => {
    t0.current = performance.now();
  }, []);
  const key = steps.join(",");
  useEffect(() => {
    if (!ready || revisit) return;
    const ms = key.split(",").map(Number);
    const now = performance.now();
    const base = Math.max(t0.current, now - (ms[0] ?? 0));
    const ids = ms.map((m, i) => window.setTimeout(() => setPhase((p) => Math.max(p, i + 1)), Math.max(0, base + m - now)));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [ready, revisit, key]);
  return phase;
}

// 버튼 → 다음 단계 (cert.md §3.3): 손 뗀 뒤 120ms 에 이동. 다음 화면 데이터(prefetch)가 그때까지 없으면 기다리고,
// 180ms 가 지나도 못 갔으면 버튼에 점 3개 (waiting). 두 번 눌러도 한 번만
const hereKey = () => (window.history.state as { key?: string } | null)?.key;
export function useCertNext() {
  const go = useTossGo();
  const active = useLayerActive();
  const [waiting, setWaiting] = useState(false);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );
  const next = useCallback(
    (to: string, o: TossGoOptions & { prefetch?: string[] } = {}) => {
      if (!active || busy.current) return;
      busy.current = true;
      const at = hereKey();
      const t0 = performance.now();
      const delay = o.delay ?? TOSS_NAV.tapDelay;
      timers.current.push(window.setTimeout(() => setWaiting(true), CERT_T.dotsAfter));
      const done = () => {
        timers.current.forEach((id) => window.clearTimeout(id));
        timers.current = [];
        if (hereKey() !== at || !go(to, { ...o, delay: 0 })) {
          busy.current = false;
          setWaiting(false);
        }
      };
      Promise.all((o.prefetch ?? []).map((p) => prefetchMissing(p))).then(() => {
        timers.current.push(window.setTimeout(done, Math.max(0, delay - (performance.now() - t0))));
      });
    },
    [go, active],
  );
  return { next, waiting };
}
