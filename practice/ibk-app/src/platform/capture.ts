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
  fit();
  try {
    if (on) localStorage.setItem(KEY, "on");
    else localStorage.removeItem(KEY);
  } catch {
    // 저장 못 하면 이번에만
  }
}

// 폰 화면 배율 (CSS zoom): --capture-fit = 캡쳐모드에서 창이 폰보다 작을 때만 줄임 (줄이지 않으면 폰 아래가 창 밖으로 잘려
// 녹화 영상 맨 아래에 깨진 띠가 찍혔음: 높이 855px 창에서 녹화 → 아래 19px), --screen-fit = 진짜 폰 화면에 꽉 맞춤 (global.css)
function fit() {
  const css = getComputedStyle(document.documentElement);
  const w = parseFloat(css.getPropertyValue("--frame-w"));
  const h = parseFloat(css.getPropertyValue("--frame-h"));
  const f = w && h ? Math.min(innerWidth / w, innerHeight / h) : 1;
  document.documentElement.style.setProperty("--capture-fit", String(Math.min(1, f)));
  document.documentElement.style.setProperty("--screen-fit", String(f));
}
addEventListener("resize", fit);
requestAnimationFrame(fit); // data-app 이 붙고 프레임 크기가 정해진 뒤 한 번 더

setCapture(stored());
