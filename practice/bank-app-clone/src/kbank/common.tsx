import type { Bank, TransferResult } from "../api/types";
import { localAsset } from "../assets/Asset";
import { BankIcon } from "../components/BankIcon";

// 여러 화면이 같이 쓰는 부품 (i-ONE 의 src/ibk/common.tsx 와 같은 자리): 앱 아이콘 · 시작화면 글자 · 복사 · 은행 원 로고 · K › B · 확인중 · 연필.
// 숫자 쓰기(kbNf)·기능 없는 버튼(noop)은 theme.ts. K › B · 확인중 · 연필의 CSS 는 kbank-send.css (.kbs-pair · .kbs-checking · .kbs-pen)

// 앱 아이콘 (로그인·프로필 고르기 위): App Store 원본을 갤럭시 모양으로 (scripts/kbank-crops/appicon.py)
export function KbankAppIcon({ size = 46 }: { size?: number }) {
  const src = localAsset("kbank-app-icon");
  if (src) return <img src={src} alt="케이뱅크" width={size} height={size} draggable={false} style={{ display: "block" }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="케이뱅크">
      <rect width="48" height="48" rx="13" fill="#0212a4" />
      <text x="24" y="33" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="800" fontFamily="inherit">
        K
      </text>
    </svg>
  );
}

// 시작화면 'Kbank' 글자: 녹화 5.6~6.2초 정지 프레임 14장 평균을 8배로 키워 윤곽을 딴 벡터 (src/assets/local/kbank-wordmark.svg, 색 #0212a4)
export function KbankWordmark({ className }: { className?: string }) {
  const src = localAsset("kbank-wordmark");
  return src ? <img className={className} src={src} alt="Kbank" draggable={false} /> : <b className={className}>Kbank</b>;
}

// 완료 화면(/send/done)으로 넘기는 값 (location.state)
export interface KbankDoneState {
  result: TransferResult; // 서버 응답: to(받는 분), amount, balanceAfter …
  from: { id: string; bank: Bank; number: string };
}

