// 홈 아래 탭바 (home.md §2.5, plan.md §0.6): y 780 → 화면 끝 (838.33 아래는 내비 띠가 같은 #171619 로 이어 그림),
// 위 · 옆 0.8dp #2b2a2d 테두리, 위 모서리 20.8. 그림 가운데 x 50.0 · 120.0 · 190.4 · 260.8 · 331.2, 글자 가운데 50.4 · 120.4 · 190.8 · 261.2 · 331.6.
// 고른 탭은 그림만 채움 (글자 색은 모두 같음). 탭 바꾸기는 움직임 없이 바로 (cut):
// 홈에서 탭으로는 push(방문 기록 한 칸), 탭끼리는 replace, 탭에서 홈은 뒤로 (방문 기록이 없으면 '/' 로 바꿈)
import { useLocation } from "react-router-dom";
import { useTossGo } from "../nav";
import { TossPressable } from "../ui/Pressable";
import { TAB_CX, type HomeTab } from "./boot";
import { TabGlyph } from "./icons";

const TABS: [HomeTab, string, number][] = [
  ["home", "홈", 50.4],
  ["benefit", "혜택", 120.4],
  ["shopping", "쇼핑", 190.8],
  ["stock", "증권", 261.2],
  ["all", "전체", 331.6],
];
const isTab = (t: string): t is HomeTab => TABS.some(([k]) => k === t);
const historyIdx = () => (window.history.state as { idx?: number } | null)?.idx ?? 0;

export function TabBar() {
  const go = useTossGo();
  const { pathname } = useLocation();
  const seg = pathname.split("/")[2] ?? "";
  const current: HomeTab = pathname === "/" ? "home" : isTab(seg) ? seg : "home";
  const onTab = (t: HomeTab) => {
    if (t === current) return;
    const o = { delay: 0, lock: 150 };
    if (t === "home") return historyIdx() > 0 ? go(-1, o) : go("/", { ...o, replace: true });
    go(`/tab/${t}`, { ...o, replace: current !== "home" });
  };
  return (
    <nav className="toss-home-tabbar">
      {TABS.map(([t, label, lx]) => (
        <TossPressable
          key={t}
          className={`toss-home-tab${t === current ? " toss-home-tab--on" : ""}`}
          style={{ left: `calc(${(lx - 35.2) / 384} * (100% + 1.6px) - 0.8px)` }}
          color="transparent"
          scale={0.94}
          onPress={() => onTab(t)}
          ariaLabel={label}
        >
          <span style={{ position: "absolute", left: TAB_CX[t] - 14 - (lx - 35.2) }}>
            <TabGlyph tab={t} filled={t === current} />
          </span>
          <span className="toss-home-tab__l">{label}</span>
        </TossPressable>
      ))}
    </nav>
  );
}
