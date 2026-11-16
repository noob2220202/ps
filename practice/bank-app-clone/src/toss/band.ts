// 토스 아래 내비게이션 띠 (838.33–853.33, PhoneFrame 의 .phone__navbar 를 toss.css 가 화면 위에 겹친 층으로 바꿈) 의 모드.
// plan.md §0.4 — 녹화 두 개를 4fps 로 훑어 잰 색:
//   solid  #171619 / 손잡이 #6b6a6d  기본 (모든 화면)
//   kb     #090909 / #616161          삼성 키보드가 떠 있을 때 (HanaKeyboard 의 data-hana-kb 도 같은 색, toss.css)
//   dim    #050407 / #5e5d60          시트 배경막(.61) 아래
//   scrim  rgba(0,0,0,.43) / #646366  소비 화면만: 목록이 띠 밑으로 비쳐 보임
// 화면은 useTossBand(mode) 로 켜 둠 (마운트돼 있고 맨 위 층인 동안). 여럿이면 나중에 켠 것. <html data-toss-band="…">
import { useEffect } from "react";
import { useLayerActive } from "../platform/LayerContext";

export type TossBandMode = "solid" | "kb" | "dim" | "scrim";

let seq = 0;
const stack: { id: number; mode: TossBandMode }[] = [];
function apply() {
  const top = stack[stack.length - 1];
  const root = document.documentElement;
  if (!top || top.mode === "solid") delete root.dataset.tossBand;
  else root.dataset.tossBand = top.mode;
}

// 띠 모드를 켬. 돌려준 함수로 끔 (컴포넌트 밖에서 쓸 때)
export function pushTossBand(mode: TossBandMode) {
  const id = ++seq;
  stack.push({ id, mode });
  apply();
  return () => {
    const i = stack.findIndex((s) => s.id === id);
    if (i >= 0) stack.splice(i, 1);
    apply();
  };
}

// mode 가 null 이거나 이 층이 맨 위가 아니면(전환 중 나가는 층 · 밑 층) 아무것도 안 함
export function useTossBand(mode: TossBandMode | null | false, enabled = true) {
  const active = useLayerActive();
  const on = !!mode && enabled && active;
  useEffect(() => {
    if (!on || !mode) return;
    return pushTossBand(mode);
  }, [on, mode]);
}
