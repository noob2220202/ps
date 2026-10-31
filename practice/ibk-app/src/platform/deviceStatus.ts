// 상태바 배터리 잔량·시계 (폰 아래 스위치 줄에서 바꿈). 이 브라우저에 기억됨
// 시계: 정한 시각부터 흘러감 = 실제 시각과의 차이(offset)를 저장. null 이면 실제 시각
import { useEffect, useState, useSyncExternalStore } from "react";

type Status = { battery: number; offset: number | null };
const KEY = "deviceStatus";

function load(): Status {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v.battery === "number") return { battery: v.battery, offset: typeof v.offset === "number" ? v.offset : null };
  } catch {
    // 처음이거나 못 읽으면 기본값
  }
  return { battery: 62, offset: null };
}

let status = load();
const listeners = new Set<() => void>();
function save(next: Status) {
  status = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장 못 하면 이번에만
  }
  listeners.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));

export const useDeviceStatus = () => useSyncExternalStore(subscribe, () => status);
export const setBattery = (n: number) => save({ ...status, battery: Math.max(0, Math.min(100, Math.round(n))) });
// "HH:MM" → 오늘 그 시각(초 0)이 지금이 되게
export function setClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return;
  const target = new Date();
  target.setHours(h, m, 0, 0);
  save({ ...status, offset: target.getTime() - Date.now() });
}
export const syncClock = () => save({ ...status, offset: null });

// 상태바 시각 (1초마다 확인해서 분이 바뀌면 바로)
export function useNow() {
  const { offset } = useDeviceStatus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return new Date(now + (offset ?? 0));
}
