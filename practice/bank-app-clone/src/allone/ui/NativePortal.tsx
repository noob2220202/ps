// AoNativePortal: 웹뷰 밖(상태바 띠 · 아래 띠까지) 덮는 네이티브 층에 그림 (src/allone/native.ts 의 자리, AlloneOverlay 가 만듦).
//  layer "sheet"(기본, #ao-native z 55) · "panel"(53, T2 키패드 판) · "keyboard"(56) · "scene"(57)
// 자리 좌표는 폰 화면 전체 (0–852, 393 폭): 안쪽 요소는 position: absolute 로 자리를 잡고, 누를 수 있는 요소는 알아서 받음
// (자리 자체는 pointer-events: none). 이 화면 층이 맨 위가 아니면(밑에 숨은 화면) 안 보이게 숨김 — 상태는 그대로 (display: none)
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLayerActive } from "../../platform/LayerContext";
import { useAoNativeHost, type AoNativeLayer } from "../native";

export function AoNativePortal({ children, layer = "sheet" }: { children: ReactNode; layer?: AoNativeLayer }) {
  const host = useAoNativeHost(layer);
  const active = useLayerActive();
  if (!host) return null;
  return createPortal(<div className={active ? "ao-native-part" : "ao-native-part ao-native-part--hidden"}>{children}</div>, host);
}
