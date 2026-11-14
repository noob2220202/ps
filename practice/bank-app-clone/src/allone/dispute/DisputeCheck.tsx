// /dispute/check — 신청 전 확인해 주세요 (녹화 C4 1.824–12.07). 이의제기 신청 → disputeApply (흰 막 + 스피너 217ms) 뒤 cut, 제목은 +17
//  - 항목 1–6 을 하나씩: 마지막으로 보인 항목의 확인함을 누르면 (누른 프레임에) 초록 테 · 초록 글자 + 다음 항목이 나타나고,
//    내용이 화면을 넘으면 맨 아래까지 바로 스크롤 (C4 2.707 · 3.291 · 4.191 · 4.924, 움직임 없음)
//  - 5번은 영업점 칸 (확인함 없음): 누르면 칸 테가 초록 + 흰 막 → 영업점검색 (branchOpen). 고르면 돌아오는 cut 에 이름이 들어가 있고 6번이 보이며 맨 아래로 스크롤
//    (C4 10.141). 칸의 초록 테는 이 화면의 다른 곳을 누를 때까지 (11.174)
//  - 다음: 6항목을 다 확인하면 초록 (전에는 흰 바탕 회색 글자). 누르면 누름 모양만 — 더 진행하지 않음 (본인인증부터는 만들지 않음)
//  - ← = 뒤로 (첫 화면, 확인한 것은 사라짐) · 취소 = 다른 흐름의 취소처럼 새로 불러온 홈 (cancelHome 막)
//  - 진행 막대 (첫 단계 = 1/5) 는 머리줄 밑에 붙음 (스크롤해도 화면 108.67 에 남음, C4 4.191)
//  - 오른쪽 스크롤 막대: 스크롤하면 나타나 983ms 뒤 117ms 동안 사라짐 (C4 4.924 → 5.907–6.024)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLayerActive } from "../../platform/LayerContext";
import { useAoFlow } from "../flow";
import { useAoBack } from "../nav";
import { AoButton, AoPage } from "../ui";
import { DISPUTE_BRANCH_ITEM, DISPUTE_CHECK_ITEMS, DISPUTE_CHECK_TITLE, DISPUTE_CONFIRM, DISPUTE_NEXT, DISPUTE_TITLE, type AoBranch } from "./content";
import { DisputeHeader, DisputeVeil, DspMagnifier, DspScrollBar } from "./parts";
import { onDisputeBranchPick, useDisputeVeil, useScrollBar, useStaged } from "./store";
import "./dispute.css";

const N = DISPUTE_CHECK_ITEMS.length;
const TITLE_AFTER = [17] as const; // 제목은 내용보다 한 프레임 늦게 (C4 1.824 → 1.841)

export function DisputeCheck() {
  const flow = useAoFlow();
  const back = useAoBack("/dispute");
  const active = useLayerActive();
  const { veil, run } = useDisputeVeil();
  const titled = useStaged(TITLE_AFTER) > 0;
  const [shown, setShown] = useState(1); // 보이는 항목 수
  const [done, setDone] = useState<boolean[]>(() => Array<boolean>(N).fill(false));
  const [branch, setBranch] = useState<AoBranch | null>(null);
  const [fieldOn, setFieldOn] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const { bar, onScroll } = useScrollBar(body, active);
  const allDone = done.every(Boolean);

  // 영업점검색에서 고른 것 (이 화면이 밑에 숨어 있을 때 옴 → 돌아오는 cut 에 이미 반영)
  useEffect(
    () =>
      onDisputeBranchPick((b) => {
        setBranch(b);
        setDone((d) => d.map((v, i) => v || i === DISPUTE_BRANCH_ITEM));
        setShown((s) => Math.max(s, DISPUTE_BRANCH_ITEM + 2));
      }),
    [],
  );

  // 새 항목이 보이면 맨 아래까지 바로 (넘치지 않으면 그대로)
  useLayoutEffect(() => {
    const el = body.current;
    if (el && shown > 1) el.scrollTop = el.scrollHeight;
  }, [shown]);

  const confirm = (i: number) => {
    if (!active || veil || done[i] || i !== shown - 1) return;
    setDone((d) => d.map((v, k) => v || k === i));
    if (i + 1 < N) setShown(i + 2);
  };

  const openBranch = () => {
    if (!flow.canGo()) return;
    setFieldOn(true);
    run(() => flow.goBranchSearch());
  };

  return (
    <div
      className="ao-dsp"
      onPointerDownCapture={(e) => {
        // 칸의 초록 테는 다른 곳을 누르면 걷힘
        if (fieldOn && !(e.target as HTMLElement).closest(".ao-dsp-check__field")) setFieldOn(false);
      }}
    >
      <AoPage
        className="ao-dsp-page"
        bodyRef={body}
        onScroll={onScroll}
        header={<DisputeHeader variant="flow" title={DISPUTE_TITLE} showTitle={titled} onBack={back} onCancel={() => void flow.goHomeFresh()} />}
        footerClassName="ao-dsp-foot"
        footer={
          <AoButton className="ao-dsp-next" disabled={!allDone} disabledColor="#7a7a7a" weight={400} size={17.9} letterSpacing={0.7} pressed="light">
            {DISPUTE_NEXT}
          </AoButton>
        }
      >
        <div className="ao-dsp-check__bar" aria-hidden>
          <i />
        </div>
        <div className="ao-dsp-check">
          <h2 className="ao-dsp-check__title">{DISPUTE_CHECK_TITLE}</h2>
          {DISPUTE_CHECK_ITEMS.slice(0, shown).map((text, i) => (
            <section key={i} className="ao-dsp-check__item">
              <p className="ao-dsp-check__text">{text}</p>
              {i === DISPUTE_BRANCH_ITEM ? (
                <button
                  type="button"
                  className={`ao-dsp-check__field${fieldOn ? " ao-dsp-check__field--on" : ""}`}
                  aria-label="영업점 검색"
                  onClick={openBranch}
                >
                  <span>{branch?.name ?? ""}</span>
                  <DspMagnifier className="ao-dsp-check__mag" />
                </button>
              ) : (
                <button
                  type="button"
                  className={`ao-dsp-check__ok${done[i] ? " ao-dsp-check__ok--on" : ""}`}
                  aria-pressed={done[i]}
                  onClick={() => confirm(i)}
                >
                  {DISPUTE_CONFIRM}
                </button>
              )}
            </section>
          ))}
        </div>
      </AoPage>
      <DspScrollBar bar={bar} />
      <DisputeVeil on={veil} />
    </div>
  );
}
