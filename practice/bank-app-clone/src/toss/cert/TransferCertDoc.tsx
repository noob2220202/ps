// 송금확인증 한 장 (cert.md §2.10). A4 종이(368 × 520.4 단위, 1단위 = 문서.pdf 화면 1dp)를 4배(--u 4px)로 그린 뒤 scale/4 로 줄임
// — 4–5단위 작은 글자가 브라우저 최소 글자 크기에 걸리지 않고 고해상도에서도 또렷함. 미리보기(D) scale 0.9348, 문서.pdf(V) 1.
// 연습용 안전 규칙 (infra §8): '연습용 화면 · 실제 이체 아님' 비스듬한 워터마크(장마다 3 × 2), 진짜 도장 대신 '연습용' 빈 도장,
// 진위확인 · 고객센터는 가짜 값. 파일(PDF)은 만들지 않음
import { TossSymbol } from "../ui/TossSymbol";
import { certPages, CERT_PAGE, type CertDocData, type CertDocRow } from "./data";

const MARK = "연습용 화면 · 실제 이체 아님";
// 표 칸 왼쪽 (단위)
const COLS: { key: keyof CertDocRow | "when"; label: string; x: number }[] = [
  { key: "when", label: "거래일자", x: 19.0 },
  { key: "to", label: "받는사람", x: 55.0 },
  { key: "from", label: "보낸사람", x: 88.3 },
  { key: "amount", label: "금액", x: 121.3 },
  { key: "fromAccount", label: "보낸 은행 계좌", x: 171.0 },
  { key: "toAccount", label: "받는 은행 계좌", x: 243.4 },
  { key: "memo", label: "받는통장 표시", x: 316.1 },
];
// 칸 폭 (다음 칸 왼쪽 − 1.5, 마지막은 오른쪽 선 349). 녹화엔 넘치는 값이 없지만 긴 은행 이름 등이 옆 칸과 겹치지 않게 자름
const colW = (i: number) => (COLS[i + 1]?.x ?? 350.5) - COLS[i].x - 1.5;
const ROW_TOP = 121.3; // 첫 줄 위 (글자 상자, 줄 높이 7.6)
const ROW_PITCH = 22; // 두 줄 × 7.35 + 틈 (cert.md §5.6)
const FOOT_GAP = 158.9 - ROW_TOP; // 마지막 줄 위 → 안내 문구 위

const u = (n: number) => `calc(${n} * var(--u))`;
const INK = 0.6; // 글자 상자 왼쪽 → 잉크 (Pretendard 5단위 글자를 녹화와 같은 방법으로 잰 차이)

