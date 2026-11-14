import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { paths } from "../../api/endpoints";
import { prefetchMissing } from "../../api/useApi";
import { useLayerActive } from "../../platform/LayerContext";
import { carryDepth } from "../nav";
import { TossPage } from "../ui/Page";
import { certUrl, CERT_T, useCertQuery } from "./data";
import { CertBar, CertTitle } from "./parts";
import "./cert.css";

// /cert/transfer/issuing?account=&ids=&at= — W 잠시만 기다려주세요 (cert.md §2.6, 녹화 A 77.44–83.37).
// 제목 반짝임(2.3초) + 퍼지는 고리 (1.28초마다 새 고리, 2.0초에 r 184). 2.6초 뒤 D 로 replace (cut) → 기록에 남지 않음 (D 에서 뒤로 = M).
// 녹화의 1.8초 검은 화면(보안 창 녹화 공백)은 따라 하지 않음. 뒤로 = 발급 취소 → M (cut)
export function CertIssuing() {
  const q = useCertQuery();
  const location = useLocation();
  const navigate = useNavigate();
  const active = useLayerActive();
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const stateRef = useRef(location.state);
  const [opened] = useState(() => Date.now());
  const to = certUrl("/cert/transfer/done", { account: q.account, ids: q.ids, at: q.at ?? opened });
  const account = q.account;
  useEffect(() => {
    // 문서에 쓸 데이터를 미리 (L 에서 받은 그대로면 다시 안 받음)
    prefetchMissing(paths.home);
    if (account) prefetchMissing(paths.transfers(account));
    const key = (window.history.state as { key?: string } | null)?.key;
    const t = window.setTimeout(() => {
      if (!activeRef.current || (window.history.state as { key?: string } | null)?.key !== key) return;
      navigate(to, { replace: true, state: carryDepth(stateRef.current, true) });
    }, CERT_T.issuing);
    return () => window.clearTimeout(t);
  }, [navigate, to, account]);
  return (
    <TossPage className="toss-cert-wait" header={<CertBar />}>
      <div className="toss-cert-c" style={{ height: 500 }}>
        <CertTitle>잠시만 기다려주세요</CertTitle>
        <div className="toss-cert-wait__rings" aria-hidden>
          <i className="toss-cert-wait__ring" />
          <i className="toss-cert-wait__ring" />
        </div>
      </div>
    </TossPage>
  );
}
