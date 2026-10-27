import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLayerActive } from "../platform/LayerContext";

// 화면마다 상태바 글자색/배경이 다름(홈=검정 배경 흰 글씨, 상세=밝은 배경 검정 글씨).
// 각 화면이 useStatusBar(...)로 선언하면 PhoneFrame의 StatusBar가 따라 바뀐다.
export interface StatusBarStyle {
  bg: string;
  fg: "light" | "dark";
}

const Ctx = createContext<{ style: StatusBarStyle; setStyle: (s: StatusBarStyle) => void } | null>(null);

export function StatusBarProvider({ children }: { children: ReactNode }) {
  const [style, setStyle] = useState<StatusBarStyle>({ bg: "#ffe100", fg: "dark" });
  return <Ctx.Provider value={{ style, setStyle }}>{children}</Ctx.Provider>;
}

export function useStatusBarStyle() {
  return useContext(Ctx)!.style;
}

// active 조건: 스와이프 중 뒤에 깔린 화면이 상태바를 바꿔버리면 안 되니까.
// 그 화면이 맨 위가 되는 순간 active가 true로 바뀌며 다시 적용된다.
export function useStatusBar(bg: string, fg: StatusBarStyle["fg"]) {
  const { setStyle } = useContext(Ctx)!;
  const active = useLayerActive();
  useEffect(() => {
    if (active) setStyle({ bg, fg });
  }, [bg, fg, active, setStyle]);
}
