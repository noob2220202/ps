// 통장 화면 아래 긴 상품 메뉴 (account.md §2.4, 녹화 A 26.0–40.5초 한 화면 스크롤). 상품 이름 · 금리는 앱에 보이는 공개 상품 정보 그대로.
// icon = src/assets/local/toss-acct-m-<icon>.png (scripts/toss-crops/account.py). 오른쪽 글자: blue = 파란 금리 · grey = 회색 안내 · pill = '새로 나온'
// sub = 두 줄 오른쪽의 회색 아랫줄 ("12개월 기준") → 줄 높이 64dp

export interface AcctMenuRow {
  icon: string;
  title: string;
  right?: string;
  tone?: "blue" | "grey" | "pill";
  sub?: string;
}
export interface AcctMenuSection {
  title: string;
  caption?: string; // 오른쪽 작은 회색 글자 ("금리, 세전" …)
  sub?: boolean; // 회색 작은 머리 (제휴사 · 갈아타기)
  rows: AcctMenuRow[];
}

const r = (icon: string, title: string, right?: string, tone: AcctMenuRow["tone"] = "blue", sub?: string): AcctMenuRow => ({ icon, title, right, tone, sub });

export const ACCT_MENU: AcctMenuSection[] = [
  {
    title: "통장",
    caption: "금리, 세전",
    rows: [
      r("tongjang-tossbank", "토스뱅크 통장", "연 1%"),
      r("tongjang-nanum", "나눠모으기 통장", "연 1.4%"),
      r("tongjang-biz", "개인사업자 통장", "연 0.1%"),
      r("tongjang-biz-safe", "개인사업자 금고", "연 1.4%"),
      r("tongjang-moim", "모임통장", "연 0.1%"),
      r("tongjang-moim-safe", "모임금고", "연 1.4%"),
      r("tongjang-kid", "아이 통장", "연 0.1%"),
      r("tongjang-interest-piggy", "이자 받는 저금통", "연 1.4%"),
      r("tongjang-game-piggy", "게임 저금통", "연 0.1%"),
      r("tongjang-livelihood", "생계비보호 통장", "연 0.1%"),
    ],
  },
  {
    title: "예적금",
    caption: "금리, 세전",
    rows: [
      r("deposit-prepaid-interest", "먼저 이자 받는 정기예금", "연 3.6%", "blue", "12개월 기준"),
      r("deposit-pick-date", "원하는 날 만기되는 정기예금", "연 3.8%", "blue", "12개월 기준"),
      r("saving-31day", "키워봐요 31일적금", "연 1% ~ 10%"),
      r("saving-free", "자유적금", "연 3.25% ~ 3.75%", "blue", "12개월 기준"),
      r("saving-gulbi", "굴비적금", "연 1.8% ~ 4.3%"),
      r("saving-kid", "아이적금", "연 2.5% ~ 5%"),
      r("saving-baby", "태아적금", "연 1% ~ 5%"),
    ],
  },
  {
    title: "외화",
    rows: [r("fx-account", "외화통장", "환율 100% 우대"), r("fx-piggy", "외화 저금통", "환율 100% 우대"), r("fx-remit", "해외송금", "송금 수수료 혜택")],
  },
  {
    title: "투자",
    caption: "수익률, 세전",
    rows: [r("invest-fund", "펀드", "새로 나온", "pill"), r("invest-mmf", "MMF", "연 3.3%")],
  },
  {
    title: "제휴사",
    caption: "수익률, 세전",
    sub: true,
    rows: [
      r("partner-bond", "채권·발행어음·RP", "연 2.6% ~ 8.67%"),
      r("partner-gold", "금 투자", "NH투자증권 · 제휴", "grey"),
      r("partner-ipo", "공모주 일정"),
      r("partner-securities", "증권계좌", "최대 3만원 혜택"),
    ],
  },
  {
    title: "연금",
    caption: "제휴사상품 | 금리, 세전",
    rows: [r("pension-check", "내 국민연금 확인하기"), r("pension-products", "연금 상품보기")],
  },
  {
    title: "대출",
    rows: [
      r("loan-limit", "내 최대 한도 알아보기"),
      r("loan-credit", "신용대출", "연 4.58% ~ 15.00%"),
      r("loan-overdraft", "비상금·마이너스통장", "연 6.24% ~ 15.00%"),
      r("loan-sunshine", "햇살론", "연 4.58% ~ 12.50%"),
      r("loan-mortgage", "주택담보대출", "연 4.41% ~ 9.09%"),
      r("loan-jeonse", "전월세보증금대출", "연 4.17% ~ 7.16%"),
      r("loan-biz", "개인사업자대출", "연 1.57% ~ 15.00%"),
      r("loan-biz-overdraft", "개인사업자마이너스통장", "연 5.66% ~ 15.00%"),
      r("loan-pro-biz", "전문직사업자대출", "연 4.07% ~ 7.33%"),
      r("loan-more71", "71개 금융사 대출 더보기", "토스 서비스·광고", "grey"),
    ],
  },
  {
    title: "갈아타기",
    sub: true,
    rows: [
      r("refi-credit", "신용대출 갈아타기", "연 5.64% ~ 15.00%"),
      r("refi-jeonse", "전월세보증금대출 갈아타기", "연 4.13% ~ 7.16%"),
      r("refi-biz", "개인사업자대출 갈아타기", "연 4.01% ~ 14.68%"),
    ],
  },
  {
    title: "신용카드",
    caption: "제휴카드 | 최대 기준",
    rows: [r("creditcard-day", "토스뱅크 하나카드 Day", "생활비 10% 할인")],
  },
  {
    title: "체크카드",
    rows: [
      r("check-tossbank", "토스뱅크 체크카드"),
      r("check-kid", "아이 체크카드 만들기"),
      r("check-kpass", "K-패스 체크카드"),
      r("check-moim", "모임카드"),
      r("check-biz", "개인사업자 체크카드"),
    ],
  },
  {
    title: "서비스",
    rows: [
      r("svc-labor-contract", "쉬운 근로계약서"),
      r("svc-jeonse-guard", "전세지킴보증"),
      r("svc-autotransfer", "자동이체"),
      r("svc-autotransfer-import", "자동이체 가져오기"),
      r("svc-tax", "세금·공과금"),
      r("svc-interest-now", "지금 이자 받기"),
      r("svc-fx-regular", "외화 정기적으로 모으기"),
      r("svc-interest-dollar", "이자 달러로 모으기"),
      r("svc-fx-avg-calc", "외화 평균환율 계산기"),
      r("svc-yellow-umbrella", "개인사업자 소득공제", "노란우산", "grey"),
      r("svc-biz-rank", "내 사업소득 순위 알아보기"),
      r("svc-house-cost-calc", "주택구입비용 계산기"),
      r("svc-100m-calc", "1억 모으는 시간 계산기"),
      r("svc-miracle-morning", "미라클 모닝 도전하기"),
      r("svc-moim-settle", "모임 정산"),
      r("svc-shared-calendar", "함께 쓰는 캘린더"),
      r("svc-kid-allowance", "아이와 용돈 미션"),
      r("svc-spare-change", "내 투자계좌 잔돈 찾기"),
    ],
  },
];

