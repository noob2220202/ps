export type Os = "android" | "ios";

// 이 앱은 인트로 영상과 같은 갤럭시 기기 화면만 (상태바 · 3버튼 내비바를 그 기기에 맞춰 직접 만듦) → 아이폰으로 바꾸지 않음
export const OS: Os = "android";

// CSS에서 [data-os="android"] 로 플랫폼별 스타일을 나눈다
document.documentElement.dataset.os = OS;
