// NH올원뱅크 움직임 값 (plan.md §3.4, 녹화에서 잰 값 — 표시가 없으면 잰 것, "invented" 는 지어낸 기본값).
// 시간은 ms, 거리는 pt (= 393 × 852 틀의 CSS px). 영역은 이 값을 가져다 씀 (CSS 에서는 같은 수를 키프레임 길이로)

// 앱 열기: 아이콘을 누르면 한 프레임에 색만 바뀜(크기 그대로), 손을 떼면 100ms ease-out 으로 원래 색 + 장면이 250ms 동안 흰색으로 녹아 사라짐 (줌 아님)
export const AO_DISSOLVE_EASE = "linear(0, .004, .008, .039, .077, .129, .203, .285, .387, .49, .602, .713, .817, .902, .962, 1)";
export const AO_INTRO = {
  idle: 650, // 장면이 가만히 있는 시간 (녹화 C1 0–0.650)
  press: 250, // 누른 채 (0.650 → 0.900 = D)
  release: 100, // 손을 떼면 아이콘이 원래 색으로 (ease-out)
  dissolve: 250, // D → D+250 흰색으로
  // 상태바 글자 흰색 → 검정: D+100 부터 217ms, 천천히 시작해 천천히 끝나는 곡선 (C1 시계 · LTE · 배터리 채움 셋 다 같음, 16.67ms 마다 잰 값).
  // 처음 표의 "녹아 사라짐 곡선 + 33ms" 는 녹화보다 최대 .2 앞섰음
  statusDelay: 100,
  statusMs: 217,
  statusEase: "linear(0, .015, .06, .14, .23, .34, .455, .57, .69, .8, .88, .95, .985, 1)",
  whiteHold: 1200, // 흰 시작화면 (녹아 사라진 뒤 1.20초, 스플래시는 D+1450)
  splashAt: 1450, // D 기준 스플래시 그림이 나타나기 시작
  pressColor: "#034913", // 누른 아이콘 바탕 (원래 #0C8F2D)
  pressMark: "#919291", // 누른 아이콘 글자 (원래 흰색)
} as const;

// 홈 인디케이터 (D 기준 ms → 투명도): 흰 시작화면 위에 잠깐 보였다가 사라짐 (C1 1.15–2.00). 앱 안에서는 늘 숨김
export const AO_HOME_INDICATOR: readonly (readonly [ms: number, opacity: number])[] = [
  [0, 0],
  [250, 0.41],
  [300, 0.45],
  [350, 0.49],
  [400, 0.6],
  [450, 0.72],
  [500, 0.85],
  [550, 0.88],
  [600, 0.91],
  [650, 0.94],
  [700, 0.97],
  [750, 1],
  [850, 1],
  [900, 0.85],
  [950, 0.64],
  [1000, 0.4],
  [1050, 0.19],
  [1100, 0],
];
export const AO_HOME_INDICATOR_MS = 1100;
// 인트로 없이 켤 때(프로필 고름 · 새로고침 · 인트로 끈 녹화): D = 시작화면이 뜬 때 − 250ms (흰 화면 1.20초 뒤 스플래시)
export const AO_LAUNCH_NO_INTRO_LEAD = 250;

// 스플래시 · 잠금(간편비밀번호)
export const AO_SPLASH = {
  fade: 267,
  fadeEase: "linear(0, .188, .308, .422, .529, .624, .694, .756, .809, .855, .893, .92, .942, .964, .975, .983, 1)",
  hold: 2383,
  toPin: 167, // 스플래시 → 잠금 화면 교차 페이드
  toPinEase: "linear(0, .026, .108, .236, .395, .541, .692, .82, .911, .96, 1)",
  keypadAfter: 117, // 교차 페이드 끝 + 117ms 에 보안 키패드가 한 프레임에
  pinToLoading: 67, // 6번째 숫자 → 67ms 뒤 로딩 막 (키패드는 그 프레임에 사라짐)
} as const;

// 로딩 스피너: 1467ms 한 바퀴, 30fps 로 (두 프레임씩 같은 모습), 켜질 때마다 동전 앞면부터
export const AO_SPINNER = { loop: 1467, fps: 30, size: 61, cx: 196.5, cy: 425.8 } as const;

