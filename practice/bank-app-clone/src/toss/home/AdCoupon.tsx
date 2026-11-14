// /ad/coupon — 이체 뒤 광고 '5천원 쿠폰이 발급됐어요' (home.md §2.9 · §3.8, 녹화 B 72.15–77.42, 기준 프레임 B 74.942).
// 옮기기(옮겼어요) 완료 '확인' 이 replace 로 엶 (REVEAL: 완료 화면이 내려가고 이 화면의 내용이 150ms 뒤 300ms 에 나타남 — nav.css).
// ← 는 내용보다 먼저 보임 (화면 뿌리에 붙여 내용 나타남 움직임 밖에 둠). 쿠폰 받기 · ← · 갤럭시 뒤로 = 닫기, 3일 동안 안보기 = 미루고 닫기.
// 닫기 = useAdDismiss → 이체 흐름 전 화면으로 history.go(-sendDepth), 90ms 직선으로 흐려짐 (FADE, state.tossExit)
import { createPortal } from "react-dom";
import { localAsset } from "../../assets/Asset";
import { useAdDismiss } from "../flow";
import { TossButton } from "../ui/Button";
import { BackIcon } from "../ui/icons";
import { TossPage } from "../ui/Page";
import { TossPressable } from "../ui/Pressable";
import { useTossPageRoot } from "../ui/shared";
import { useAdBackGuard } from "./boot";
import "./home.css";

export function AdCoupon() {
  const dismiss = useAdDismiss();
  const leave = useAdBackGuard(() => dismiss());
  const close = (snooze: boolean) => leave(() => dismiss({ snooze }));
  const img = localAsset("toss-home-coupon");
  return (
    <TossPage className="toss-home-adp">
      <AdBack onPress={() => close(false)} />
      {img && <img className="toss-home-cpn__img" src={img} alt="" draggable={false} />}
      <p className="toss-home-cpn__t">{"5천원 쿠폰이\n발급됐어요"}</p>
      <p className="toss-home-cpn__s">토스쇼핑에서 쓸 수 있어요 · AD</p>
      <TossButton className="toss-home-cpn__btn" onPress={() => close(false)}>
        쿠폰 받기
      </TossButton>
      <TossPressable className="toss-home-cpn__skip" radius={8} color="#26262a" onPress={() => close(true)}>
        3일 동안 안보기
      </TossPressable>
    </TossPage>
  );
}

// ← (화면 뿌리에 붙임 — 내용의 나타남 · 흐려짐 움직임과 따로)
export function AdBack({ onPress }: { onPress: () => void }) {
  const root = useTossPageRoot();
  if (!root) return null;
  return createPortal(
    <TossPressable className="toss-home-adp__back" radius={24} onPress={onPress} ariaLabel="뒤로">
      <BackIcon size={24} />
    </TossPressable>,
    root,
  );
}
