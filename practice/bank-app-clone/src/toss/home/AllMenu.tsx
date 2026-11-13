import { TOSS_BG_DEEP } from "../ui/Page";
import { TossStub } from "../stub";
import { TabBar } from "./TabBar";

// 기초 단계 자리 — A1 home 영역이 진짜 화면으로 바꿈. /tab/all 전체 메뉴 (assets.md §5.4)
export function AllMenu() {
  return (
    <TossStub
      title="전체"
      area="home"
      header={false}
      bg={TOSS_BG_DEEP}
      dock={<TabBar />}
      links={[
        { label: "내 자산", to: "/assets" },
        { label: "소비", to: "/spend" },
        { label: "내 계좌", to: "/assets/accounts" },
        { label: "토스뱅크 통장", to: "/bank/main" },
        { label: "증명서 발급", to: "/cert" },
      ]}
    />
  );
}
