// 토스 공용 부품 견본 (/dev/ui, 기초 단계 확인용 — 영역이 부품 모양을 볼 때). 녹화에 없는 화면
import { useEffect, useState } from "react";
import { cutTossLoad, showTossLoad, showTossWaitBox } from "./loading";
import { showTossToast } from "./toast";
import { TossAppBar } from "./ui/AppBar";
import { TossBankLogo } from "./ui/BankLogo";
import { TossBottomDock, TossButton, TossButtonPair, TOSS_DOCK_SPACE } from "./ui/Button";
import { TossDialog } from "./ui/Dialog";
import { ChevronRightIcon, StarIcon } from "./ui/icons";
import { TossOdometer } from "./ui/Odometer";
import { TossPage } from "./ui/Page";
import { TossProgressBar } from "./ui/ProgressBar";
import { TossRow } from "./ui/Row";
import { TossSheet } from "./ui/Sheet";
import { TossSkeleton } from "./ui/Skeleton";
import { TossSpinner } from "./ui/Spinner";

export function UiGallery() {
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [n, setN] = useState(1_250_000);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 900);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <TossPage
      header={<TossAppBar title="공용 부품" progress={<TossProgressBar ready={ready} />} />}
      dock={
        <TossBottomDock fade>
          <TossButton loading={loading} onPress={() => (setLoading(true), window.setTimeout(() => setLoading(false), 1500))}>
            확인
          </TossButton>
        </TossBottomDock>
      }
    >
      <div style={{ padding: `8px 0 ${TOSS_DOCK_SPACE}px`, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ padding: "0 24px", fontSize: 28, fontWeight: 700 }}>
          <TossOdometer id="gallery" value={n} />
        </div>
        <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <TossButtonPair>
            <TossButton variant="grey" onPress={() => setN(n + 37_000)}>
              + 37,000
            </TossButton>
            <TossButton variant="weak" onPress={() => setN(Math.max(0, n - 8_500))}>
              − 8,500
            </TossButton>
          </TossButtonPair>
          <TossButtonPair>
            <TossButton variant="secondary" onPress={() => setSheet(true)}>
              시트
            </TossButton>
            <TossButton onPress={() => setDialog(true)}>안내창</TossButton>
          </TossButtonPair>
          <TossButtonPair>
            <TossButton variant="grey" onPress={() => showTossToast("토스뱅크")}>
              토스트
            </TossButton>
            <TossButton
              variant="grey"
              onPress={() => {
                const id = showTossLoad();
                window.setTimeout(() => cutTossLoad(id), 1000);
              }}
            >
              LOAD
            </TossButton>
            <TossButton
              variant="grey"
              onPress={() => {
                const hide = showTossWaitBox(0);
                window.setTimeout(hide, 1500);
              }}
            >
              기다림
            </TossButton>
          </TossButtonPair>
          <TossButton disabled>disabled</TossButton>
        </div>
        {(["toss", "hana", "kakao", "nh", "kb", "woori"] as const).map((code) => (
          <TossRow
            key={code}
            icon={<TossBankLogo code={code} size={40} />}
            title={code}
            sub="1000-1234-5678"
            right={<StarIcon size={24} on={code === "hana"} />}
            onPress={() => {}}
            height={68}
            inset="0 8px"
            radius={12}
            scale={0.98}
          />
        ))}
        <TossRow title="오른쪽 화살표" right={<ChevronRightIcon size={20} color="#7a797e" />} height={56} onPress={() => {}} />
        <div style={{ padding: "0 24px", display: "flex", gap: 12, alignItems: "center" }}>
          <TossSkeleton w={30} h={30} r={10} />
          <TossSkeleton w={140} h={14} />
          <TossSkeleton w={60} h={14} tone="web" />
          <TossSpinner />
          <TossSpinner variant="blue" />
        </div>
      </div>
      <TossSheet open={sheet} onClose={() => setSheet(false)} title="은행을 선택해주세요" top={169.7}>
        <div style={{ padding: "0 28px 28px", color: "#97979c" }}>시트 내용</div>
      </TossSheet>
      <TossDialog open={dialog} title="계좌번호를 찾을 수 없어요" body="돈을 보내려는 계좌번호를 다시 확인해주세요." onClose={() => setDialog(false)} />
    </TossPage>
  );
}
