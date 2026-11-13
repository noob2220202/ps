import { useTossFlow } from "../flow";
import { useTossGo } from "../nav";
import { TossBottomDock, TossButton } from "../ui/Button";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { certUrl, CERT_PAGE, CERT_T, useCertDoc, useCertQuery } from "./data";
import { CertBar, CertTitle } from "./parts";
import { useCertPhase, useCertRevisit } from "./steps";
import { TransferCertDoc } from "./TransferCertDoc";
import "./cert.css";

const PREVIEW = 344 / CERT_PAGE.w; // 0.9348

// /cert/transfer/done?account=&ids=&at= — D 송금 확인증을 발급했어요 (cert.md §2.7, 녹화 A 83.816 / 89.341). W 를 replace 해서 옴 (뒤로 = M).
// 회색 카드 600ms → 흰 종이 → 150ms 뒤 문서 첫 장 (0.9348 배). 두 버튼은 들어올 때 .4 → 1 (250ms). 문서.pdf 에서 돌아오면 끝 모습 그대로.
// 확인했어요 → 증명서에 들어온 화면으로 (certExit, pop). 파일 저장하기 → 400ms 뒤 문서.pdf (push) — 파일은 만들지 않음
export function CertDone() {
  const q = useCertQuery();
  const doc = useCertDoc(q);
  const go = useTossGo();
  const { certExit } = useTossFlow();
  const { revisit } = useCertRevisit();
  const phase = useCertPhase([CERT_T.doneSkeleton, CERT_T.doneSkeleton + CERT_T.doneDoc], !!doc.data, revisit);
  return (
    <TossPage
      className="toss-cert-done"
      header={<CertBar />}
      dock={
        <TossBottomDock>
          <div className={`toss-cert-done__btns${revisit ? "" : " toss-cert-done__btns--in"}`}>
            <TossButton variant="grey" onPress={certExit}>
              확인했어요
            </TossButton>
            <TossButton onPress={() => go(certUrl("/cert/doc", { account: q.account, ids: q.ids, at: q.at ?? undefined }), { delay: CERT_T.docIdle })}>파일 저장하기</TossButton>
          </div>
        </TossBottomDock>
      }
    >
      <div className="toss-cert-c" style={{ height: 600 }}>
        <CertTitle>송금 확인증을 발급했어요</CertTitle>
        <div className={`toss-cert-done__card${phase >= 1 ? " toss-cert-done__card--paper" : ""}`}>
          {phase >= 2 && doc.data && <TransferCertDoc data={doc.data} scale={PREVIEW} />}
          {doc.error && !doc.data && (
            <TossPressable className="toss-cert-fail" style={{ top: 220 }} onPress={doc.retry}>
              잠시 후 다시 시도해 주세요
            </TossPressable>
          )}
        </div>
      </div>
    </TossPage>
  );
}
