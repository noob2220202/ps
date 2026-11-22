// ⚠️ 자동 생성 파일 — 직접 고치지 말고 spec/*.assets.json 을 고친 뒤 `node tools/gen-from-spec.cjs` 를 다시 실행한다.
//
// WooriArt — 잘라낸 아트 에셋 파일 표 (이름 → public/ 경로)
//
// 이름 = '<그룹>.<spec 의 name>' (그룹 = public/woori/<그룹>/).
// PNG 는 정지 구간 원본 프레임(손잡이 지운 clean 영상) 중앙값 → 크롭 → 업스케일 이미지다.
// 파일 크기 = 영상 frame px 박스 × scale. 화면에는 WooriArtbox.ts 의 w/h (dp, D1) 로 표시한다.
// character: true 는 캐릭터 자리의 독창적 대체 그림 (영상의 캐릭터를 따라 그리지 않음, 비교에서는 마스크).
// 원본 표: spec/done.assets.json, spec/history-detail.assets.json, spec/history.assets.json, spec/home.assets.json, spec/launch.assets.json, spec/send-a.assets.json, spec/send-b.assets.json

export type WooriArtGroup = "launch" | "home" | "history" | "history-detail" | "send-a" | "send-b" | "done" | "banks" | "common"

export type WooriArtName =
  | "launch.splash-won-wordmark"
  | "launch.splash-if-award"
  | "launch.splash-ma-cert"
  | "launch.splash-woori-wordmark"
  | "launch.splash-logo-track"
  | "launch.splash-logo-fill"
  | "launch.splash-logo-circle"
  | "launch.check-circle-outline"
  | "launch.check-circle-off"
  | "launch.login-loader-hexes"
  | "launch.login-loader-wings"
  | "launch.login-loader-body"
  | "home.wallet"
  | "home.bell-dot"
  | "home.menu"
  | "home.ai-chat-bubble"
  | "home.ai-chat-ai"
  | "home.ai-chat-lines"
  | "home.ai-chat-sparkle"
  | "home.notice-bell"
  | "home.close-x-small"
  | "home.gear"
  | "home.kebab"
  | "home.copy"
  | "home.strip-arrow"
  | "home.woori-logo-40"
  | "home.other-bank-logos"
  | "home.tab-product"
  | "home.tab-asset"
  | "home.tab-home-on"
  | "home.tab-stock"
  | "home.tab-benefit"
  | "home.home-character-room"
  | "home.home-character-banner"
  | "home.home-popup-image"
  | "home.banner-img-01"
  | "home.banner-img-02"
  | "home.banner-img-03"
  | "home.banner-img-04"
  | "home.banner-img-05"
  | "home.banner-img-06"
  | "home.banner-img-07"
  | "home.banner-img-08"
  | "home.banner-img-09"
  | "home.banner-img-10"
  | "home.banner-img-04-character"
  | "home.counter-prev"
  | "home.counter-next"
  | "home.counter-pause"
  | "home.chevron-right"
  | "home.svc-won-mobile"
  | "home.svc-exchange-pocket"
  | "home.svc-won-wallet"
  | "home.grp-capital-car"
  | "home.grp-securities-chart"
  | "history.back-chevron"
  | "history.woori-logo-40"
  | "history.chevron-down-small"
  | "history.copy"
  | "history.search"
  | "history.filter-sliders"
  | "history.chevron-down"
  | "history.close-x"
  | "history.chevron-down-tiny"
  | "history.chevron-right"
  | "history.chevron-right-12"
  | "history.chevron-down-12"
  | "history-detail.close-x"
  | "history-detail.chevron-memo"
  | "history-detail.chevron-search"
  | "send-a.camera"
  | "send-a.star-outline"
  | "send-a.plus"
  | "send-a.close"
  | "send-a.clear-circle"
  | "send-a.chevron-down"
  | "send-a.kb-backspace"
  | "send-a.kb-nav-mic"
  | "send-a.kb-nav-recents"
  | "send-a.kb-nav-home"
  | "send-a.kb-nav-hide"
  | "send-a.kb-glyph-2"
  | "send-a.kb-glyph-dotdash"
  | "send-a.kb-glyph-comma"
  | "send-a.kb-tb-eq"
  | "send-a.kb-tb-at"
  | "send-a.kb-tb-plus"
  | "send-a.kb-tb-rparen"
  | "send-a.kb-tb-lparen"
  | "send-a.kb-tb-dot"
  | "send-b.keypad-backspace"
  | "send-b.confirm-arrow"
  | "send-b.warning-triangle"
  | "send-b.warning-bang-bar"
  | "send-b.warning-bang-dot"
  | "send-b.siren"
  | "send-b.confirm-logo-woori"
  | "send-b.confirm-logo-nh"
  | "send-b.confirm-logo-kakao"
  | "done.check-circle"
  | "done.ad-iou-illust"
  | "banks.woori"
  | "banks.nh"
  | "banks.kb"
  | "banks.kakao"
  | "banks.shinhan"
  | "banks.hana"
  | "banks.ibk"
  | "banks.toss"
  | "banks.kfcc"
  | "banks.kbank"
  | "banks.im"
  | "banks.busan"
  | "banks.sc"
  | "banks.kyongnam"
  | "banks.kwangju"
  | "banks.deutsche"
  | "banks.nfcf"
  | "banks.kdb"
  | "banks.suhyup"
  | "banks.suhyup-central"
  | "banks.cu"
  | "banks.citi"

