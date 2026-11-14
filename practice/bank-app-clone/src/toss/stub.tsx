// 아직 안 만든 토스 화면 자리 (기초 단계). 영역(home · account · transfer · cert · assets)이 자기 폴더의 stub 파일을 진짜 화면으로 바꿈.
// 화면 이동 시험용으로 다른 주소로 가는 버튼을 둘 수 있음
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { TossBandMode } from "./band";
import { useTossGo } from "./nav";
import { TossAppBar } from "./ui/AppBar";
import { TossPage } from "./ui/Page";
import { TossPressable } from "./ui/Pressable";
import "./stub.css";

export interface TossStubLink {
  label: string;
  to?: string;
  state?: Record<string, unknown>;
  replace?: boolean;
  onPress?: () => void; // to 대신
}

export function TossStub({
  title,
  area,
  sub,
  links = [],
  bg,
  back = true,
  header = true,
  dock,
  navMode,
}: {
  title: string;
  area: string;
  sub?: ReactNode;
  links?: TossStubLink[];
  bg?: string;
  back?: boolean;
  header?: boolean;
  dock?: ReactNode;
  navMode?: TossBandMode;
}) {
  const go = useTossGo();
  const loc = useLocation();
  return (
    <TossPage bg={bg} header={header ? <TossAppBar title={title} onBack={back ? undefined : false} /> : undefined} dock={dock} navMode={navMode}>
      <div className="toss-stub">
        <p className="toss-stub__title">{title}</p>
        <p className="toss-stub__sub">
          {sub ?? (
            <>
              {area} · {loc.pathname}
              {loc.search}
            </>
          )}
        </p>
        {links.map((l) => (
          <TossPressable
            key={`${l.to}${l.label}`}
            className="toss-stub__link"
            radius={14}
            onPress={() => (l.onPress ? l.onPress() : l.to && go(l.to, { state: l.state, replace: l.replace }))}
          >
            {l.label}
          </TossPressable>
        ))}
      </div>
    </TossPage>
  );
}
