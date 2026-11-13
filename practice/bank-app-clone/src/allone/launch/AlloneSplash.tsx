// [기초 단계 자리 — launch 영역이 이 파일을 진짜 시작 흐름으로 바꿈: 흰 시작화면 → 스플래시 → 간편비밀번호 → 로그인 로딩]
// 지금은 앱을 쓸 수 있게 최소한만: 흰 화면 → (D+1450 에) 로그인 로딩 막(login 프로필, 홈 데이터를 막 동안 받음) → cut 에 onDone (홈이 막 밑에 그려짐)
// 계약 (plan.md §3.5): export function AlloneSplash({ onDone }: { onDone: () => void })
import { useEffect, useRef } from "react";
import { prefetch } from "../../api/useApi";
import { useStatusBar } from "../../hooks/useStatusBar";
import { aoPaths } from "../api";
import { aoLaunchAt } from "../launch";
import { aoLoad } from "../loading";
import { AO_INTRO } from "../motion";

export function AlloneSplash({ onDone }: { onDone: () => void }) {
  useStatusBar("#ffffff", "dark");
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    let alive = true;
    // 흰 시작화면은 D + 1450 까지 (D = 앱이 켜진 때, launch.ts)
    const at = aoLaunchAt();
    const wait = Math.max(300, (at ?? performance.now()) + AO_INTRO.splashAt - performance.now());
    const t = window.setTimeout(() => {
      if (!alive) return;
      void aoLoad("login", { task: prefetch(aoPaths.home), onCut: () => alive && done.current() });
    }, wait);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, []);
  return <div className="ao-stub-white" />;
}