// 로딩 막 (웹뷰 59–818 만): 한 프레임에 켜지고 꺼짐, 스피너는 33ms 먼저 꺼짐. 더 어둡게(거래 상세 · 잔액채우기 링크)는 검정 .22 한 겹
export const AO_DIM = {
  web: "rgba(55, 55, 55, 0.68)",
  deepen: "rgba(0, 0, 0, 0.22)",
  deepenDetail: 280, // ease-out
  deepenTopup: 300, // ease-out
  spinnerLead: 33,
  scrim: "rgba(0, 0, 0, 0.3)", // 웹 시트 배경막
  nativeAmount: "rgba(0, 0, 0, 0.765)", // 금액 입력(T7) 네이티브 막 — 창 전체
  nativePassword: "rgba(0, 0, 0, 0.733)", // 계좌 비밀번호(T3) 네이티브 막 — 창 전체
} as const;

// 웹 시트 (화면 안): 배경막 300ms ease, 올라오기 291ms, 내려가기 150ms (invented)
export const AO_SHEET = {
  scrim: 300,
  scrimEase: "ease",
  rise: 291,
  riseEase: "cubic-bezier(0, .11, .17, .87)",
  down: 150,
  downEase: "cubic-bezier(.4, 0, 1, 1)", // invented
} as const;

// 정기점검 시트: 막이 걷힌 뒤 +583ms 에 미끄러짐 없이 나타남 (배경막만 300ms), 닫으면 한 프레임에
export const AO_NOTICE = { afterDim: 583, autoAdvance: 4000, slide: 300 } as const;

// 금액 키패드 판(T2, 네이티브, 화면 y 435–852): 화면 아래끝(852)에서 들어오고 852 로 나감 — 818 이 아님, 움직이는 동안 판 내용이 아래 띠
// 818–852 에 보임. C3 28.963–29.146 · 1.879–2.046 을 프레임마다 잰 판 위끝 (칩 글자 · 숫자 줄이 같음):
// 들어옴 175ms cubic-bezier(.4,.2,.6,1), 화면이 바뀐 뒤 5ms 부터 (rms 1–1.4pt) · 나감 170ms cubic-bezier(.4,0,.6,.7) (rms 1.5–2.2pt).
// 처음 표의 818 기준 150ms (.31,.18,.55,.89) / 153ms (.39,.03,.70,.92) 는 녹화와 5–40pt 어긋났음. transfer.css 가 같은 수를 씀
export const AO_PANEL = {
  top: 435,
  from: 852, // 화면 아래끝 (판 높이만큼 = translateY(100%))
  in: 175,
  inDelay: 5,
  inEase: "cubic-bezier(.4, .2, .6, 1)",
  out: 170,
  outEase: "cubic-bezier(.4, 0, .6, .7)",
} as const;

// 금액 입력 시트(T7, 네이티브): 막이 걷힌 프레임 +64ms 부터 357ms 올라옴, 닫기 ≈145ms 내려간 뒤 막이 370ms 더 남음.
// 상태바 아이콘은 600ms 뒤 한 프레임에, 시계는 667ms 뒤 100ms 동안 흰색 (닫으면 한 프레임에 검정)
export const AO_AMOUNT_SHEET = {
  riseDelay: 64,
  rise: 357,
  riseEase: "cubic-bezier(.19, .52, .23, 1)",
  close: 145,
  closeEase: "cubic-bezier(.29, .19, .54, .75)",
  dimLinger: 370,
  statusIconsDelay: 600,
  statusClockDelay: 667,
  statusClockMs: 100,
  digitRoll: 250, // 숫자 −30pt → 0, 투명도 .1 → .3, 직선, 그다음 또렷
} as const;

// 계좌 비밀번호 시트(T3, 네이티브): 한 프레임에 나타나고 사라짐, 4번째 숫자 +50ms 에 닫힘. 상태바는 검정 그대로
export const AO_PASSWORD_SHEET = { afterLastDigit: 50 } as const;

// iOS 키보드: 올라옴 290ms cubic-bezier(.2,.4,.2,1) — C3 41.146–41.513 프레임마다 잰 판 위치에 맞춤 (오차 rms 2pt, 처음 표의 240ms
// cubic-bezier(.2,.8,.2,1) 은 중간에서 45pt 어긋났음). 쉴 때 판 위끝 545 (C3 41.80; 41.40 은 아직 547.7 로 내려앉는 중).
// 내려감 250ms (invented). ui/Keyboard.tsx 가 이 값을 씀
export const AO_KEYBOARD = { slide: 290, ease: "cubic-bezier(.2, .4, .2, 1)", out: 250, outEase: "cubic-bezier(.4, 0, .6, 1)", top: 545 } as const;