// 번호 옆 복사 (잉크 x 219~241 · y 223~245px = 14.3dp 정사각, #6d737a). 앞 네모가 왼쪽 위(흰 바탕으로 덮음), 뒤 네모는 오른쪽 아래로
// 오른쪽·아래 변만 보임 (프레임 630 번호 옆 · 1800 거래 금액 옆 잉크: 앞 533~550 × 491~508, 뒤 539~555 × 497~513px — 1차는 앞뒤가 반대였음).
// 크기·간격·굵기는 1800 거래 금액 옆 아이콘과 격자로 맞춤 (잉크 RMS 1차 62% → 40%, 남은 건 기기px 반올림 위치)
export function KbankCopyIcon({ color, size = 14.3 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" overflow="visible" aria-hidden>
      <rect x="5.4" y="5.4" width="15.6" height="15.6" rx="3" fill="none" stroke={color} strokeWidth="1.8" />
      <rect x="0.6" y="0.6" width="15.6" height="15.6" rx="3" fill="#fff" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

// 은행 원 로고: 녹화에 나온 것(카카오뱅크·케이뱅크·농축협·새마을금고)은 녹화에 맞춰 다시 그린 SVG(새마을금고만 그라데이션이라 PNG) —
// 상자 = 녹화에서 잡은 원 상자 크기, 원은 가운데. 나머지는 공용 BankIcon
export function KbankBankLogo({ bank, size }: { bank: Pick<Bank, "code" | "name" | "short" | "color"> & Partial<Bank>; size: number }) {
  const src = localAsset(`kbank-bank-${bank.code}`);
  if (src) return <img className="kb-logo" src={src} alt={bank.name} width={size} height={size} draggable={false} />;
  return <BankIcon bank={bank as Bank} size={size} />;
}

// '··· 확인중' (프레임 982~1044): 점 셋이 차례로 2.85dp 뛰어오름 (0.63초 주기, 0.18초씩 늦게)
export function Checking() {
  return (
    <span className="kbs-checking">
      <i />
      <i />
      <i />
      <span>확인중</span>
    </span>
  );
}

// K › B (확인) — 보내는 중에는 › 가 ››› 로 펼쳐져 늘었다 줄었다 함 (kbank-send.css .kbs-pair__run)
export function KbankPair({ from, to, className = "", moving = false }: { from: Bank; to: Bank; className?: string; moving?: boolean }) {
  return (
    <div className={`kbs-pair ${className}`}>
      <KbankBankLogo bank={from} size={48.8} />
      {moving ? (
        <span className="kbs-pair__run" aria-hidden>
          {[0, 1, 2].map((i) => (
            <svg key={i} width="9" height="14" viewBox="0 0 9 14">
              <path d="M1.8 1.6 7 7l-5.2 5.4" fill="none" stroke="#4862f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ))}
        </span>
      ) : (
        <svg className="kbs-pair__gt" width="9" height="14" viewBox="0 0 9 14" aria-hidden>
          <path d="M1.8 1.6 7 7l-5.2 5.4" fill="none" stroke="#4862f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <KbankBankLogo bank={to} size={48.8} />
    </div>
  );
}

// ✎ 뚜껑이 떨어진 연필: 왼쪽 아래 끝이 직각으로 깎인 몸통(폭 4.47) + 0.55 틈 + 둥근 뚜껑 (프레임 682~701 '편집하기' · 927~977 표).
//   16 칸에 잉크 0.4~15.65 · 0.6~15.85 → 표는 16 (녹화 잉크 326.1~341.7 × 551.9~567.5 = 15.6, 몸통 폭 4.3), '편집하기' 는 11.5 (343.6~354.7 = 11.1)
export function KbankPencil({ size = 16, color = "#2a2d33", className = "kbs-pen" }: { size?: number; color?: string; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path d="M0.4 15.85V12.69L8.95 4.14 12.11 7.3 3.56 15.85Z" fill={color} />
      <path d="M9.34 3.75 11.83 1.26A2.235 2.235 0 0 1 14.99 4.42L12.5 6.91Z" fill={color} />
    </svg>
  );
}

// 굵은 금액 숫자: 녹화의 굵은 금액 줄은 '1' 의 좌우가 Pretendard 보다 넓고 '0' 은 조금 좁음 (FONT.md '굵은 금액의 1') → 그 글자만 span 으로 감쌈.
// 값은 화면마다 녹화에서 잰 것이라 CSS 는 화면 접두사의 -n1 · -n0 에 둠 (근거는 각 CSS 주석):
//   홈 잔액 24px    kbh-n1 0.095em ('1원' 과 '0원' 의 '원' 끝이 같음, 녹화 350 · 1290) · '0' 은 그대로
//   계좌 28 · 22px  kba-n1 0.054em · kba-n0 −0.025em (프레임 630 · 1340 · 1500 금액 9줄 최소제곱)
//   금액 입력 26px  kbs-n1 0.06em ('1' 뒤 +0.071em, 763~910) · kbs-n0 −0.025em (계좌 값을 따름 — 녹화엔 '1원' 뿐)
// fresh > 0 이면 마지막 글자(방금 누른 숫자)만 다시 그려 페이드 (금액 입력 .kbs-new)
export function KbankDigits({ text, prefix, zero = false, fresh = 0 }: { text: string; prefix: "kbh" | "kba" | "kbs"; zero?: boolean; fresh?: number }) {
  const last = text.length - 1;
  return [...text].map((ch, i) => {
    const isNew = fresh > 0 && i === last;
    const cls = [ch === "1" || (zero && ch === "0") ? `${prefix}-n${ch}` : "", isNew ? `${prefix}-new` : ""].filter(Boolean).join(" ");
    return cls ? (
      <span key={isNew ? `n${fresh}` : i} className={cls}>
        {ch}
      </span>
    ) : (
      ch
    );
  });
}
