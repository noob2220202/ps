// /dispute — 이의제기 신청 및 조회 첫 화면 (녹화 C4 0.0–1.8). 통합검색 결과 '이의제기 신청 및 조회' → disputeLink 막 뒤 cut.
//  처음 그려질 때 (C4 0.024 → 0.424, cut 은 막 밑): 빈 흰 화면 + 가운데 all one 스피너 (막이 걷힌 뒤 한 프레임 보임, C4 0.024)
//    → +50 머리줄(제목 없이) + 가운데 초록 화살표 그림 (웹 화면 자기 로딩 그림, 움직이지 않음, 0.041)
//    → +267 내용 · 아래 버튼 (화살표 꺼짐, 0.257) → +301 제목 (0.291) → +434 그림 (0.424)
//  ← = 뒤로 (통합검색 결과) · 집 = 홈 · ≡🔍 = 전체메뉴 · 신청내역 조회 = 누름만 · 이의제기 신청 = 흰 막 + 스피너 (disputeApply) → 신청 전 확인
//  본문은 스크롤 (신청절차는 아래 버튼 줄 밑으로 이어짐 — 녹화는 제목 윗부분만 보임)
import { localAsset } from "../../assets/Asset";
import { useAoFlow } from "../flow";
import { useAoBack } from "../nav";
import { AoButton, AoPage, AoSpinner } from "../ui";
import { DISPUTE_INTRO as T, DISPUTE_TITLE } from "./content";
import { DisputeHeader, DisputeVeil } from "./parts";
import { useDisputeVeil, useStaged } from "./store";
import "./dispute.css";

// 처음 그린 뒤 (cut 부터): 머리줄 + 화살표 · 내용 · 제목 · 그림. 막은 cut + 33 에 걷히고 (nav.ts disputeLink) 그 뒤 한 프레임은 빈 화면 + 스피너
const STAGES = [50, 267, 301, 434] as const;

export function DisputeIntro() {
  const flow = useAoFlow();
  const back = useAoBack("/");
  const { veil, run } = useDisputeVeil();
  const stage = useStaged(STAGES);
  const art = localAsset("allone-dispute-clipboard");
  const arrow = localAsset("allone-dispute-arrow");

  const apply = () => {
    if (!flow.canGo()) return;
    run(() => flow.goDisputeCheck());
  };

  return (
    <div className="ao-dsp">
      <AoPage
        className="ao-dsp-page"
        header={
          <DisputeHeader
            variant="nav"
            title={DISPUTE_TITLE}
            blank={stage < 1}
            showTitle={stage >= 3}
            onBack={back}
            onHome={() => void flow.goHome()}
            onMenu={() => void flow.goMenu()}
          />
        }
        footerClassName="ao-dsp-foot ao-dsp-intro__foot"
        footer={
          stage >= 2 ? (
            <>
              <AoButton variant="outline" weight={400} size={18} width={169.65} className="ao-dsp-intro__history">
                {T.history}
              </AoButton>
              <AoButton weight={400} size={18} width={167.4} pressed="light" className="ao-dsp-intro__apply" onPress={apply}>
                {T.apply}
              </AoButton>
            </>
          ) : (
            <div className="ao-dsp-intro__footgap" />
          )
        }
      >
        {stage >= 2 && (
          <div className="ao-dsp-intro">
            <h2 className="ao-dsp-intro__head">
              {T.headline.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </h2>
            <div className="ao-dsp-intro__art">{stage >= 4 && art && <img src={art} alt="" aria-hidden draggable={false} />}</div>
            <h3 className="ao-dsp-intro__h">{T.targetTitle}</h3>
            <p className="ao-dsp-intro__target">
              {T.target.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </p>
            <p className="ao-dsp-intro__note">{T.targetNote}</p>
            <h3 className="ao-dsp-intro__h ao-dsp-intro__h--steps">{T.stepsTitle}</h3>
            <ol className="ao-dsp-intro__steps">
              {T.steps.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ol>
          </div>
        )}
      </AoPage>
      {stage === 0 && (
        <div className="ao-dsp-spin">
          <AoSpinner size={61} />
        </div>
      )}
      {stage === 1 && arrow && <img className="ao-dsp-wait" src={arrow} alt="" aria-hidden draggable={false} />}
      <DisputeVeil on={veil} />
    </div>
  );
}
