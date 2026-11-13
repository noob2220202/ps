import { useParams } from "react-router-dom";
import { TOSS_BG_DEEP } from "../ui/Page";
import { TossStub } from "../stub";
import { TabBar } from "./TabBar";

// 기초 단계 자리 — A1 home 영역이 진짜 화면으로 바꿈. /tab/benefit · /tab/shopping · /tab/stock (plan.md §1.6)
const NAME: Record<string, string> = { benefit: "혜택", shopping: "쇼핑", stock: "증권" };
export function TabPlaceholder() {
  const { tab = "" } = useParams();
  return <TossStub title={NAME[tab] ?? tab} area="home" header={false} bg={TOSS_BG_DEEP} dock={<TabBar />} sub="연습용 클론에서는 아직 없는 화면이에요" />;
}
