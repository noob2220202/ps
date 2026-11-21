// 단위·좌표 (도구 공용). 영상 frame px 와 앱 dp(= CSS px, 360 폭) 사이 변환 — D1 단위 (1단계 units.json 이 정본).
//
//   폰 1080x2640 기기px, 밀도 3.0  →  360 x 880 dp
//   영상 524 x 1280 frame px. 가로와 세로 배율이 다르다 (비등방):
//     세로  y_px = 16/11 · y_dp                       (화면 위끝 기준, 정확한 값)
//           y_dp = 0.6875 · y_px                      앱 안 y = y_dp − 31.333
//     가로  x_px = 262.02 + 1.45803 · (x_dp − 180)    (가운데 262.02 px = 180 dp, 세로보다 0.24% 크다)
//           x_dp = 180 + (x_px − 262.02) / 1.45803
//     길이  폭 w_dp = w_px / 1.45803,  높이 h_dp = h_px · 0.6875,  방향 없는 길이(반지름·글자 크기·선 굵기) = px · 0.6875
//   → 스칼라 하나로 바꾸지 않는다. 가로 위치·폭은 xDp/wDp, 세로는 yDp/hDp 를 쓴다 (가로에 0.6875 를 쓰면 가장자리에서 0.4–0.8 px 어긋남).
//
// 세로 띠: 상태바 0–45.576 px (0–31.333 dp, 94 기기px) · 앱 뷰포트 45.576–1210.182 px (31.333–832 dp, 높이 800.667 dp)
//          · 3버튼 내비 바 1210.182–1280 px (832–880 dp, 48 dp)
//
// 스크린샷: 뷰포트 360x880, deviceScaleFactor 16/11 → 524x1280 PNG (360 × 16/11 = 523.64 를 올려 524).
// ?frame=1 (앱 약속): 위 31 dp 스페이서 + 앱 셸(360 x 800.667 dp, 문서는 스크롤하지 않음)에
//   transform-origin: 0 0; transform: translate(-0.2925px, 0.333px) scaleX(1.0023956) + 아래 48 dp 스페이서(z-index 로 셸 위에).
//   레이아웃 위치(top/left/height)는 DSF 를 곱하기 전에 정수 dp 로 반올림되고 transform 은 반올림되지 않는다 (units.md 6.2절)
//   → 31.333 을 스페이서로 두지 않고 31 + translateY 0.333 으로 둔다. html/body 에 transform 을 걸지 않는다 (position:fixed 가 깨짐).
'use strict';

/* ── 기본 상수 ───────────────────────────────────────── */

const FRAME = Object.freeze({ w: 524, h: 1280 });
const VIEWPORT_DP = Object.freeze({ w: 360, h: 880 });
/** deviceScaleFactor = 세로 px/dp (정확한 값 16/11) */
const DSF = 16 / 11;
const DSF_TEXT = '16/11';

/** 세로: 1 dp = 16/11 frame px (정확) */
const PX_PER_DP_Y = 16 / 11;
const DP_PER_PX_Y = 11 / 16; // 0.6875
/** 가로: 1 dp = 1.45803 frame px, 가운데 262.02 px = 180 dp */
const PX_PER_DP_X = 1.45803;
const X_CENTER_PX = 262.02;
const X_CENTER_DP = 180;

const DENSITY = 3;
const STATUS_BAR_DEVICE_PX = 94;
const NAV_DEVICE_PX = 144;
/** 상태바 높이 = 웹뷰 위끝 (화면 기준). 31.333… dp = 45.576 px */
const STATUS_BAR_DP = STATUS_BAR_DEVICE_PX / DENSITY;
const STATUS_BAR_PX = STATUS_BAR_DP * PX_PER_DP_Y;
/** 3버튼 내비 바 */
const NAV_DP = NAV_DEVICE_PX / DENSITY; // 48
const NAV_PX = NAV_DP * PX_PER_DP_Y; // 69.818
/** 웹뷰 아래끝 = 내비 바 위끝 (화면 기준) */
const APP_BOTTOM_DP = VIEWPORT_DP.h - NAV_DP; // 832
const APP_BOTTOM_PX = APP_BOTTOM_DP * PX_PER_DP_Y; // 1210.182
const APP_HEIGHT_DP = APP_BOTTOM_DP - STATUS_BAR_DP; // 800.667

/** ?frame=1 구성 (units.json frameMode). css 는 units.md 6.3절에서 검증한 글자 그대로 */
const FRAME_MODE = Object.freeze({
  topSpacerDp: 31,
  bottomSpacerDp: NAV_DP,
  appHeightDp: APP_HEIGHT_DP,
  kx: 1.0023956, // = 1.45803 / (16/11)
  txDp: -0.2925, // = (262.02 − 1.45803·180) / (16/11)
  tyDp: 0.333, // = 94/3 − 31 (상태바 94 기기px − 31 dp 스페이서)
  origin: '0 0',
  transform: 'translate(-0.2925px, 0.333px) scaleX(1.0023956)',
});

/** 비교에서 항상 빼는 OS UI (frame px "x,y,w,h"). 엣지 패널 손잡이는 *-clean.mp4 에서 지웠으므로 없다 */
const DEFAULT_MASKS = Object.freeze({
  statusbar: '0,0,524,46', // 0–45.58 + 섞인 45행
  navbar: '0,1210,524,70', // 1210.18–1280 + 섞인 1210행
});
/** 이름으로 부를 수 있는 선택 마스크 (compare.py --mask <이름>, shots 항목 mask 에도 이름 가능) */
const OPTIONAL_MASKS = Object.freeze({
  keyboard: '0,738,524,542', // 삼성 키보드(노란 테마, OS) 508 dp(738.95 px)부터 아래끝
  imeAppearing: '0,1207,524,73', // 키보드가 뜨기 직전 회색 띠
  rightColumnIso: '523,0,1,1280', // 가로 보정 없이 찍으면 x=523 열은 64% 만 페이지
  edgePanelRawOnly: '0,147,9,176', // 손잡이를 지우지 않은 원본 mp4 프레임과 비교할 때만
});

