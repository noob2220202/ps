import { paths } from "../../api/endpoints";
import { TossBottomDock, TossButton } from "../ui/Button";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { TossProgressBar } from "../ui/ProgressBar";
import { CERT_T } from "./data";
import { CertBar, CertTitle } from "./parts";
import { useCertNext, useCertPhase, useCertRevisit } from "./steps";
import "./cert.css";

// 옅은 뼈대 (녹화 A 66.49–66.96 을 잼, 화면 좌표): 제목 24.8–192 × 105.6–135.2, 부제 24–135.2 × 147.2–169.6,
// 동그라미 ⌀39.2 (x 25.8) + 같은 높이 40 막대 x 79.2–358 세 줄 (위끝 207.2, 간격 73.6)
const SKEL_ROWS = [207.2, 280.8, 354.4];

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
            <i className="toss-cert-skel toss-skel" style={{ left: 24.8, top: 105.6 - 81.6, width: 167.2, height: 29.6 }} />
            <i className="toss-cert-skel toss-skel" style={{ left: 24, top: 147.2 - 81.6, width: 111.2, height: 22.4 }} />
            {SKEL_ROWS.map((y) => (
              <span key={y}>
                <i className="toss-cert-skel toss-skel" style={{ left: 25.8, top: y - 81.6, width: 39.2, height: 39.2, borderRadius: 19.6 }} />
                <i className="toss-cert-skel toss-skel" style={{ left: 79.2, top: y - 81.6, width: 278.8, height: 40 }} />
              </span>
            ))}
          </>
        )}
        {ready && (
          <>
            <CertTitle>송금 확인증</CertTitle>
            <p className="toss-cert-t toss-cert-intro__sub">다른 계좌로 돈을 보낸 내역을 확인할 수 있어요.</p>
            <TossPressable className="toss-cert-intro__lang" radius={10} color="rgba(255,255,255,0.05)" fadeIn={100} fadeOut={120}>
              <p className="toss-cert-t toss-cert-intro__label">언어</p>
              <p className="toss-cert-t toss-cert-intro__value">국문</p>
            </TossPressable>
          </>
        )}
      </div>
    </TossPage>
  );
}
