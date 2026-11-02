import { useEffect, useRef } from "react";
import type { KbankKey } from "./keypad";

// 안드로이드 뒤로(3버튼 바 <)를 이체 화면 안에서 받기 — 금액·확인 단계는 뒤로 한 번에 한 단계씩.
// active 인 동안 방문 기록 한 칸(주소·라우터 상태 그대로 + ibkBack 깊이)을 쌓아 두고, 뒤로가기로 그 칸이 빠지면 onBack.
// 깊이 표시는 i-ONE 과 같은 history.state.ibkBack 을 씀 → 공용 ScreenStack 이 '화면 안 뒤로가기 칸'으로 알아봄(iOS 가장자리 끌기 막음)
export const kbBackLevel = () => (window.history.state as { ibkBack?: number } | null)?.ibkBack ?? 0;

// history.go(delta) 하고 도착(popstate)까지 기다림. 안 오면 300ms 뒤 끝
export function kbHistoryGo(delta: number) {
  if (!delta) return Promise.resolve();
  return new Promise<void>((done) => {
    const end = () => {
      window.removeEventListener("popstate", end);
      window.clearTimeout(t);
      done();
    };
    const t = window.setTimeout(end, 300);
    window.addEventListener("popstate", end);
    window.history.go(delta);
  });
}

// key 가 바뀌면(뒤로가기로 칸이 빠진 뒤) 다시 쌓음. 칸이 있는 채로 key 만 바뀌면 그대로 둠
export function useKbankBackStep(active: boolean, onBack: () => void, key?: unknown) {
  const ref = useRef(onBack);
  useEffect(() => {
    ref.current = onBack;
  });
  const depth = useRef(0);
  useEffect(() => {
    if (!active) return;
    const onPop = () => {
      if (!depth.current || kbBackLevel() >= depth.current) return; // 더 위에 쌓인 다른 칸이 빠진 것
      depth.current = 0;
      ref.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (depth.current && kbBackLevel() === depth.current) window.history.back();
      depth.current = 0;
    };
  }, [active]);
  // 한 박자 늦게 쌓기: 개발 모드(StrictMode)가 effect 를 두 번 돌려도 한 칸만
  useEffect(() => {
    if (!active || depth.current) return;
    const t = window.setTimeout(() => {
      if (depth.current) return;
      depth.current = kbBackLevel() + 1;
      window.history.pushState({ ...window.history.state, ibkBack: depth.current }, "");
    });
    return () => window.clearTimeout(t);
  }, [active, key]);
}

export const kbNf = new Intl.NumberFormat("ko-KR");

// 금액 읽기: 만 미만은 "2,000원", 만 이상은 "1만 5,000원" (프레임 860 '1원')
export function kbReadWon(n: number) {
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  if (!man) return `${kbNf.format(rest)}원`;
  return `${kbNf.format(man)}만${rest ? ` ${kbNf.format(rest)}` : ""}원`;
}

// 자판 → 금액 (11자리까지, 앞자리 0 은 안 붙음)
export function kbPress(a: number, k: KbankKey) {
  if (k === "back") return Math.floor(a / 10);
  const s = `${a || ""}${k}`.replace(/^0+/, "");
  return s.length > 11 ? a : Number(s || 0);
}