export function TransferCertDoc({ data, page = 0, scale = 1, className }: { data: CertDocData; page?: number; scale?: number; className?: string }) {
  const pages = certPages(data.rows);
  const rows = pages[page] ?? [];
  const lastTop = ROW_TOP + ROW_PITCH * Math.max(0, rows.length - 1);
  return (
    <div className={`toss-cert-doc${className ? ` ${className}` : ""}`} style={{ width: CERT_PAGE.w * scale, height: CERT_PAGE.h * scale }}>
      <div className="toss-cert-doc__page" style={{ transform: `scale(${scale / 4})` }}>
        <p className="toss-cert-doc__title">송금확인증</p>
        <p className="toss-cert-doc__statement">{data.userName}님의 계좌 송금 내역을 아래와 같이 증명합니다.</p>
        <p className="toss-cert-doc__unit">단위: 원</p>
        <i className="toss-cert-doc__rule toss-cert-doc__rule--top" />
        {COLS.map((c) => (
          <p key={c.key} className="toss-cert-doc__th" style={{ left: u(c.x + INK) }}>
            {c.label}
          </p>
        ))}
        {rows.map((r, i) => (
          <div key={r.id} className="toss-cert-doc__tr" style={{ top: u(ROW_TOP + ROW_PITCH * i) }}>
            {COLS.map((c, ci) => (
              <p key={c.key} className={`toss-cert-doc__td toss-cert-doc__td--${c.key}`} style={{ left: u(c.x + INK), maxWidth: u(colW(ci)) }}>
                {c.key === "when" ? (
                  <>
                    {r.date}
                    <br />
                    {r.time}
                  </>
                ) : (
                  r[c.key]
                )}
              </p>
            ))}
          </div>
        ))}
        <p className="toss-cert-doc__note" style={{ top: u(lastTop + FOOT_GAP) }}>
          본 송금확인증은 고객 편의를 위해 제공되는 것으로 거래의 참고용으로만 사용하실 수 있습니다.
        </p>
        <i className="toss-cert-doc__rule toss-cert-doc__rule--bottom" />
        <p className="toss-cert-doc__fl" style={{ left: u(18.5 + INK), top: u(457.2) }}>
          발급일자
        </p>
        <p className="toss-cert-doc__fv" style={{ left: u(61.7 + INK), top: u(457.2) }}>
          {data.issueDate}
        </p>
        <p className="toss-cert-doc__fl" style={{ left: u(177.6 + INK), top: u(457.2) }}>
          문서 진위확인
        </p>
        <p className="toss-cert-doc__fv" style={{ left: u(233.6 + INK), top: u(457.2) }}>
          연습용 문서 · 진위확인 불가
        </p>
        <p className="toss-cert-doc__fl" style={{ left: u(18.5 + INK), top: u(467.8) }}>
          발급번호
        </p>
        <p className="toss-cert-doc__fv" style={{ left: u(61.7 + INK), top: u(467.8) }}>
          {data.issueNo}
        </p>
        <p className="toss-cert-doc__fl" style={{ left: u(177.8 + INK), top: u(467.8) }}>
          고객센터
        </p>
        <p className="toss-cert-doc__fv" style={{ left: u(233.8 + INK), top: u(467.8) }}>
          0000-0000
        </p>
        <CertDocLogo />
        <CertSeal />
        <p className="toss-cert-doc__pageno">
          {page + 1}/{pages.length}
        </p>
        <div className="toss-cert-doc__mark" aria-hidden>
          {[0, 1, 2].map((r) =>
            [0, 1].map((c) => (
              <span key={`${r}${c}`} style={{ left: u(92 + 184 * c), top: u(86.7 + 173.5 * r) }}>
                {MARK}
              </span>
            )),
          )}
        </div>
      </div>
    </div>
  );
}

// 'toss bank' 표시 (검정): 토스 심볼 모양을 가면으로 칠하고 글자는 SVG 로 다시 그림 (잉크 18.4–72.8 × 491.4–500.9)
function CertDocLogo() {
  return (
    <span className="toss-cert-doc__logo" aria-label="toss bank">
      <TossSymbol height={9.6 * 4} grey className="toss-cert-doc__logo-mark" style={{ background: "#191f28" }} />
      <svg className="toss-cert-doc__logo-word" viewBox="0 0 44 10" aria-hidden>
        <text x="0" y="7.95" fontSize="9" fontWeight="700" textLength="43.8" lengthAdjust="spacingAndGlyphs" fill="#191f28">
          toss bank
        </text>
      </svg>
    </span>
  );
}

// 빈 도장 (진짜 은행 도장은 그리지 않음): 빨간 겹 동그라미 ⌀30.6 + '연습용'
function CertSeal() {
  return (
    <svg className="toss-cert-doc__seal" viewBox="0 0 30.6 30.6" aria-label="연습용 도장">
      <circle cx="15.3" cy="15.3" r="14.6" fill="none" stroke="#e5484d" strokeWidth="1.2" />
      <circle cx="15.3" cy="15.3" r="12.4" fill="none" stroke="#e5484d" strokeWidth="0.5" />
      <text x="15.3" y="17.5" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="#e5484d">
        연습용
      </text>
    </svg>
  );
}
