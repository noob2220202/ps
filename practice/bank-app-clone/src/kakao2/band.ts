// kakao2 K2Inset: 상태바가 화면 위에 겹친 투명한 층이라 54pt 띠는 화면 층마다 따로 칠함 → 안쪽 화면이 useStatusBar 로 정한 바탕색을 그 층에 알려 줌
// (맨 위가 아닌 층도 — 전환 중 밑 화면 띠가 제 색을 지키게). K2Inset 밖(다른 앱 · kakao)에선 null 이라 아무 일 없음
import { createContext } from "react";

export const StatusBandContext = createContext<((bg: string) => void) | null>(null);