// 홈 아래 탭 바 (쪽 743–818) 와 내 자산 확인 알약: 둘은 곡선이 따로 (탭 바가 알약 위에 그려지고, 알약이 더 빨리 내려가 탭 바 뒤로 들어감).
// 프레임마다 잰 값 (탭 바 = 홈 아이콘 줄, 알약 = 위끝). home.css 가 같은 수를 transition 으로 씀
//  - 숨김 (스크롤 이벤트부터, C1 14.517–15.0): 탭 바 490ms cubic-bezier(.4,0,.2,1) 로 +75 (rms .5pt, 한 프레임 앞서 시작 = 지연 −17),
//    알약 620ms cubic-bezier(.2,.05,.1,1) 로 +135 (rms .9pt)
//  - 맨 위로 돌아옴 (맨 위 닿음 C2 3.858 → 3.903 부터): 탭 바 952ms cubic-bezier(.22,-.12,.03,1) (rms .1pt), 알약 731ms cubic-bezier(.16,.29,.07,1)
//    (rms .4pt). 지연 8ms + 그리는 한 프레임 ≈ 녹화의 38–45ms
//  - 맨 끝 (끝 닿음 C2 2.358 → 2.395 부터): 탭 바만, 맨 위로 돌아올 때 곡선의 앞부분으로 +14.33 에서 멈춤 = 424ms linear(…) (rms .2pt). 알약은 안 나옴
//  - 가운데에서 위로 올려도 안 나옴
export const AO_TABBAR = {
  bar: {
    hideBy: 75,
    hide: 490,
    hideDelay: -17,
    hideEase: "cubic-bezier(.4, 0, .2, 1)",
    showTop: 952,
    showTopEase: "cubic-bezier(.22, -.12, .03, 1)",
    bottom: 424,
    bottomEase: "linear(0, 0, 0, 0.041, 0.125, 0.244, 0.368, 0.479, 0.575, 0.656, 0.726, 0.787, 0.841, 0.888, 0.93, 0.967, 1)",
    bottomRest: 14.33, // 맨 끝에서는 +14.33 에 멈춤
  },
  pill: {
    hideBy: 135,
    hide: 620,
    hideEase: "cubic-bezier(.2, .05, .1, 1)",
    showTop: 731,
    showTopEase: "cubic-bezier(.16, .29, .07, 1)",
  },
  showTopDelay: 8,
} as const;

// 홈 계좌 카드 넘기기: 손을 뗀 때부터 맞춰 서기 · 제자리로 둘 다 305ms cubic-bezier(.3,.43,.3,1) (C2 4.507–4.783 rms 1.1pt, C3 25.192–25.433 rms .24pt).
// 처음 표의 250 · 450ms 는 손가락이 끄는 시간까지 넣어 잰 값이었음. 처음 보는 카드의 "조회 중" 몸통 420ms
export const AO_CAROUSEL = {
  snap: 305,
  rubber: 305,
  ease: "cubic-bezier(.3, .43, .3, 1)",
  easePoints: [0.3, 0.43, 0.3, 1] as const,
  unseenBody: 420,
} as const;
// 오늘의 혜택 글자 · 광고 넘기기
export const AO_TICKER = { period: 2500, iconFade: 150, firstChar: 217, perChar: 67 } as const;
export const AO_ADS = { interval: 4000, slide: 180 } as const; // interval invented
// 뼈대(스켈레톤): 막이 걷힌 뒤 H1 → 알약 → H2 배너 → H3 카드 → H4 아래 칸 (C1 프레임 차이: 막 12.150 · 알약 12.183 · 배너 12.267 · 카드 12.500 · 아래 12.700)
export const AO_SKELETON_STEPS = [0, 33, 117, 350, 550] as const;

// 스위치: 자동완성 색은 한 프레임에 · 손잡이 250ms, 큰글 손잡이 200ms (invented)
export const AO_SWITCH = { knob: 250, bigTextKnob: 200, small: 150 } as const;

// 토스트: 200ms 나타남/사라짐, 2000ms 머묾 (invented)
export const AO_TOAST = { fade: 200, hold: 2000 } as const;

// 화면 이동 잠금: 한 번 이동하면 이만큼 다음 이동을 받지 않음 (빠른 두 번 누름에 같은 화면이 두 칸 쌓이지 않게)
export const AO_NAV_LOCK = 450;
