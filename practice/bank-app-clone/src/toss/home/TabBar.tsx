import { useLocation } from "react-router-dom";
import { useTossGo } from "../nav";
import { TabIcon, type TossTab } from "../ui/icons";
import { TossPressable } from "../ui/Pressable";
import "../stub.css";

// 기초 단계 자리 — A1 home 영역이 진짜 탭바로 바꿈. 780.5 → 838.33 (57.8), 가운데 x 50.0 / 120.4 / 190.4 / 260.8 / 331.2 (plan.md §0.6)
// 홈에서 탭으로는 push(cut), 탭끼리는 replace(cut), 탭에서 홈은 뒤로 (홈이 방문 기록 첫 칸)
const TABS: [TossTab, string, number][] = [
  ["home", "홈", 50.0],
  ["benefit", "혜택", 120.4],
  ["shopping", "쇼핑", 190.4],
  ["stock", "증권", 260.8],
  ["all", "전체", 331.2],
];

export function TabBar() {
  const go = useTossGo();
  const { pathname } = useLocation();
  const current: TossTab = pathname === "/" ? "home" : ((pathname.split("/")[2] as TossTab) ?? "home");
  const onTab = (t: TossTab) => {
    if (t === current) return;
    if (t === "home") return go(-1, { delay: 0, lock: 150 });
    go(`/tab/${t}`, { replace: current !== "home", delay: 0, lock: 150 });
  };
  return (
    <nav className="toss-stub-tabbar">
      {TABS.map(([t, label, x]) => (
        <TossPressable key={t} className="toss-stub-tabbar__tab" style={{ left: x - 32 }} onPress={() => onTab(t)} ariaLabel={label}>
          <TabIcon tab={t} filled={t === current} size={24} />
          <span>{label}</span>
        </TossPressable>
      ))}
    </nav>
  );
}
