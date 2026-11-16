// 홈 아래 칸의 글줄 · 광고가 돌기 시작해도 되는지 (H4 부터, 홈이 맨 위 화면일 때). 이 둘만 다시 그려지게 context 로 전함
import { createContext } from "react";

export const LowerActive = createContext(false);