export interface WooriArtFile {
  /** public/ 기준 경로 (앞에 '/' 없이), 예: 'woori/home/banner-1.png' */
  file: string
  kind: 'png' | 'svg' | 'other'
  /** 파일 해상도 ÷ 영상 frame px 박스 (업스케일 PNG → 3, SVG → 1). 표시 크기(dp)는 WooriArtbox 의 w/h */
  scale: number
  /** 투명 배경 여부 (PNG 알파 채널 / SVG) */
  transparent: boolean
  /** PNG 실제 픽셀 크기 [w, h] (= frame px 박스 × scale) */
  intrinsic?: readonly [number, number]
  /** 실제 기기용 선명한 판 (public/ 기준 경로). 프레임 모드가 아닐 때 artSrc 가 이 파일을 준다 — 다시 키운 PNG(Real-ESRGAN, 역투영) 또는 벡터 SVG */
  hq?: string
  /** SVG 기본 색 (파일에 박힌 색) */
  color?: string
  /** 캐릭터 자리의 독창적 대체 그림 (비교 마스크) */
  character?: true
  /** 영상 대조용 참고 에셋: 화면은 이 파일을 쓰지 않는다 (이유는 note, spec 의 referenceOnly) */
  referenceOnly?: true
  /** 설명 (spec notes 첫 문장, 참고용이면 그 이유) */
  note?: string
}

