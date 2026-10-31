// 캡쳐모드: PC에서 화면 녹화/캡쳐할 때 폰 테두리와 아래 스위치를 숨기고 화면만 남긴다.
// <html data-capture="on"> 하나로 CSS가 처리 → 새로고침 없이 바로 켜고 끔. 이 브라우저에 기억됨.
const KEY = "capture";

function stored() {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function isCapture() {
  return document.documentElement.dataset.capture === "on";
}

export function setCapture(on: boolean) {
  if (on) document.documentElement.dataset.capture = "on";
  else delete document.documentElement.dataset.capture;
  try {
    if (on) localStorage.setItem(KEY, "on");
    else localStorage.removeItem(KEY);
  } catch {
    // 저장 못 하면 이번에만
  }
}

setCapture(stored());
