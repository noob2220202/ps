// 통장 위 배너 (account.md §2.3 · §3.3, 녹화 A 22.70–24.97초 · B 3.03–5.20초)
//  펼침: 높이 0 → 180.8dp 650ms (그림은 위에 붙어 있고 아래 카드가 내려가며 드러남)
//  +870ms 제목이 배너 가운데쯤(최종보다 18dp 아래)에서 400ms 에 나타나며 5dp 올라옴 → +1590ms 330ms 동안 18dp 더 올라 제자리
//  +1850ms 부제 · 버튼 · × 가 400ms 에 나타남
//  방문마다 두 가지를 번갈아 (자동이체 가져오기 / 새로운 예금). × 는 거꾸로 350ms 에 접히고 앱을 다시 열 때까지 안 보임
import { CloseIcon } from "../ui/icons";
import { TossPressable } from "../ui/Pressable";
import type { AcctBannerState } from "./banner";
import { acctImg } from "./data";
import { AcctButton } from "./parts";

export function BankBanner({ banner, active }: { banner: AcctBannerState; active: boolean }) {
  const v = banner.variant;
  if (!v) return null;
  const art = acctImg(v.art);
  return (
    <div className={`toss-acct-banner toss-acct-banner--${banner.state}${banner.still ? " toss-acct-banner--still" : ""}`}>
      <div className="toss-acct-banner__art" style={art ? { backgroundImage: `url(${art})` } : undefined} />
      <div className="toss-acct-banner__title">
        <div className="toss-acct-banner__titlein">
          {v.title[0]}
          <br />
          {v.title[1]}
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
