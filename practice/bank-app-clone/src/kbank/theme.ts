import { useStatusBar } from "../hooks/useStatusBar";

// 케이뱅크 녹화(cb67e5eb, 2026-11-02, 갤럭시 제스처 내비게이션) 590 × 1280px = 384 × 833.08dp → 1dp = 1.53646px
// 상태바 0~33.2dp (흰색), 아래 제스처 손잡이는 앱 위에 겹쳐 그림 (검은 띠 없음, 손잡이 124.3~259.0 × 824~828, #b0aeaf)
export const KB_SCALE = 590 / 384;
export const KB_TOP = 33.2; // 상태바 아래끝 = 앱 영역 위끝 (dp)
export const KB_NAV = 16; // 아래 제스처 영역 (탭바·버튼이 이만큼 위로)

// 녹화 px → dp. 앱 영역 안 y 는 kbY(녹화 y) (상태바 높이를 뺌)
export const kb = (recPx: number) => recPx / KB_SCALE;
export const kbY = (recY: number) => recY / KB_SCALE - KB_TOP;

export const KB_STATUS = "#ffffff";

// 케이뱅크는 녹화에 라이트 모드만 있음 → 상태바 글자는 늘 어두운 색
export function useKbankStatusBar(bg: string = KB_STATUS) {
  useStatusBar(bg, "dark");
}
