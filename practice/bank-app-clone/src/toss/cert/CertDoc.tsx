import { TossPage, TOSS_BG } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { certPages, useCertDoc, useCertQuery } from "./data";
import { CertBar, CertShareIcon } from "./parts";
import { TransferCertDoc } from "./TransferCertDoc";
import "./cert.css";

// /cert/doc?account=&ids=&at= — V 문서.pdf (cert.md §2.8, 녹화 A 92.236). 머리줄 #171619 + 제목 '문서.pdf' + 공유(누름 표시만),
// 본문 #dddee3 에 A4 종이(368 × 520.4, x 8–376 · y 100.8–620). 여러 장이면 19.2 간격으로 쌓고 스크롤.
// 워터마크 · 빈 도장 · 가짜 진위확인 그대로 (TransferCertDoc). 내려받기 · 인쇄 · 공유는 없음
export function CertDoc() {
  const q = useCertQuery();
  const doc = useCertDoc(q);
  const data = doc.data;
  return (
    <TossPage
      className="toss-cert-docview"
      bg="#dddee3"
      band={TOSS_BG}
      header={
        <CertBar
          bg={TOSS_BG}
          title="문서.pdf"
          right={
            <TossPressable className="toss-cert-docview__share" radius={22} inset={-10} ariaLabel="공유">
              <CertShareIcon />
            </TossPressable>
          }
        />
      }
    >
      {data && (
        <div className="toss-cert-docview__pages">
          {certPages(data.rows).map((_, i) => (
            <TransferCertDoc key={i} data={data} page={i} />
          ))}
        </div>
      )}
      {doc.error && !data && (
        <TossPressable className="toss-cert-fail" onPress={doc.retry}>
          잠시 후 다시 시도해 주세요
        </TossPressable>
      )}
    </TossPage>
  );
}
