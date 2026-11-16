// 화면 층은 맨 위만 살아 있음 (ScreenStack) — 뒤로 와서 다시 그려질 때 그 방문 기록 칸(location.key)의 값을 되살림
//  계좌번호 화면의 번호 · 은행, 금액 화면의 금액, 받는 분 목록의 펼침, 완료 화면의 단계
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const mem = new Map<string, unknown>();

export function useKeyed<T>(name: string, init: T) {
  const { key } = useLocation();
  const id = `${name}:${key}`;
  const [v, setV] = useState<T>(() => (mem.has(id) ? (mem.get(id) as T) : init));
  const set = useCallback(
    (next: T | ((p: T) => T)) =>
      setV((p) => {
        const n = typeof next === "function" ? (next as (p: T) => T)(p) : next;
        mem.set(id, n);
        return n;
      }),
    [id],
  );
  return [v, set] as const;
}

// 이 칸에 전에 와 본 적이 있는지 (처음 들어올 때의 움직임 · 기다림을 다시 하지 않으려고)
export function useRevisit(name: string) {
  const { key } = useLocation();
  const id = `seen:${name}:${key}`;
  const [seen] = useState(() => mem.has(id));
  useEffect(() => {
    mem.set(id, true);
  }, [id]);
  return seen;
}
