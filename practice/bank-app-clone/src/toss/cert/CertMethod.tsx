import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { certUrl, CERT_T, useCertQuery } from "./data";
import { CertBar, CertChevronRight, CertTitle } from "./parts";
import { useCertNext } from "./steps";
import "./cert.css";

// 잉크 위끝 180.0 / 236.0 / 292.0 (간격 56) → 줄 칸 = 잉크 가운데 ± 28, 본문 좌표
const ROWS = ["휴대폰에 저장", "이메일", "팩스"];
const ROW0 = 188 - 28 - 81.6;

// /cert/transfer/method?account=&ids= — M 증명서를 어떻게 받을까요? (cert.md §2.5, 녹화 A 76.040). 버튼 없음.
// 휴대폰에 저장 → 발급 시각(at)을 주소에 담아 W 로 (cut, 150ms 뒤). 이메일 · 팩스는 누름 표시만
export function CertMethod() {
  const q = useCertQuery();
  const { next } = useCertNext();
  const save = () => next(certUrl("/cert/transfer/issuing", { account: q.account, ids: q.ids, at: Date.now() }), { delay: CERT_T.methodTap });
  return (
    <TossPage className="toss-cert-method" header={<CertBar />}>
      <div className="toss-cert-c" style={{ height: 400 }}>
        <CertTitle>증명서를 어떻게 받을까요?</CertTitle>
        {ROWS.map((label, i) => (
          <TossPressable
            key={label}
            className="toss-cert-row toss-cert-method__row"
            style={{ top: ROW0 + 56 * i }}
            inset="0 4px"
            radius={10}
            color="rgba(255,255,255,0.06)"
            fadeIn={100}
            fadeOut={120}
            onPress={i === 0 ? save : undefined}
          >
            <p className="toss-cert-t toss-cert-narrow toss-cert-method__label">{label}</p>
            <CertChevronRight className="toss-cert-method__chev" />
          </TossPressable>
        ))}
      </div>
    </TossPage>
  );
}
