// NH올원뱅크 홈 · 전체메뉴 · 통합검색 · 정기점검 시트의 고정 글 (home.md §2, §4 — 서버에 없는 화면 문구는 여기 한 곳).
// 녹화에 보인 일반 화면 문구는 그대로, 녹화에 없거나 쓰면 안 되는 것(실제 인물 광고 · 공익 광고 · 기록자의 최근 이용메뉴)은 지어낸 문구.
// 그림은 src/assets/local/allone-home-*.png (scripts/allone-crops/home.py) — 이름만 적고 화면이 localAsset 으로 찾음
import type { AoNoticeItem } from "../api";

// ---------- 홈 ----------
export const HOME_BANNER = {
  sub: "두근두근, 나도 포인트 부자?",
  title: "1분만 투자해도 쌓여가는 포인트",
  art: "allone-home-banner",
};

// 카드 아래 광고 칸 (녹화의 공익 광고 대신 지어낸 NH 광고, 같은 자리 — plan Q16)
export const HOME_AD = {
  brand: "NH농협은행",
  title: "적금 만기, 잊지 않게..",
  sub: "NH농협은행 [만기 알림]이 챙겨드려요",
};

// 오늘의 혜택 글줄 (2.5초마다 바뀜, 이 순서 — home.md §2.6)
export const HOME_TICKER = [
  { art: "allone-home-ticker-flame", text: "지금 핫한 이벤트 보기" },
  { art: "allone-home-ticker-point", text: "매일 포인트 응모 받기" },
  { art: "allone-home-ticker-bag", text: "쓸수록 돈 되는 생활혜택 모음" },
] as const;

// 바로가기 4 × 2 (마지막 메뉴설정은 SVG 점선 +)
export const HOME_QUICK = [
  { label: "계좌등록", art: "allone-home-quick-register" },
  { label: "전체계좌", art: "allone-home-quick-accounts" },
  { label: "공과금납부", art: "allone-home-quick-bills" },
  { label: "이체한도변경", art: "allone-home-quick-limit" },
  { label: "올원사장님+", art: "allone-home-quick-owner" },
  { label: "올원룰렛", art: "allone-home-quick-roulette" },
  { label: "캐시백쿠폰몰", art: "allone-home-quick-coupon" },
  { label: "메뉴설정", art: null },
] as const;

export const HOME_MOIM = {
  sub: "모임을 더 쉽고 편리하게",
  lines: ["투명한 회비관리, 함께해요", "NH올원모임으로 시작하기"],
  art: "allone-home-moim",
};

// 광고 넘기기 3장: 1 · 3 은 지어낸 것 (녹화 1장은 실제 인물 광고라 쓰지 않음), 2 는 녹화 그대로
export const HOME_ADS = [
  { sub: "NH농협카드", lines: ["체크카드 새로 만들고", "캐시백 받아가기"], art: "card" },
  { sub: "NH투자증권 채권서비스 OPEN", lines: ["투자도 더 다양하게", "채권 상품 보러가기"], art: "allone-home-ad-bond" },
  { sub: "올원 만보기", lines: ["매일 걷기만 해도", "포인트가 쌓여요"], art: "steps" },
] as const;

export const HOME_SCHEDULE = { title: "다가오는 금융일정", lines: ["마이데이터 연결하고", "모든 금융일정 모아 보기"], art: "allone-home-calendar" };
export const HOME_SPEND = { title: "내 소비", lines: ["교통카드, 카페, 마트", "흩어진 소비 한번에 관리하기"], art: "allone-home-mart" };
export const HOME_ASSET = {
  title: "내 자산",
  lines: ["놓칠 수 없는 내 자산 관리", "NH올원뱅크가 함께 합니다"],
  art: "allone-home-asset",
  chips: [["모든 금융기관 대출", "투자 포트폴리오"], ["입출금 계좌 관리", "부동산 시세"], ["자산 변동 내역"]],
};

// 생활자산: 3번째(헬스케어)는 지어낸 것 (녹화에서 끝까지 안 보임)
export const HOME_LIFE = [
  { title: "모빌리티", color: "#6185ff", lines: ["내 자동차 지금", "시세는 얼마?"], art: "allone-home-life-car" },
  { title: "보험", color: "#4589fe", lines: ["내 가입보험", "한눈에 확인하려면?"], art: "allone-home-life-insurance" },
  { title: "헬스케어", color: "#059d8c", lines: ["자산처럼 챙기는", "건강 관리 시작하기"], art: null },
] as const;

