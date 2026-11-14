// /ad/payback — 이체 뒤 광고 '30일 동안 / 매일 2,000원 돌려받기' (home.md §2.9 · §3.8, 녹화 B 120.35–129.73, 기준 프레임 B 129.251).
// 보내기(보냈어요) 완료 '확인' 이 replace + push 로 엶 + 토스트 '토스로 이동했어요' (flow.ts useSendFinish).
// 녹화의 빈 화면 3장(넘겨주기) · 내용이 49dp 올라가는 다시 배치는 하나로 줄임: 빈 화면 + 진행 막대(70%) → 600ms 에 내용 (200ms 나타남).
// 달력 로티는 잘라 낸 열쇠 장면 5장을 1.9초 돌림 (home.css). 확인하기 · × 닫기 · ← · 갤럭시 뒤로 = 닫기 → 이체 흐름 전 화면으로 pop
import { useEffect, useState } from "react";
import { localAsset } from "../../assets/Asset";
import { useAdDismiss } from "../flow";
import { TossButton } from "../ui/Button";
import { TossPage } from "../ui/Page";
import { TossProgressBar } from "../ui/ProgressBar";
import { TossPressable } from "../ui/Pressable";
import { AdBack } from "./AdCoupon";
import { useAdBackGuard } from "./boot";
import "./home.css";

const CONTENT_AT = 600; // 내용이 나타나는 때 (push 시작부터)
const CAL = ["plus", "won", "flip", "edge", "bag"];

export function AdPayback() {
  const dismiss = useAdDismiss();
  const leave = useAdBackGuard(() => dismiss());
  const close = () => leave(() => dismiss());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), CONTENT_AT);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <TossPage className="toss-home-adp">
      <AdBack onPress={close} />
      <div className="toss-home-pb__bar">
        <TossProgressBar ready={ready} />
      </div>
      {ready && (
        <div className="toss-home-pb toss-home-pb--in">
          <div className="toss-home-cal">
            {CAL.map((k) => {
              const src = localAsset(`toss-home-cal-${k}`);
              return src ? <img key={k} src={src} alt="" draggable={false} /> : null;
            })}
          </div>
          <p className="toss-home-pb__t">{"30일 동안\n매일 2,000원 돌려받기"}</p>
          <p className="toss-home-pb__s">새로 나온 토스페이 이벤트 · AD</p>
          <TossButton className="toss-home-pb__btn" onPress={close}>
            확인하기
          </TossButton>
          <TossPressable className="toss-home-pb__close" radius={10} color="#26262a" onPress={close} ariaLabel="닫기">
            <svg className="toss-home-pb__x" width={11.2} height={11.2} viewBox="0 0 11.2 11.2" aria-hidden>
              <path d="M1 1 10.2 10.2M10.2 1 1 10.2" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
            </svg>
            <span className="toss-home-pb__cl">닫기</span>
          </TossPressable>
        </div>
      )}
    </TossPage>
  );
}
