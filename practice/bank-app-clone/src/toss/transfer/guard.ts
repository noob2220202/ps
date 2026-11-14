// 갤럭시 뒤로 받기 (이체 영역). 자판 · 시트처럼 방문 기록 한 칸을 쌓는 것(nav.ts useTossBackStep)을 닫은 뒤 다른 일을 하려면
// 그 칸이 빠지는(popstate) 것을 기다려야 함 — 기다리지 않고 바로 다음 칸을 쌓거나 바꾸면 순서가 꼬임
import { useEffect, useRef } from "react";
import { tossAfterLock, tossBackLevel } from "../nav";

// 다음 popstate 까지 (안 오면 ms 뒤)
export const nextPop = (ms = 150) =>
  new Promise<void>((ok) => {
    const done = () => {
      window.removeEventListener("popstate", done);
      window.clearTimeout(t);
      ok();
    };
    const t = window.setTimeout(done, ms);
    window.addEventListener("popstate", done);
  });

// 이체 완료(S7/S8) 지킴 칸: 이 화면이 맨 위인 동안 방문 기록 한 칸(tossBack 1)을 쌓아 두고, 뒤로가기로 그 칸이 빠지면 onBack
// (hold() 가 true 면 onBack 없이 칸을 바로 다시 쌓음 — 보내는 중엔 뒤로가기를 받지 않음).
// onBack 은 이동 잠금이 풀린 뒤에 (메모 화면에서 막 돌아왔으면 잠금 중 — 버리면 지킴 칸만 빠지고 다음 뒤로가 끝난 이체 화면으로 감).
// 메모 화면을 push 했다 돌아와도 칸을 또 쌓지 않음 (useTossBackStep 은 돌아올 때 한 칸을 더 쌓음).
// leave(): 지킴 칸을 걷어 내고(onBack 은 부르지 않음) 화면 주소 칸에서 fn — 확인 버튼이 replace 로 광고 화면을 열 때
export function useDoneGuard(active: boolean, onBack: () => void, hold: () => boolean = () => false) {
  const ref = useRef(onBack);
  const holdRef = useRef(hold);
  const leaving = useRef(false);
  useEffect(() => {
    ref.current = onBack;
    holdRef.current = hold;
  });
  useEffect(() => {
    if (!active) return;
    const arm = () => {
      if (!leaving.current && tossBackLevel() === 0) window.history.pushState({ ...window.history.state, tossBack: 1 }, "");
    };
    const t = window.setTimeout(arm);
    let cancel = () => {};
    const onPop = () => {
      if (leaving.current || tossBackLevel() > 0) return;
      cancel();
      if (holdRef.current()) window.setTimeout(arm);
      else cancel = tossAfterLock(() => ref.current());
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("popstate", onPop);
      cancel();
    };
  }, [active]);
  return (fn: () => void) => {
    if (leaving.current) return;
    const lv = tossBackLevel();
    if (!lv) return fn();
    leaving.current = true;
    const wait = nextPop(300);
    window.history.go(-lv);
    wait.then(() => {
      leaving.current = false;
      fn();
    });
  };
}