// 유용한 정보 (공개 기사 제목 · 썸네일 toss-acct-info-1/2)
export const ACCT_INFO = [
  { thumb: "info-1", title: "청년문화예술패스, 이달 말 신청 마감돼요" },
  { thumb: "info-2", title: "퇴직금 계산, 기준부터 알아봐요" },
];

// 추천 (1/2 은 녹화 그대로, 2/2 는 지어낸 것 — '더 보기' 로 넘김). 첫 줄은 두 줄 (위 회색 안내 + 굵은 제목)
// tile: toss-acct-tile-<tile>.png (녹화 타일) · menu: 상품 메뉴 아이콘을 회색 타일에 얹어 그림
export interface AcctReco {
  tile?: string;
  menu?: string;
  title: string;
  caption?: string;
}
export const ACCT_RECO: AcctReco[][] = [
  [
    { tile: "benefit", caption: "오늘 받을 수 있는 혜택", title: "최소 1,500원 보기" },
    { tile: "fx", title: "외화통장" },
    { tile: "nanum", title: "나눠모으기 통장" },
    { tile: "gulbi", title: "굴비적금" },
  ],
  [
    { menu: "tongjang-moim", caption: "친구와 함께 쓰는 통장", title: "모임통장" },
    { menu: "tongjang-kid", title: "아이 통장" },
    { menu: "saving-free", title: "자유적금" },
    { menu: "deposit-prepaid-interest", title: "먼저 이자 받는 정기예금" },
  ],
];

// 통장 위 배너 (방문마다 번갈아, × 는 앱을 다시 열 때까지 숨김). art = toss-acct-banner-<art>.jpg
export const ACCT_BANNERS = [
  { id: "autotransfer", art: "banner-autotransfer", title: ["자동이체 가져오기가", "새로 나왔어요"], sub: "흩어진 자동이체를 한 번에 가져올 수 있어요.", cta: "보러가기" },
  { id: "newdeposit", art: "banner-newdeposit", title: ["토스뱅크에", "새로운 예금이 나왔어요"], sub: "1년 보관하면 연 3.8% (세전)", cta: "자세히 보기" },
] as const;
