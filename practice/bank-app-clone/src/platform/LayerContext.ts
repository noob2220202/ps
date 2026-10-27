import { createContext, useContext } from "react";

// 화면 전환 중엔 화면 2개가 동시에 떠 있다(나가는 화면 + 들어오는 화면, 스와이프 중 뒤 화면).
// 상태바 색 변경 같은 "전역에 영향 주는 일"은 맨 위(active) 화면만 하도록 알려준다.
export const LayerContext = createContext({ active: true });

export const useLayerActive = () => useContext(LayerContext).active;
