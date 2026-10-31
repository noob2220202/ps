export type Os = "android" | "ios";

const isOs = (v: string | null): v is Os => v === "android" || v === "ios";

function read(): string | null {
  try {
    return localStorage.getItem("os");
  } catch {
    return null;
  }
}

// 우선순위: 주소의 ?os= → 지난번 선택 → 실제 기기(UA). 화면 이동하면 쿼리가 사라지므로 저장해 둔다.
const param = new URLSearchParams(location.search).get("os");
const stored = read();

export const OS: Os = isOs(param)
  ? param
  : isOs(stored)
    ? stored
    : /iPhone|iPad|iPod/.test(navigator.userAgent)
      ? "ios"
      : "android";

try {
  localStorage.setItem("os", OS);
} catch {
  // 사파리 사생활 보호 모드 등에서는 저장 실패 → 이번 세션만 적용
}

// CSS에서 [data-os="ios"] 로 플랫폼별 스타일을 나눈다
document.documentElement.dataset.os = OS;
