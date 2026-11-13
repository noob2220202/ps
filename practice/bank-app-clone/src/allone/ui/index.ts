// NH올원뱅크 공용 부품 모음 (plan.md §3.3). 영역은 여기서 가져다 씀: import { AoPage, AoHeader, AoSheet } from "../ui"
// 부품 모양은 /dev/ui 견본(Gallery.tsx)에서 볼 수 있음. 스타일은 ui.css (routes.tsx 가 불러옴) + allone.css 토큰
export { AoPage, type AoPageProps } from "./Page";
export { AoHeader, type AoHeaderProps, type AoHeaderNavProps, type AoHeaderCloseProps, type AoHeaderFlowProps, type AoHeaderModalProps } from "./Header";
export { AoButton, type AoButtonProps, type AoButtonVariant, type AoButtonPressed } from "./Button";
export { AoSheet, type AoSheetProps } from "./Sheet";
export { AoNativeSheet, type AoNativeSheetProps, type AoNativeSheetLevel } from "./NativeSheet";
export { AoKeyboard, AoCaret, AO_KB_TOP, AO_KB_NUM_TOP, AO_KB_ACCESSORY, type AoKeyboardProps } from "./Keyboard";
export { compose as aoComposeHangul, isJamo as aoIsJamo, isConsonant as aoIsConsonant, isVowel as aoIsVowel } from "./hangul";
export { AoSwitch, type AoSwitchProps } from "./Switch";
export { AoSkeleton, type AoSkeletonProps } from "./Skeleton";
export * from "./icons";

// 다른 기초 담당이 만든 부품 (같이 모아 둠)
export { AlloneAppIcon, AoSquircle, AO_ICON_GREEN, AO_ICON_PRESSED_BG, AO_ICON_PRESSED_MARK } from "./AppIcon";
export { AoWordmark, AO_WORDMARK_RATIO } from "./Wordmark";
export { AoSpinner } from "./Spinner";
export { AoBankLogo, AO_NH_BLUE, type AoBankLogoProps } from "./BankLogo";
export { AoLoadingLayer } from "./Loading";
export { AoToastLayer } from "./Toast";
export { AoNativePortal } from "./NativePortal";
// 짝이 되는 상태 모듈 (Loading.tsx + loading.ts, Toast.tsx + toast.ts)
export { aoLoad, showAoLoading, cutAoLoading, useAoLoadingVisible, onAoLoadingHidden, isAoLoadingUp } from "../loading";
export { aoToast, cutAoToast, AO_TOAST_BOTTOM } from "../toast";
export { setAoStatusFg } from "../statusFg";
