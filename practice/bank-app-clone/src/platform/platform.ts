import { APP, HAS_INTRO } from "../profile/session";

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

// ibk2(녹화 인트로를 켠 i-ONE Bank)는 인트로 영상과 같은 갤럭시 기기 화면만 (상태바 · 3버튼 내비바를 그 기기에 맞춰 만듦) → 아이폰으로 바꾸지 않음
export const IBK2 = APP === "ibk" && HAS_INTRO;
export const OS: Os = IBK2
  ? "android"
  : isOs(param)
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
// ibk2: 인트로 영상 기기에 맞춘 상태바 · 진짜 폰에서도 프레임 그대로 (PhoneFrame.css · global.css 의 [data-ibk2])
if (IBK2) document.documentElement.dataset.ibk2 = "on";
