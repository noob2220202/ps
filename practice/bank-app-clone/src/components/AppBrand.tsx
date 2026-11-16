import { KakaoCircle } from "./art";
import { HanaAppIcon } from "../hana/common";
import { IbkAppIcon } from "../ibk/common";
import { KbankAppIcon } from "../kbank/common";
import { NhAppIcon } from "../nh/common";
import { TossAppIcon } from "../toss/AppIcon";
import { AlloneAppIcon } from "../allone/ui/AppIcon";
import { APP } from "../profile/session";

// 로그인·프로필 고르기·계정 관리 위에 나오는 앱 아이콘 (서버가 어느 앱인지에 따라)
export function AppIcon({ size }: { size: number }) {
  if (APP === "nh") return <NhAppIcon size={size} />;
  if (APP === "hana") return <HanaAppIcon size={size} />;
  if (APP === "ibk") return <IbkAppIcon size={size} />;
  if (APP === "kbank") return <KbankAppIcon size={size} />;
  if (APP === "toss") return <TossAppIcon size={size} />;
  if (APP === "allone") return <AlloneAppIcon size={size} />;
  return <KakaoCircle size={size} />;
}
