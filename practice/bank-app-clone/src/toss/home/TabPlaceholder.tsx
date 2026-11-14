// /tab/benefit · /tab/shopping · /tab/stock — 녹화에 없는 탭 (plan.md §1.6): 홈 머리줄 모양에 탭 이름(22 B), 가운데 회색 안내 한 줄,
// 탭바는 그 탭 그림을 채워서. 홈 ↔ 탭은 움직임 없이 (cut), 뒤로 = 홈
import { useParams } from "react-router-dom";
import { TossPage, TOSS_BG_DEEP } from "../ui/Page";
import { TossRedirect } from "../ui/Redirect";
import { TabBar } from "./TabBar";
import "./home.css";

const NAME: Record<string, string> = { benefit: "혜택", shopping: "쇼핑", stock: "증권" };

export function TabPlaceholder() {
  const { tab = "" } = useParams();
  if (!Object.hasOwn(NAME, tab)) return <TossRedirect to="/" />; // 없는 탭 (toString 같은 이름도)
  return (
    <TossPage
      bg={TOSS_BG_DEEP}
      className="toss-home"
      header={
        <div className="toss-home-head">
          <span className="toss-home-ph__title">{NAME[tab]}</span>
        </div>
      }
      dock={<TabBar />}
    >
      <p className="toss-home-ph__msg">연습용 클론에서는 아직 없는 화면이에요</p>
    </TossPage>
  );
}