export const HOME_GROUP = [
  { title: "NH투자증권", lines: ["다양한 투자상품과", "리서치"], art: "allone-home-group-invest" },
  { title: "NH농협카드", lines: ["일상 속 혜택을", "더욱 풍성하게"], art: "allone-home-group-card" },
  { title: "NH농협생명", lines: ["든든한 보장과 함께", "준비하는 미래"], art: "allone-home-group-life" },
  { title: "NH농협손해보험", lines: ["일상 속 위험을", "지켜주는 맞춤형 보장"], art: "allone-home-group-insurance" },
  { title: "NH농협캐피탈", lines: ["대출이 필요할 때,", "언제나 든든한"], art: "allone-home-group-capital" },
  { title: "NH저축은행", lines: ["간편하게 대출 신청", "합리적인 예금조회"], art: "allone-home-group-savings" },
] as const;

export const HOME_TABS = [
  { key: "home", label: "홈" },
  { key: "products", label: "금융상품" },
  { key: "assets", label: "내 자산" },
  { key: "points", label: "포인트쌓기" },
  { key: "benefits", label: "생활혜택" },
] as const;

// ---------- 전체메뉴 ----------
// link: 만든 화면으로 가는 줄 (history = 거래내역조회 · send = 계좌이체 · topup = 잔액채우기). 나머지는 누름만 있고 아무 일 없음
export type AoMenuLink = "history" | "send" | "topup";
export interface AoMenuItem {
  label: string;
  link?: AoMenuLink;
}
export interface AoMenuSection {
  key: string;
  rail: string; // 왼쪽 목록 이름
  title: string; // 오른쪽 머리글
  items: AoMenuItem[];
}

// 최근 이용메뉴 (prefs 의 키 → 이름 · 이동)
export const MENU_RECENT: Record<string, AoMenuItem> = {
  history: { label: "거래내역조회", link: "history" },
  send: { label: "계좌이체", link: "send" },
  topup: { label: "잔액채우기", link: "topup" },
};

// (v) = 녹화에 보인 줄. 나머지는 올원뱅크에 있을 법한 지어낸 줄 (home.md §2.18)
export const MENU_SECTIONS: AoMenuSection[] = [
  { key: "recent", rail: "최근", title: "최근 이용메뉴", items: [] },
  {
    key: "inquiry",
    rail: "조회",
    title: "조회",
    items: [
      { label: "전체계좌조회", link: "history" },
      { label: "이체내역", link: "history" },
      { label: "계좌통합조회" },
      { label: "해지계좌조회" },
      { label: "거래중지계좌조회" },
      { label: "숨은자산찾기" },
      { label: "거래내역조회", link: "history" },
    ],
  },
  {
    key: "transfer",
    rail: "이체/출금",
    title: "이체/출금",
    items: [
      { label: "계좌이체", link: "send" },
      { label: "잔액채우기", link: "topup" },
      { label: "자동이체 등록/조회" },
      { label: "예약이체" },
      { label: "이체한도 조회/변경" },
      { label: "지연이체서비스" },
    ],
  },
  { key: "products-mine", rail: "가입상품관리", title: "가입상품관리", items: [{ label: "예금/적금 관리" }, { label: "계좌 비밀번호 변경" }, { label: "계좌해지" }, { label: "통장사본" }] },
  { key: "products", rail: "금융상품", title: "금융상품", items: [{ label: "예금" }, { label: "적금" }, { label: "대출" }, { label: "펀드" }, { label: "카드" }] },
  { key: "fx", rail: "외환", title: "외환", items: [{ label: "환전" }, { label: "해외송금" }, { label: "환율조회" }] },
  { key: "pension", rail: "퇴직연금", title: "퇴직연금", items: [{ label: "퇴직연금 가입정보" }, { label: "적립금 조회" }] },
  { key: "bills", rail: "공과금/채권", title: "공과금/채권", items: [{ label: "지로/공과금 납부" }, { label: "국세/지방세" }, { label: "제로페이모바일상품권" }] },
  { key: "assets", rail: "내 자산", title: "내 자산", items: [{ label: "내 자산 확인" }, { label: "마이데이터 연결" }] },
  { key: "life", rail: "금융편의", title: "금융편의", items: [{ label: "만보기" }, { label: "디깅퀴즈" }, { label: "포인트" }] },
  { key: "owner", rail: "올원사장님+", title: "올원사장님+", items: [{ label: "매출 조회" }, { label: "사업자 계좌 관리" }] },
  { key: "event", rail: "이벤트/혜택", title: "이벤트/혜택", items: [{ label: "진행 중인 이벤트" }, { label: "당첨 내역" }, { label: "쿠폰함" }] },
  { key: "help", rail: "고객센터", title: "고객센터", items: [{ label: "공지사항" }, { label: "자주 묻는 질문" }, { label: "상담 신청" }] },
  { key: "settings", rail: "설정", title: "설정", items: [{ label: "알림 설정" }, { label: "인증/보안 설정" }, { label: "앱 정보" }] },
];

