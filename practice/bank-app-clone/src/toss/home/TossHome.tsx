import { useState } from "react";
import { createPortal } from "react-dom";
import { DevPanel } from "../../dev-panel/DevPanel";
import { useTossFlow } from "../flow";
import { TossStub } from "../stub";
import { BellIcon } from "../ui/icons";
import { TOSS_BG_DEEP } from "../ui/Page";
import { useTossPageRoot } from "../ui/shared";
import { TossPressable } from "../ui/Pressable";
import { TabBar } from "./TabBar";

// 기초 단계 자리 — A1 home 영역이 진짜 홈으로 바꿈. '/' (바탕 #100f12, 탭바, 🔔 = 관리 패널). 아래 버튼은 화면 이동 시험용
export function TossHome() {
  const { goBank, goSend } = useTossFlow();
  const [panel, setPanel] = useState(false);
  return (
    <>
      <TossStub
        title="홈"
        area="home"
        header={false}
        bg={TOSS_BG_DEEP}
        dock={<TabBar />}
        links={[
          { label: "토스뱅크 통장 (토스트 + push)", onPress: () => goBank("main", { toast: true }) },
          { label: "송금 (토스트 + LOAD)", onPress: () => goSend({ from: "main", toastFromHome: true }) },
          { label: "소비", to: "/spend" },
          { label: "자산", to: "/assets" },
          { label: "상세 내역 (예시)", to: "/tx/x" },
          { label: "관리 패널", onPress: () => setPanel(true) },
          { label: "공용 부품 견본", to: "/dev/ui" },
        ]}
      />
      <TossPressable className="toss-stub-bell" radius={20} onPress={() => setPanel(true)} ariaLabel="관리 패널">
        <BellIcon size={24} dot />
      </TossPressable>
      <PanelMount open={panel} onClose={() => setPanel(false)} />
    </>
  );
}

// 관리 패널을 화면 뿌리(28dp 띠까지)에 붙임
function PanelMount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const root = useTossPageRoot();
  const node = <DevPanel open={open} onClose={onClose} />;
  return root ? createPortal(node, root) : node;
}
