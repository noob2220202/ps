// 통장 위 배너 (account.md §2.3 · §3.3, 녹화 A 22.70–25.0초 · B 3.03–5.20초). 시각은 펼치기 시작부터
//  펼침: 높이 0 → 180.8dp 650ms (아래 카드가 내려가며 드러남)
//  그림: 100ms 뒤 300ms 에 나타나며 1.3배 → 1배로 1300ms 동안 줄어듦 (A 23.26–23.91 체크 타일 52.8 → 48dp)
//  제목: +880ms 한 줄씩(둘째 줄 +60ms) 나타남 — 이때는 오른쪽 12 · 아래 18.4dp 에 1.045배 → +1560ms 380ms 동안 제자리 크기로
//  +1880ms × 가 나타나고, 부제 (+1900ms) · 버튼 (+1980ms) 은 14dp 밑에서 올라오며 나타남 (A 24.60–24.96)
//  방문마다 두 가지를 번갈아 (자동이체 가져오기 / 새로운 예금). × 는 거꾸로 350ms 에 접히고 앱을 다시 열 때까지 안 보임
import type { CSSProperties } from "react";
import { CloseIcon } from "../ui/icons";
import { TossPressable } from "../ui/Pressable";
import type { AcctBannerState } from "./banner";
import { acctImg } from "./data";
import { AcctButton } from "./parts";

export function BankBanner({ banner, active }: { banner: AcctBannerState; active: boolean }) {
  const v = banner.variant;
  if (!v) return null;
  const art = acctImg(v.art);
  // 잘라 온 그림은 다 줄어들기 전 모습 (A 23.439 는 1.052배 · B 3.932 는 1.033배) → 그만큼 더 줄여 끝 모습에 맞춤
  const artStyle = { ...(art && { backgroundImage: `url(${art})` }), "--acct-art-end": v.artEnd } as CSSProperties;
  return (
    <div className={`toss-acct-banner toss-acct-banner--${banner.state}${banner.still ? " toss-acct-banner--still" : ""}`}>
      <div className="toss-acct-banner__art" style={artStyle}>
        <div className="toss-acct-banner__zoom" style={artStyle} />
      </div>
      <div className="toss-acct-banner__title">
        <div className="toss-acct-banner__titlein">
          <span className="toss-acct-banner__line">{v.title[0]}</span>
          <span className="toss-acct-banner__line toss-acct-banner__line--2">{v.title[1]}</span>
        </div>
      </div>
      <div className="toss-acct-banner__sub">{v.sub}</div>
      <AcctButton className="toss-acct-banner__cta">{v.cta}</AcctButton>
      <TossPressable className="toss-acct-banner__x" radius={18} onPress={active ? banner.close : undefined} ariaLabel="닫기">
        <CloseIcon size={28} stroke={1.5} color="#a7a5b0" />
      </TossPressable>
    </div>
  );
}
