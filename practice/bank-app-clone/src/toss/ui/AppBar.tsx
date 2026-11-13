// 머리줄 (28 – 81.6, 53.6dp). plan.md §3.3: account §2.1 · §3.4–3.5, transfer §2.0, cert §2.0
//  ← 잉크 x 18.4–38.4 · y 45.6–64.0 (2dp 선), 누르는 칸 48 × 48 (가운데 28.4, 54.8)
//  제목: 왼쪽 x 72 (17 SB) 또는 가운데 (통장 "토스뱅크 통장 ⌄")
//  mode: solid = 화면 바탕 / blur = 투명 + 뒤 흐림 20px (통장, 제목은 titleVisible 로 나타남) / scroll = 스크롤 따라 바탕 (거래내역: (st − 40)/120)
//  progress: 아래 y 80 에 붙는 진행 막대 자리 (ProgressBar)
import type { CSSProperties, ReactNode } from "react";
import { BackIcon } from "./icons";
import { TossPressable } from "./Pressable";
import { useTossBack } from "../nav";

export interface TossAppBarProps {
  title?: ReactNode;
  center?: boolean; // 제목 가운데
  titleVisible?: boolean; // blur 모드에서 제목 보이기 (250ms ease-out, 80ms 늦게)
  onBack?: (() => void) | false; // false = ← 없음, 없으면 뒤로 (useTossBack)
  backFallback?: string;
  right?: ReactNode;
  mode?: "solid" | "blur" | "scroll";
  scrollTop?: number; // scroll 모드
  bg?: string; // 바탕 (기본 화면 바탕 var(--toss-bg))
  progress?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function TossAppBar({ title, center, titleVisible = true, onBack, backFallback, right, mode = "solid", scrollTop = 0, bg, progress, className, style }: TossAppBarProps) {
  const back = useTossBack(backFallback);
  const scrollBg = mode === "scroll" ? Math.min(1, Math.max(0, (scrollTop - 40) / 120)) : 1;
  return (
    <header className={`toss-appbar toss-appbar--${mode}${className ? ` ${className}` : ""}`} style={{ ["--toss-appbar-bg" as string]: bg ?? "var(--toss-bg)", ...style }}>
      {mode !== "blur" && <div className="toss-appbar__bg" style={{ opacity: scrollBg }} />}
      {onBack !== false && (
        <TossPressable className="toss-appbar__back" radius={24} onPress={onBack || back} ariaLabel="뒤로">
          <BackIcon size={24} />
        </TossPressable>
      )}
      {title != null && (
        <div className={`toss-appbar__title${center ? " toss-appbar__title--center" : ""}${mode === "blur" ? ` toss-appbar__title--fade${titleVisible ? " on" : ""}` : ""}`}>{title}</div>
      )}
      {right && <div className="toss-appbar__right">{right}</div>}
      {progress && <div className="toss-appbar__progress">{progress}</div>}
    </header>
  );
}
