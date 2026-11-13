import { paths } from "../../api/endpoints";
import { TossBottomDock, TossButton } from "../ui/Button";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { TossProgressBar } from "../ui/ProgressBar";
import { CERT_T } from "./data";
import { CertBar, CertTitle } from "./parts";
import { useCertNext, useCertPhase, useCertRevisit } from "./steps";
import "./cert.css";

// 옅은 뼈대 (녹화 66.97–67.04, 화면 y): 제목 26–192 × 106–134, 부제 26–136 × 149–170, 동그라미 ⌀40 + 막대 83–354 세 줄 (간격 74)
const SKEL_ROWS = [205, 279, 353];

// /cert/transfer — I 송금 확인증 (cert.md §2.2, 녹화 A 68.449). 들어오면 진행 막대 → 옅은 뼈대 → 600ms 에 내용 (뒤로 와서는 바로).
// 발급하기 → A (cut, 계좌 데이터를 받아 둠, 180ms 안에 못 가면 점 3개). 언어 · 국문은 누름 표시만
export function CertIntro() {
  const { revisit } = useCertRevisit();
  const phase = useCertPhase([CERT_T.introSkeleton, CERT_T.introContent], true, revisit);
  const { next, waiting } = useCertNext();
  const ready = phase >= 2;
  return (
    <TossPage
      className="toss-cert-intro"
      header={<CertBar progress={<TossProgressBar ready={ready} />} />}
      dock={
        ready && (
          <TossBottomDock>
            <TossButton loading={waiting} onPress={() => next("/cert/transfer/account", { prefetch: [paths.home] })}>
              발급하기
            </TossButton>
          </TossBottomDock>
        )
      }
    >
      <div className="toss-cert-c">
        {phase === 1 && (
          <>
            <i className="toss-cert-skel toss-skel" style={{ left: 26, top: 106 - 81.6, width: 166, height: 28 }} />
            <i className="toss-cert-skel toss-skel" style={{ left: 26, top: 149 - 81.6, width: 110, height: 21 }} />
            {SKEL_ROWS.map((y) => (
              <span key={y}>
                <i className="toss-cert-skel toss-skel" style={{ left: 30, top: y - 81.6, width: 40, height: 40, borderRadius: 20 }} />
                <i className="toss-cert-skel toss-skel" style={{ left: 83, top: y + 8 - 81.6, width: 271, height: 24 }} />
              </span>
            ))}
          </>
        )}
        {ready && (
          <>
            <CertTitle>송금 확인증</CertTitle>
            <p className="toss-cert-t toss-cert-intro__sub">다른 계좌로 돈을 보낸 내역을 확인할 수 있어요.</p>
            <TossPressable className="toss-cert-intro__lang" radius={10} color="rgba(255,255,255,0.05)" fadeIn={100} fadeOut={120}>
              <p className="toss-cert-t toss-cert-intro__label" style={{ left: 20.8, top: 149.08 - 136 }}>
                언어
              </p>
              <p className="toss-cert-t toss-cert-intro__value" style={{ left: 21.1, top: 170.77 - 136 }}>
                국문
              </p>
            </TossPressable>
          </>
        )}
      </div>
    </TossPage>
  );
}