export const WOORI_ART: Record<WooriArtName, WooriArtFile> = {
  "launch.splash-won-wordmark": { file: "woori/launch/splash-won-wordmark.png", kind: "png", scale: 3, transparent: true, intrinsic: [333, 111], hq: "woori/launch/splash-won-wordmark.hq.svg", note: "'WON' 글자 로고 (남색 #00259f — 로고 원과 같은 색, 잉크 Y<60 화소 중앙값 (0,37,159))" },
  "launch.splash-if-award": { file: "woori/launch/splash-if-award.png", kind: "png", scale: 3, transparent: true, intrinsic: [417, 216], hq: "woori/launch/splash-if-award.hq.svg", note: "iF DESIGN AWARD 2026 (빨간 사각 2개, 코어 (230,0,18))" },
  "launch.splash-ma-cert": { file: "woori/launch/splash-ma-cert.png", kind: "png", scale: 3, transparent: true, intrinsic: [513, 171], hq: "woori/launch/splash-ma-cert.hq.svg", note: "MA 모바일 접근성 인증 마크(남색 (35,63,144)) + 'Mobile Accessibility / 모바일 접근성 인증' 글자" },
  "launch.splash-woori-wordmark": { file: "woori/launch/splash-woori-wordmark.png", kind: "png", scale: 3, transparent: true, intrinsic: [273, 90], hq: "woori/launch/splash-woori-wordmark.hq.svg", note: "'우리은행' 글자 로고 (파랑, 가장 진한 3% 중앙값 #0c5997 — 획이 가늘어 코덱이 옅게 만든 값)" },
  "launch.splash-logo-track": { file: "woori/launch/splash-logo-track.svg", kind: "svg", scale: 1, transparent: true, color: "#d0d0d0", note: "WON 로고 맨 아래 겹: 회색 알약 트랙 75.15x40.88dp, #d0d0d0, 양 끝 반원(rx 20.44)" },
  "launch.splash-logo-fill": { file: "woori/launch/splash-logo-fill.svg", kind: "svg", scale: 1, transparent: true, color: "linear-gradient(90deg, #2bc8f4 0, #cefffd 35.80dp, #e9ffff 41.88dp, #ffffff 46.65dp) (트랙 왼끝 기준)", note: "WON 로고 가운데 겹: 하늘색 그라데이션 알약(트랙과 같은 왼끝·폭 75.15dp, 높이 41.0dp, rx 20.5)" },
  "launch.splash-logo-circle": { file: "woori/launch/splash-logo-circle.svg", kind: "svg", scale: 1, transparent: true, color: "#00259f", note: "WON 로고 맨 위 겹: 남색 원 지름 50.6dp #00259f (0,37,159)" },
  "launch.check-circle-outline": { file: "woori/launch/check-circle-outline.svg", kind: "svg", scale: 1, transparent: true, color: "#33353a", note: "자동 로그인 ✓ (켬): 원 테두리(중심 반지름 11.25dp, 굵기 1.5dp) + 체크(굵기 2dp, 둥근 끝·꺾임) #33353a(--woori-text)" },
  "launch.check-circle-off": { file: "woori/launch/check-circle-off.svg", kind: "svg", scale: 1, transparent: true, color: "#33353a", note: "**설계값(영상에 없음)**: 자동 로그인 끔 — 같은 원 테두리만(체크 없음)" },
  "launch.login-loader-hexes": { file: "woori/launch/login-loader-hexes.svg", kind: "svg", scale: 1, transparent: true, character: true, note: "캐릭터 대체 그림(독창, 비교 마스크). 뒤 겹: 노란 육각형 무늬 한 칸(112dp, 가로로 이어 붙여도 이음매 없음 — 도형이 칸 경계를 넘지 않음)" },
  "launch.login-loader-wings": { file: "woori/launch/login-loader-wings.svg", kind: "svg", scale: 1, transparent: true, character: true, note: "캐릭터 대체 그림(독창, 비교 마스크). 가운데 겹: 반투명 흰 날개 2장(뿌리 (61, 41)dp)" },
  "launch.login-loader-body": { file: "woori/launch/login-loader-body.svg", kind: "svg", scale: 1, transparent: true, character: true, note: "캐릭터 대체 그림(독창, 비교 마스크). 앞 겹: 하늘색 알약 몸통(40x50dp, −12° 기울임) + 노란 띠 2개 + 아래 그늘 + 윤기" },
  "home.wallet": { file: "woori/home/wallet.svg", kind: "svg", scale: 1, transparent: true, color: "#313237", note: "머리 지갑 아이콘 (24dp 칸 196,14 — 머리는 고정이라 모든 상태 같은 자리)" },
  "home.bell-dot": { file: "woori/home/bell-dot.svg", kind: "svg", scale: 1, transparent: true, color: "#2f3336", note: "머리 알림 종(선, #2f3336, 굵기 1.97dp) + 빨간 점(#d3555b, 중심 22.18,2.13 r2.11 — 상자 오른쪽 끝에 걸쳐 0.3dp 잘림, 원래도 같은 자리)" },
  "home.menu": { file: "woori/home/menu.svg", kind: "svg", scale: 1, transparent: true, color: "#26282d", note: "머리 ☰ (세 줄 x 3.97–20.07, 간격 6.01, 굵기 1.87dp, 둥근 끝)" },
  "home.ai-chat-bubble": { file: "woori/home/ai-chat-bubble.svg", kind: "svg", scale: 1, transparent: true, color: "#2f3239", note: "AI 말풍선 테두리(고정 겹): 원호(중심 11.1,12.0 r8.69, 위 끝 −83° → 오른쪽 아래 −298°) + 꼬리(19.36,20.37 꺾임 → 19.64,11.71)" },
  "home.ai-chat-ai": { file: "woori/home/ai-chat-ai.svg", kind: "svg", scale: 1, transparent: true, color: "#2b2e34", note: "말풍선 안 \"AI\" 글자 (A: 꼭대기 평평 0.9dp, 반폭 2.61, 아래 15.43, 가로대 13.65 / I: x 14.73), 굵기 1.44dp, 각진 끝" },
  "home.ai-chat-lines": { file: "woori/home/ai-chat-lines.svg", kind: "svg", scale: 1, transparent: true, color: "#2b2e34", note: "말풍선 안 \"≡\" 두 줄 (x 7.24 → 15.21 / 13.17, y 11.05 · 14.40, 굵기 1.51dp, 각진 끝)" },
  "home.ai-chat-sparkle": { file: "woori/home/ai-chat-sparkle.png", kind: "png", scale: 3, transparent: true, intrinsic: [63, 66], hq: "woori/home/ai-chat-sparkle.hq.png", note: "AI 말풍선 오른쪽 위 파랑→보라 그라데이션 별(네 갈래)" },
  "home.notice-bell": { file: "woori/home/notice-bell.svg", kind: "svg", scale: 1, transparent: true, color: "#f9b811", note: "공지 카드 종 (채운 노랑 #f9b811 + 주황 추 #e58418)" },
  "home.close-x-small": { file: "woori/home/close-x-small.svg", kind: "svg", scale: 1, transparent: true, color: "#7e8082", note: "작은 ✕ (공지 카드·다른 은행 카드 오른쪽 위, 16dp 칸 = 카드 위끝 +12·오른쪽 끝 −28)" },
  "home.gear": { file: "woori/home/gear.svg", kind: "svg", scale: 1, transparent: true, color: "#7b8188", note: "홈계좌설정 칩 톱니 (6톱니 별, 끝 r7.36 · 골 r4.89, 둥글기 0.81/0.61, 가운데 구멍 r1.95 evenodd)" },
  "home.kebab": { file: "woori/home/kebab.svg", kind: "svg", scale: 1, transparent: true, color: "#848386", note: "WON 통장 카드 ⋮ (24dp 칸 = 카드 위끝 +14)" },
  "home.copy": { file: "woori/home/copy.svg", kind: "svg", scale: 1, transparent: true, color: "#858585", note: "계좌번호 옆 복사 (앞 둥근 사각 6.13–14.03 x 5.86–13.67, r1.55 + 뒤 ㄱ자, 굵기 1.34dp)" },
  "home.strip-arrow": { file: "woori/home/strip-arrow.svg", kind: "svg", scale: 1, transparent: true, color: "#ffffff", note: "WON 통장 파란 띠(#3794f6) 흰 굽은 화살표 (채운 다각형: 꼬리 곡선 + 둥근 머리)" },
  "home.woori-logo-40": { file: "woori/home/woori-logo-40.png", kind: "png", scale: 3, transparent: true, intrinsic: [186, 186], hq: "woori/home/woori-logo-40.hq.svg", note: "WON 통장 카드 우리 로고 원 40dp (연파랑 원 #c0e1fe + 파랑 그라데이션 띠)" },
  "home.other-bank-logos": { file: "woori/home/other-bank-logos.png", kind: "png", scale: 3, transparent: true, intrinsic: [564, 156], hq: "woori/home/other-bank-logos.hq.png", note: "다른 은행 계좌 카드의 겹친 로고 원 5개(카카오뱅크·토스·KB·하나·…) 한 장" },
  "home.tab-product": { file: "woori/home/tab-product.svg", kind: "svg", scale: 1, transparent: true, color: "#444549", note: "탭 상품 (쇼핑백: 사다리꼴 — 위 반폭 9.23 · 아래 10.14, 모서리 r3.38, 손잡이 U, 굵기 2.0dp)" },
  "home.tab-asset": { file: "woori/home/tab-asset.svg", kind: "svg", scale: 1, transparent: true, color: "#49494e", note: "탭 자산·소비 (파이: 큰 원호 r10.01 + 같은 중심 원호의 조각, 조각은 각진 모서리 evenodd)" },
  "home.tab-home-on": { file: "woori/home/tab-home-on.svg", kind: "svg", scale: 1, transparent: true, color: "#2584e9", note: "탭 홈(선택): 채운 오각 집 #2584e9 (꼭짓점 둥글기 1.99 · 어깨 2.45 · 아래 2.51) + 흰 점 r1.45" },
  "home.tab-stock": { file: "woori/home/tab-stock.svg", kind: "svg", scale: 1, transparent: true, color: "#48494d", note: "탭 주식 (둥근 사각 r2.83 + 꺾은선 4점, 굵기 2.03dp)" },
  "home.tab-benefit": { file: "woori/home/tab-benefit.svg", kind: "svg", scale: 1, transparent: true, color: "#48494e", character: true, note: "캐릭터 대체 그림(독창, 비교 마스크). **character: true — 독창 대체 그림.** 영상의 혜택 아이콘(더듬이 달린 얼굴 선 아이콘)은 마스코트 얼굴로 볼 수 있어 따라 그리지 않고, 같은 칸·굵기(1.95dp)·색(#48494e)의 선물 상" },
  "home.home-character-room": { file: "woori/home/home-character-room.png", kind: "png", scale: 3, transparent: true, intrinsic: [1104, 480], hq: "woori/home/home-character-room.hq.png", note: "홈 맨 위 캐릭터 배너의 **캐릭터가 아닌 부분**(창문·화분과 의자·전등과 불빛·액자·난로)만 영상에서 자른 그림" },
  "home.home-character-banner": { file: "woori/home/home-character-banner.svg", kind: "svg", scale: 1, transparent: true, character: true, note: "캐릭터 대체 그림(독창, 비교 마스크). **character: true — 독창 대체 그림.** 영상의 곰·벌·분홍 캐릭터를 자르거나 따라 그리지 않고, 같은 자리(캐릭터 무리 상자 앱 122,154 150x87dp)·대략의 색감(연보라·노랑·분홍·주황)" },
  "home.home-popup-image": { file: "woori/home/home-popup-image.png", kind: "png", scale: 3, transparent: true, intrinsic: [570, 573], hq: "woori/home/home-popup-image.hq.png", note: "프로모션 시트의 \"해외 결제 적립 / 5천 포인트 / 최대 5.3%\" 그림(사람·캐릭터 없음, 중간 배너 2 와 같은 그림을 크게)" },
  "home.banner-img-01": { file: "woori/home/banner-img-01.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-01.hq.png", note: "중간 배너 1/10 그림: 선물 상자(분홍 클로버)" },
  "home.banner-img-02": { file: "woori/home/banner-img-02.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-02.hq.png", note: "중간 배너 2/10 그림: 해외 결제 적립(팝업 그림과 같음)" },
  "home.banner-img-03": { file: "woori/home/banner-img-03.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-03.hq.png", note: "중간 배너 3/10 그림: BLACK FRIDAY 통신비 특가 글자 그림 + 알뜰폰 꼬리표" },
  "home.banner-img-04": { file: "woori/home/banner-img-04.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-04.hq.png", note: "중간 배너 4/10 그림: 여행가방 (캐릭터는 대체 그림으로 따로)" },
  "home.banner-img-05": { file: "woori/home/banner-img-05.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-05.hq.png", note: "중간 배너 5/10 그림: 검은 선물 상자 + 금화" },
  "home.banner-img-06": { file: "woori/home/banner-img-06.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-06.hq.png", note: "중간 배너 6/10 그림: 하트 풍선 + 금화 주머니" },
  "home.banner-img-07": { file: "woori/home/banner-img-07.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-07.hq.png", note: "중간 배너 7/10 그림: 콜라·감자튀김·롤케이크·과자" },
  "home.banner-img-08": { file: "woori/home/banner-img-08.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-08.hq.png", note: "중간 배너 8/10 그림: 파란 카드 + CU 동전" },
  "home.banner-img-09": { file: "woori/home/banner-img-09.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-09.hq.png", note: "중간 배너 9/10 그림: COUNTDOWN FANTASY 2026→2027 글자" },
  "home.banner-img-10": { file: "woori/home/banner-img-10.png", kind: "png", scale: 3, transparent: true, intrinsic: [630, 524], hq: "woori/home/banner-img-10.hq.png", note: "중간 배너 10/10 그림: N pay 기프트카드" },
  "home.banner-img-04-character": { file: "woori/home/banner-img-04-character.svg", kind: "svg", scale: 1, transparent: true, character: true, note: "캐릭터 대체 그림(독창, 비교 마스크). **character: true — 독창 대체 그림 (critic 다시 그림).** 앞 판의 '얼굴 없는 여행 주머니 + 파란 띠 + 흰 점'은 원래 캐릭터(묶은 주머니 몸 + 파란 꽃무늬 셔츠)의 실루엣·무늬를 그" },
  "home.counter-prev": { file: "woori/home/counter-prev.svg", kind: "svg", scale: 1, transparent: true, color: "#737274", note: "중간 배너 카운터 알약/⏸ 원 안 ‹ (꼭짓점 3.67,6.0 · 가로 3.90 · 세로 반 3.91, 굵기 1.41dp, 둥근 끝)" },
  "home.counter-next": { file: "woori/home/counter-next.svg", kind: "svg", scale: 1, transparent: true, color: "#737274", note: "중간 배너 카운터 알약/⏸ 원 안 › (꼭짓점 8.29,5.98, 같은 모양 반대 방향)" },
  "home.counter-pause": { file: "woori/home/counter-pause.svg", kind: "svg", scale: 1, transparent: true, color: "#727274", note: "중간 배너 카운터 알약/⏸ 원 안 ⏸ 두 막대 (가운데 6.0,5.99 · 간격 3.02 · 반높이 2.18, 굵기 1.51dp, 둥근 끝)" },
  "home.chevron-right": { file: "woori/home/chevron-right.svg", kind: "svg", scale: 1, transparent: true, color: "#737275", note: "공지 줄 오른쪽 › (꼭짓점 10.18,7.99 · 가로 5.0 · 세로 반 4.98, 굵기 1.66dp, 둥근 끝)" },
  "home.svc-won-mobile": { file: "woori/home/svc-won-mobile.png", kind: "png", scale: 3, transparent: true, intrinsic: [117, 150], hq: "woori/home/svc-won-mobile.hq.png", note: "추천서비스 카드 흰 원(48dp) 안 3D 아이콘" },
  "home.svc-exchange-pocket": { file: "woori/home/svc-exchange-pocket.png", kind: "png", scale: 3, transparent: true, intrinsic: [156, 123], hq: "woori/home/svc-exchange-pocket.hq.png", note: "추천서비스 카드 흰 원(48dp) 안 3D 아이콘" },
  "home.svc-won-wallet": { file: "woori/home/svc-won-wallet.png", kind: "png", scale: 3, transparent: true, intrinsic: [132, 120], hq: "woori/home/svc-won-wallet.hq.png", note: "추천서비스 카드 흰 원(48dp) 안 3D 아이콘" },
  "home.grp-capital-car": { file: "woori/home/grp-capital-car.png", kind: "png", scale: 3, transparent: true, intrinsic: [210, 129], hq: "woori/home/grp-capital-car.hq.png", note: "우리금융그룹 서비스 마키 캐피탈 카드 — 자동차 3D(흰 차 + 파란 ₩ 꼬리표)" },
  "home.grp-securities-chart": { file: "woori/home/grp-securities-chart.png", kind: "png", scale: 3, transparent: true, intrinsic: [165, 132], hq: "woori/home/grp-securities-chart.hq.png", note: "우리금융그룹 서비스 마키 증권 카드 — 주황 막대 차트 + 화살표 3D" },
  "history.back-chevron": { file: "woori/history/back-chevron.svg", kind: "svg", scale: 1, transparent: true, color: "#37373a", note: "일반 페이지 머리 ‹ (주인 history — launch 인증서 PIN·send-a 이체 대상·send-b 금액/확인 머리도 같은 그림, 같은 상자)" },
  "history.woori-logo-40": { file: "woori/history/woori-logo-40.png", kind: "png", scale: 3, transparent: true, intrinsic: [184, 183], hq: "woori/history/woori-logo-40.hq.svg", note: "계좌 카드 우리은행 로고 원 40dp (연하늘 원 + 파랑 그라데이션 로고)" },
  "history.chevron-down-small": { file: "woori/history/chevron-down-small.svg", kind: "svg", scale: 1, transparent: true, color: "#6f7071", note: "계좌 이름 \"WON 통장\" 옆 ⌄ (주인 history — send-b 금액·확인 화면 출금/받는 계좌 ⌄ 도 같은 그림)" },
  "history.copy": { file: "woori/history/copy.svg", kind: "svg", scale: 1, transparent: true, color: "#858587", note: "계좌번호 옆 복사 (16dp 상자 (220.98,140.8) = 잉크 가운데 − 8; **x 는 계좌 글자 끝 + 4dp 를 따라간다** — 더미 계좌번호는 영상 글자와 폭이 달라 글자 끝에 붙여 놓는다)" },
  "history.search": { file: "woori/history/search.svg", kind: "svg", scale: 1, transparent: true, color: "#707072", note: "필터 줄 돋보기 🔍 (20dp 상자 (20,381); 붙은 필터 블록에서는 (20,59.667) 등 블록과 함께 움직인다)" },
  "history.filter-sliders": { file: "woori/history/filter-sliders.svg", kind: "svg", scale: 1, transparent: true, color: "#6d6f73", note: "필터 줄 오른쪽 조절(슬라이더) 아이콘 (20dp 상자 (320,381.5), 오른끝 340; 붙은 블록에서는 (320,60.167) 등)" },
  "history.chevron-down": { file: "woori/history/chevron-down.svg", kind: "svg", scale: 1, transparent: true, color: "#828488", note: "기간 내 합계 상자 오른쪽 ⌄ (20dp 상자 (300,473.667), 회색 바탕 #f6f7fa 위)" },
  "history.close-x": { file: "woori/history/close-x.svg", kind: "svg", scale: 1, transparent: true, color: "#37373a", note: "시트 ✕ (조회조건 시트 위 오른쪽, 24dp 상자 (316,375); 주인 history — send-b 중복 경고 시트·비밀번호 시트 ✕ 도 같은 그림)" },
  "history.chevron-down-tiny": { file: "woori/history/chevron-down-tiny.svg", kind: "svg", scale: 1, transparent: true, color: "#707071", note: "시트 \"상세조건조회\" 옆 아주 작은 ⌄ (16dp 상자 (210.4,663))" },
  "history.chevron-right": { file: "woori/history/chevron-right.svg", kind: "svg", scale: 1, transparent: true, color: "#6e6e71", note: "큰 › 16dp (history 화면에는 없음 — send-b 가 \"주인 history\" 로 참조: 받는분에게 표시 › · 나에게 표시 ›)" },
  "history.chevron-right-12": { file: "woori/history/chevron-right-12.svg", kind: "svg", scale: 1, transparent: true, color: "#6d6f72", note: "작은 › 12dp (history 화면에는 없음 — done 메모 ›, send-b \"처음 보내는 계좌예요\" 칩 › 가 history 이름으로 참조)" },
  "history.chevron-down-12": { file: "woori/history/chevron-down-12.svg", kind: "svg", scale: 1, transparent: true, color: "#6e6f71", note: "작은 ⌄ 12dp (history 화면에는 없음 — done·send-b \"더보기\" ⌄ 가 history.chevron-down-small 이름으로 참조했지만 그림은 작은 꺾쇠)" },
  "history-detail.close-x": { file: "woori/history-detail/close-x.svg", kind: "svg", scale: 1, transparent: true, color: "#3e3f42", note: "상세 머리 ✕ (24dp 상자, viewBox 24)" },
  "history-detail.chevron-memo": { file: "woori/history-detail/chevron-memo.svg", kind: "svg", scale: 1, transparent: true, color: "#78787a", note: "메모를 입력해 보세요 뒤 › (회색 — 인벤토리의 'chevron-right-blue' 는 파랑이 아니다)" },
  "history-detail.chevron-search": { file: "woori/history-detail/chevron-search.svg", kind: "svg", scale: 1, transparent: true, color: "#7a7a7a", note: "'…' 검색하기 뒤 › (회색)" },
  "send-a.camera": { file: "woori/send-a/camera.svg", kind: "svg", scale: 1, transparent: true, color: "#2a2b2c", note: "카메라(계좌 촬영) 선 아이콘 — 어디로 이체 입력 줄 오른쪽" },
  "send-a.star-outline": { file: "woori/send-a/star-outline.svg", kind: "svg", scale: 1, transparent: true, color: "#87898b", note: "☆ 즐겨찾기(빈 별) — 최근입금계좌 행" },
  "send-a.plus": { file: "woori/send-a/plus.svg", kind: "svg", scale: 1, transparent: true, color: "#6b7073", note: "＋ — 연락처로 이체하기 원(40dp #eff0f3) 안" },
  "send-a.close": { file: "woori/send-a/close.svg", kind: "svg", scale: 1, transparent: true, color: "#393a3d", note: "✕ 닫기 — 계좌번호·금융회사 페이지 머리" },
  "send-a.clear-circle": { file: "woori/send-a/clear-circle.svg", kind: "svg", scale: 1, transparent: true, color: "#81858c", note: "ⓧ 지우기 — 입력칸 오른쪽" },
  "send-a.chevron-down": { file: "woori/send-a/chevron-down.svg", kind: "svg", scale: 1, transparent: true, color: "#403e42", note: "⌄ 은행/증권사 선택 줄 오른쪽 — 꼭짓점 (10.02,12.62), 팔 반폭 4.95·높이 4.88, 획 1.70dp 둥근 끝·이음" },
  "send-a.kb-backspace": { file: "woori/send-a/kb-backspace.svg", kind: "svg", scale: 1, transparent: true, color: "#070708", note: "키보드 ⌫ (흰 키 위 검정) — 32x24dp 상자(키 가운데 311.333, 560.833 에 가운데)" },
  "send-a.kb-nav-mic": { file: "woori/send-a/kb-nav-mic.svg", kind: "svg", scale: 1, transparent: true, color: "#3c3c3d", note: "OS 내비 줄(키보드 모드) 마이크 — 바깥 캡슐 + 안 캡슐 + 받침 U 띠(테두리) + 기둥 + 받침대 알약, 모두 테두리 선 1.3dp(안 캡슐 1.18)" },
  "send-a.kb-nav-recents": { file: "woori/send-a/kb-nav-recents.svg", kind: "svg", scale: 1, transparent: true, color: "#acacac", note: "OS 내비 ||| 최근 앱 (키보드 모드) — 세로 막대 3개(간격 6.25dp, 길이 13.6dp), 굵기 1.42dp 둥근 끝" },
  "send-a.kb-nav-home": { file: "woori/send-a/kb-nav-home.svg", kind: "svg", scale: 1, transparent: true, color: "#a8a8a8", note: "OS 내비 ○ 홈 — 둥근 사각 테두리 14.3dp(rx 5.08), 획 1.62dp" },
  "send-a.kb-nav-hide": { file: "woori/send-a/kb-nav-hide.svg", kind: "svg", scale: 1, transparent: true, color: "#aaaaaa", note: "OS 내비 ⌄ 키보드 내리기(평소 ‹ 자리) — 팔 반폭 7.26·높이 8.38, 획 1.48dp" },
  "send-a.kb-glyph-2": { file: "woori/send-a/kb-glyph-2.png", kind: "png", scale: 3, transparent: true, intrinsic: [75, 99], color: "#000000", note: "숫자 키 '2' — Pretendard 600/25 맞춤 오차가 큰(0.215) 숫자라 그림으로(9.3절)" },
  "send-a.kb-glyph-dotdash": { file: "woori/send-a/kb-glyph-dotdash.png", kind: "png", scale: 3, transparent: true, intrinsic: [84, 66], color: "#000000", note: "기능 키 '.-' (흰 키 위 검정)" },
  "send-a.kb-glyph-comma": { file: "woori/send-a/kb-glyph-comma.png", kind: "png", scale: 3, transparent: true, intrinsic: [36, 48], color: "#000000", note: "기능 키 ',' (흰 키 위 검정, 키 가운데보다 아래)" },
  "send-a.kb-tb-eq": { file: "woori/send-a/kb-tb-eq.png", kind: "png", scale: 3, transparent: true, intrinsic: [51, 39], color: "#ffffff", note: "도구줄 '=' (칸 1/6)" },
  "send-a.kb-tb-at": { file: "woori/send-a/kb-tb-at.png", kind: "png", scale: 3, transparent: true, intrinsic: [84, 84], color: "#ffffff", note: "도구줄 '@' (칸 2/6)" },
  "send-a.kb-tb-plus": { file: "woori/send-a/kb-tb-plus.png", kind: "png", scale: 3, transparent: true, intrinsic: [51, 51], color: "#ffffff", note: "도구줄 '+' (칸 3/6)" },
  "send-a.kb-tb-rparen": { file: "woori/send-a/kb-tb-rparen.png", kind: "png", scale: 3, transparent: true, intrinsic: [36, 90], color: "#ffffff", note: "도구줄 ')' (칸 4/6)" },
  "send-a.kb-tb-lparen": { file: "woori/send-a/kb-tb-lparen.png", kind: "png", scale: 3, transparent: true, intrinsic: [36, 90], color: "#ffffff", note: "도구줄 '(' (칸 5/6)" },
  "send-a.kb-tb-dot": { file: "woori/send-a/kb-tb-dot.png", kind: "png", scale: 3, transparent: true, intrinsic: [24, 24], color: "#ffffff", note: "도구줄 '.' (칸 6/6)" },
  "send-b.keypad-backspace": { file: "woori/send-b/keypad-backspace.svg", kind: "svg", scale: 1, transparent: true, color: "#33353a", note: "← 지우기: 금액 키패드 셋째 열·넷째 행, 계좌 비밀번호 키패드 마지막 줄 오른쪽 (주인 send-b)" },
  "send-b.confirm-arrow": { file: "woori/send-b/confirm-arrow.svg", kind: "svg", scale: 1, transparent: true, color: "#8a8a8b", note: "확인 머리 로고 사이 → (회색)" },
  "send-b.warning-triangle": { file: "woori/send-b/warning-triangle.svg", kind: "svg", scale: 1, transparent: true, color: "#fdb80e", note: "중복 경고 시트 ⚠ 의 노란 둥근 삼각형(느낌표 없이 — 느낌표는 warning-bang-bar · warning-bang-dot 를 위에 따로 그려 움직인다)" },
  "send-b.warning-bang-bar": { file: "woori/send-b/warning-bang-bar.svg", kind: "svg", scale: 1, transparent: true, color: "#ffffff", note: "⚠ 느낌표 막대(흰, 위아래 반원 끝) — 끝 모양 상자: 가운데 x 180.046, 위 456.143 · 아래 476.440, 폭 5.785 (dp, 앱; v1 #7151–#7162 중앙값 맞춤 rms 1.62)" },
  "send-b.warning-bang-dot": { file: "woori/send-b/warning-bang-dot.svg", kind: "svg", scale: 1, transparent: true, color: "#ffffff", note: "⚠ 느낌표 점(흰 원) — 끝 자리: 가운데 (180.046, 483.960), 반지름 2.911 (dp, 앱)" },
  "send-b.siren": { file: "woori/send-b/siren.png", kind: "png", scale: 3, transparent: true, intrinsic: [69, 66], hq: "woori/send-b/siren.hq.png", note: "🚨 처음 보내는 계좌 칩(v2, 분홍 #fdeaf1)의 사이렌 그림(여러 색, 이모지 모양 — 사람·캐릭터 아님)" },
  "send-b.confirm-logo-woori": { file: "woori/send-b/confirm-logo-woori.png", kind: "png", scale: 3, transparent: true, intrinsic: [210, 209], hq: "woori/send-b/confirm-logo-woori.hq.svg", note: "이체 확인 머리의 출금 계좌 우리은행 로고 48dp 원(그림의 주인은 send-a banks.woori — 이건 같은 그림을 확인 화면 48dp 자리에서 직접 자른 크기 전용 판)" },
  "send-b.confirm-logo-nh": { file: "woori/send-b/confirm-logo-nh.png", kind: "png", scale: 3, transparent: true, intrinsic: [210, 209], hq: "woori/send-b/confirm-logo-nh.hq.png", note: "이체 확인 머리의 받는 계좌 지역농축협(nh-local — 농협은행 nh 와 같은 그림) 로고 48dp 원(그림의 주인은 send-a banks.nh — 이건 같은 그림을 확인 화면 48dp 자리에서 직접 자른 크기" },
  "send-b.confirm-logo-kakao": { file: "woori/send-b/confirm-logo-kakao.png", kind: "png", scale: 3, transparent: true, intrinsic: [210, 209], hq: "woori/send-b/confirm-logo-kakao.hq.svg", note: "이체 확인 머리의 받는 계좌 카카오뱅크 로고 48dp 원(그림의 주인은 send-a banks.kakao — 이건 같은 그림을 확인 화면 48dp 자리에서 직접 자른 크기 전용 판)" },
  "done.check-circle": { file: "woori/done/check-circle.svg", kind: "svg", scale: 1, transparent: true, color: "#2286f2", note: "완료 체크 원: 파란 원 60dp(#2286f2) + 흰 체크(꺾인 선 하나, 굵기 6dp, 둥근 끝·이음)" },
  "done.ad-iou-illust": { file: "woori/done/ad-iou-illust.png", kind: "png", scale: 3, transparent: true, intrinsic: [280, 279], hq: "woori/done/ad-iou-illust.hq.png", note: "광고 카드(차용증 서비스) 오른쪽 그림: 말린 차용증 종이 + 파란 인장 + 지폐 묶음(여러 색, 사람·캐릭터 없음 → 자른 그림)" },
  "banks.woori": { file: "woori/banks/woori.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/woori.hq.svg", note: "우리은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.nh": { file: "woori/banks/nh.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/nh.hq.png", note: "농협은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.kb": { file: "woori/banks/kb.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/kb.hq.svg", note: "국민은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.kakao": { file: "woori/banks/kakao.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/kakao.hq.svg", note: "카카오뱅크 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.shinhan": { file: "woori/banks/shinhan.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/shinhan.hq.svg", note: "신한은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.hana": { file: "woori/banks/hana.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/hana.hq.svg", note: "하나은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.ibk": { file: "woori/banks/ibk.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/ibk.hq.png", note: "기업은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.toss": { file: "woori/banks/toss.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/toss.hq.svg", note: "토스뱅크 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.kfcc": { file: "woori/banks/kfcc.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/kfcc.hq.svg", note: "새마을금고 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.kbank": { file: "woori/banks/kbank.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/kbank.hq.svg", note: "케이뱅크 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.im": { file: "woori/banks/im.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/im.hq.svg", note: "iM뱅크(대구) 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.busan": { file: "woori/banks/busan.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/busan.hq.svg", note: "부산은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.sc": { file: "woori/banks/sc.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/sc.hq.svg", note: "SC제일은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.kyongnam": { file: "woori/banks/kyongnam.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/kyongnam.hq.svg", note: "경남은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.kwangju": { file: "woori/banks/kwangju.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/kwangju.hq.svg", note: "광주은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.deutsche": { file: "woori/banks/deutsche.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/deutsche.hq.svg", note: "도이치은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.nfcf": { file: "woori/banks/nfcf.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/nfcf.hq.svg", note: "산림조합 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.kdb": { file: "woori/banks/kdb.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/kdb.hq.svg", note: "산업은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.suhyup": { file: "woori/banks/suhyup.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/suhyup.hq.svg", note: "수협은행 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.suhyup-central": { file: "woori/banks/suhyup-central.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/suhyup-central.hq.svg", note: "수협중앙회 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.cu": { file: "woori/banks/cu.png", kind: "png", scale: 3, transparent: true, intrinsic: [140, 140], hq: "woori/banks/cu.hq.svg", note: "신협 로고(원 32dp, 원 밖 투명) 140x140 = 32dp x3 상자(frame 46.657x46.545px x3)" },
  "banks.citi": { file: "woori/banks/citi.png", kind: "png", scale: 3, transparent: true, intrinsic: [70, 70], hq: "woori/banks/citi.hq.png", note: "한국씨티 로고(파란 원 + 흰 마크) — 그리드에 없고 추천 칩(16dp)에만 나온다(banks.json chipOnly)" },
}

export const WOORI_ART_NAMES = Object.keys(WOORI_ART) as WooriArtName[]

/** 이름 → 파일 (표가 비어 WooriArtName 이 never 여도 타입이 무너지지 않게 넓힌 보기) */
const ART: Readonly<Record<string, WooriArtFile>> = WOORI_ART

export function hasArt(name: string): name is WooriArtName {
  return Object.prototype.hasOwnProperty.call(WOORI_ART, name)
}

export function getArt(name: WooriArtName): WooriArtFile {
  return ART[name] as WooriArtFile
}

/**
 * 에셋 URL ('/woori/...').
 * 프레임 모드(?frame=1 — 영상과 겹쳐 보는 비교)에서는 영상에서 만든 원래 파일(file)을 그대로 쓰고,
 * 그 밖(실제 폰·태블릿·APK)에서는 선명한 판(hq)이 있으면 그것을 쓴다. 영상 해상도(1dp ≈ 1.46px)보다 촘촘한 화면에서 흐리지 않게.
 */
export function artSrc(name: WooriArtName): string {
  const a = getArt(name)
  const frame = typeof document !== 'undefined' && document.documentElement.dataset.frame === '1'
  return '/' + (a.hq && !frame ? a.hq : a.file)
}

/** 은행 로고 에셋 이름 ('banks.<코드>', 없으면 undefined) */
export function bankArtName(code: string): WooriArtName | undefined {
  const name = `banks.${code}`
  return hasArt(name) ? name : undefined
}
