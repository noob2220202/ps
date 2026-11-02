import { useStatusBar } from "../hooks/useStatusBar";

// 케이뱅크 녹화(cb67e5eb, 2026-11-02, 갤럭시 제스처 내비게이션) 590 × 1280px = 384 × 833.08dp → 1dp = 1.53646px
// 상태바 0~33.2dp (흰색), 아래 제스처 손잡이는 앱 위에 겹쳐 그림 (검은 띠 없음, 손잡이 124.8~259.2 × 824.1~828.0, #b2b2b2)
export const KB_SCALE = 590 / 384;
export const KB_TOP = 33.2; // 상태바 아래끝 = 앱 영역 위끝 (dp)
export const KB_NAV = 16; // 아래 제스처 영역 (탭바·버튼이 이만큼 위로)

// 녹화 px → dp. 앱 영역 안 y 는 kbY(녹화 y) (상태바 높이를 뺌). 코드에선 안 부르고, CSS 주석의 '녹화 px ÷ 1.53646 (− 33.2)' 환산식을
// 한곳에 적어 둔 것 (재기 도구·문서가 이 이름으로 가리킴)
export const kb = (recPx: number) => recPx / KB_SCALE;
export const kbY = (recY: number) => recY / KB_SCALE - KB_TOP;

export const KB_STATUS = "#ffffff";

// 케이뱅크는 녹화에 라이트 모드만 있음 → 상태바 글자는 늘 어두운 색
export function useKbankStatusBar(bg: string = KB_STATUS) {
  useStatusBar(bg, "dark");
}

// 금액 쓰기 (1,234)
export const kbNf = new Intl.NumberFormat("ko-KR");
// 기능 없는 버튼: 눌러도 아무 일 없음 (녹화에 없는 화면으로 가는 것 — 안내창도 띄우지 않음)
export const noop = () => {};