/* ── 반올림 ─────────────────────────────────────────── */

const roundN = (v, n) => {
  const k = 10 ** n;
  const r = Math.round(v * k) / k;
  return Object.is(r, -0) ? 0 : r;
};
/** 소수 셋째 자리 (dp·px 표기 기본: 31.333, 45.576, 1210.182) */
const round3 = (v) => roundN(v, 3);
const round2 = (v) => roundN(v, 2);

/* ── 변환: 정확한 값 (반올림 없음) ─────────────────────── */

const exact = Object.freeze({
  /** 가로 위치 dp → frame px */
  xPx: (xdp) => X_CENTER_PX + PX_PER_DP_X * (xdp - X_CENTER_DP),
  /** 가로 위치 frame px → dp */
  xDp: (xpx) => X_CENTER_DP + (xpx - X_CENTER_PX) / PX_PER_DP_X,
  /** 세로 위치 dp(화면 기준) → frame px */
  yPx: (ydp) => ydp * PX_PER_DP_Y,
  /** 세로 위치 frame px → dp (화면 기준) */
  yDp: (ypx) => ypx * DP_PER_PX_Y,
  /** 폭(가로 길이·가로 이동) */
  wPx: (wdp) => wdp * PX_PER_DP_X,
  wDp: (wpx) => wpx / PX_PER_DP_X,
  /** 높이(세로 길이·세로 이동) */
  hPx: (hdp) => hdp * PX_PER_DP_Y,
  hDp: (hpx) => hpx * DP_PER_PX_Y,
  /** 방향 없는 길이 (반지름·글자 크기·선 굵기): 세로 배율 = DSF */
  lenPx: (dp) => dp * PX_PER_DP_Y,
  lenDp: (px) => px * DP_PER_PX_Y,
});

/* ── 변환: 소수 셋째 자리 ─────────────────────────────── */

const xPx = (v) => round3(exact.xPx(v));
const xDp = (v) => round3(exact.xDp(v));
const yPx = (v) => round3(exact.yPx(v));
const yDp = (v) => round3(exact.yDp(v));
const wPx = (v) => round3(exact.wPx(v));
const wDp = (v) => round3(exact.wDp(v));
const hPx = (v) => round3(exact.hPx(v));
const hDp = (v) => round3(exact.hDp(v));
const lenPx = (v) => round3(exact.lenPx(v));
const lenDp = (v) => round3(exact.lenDp(v));
/** 화면 y frame px → 앱 뷰포트 기준 dp (y_dp − 31.333) */
const yAppDp = (ypx) => round3(exact.yDp(ypx) - STATUS_BAR_DP);
/** 앱 뷰포트 기준 dp → 화면 y frame px */
const yAppPx = (yapp) => round3(exact.yPx(yapp + STATUS_BAR_DP));

/** [x,y,w,h] 또는 {x,y,w,h} (frame px, 화면 기준) → {x,y,w,h} dp (화면 기준) */
function boxDp(b) {
  const [x, y, w, h] = Array.isArray(b) ? b : [b.x, b.y, b.w, b.h];
  return { x: xDp(x), y: yDp(y), w: wDp(w), h: hDp(h) };
}
/** [x,y,w,h] 또는 {x,y,w,h} (dp, 화면 기준) → {x,y,w,h} frame px */
function boxPx(b) {
  const [x, y, w, h] = Array.isArray(b) ? b : [b.x, b.y, b.w, b.h];
  return { x: xPx(x), y: yPx(y), w: wPx(w), h: hPx(h) };
}

/** 마스크 하나: 이름(statusbar·keyboard …) 또는 "x,y,w,h" → "x,y,w,h" (frame px 정수). 틀리면 throw */
function resolveMask(m) {
  const s = String(m).trim();
  if (Object.hasOwn(DEFAULT_MASKS, s)) return DEFAULT_MASKS[s];
  if (Object.hasOwn(OPTIONAL_MASKS, s)) return OPTIONAL_MASKS[s];
  const v = s.split(',').map((t) => Number(t.trim()));
  if (v.length !== 4 || v.some((n) => !Number.isFinite(n))) {
    throw new Error(`마스크 '${s}': "x,y,w,h" 또는 이름(${[...Object.keys(DEFAULT_MASKS), ...Object.keys(OPTIONAL_MASKS)].join(', ')}) 이어야 한다`);
  }
  return v.map((n) => Math.round(n)).join(',');
}

module.exports = {
  FRAME, VIEWPORT_DP, DSF, DSF_TEXT,
  PX_PER_DP_X, PX_PER_DP_Y, DP_PER_PX_Y, X_CENTER_PX, X_CENTER_DP,
  DENSITY, STATUS_BAR_DEVICE_PX, NAV_DEVICE_PX,
  STATUS_BAR_DP, STATUS_BAR_PX, NAV_DP, NAV_PX, APP_BOTTOM_DP, APP_BOTTOM_PX, APP_HEIGHT_DP,
  FRAME_MODE, DEFAULT_MASKS, OPTIONAL_MASKS,
  round2, round3, exact,
  xPx, xDp, yPx, yDp, wPx, wDp, hPx, hDp, lenPx, lenDp, yAppDp, yAppPx, boxDp, boxPx, resolveMask,
};
