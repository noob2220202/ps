import { useLayoutEffect, useRef, useState } from "react";
import { TossPage, TOSS_BG } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { TossRedirect } from "../ui/Redirect";
import { certPages, CERT_PAGE, useCertDoc, useCertQuery } from "./data";
import { CertBar, CertShareIcon } from "./parts";
import { TransferCertDoc } from "./TransferCertDoc";
import "./cert.css";

// /cert/doc?account=&ids=&at= — V 문서.pdf (cert.md §2.8, 녹화 A 92.236). 머리줄 #171619 + 제목 '문서.pdf' + 공유(누름 표시만),
// 본문 #dddee3 에 A4 종이(367.4 × 519.6, x 8–375.4 · y 100.8–620.4). 여러 장이면 19.2 간격으로 쌓고 스크롤.
// 384 보다 좁은 폰에서는 양옆 8 을 남기고 종이를 줄임.
// 워터마크 · 빈 도장 · 가짜 진위확인 그대로 (TransferCertDoc). 내려받기 · 인쇄 · 공유는 없음
export function CertDoc() {
  // 고른 내역 없이 주소를 바로 열었음 → 증명서 첫 화면
  return useCertQuery().ids.length ? <DocBody /> : <TossRedirect to="/cert" />;
}

function DocBody() {
  const q = useCertQuery();
  const doc = useCertDoc(q);
  const data = doc.data;
  const body = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const fit = () => setK(Math.min(1, (el.clientWidth - 16) / CERT_PAGE.w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <TossPage
      className="toss-cert-docview"
      bg="#dddee3"
      band={TOSS_BG}
      bodyRef={body}
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
        <div className="toss-cert-docview__pages" style={{ paddingLeft: `calc(50% - ${(CERT_PAGE.w * k) / 2 + 0.3}px)` }}>
          {certPages(data.rows).map((_, i) => (
            <TransferCertDoc key={i} data={data} page={i} scale={k} />
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