export const MENU_QUICK = [
  { label: "NH지갑", art: "allone-home-menu-wallet" },
  { label: "인증/보안", art: "allone-home-menu-security" },
  { label: "고객센터", art: "allone-home-menu-help" },
  { label: "이벤트", art: "allone-home-menu-event" },
] as const;

// 통합검색: 메뉴 줄 전체 (같은 이름은 한 번)
export const SEARCH_CATALOG: AoMenuItem[] = (() => {
  const seen = new Set<string>();
  const out: AoMenuItem[] = [];
  for (const s of MENU_SECTIONS)
    for (const it of s.items)
      if (!seen.has(it.label)) {
        seen.add(it.label);
        out.push(it);
      }
  return out;
})();
export const SEARCH_POPULAR = ["제로페이모바일상품권", "카드", "자동이체", "포인트", "만보기", "환전", "통장사본", "디깅퀴즈", "대출"];

// ---------- 정기점검 안내 시트 (launch.md §2.10, plan Q10) ----------
// 1쪽: 녹화의 공지 모양 그대로 — 제목의 달과 날짜는 오늘로 계산 (🔔 관리 패널에서 바꾸면 서버 noticeItems)
// 2–5쪽: 지어낸 일반 안내 (같은 모양)
export interface AoNoticePage {
  title: [string, string, string]; // 앞 · 초록 · 뒤
  items: AoNoticeItem[];
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const p2 = (n: number) => String(n).padStart(2, "0");
const md = (d: Date) => `${p2(d.getMonth() + 1)}/${p2(d.getDate())}(${DAYS[d.getDay()]})`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// 다가오는 금요일(오늘 포함) 23:50 ~ 토 02:00, 그다음 일요일 23:55 ~ 월 04:00
export function noticeDefaultItems(today = new Date()): AoNoticeItem[] {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const fri = addDays(base, (5 - base.getDay() + 7) % 7);
  const sun = addDays(fri, 2);
  return [
    { title: "NH인증서 서비스 일시중단", when: `${md(fri)} 23:50 ~ ${md(addDays(fri, 1))} 02:00` },
    { title: "전자금융 서비스 일시중단", when: `${md(sun)} 23:55 ~ ${md(addDays(sun, 1))} 04:00` },
  ];
}

export function noticePages(items: AoNoticeItem[] | null | undefined, today = new Date()): AoNoticePage[] {
  const month = today.getMonth() + 1;
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return [
    { title: [`${month}월 시스템 `, "정기점검", " 안내"], items: items && items.length ? items : noticeDefaultItems(today) },
    {
      title: ["새로운 ", "앱 업데이트", " 안내"],
      items: [
        { title: "최신 버전으로 업데이트해 주세요", when: "앱스토어에서 NH올원뱅크 검색" },
        { title: "더 편해진 이체 화면", when: "받는 분 찾기 · 금액 입력 개선" },
      ],
    },
    {
      title: ["", "고객센터", " 운영시간 안내"],
      items: [
        { title: "평일 상담", when: "09:00 ~ 18:00 (공휴일 제외)" },
        { title: "AI톡 상담", when: "24시간 365일 운영" },
      ],
    },
    {
      title: ["", "개인정보처리방침", " 개정 안내"],
      items: [
        { title: "개정 내용 확인", when: `${md(addDays(today, 14))} 시행` },
        { title: "문의", when: "전체메뉴 > 고객센터" },
      ],
    },
    {
      title: ["", "이벤트", " 참여 안내"],
      items: [
        { title: "매일 포인트 응모하기", when: "오늘의 혜택에서 참여" },
        { title: "친구 초대 이벤트", when: `${md(end)}까지` },
      ],
    },
  ];
}
