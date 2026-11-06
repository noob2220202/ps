// kakao2 홈에만 있는 글 · 그림 · 시각 (서버 /api/home 은 kakao 와 같게 두고, 녹화에 나온 것들은 화면 쪽 상수로 — home.md §6)
import bannerCards from "../../assets/local/k2-home-banner-cards.webp";
import bannerMeritz from "../../assets/local/k2-home-banner-meritz.webp";
import family from "../../assets/local/k2-home-family.png";
import bankBuilding from "../../assets/local/k2-home-bank.png";
import listSubsidy from "../../assets/local/k2-home-list-subsidy.png";
import listAllowance from "../../assets/local/k2-home-list-allowance.png";
import listCoupon from "../../assets/local/k2-home-list-coupon.png";
import listSafe from "../../assets/local/k2-home-list-safe.png";
import { localAsset } from "../../assets/Asset";

// AI 알약 문구 (한 줄). 켤 때: [0] 을 지우고 [1] 을 씀 (녹화 0.75 – 1.85초), 홈에 다시 올 때마다 하나씩 다음으로.
// [2] 부터는 녹화에 안 나옴 → 카카오뱅크 홈 문구 중 한 줄짜리 (critic.md Q7)
export const PILL_MESSAGES = [
  "전국 소비축제, 놓치면 아쉬운 혜택은?",
  "후불교통카드 미납, 정지 전 확인하세요",
  "전세사기 피해, 3분의 1은 돌려받아요",
  "코스피 7천, 다시 올 수 있을까요?",
  "국내 반도체주 시총 상위 종목 흐름은?",
  "원금 지키는 펀드, 정말 가능할까요?",
  "24시간 에어컨, 전기세 얼마일까요?",
  "지난 달보다 얼마나 더 썼을까요?",
];

// 배너: 점 1 = 보험 점검(AD), 점 2 = 녹화에 안 나옴(카카오뱅크 '금요일' 배너), 점 3 = 내 소비 지원금. 켤 때 점 3 에서 시작 (home.md §4.4)
export type K2BannerItem = {
  id: string;
  title: [string, string];
  cta: string;
  image?: string;
  imageClass: string; // 그림 자리 (K2Banner.css)
  legal?: [string, string];
  ad?: boolean;
};
export const BANNERS: K2BannerItem[] = [
  {
    id: "insure",
    title: ["10년 넘은 보험 점검", "나의 보장금액 찾아드려요"],
    cta: "확인하기",
    image: bannerMeritz,
    imageClass: "meritz",
    legal: ["준법감시인 심의필 제2026-", "광고-2362호(26.9.17~27.9.16)"],
    ad: true,
  },
  { id: "friday", title: ["금요일이 다가온다!", "간식부터 용돈까지 혜택 받기"], cta: "자세히 보기", image: localAsset("banner-friday"), imageClass: "friday" },
  { id: "subsidy", title: ["내 소비 지원금은 얼마?", "최대 5만원 소비 지원금"], cta: "지금 확인하기", image: bannerCards, imageClass: "cards" },
];
export const BANNER_START = 2;

// 둘째 카드 위 홍보 줄: 홈에 다시 올 때마다 다음 것으로 (녹화 27.825초 모임통장 → 다른금융)
export const PROMOS = [
  { id: "family", icon: family, title: "함께 쓰고 같이 보는 회비관리", desc: "모임통장 시작하기" },
  { id: "other", icon: bankBuilding, title: "내 모든 계좌를 한눈에", desc: "다른금융 계좌 등록하기" },
];

export const CHIPS = ["통장", "저축", "대출", "다른 금융 계좌"];

export const SHORTCUTS = [
  { id: "subsidy", label: "정부지원금 찾기", icon: listSubsidy },
  { id: "allowance", label: "매일 용돈 받기", icon: listAllowance },
  { id: "coupon", label: "50만원 넣고 금리쿠폰 받기", icon: listCoupon },
  { id: "safe", label: "나만의 개인금고", icon: listSafe },
];

export const FLOATING_AD = { title: "MMA2026, ILLIT과 함께!", desc: "11/15 오후 6시 멜론에서 만나요" };

// 시각 (ms). 켜짐 연출은 launch.ts LAUNCH (녹화 인트로 끝 = 0) 기준, 다시 올 때는 홈 층이 다시 맨 위가 된 때 기준
export const K2_HOME = {
  // AI 알약 (critic.md §2.1, intro.md §7): 지우기 시작 0 기준
  pillCollapse: 180, // 폭이 동그라미로 줄어듦 (글자는 잘리며 흐려지고 별은 작아져 사라짐)
  pillType: 438, // 첫 글자 · 폭 늘어남 · 고리 (빈 동그라미 0.925 → 1.183초). 글자 묶음은 16ms 앞서부터 나타나기 시작
  pillChar: 33.3, // 한 글자씩 (빈칸도 한 글자)
  pillStar: 1005, // 별이 다시 커지기 시작 (1.75초)
  pillGlow: 988, // 고리가 사라진 뒤 알약 둘레 옅은 노란 빛이 다시 돎 (지우는 · 쓰는 동안은 없음)
  returnPromo: 465, // 이체 모달을 닫기 시작하고 홍보 줄 바뀜 (27.36 → 27.825초)
  returnPill: 850, // 같은 때부터 알약 지우기 시작 (28.21초)
  bannerInterval: 5150,
  bannerSlide: 285,
  transferLoad: 1650, // 이체 누르고 로딩 막 (6.475 → 8.125초, 받기가 더 늦으면 받을 때까지)
  transferNav: 50, // 막이 흐려지기 시작하고 이체 모달이 올라오기 시작, 막은 그 첫 프레임(≈ 67ms)에 걷힘 (critic.md C6)
  // 떠 있는 광고가 탭바 뒤를 지날 때 탭바 유리 (광고가 제자리보다 이만큼 아래 = 광고 위끝 667 + 이만큼):
  // 올라오며 50 밑으로 → 잠깐 밝은 쪽으로 기울었다 돌아옴 (녹화 3.50초, 광고 위끝 708), 그 뒤 내려가며 60 위로 → 밝은 유리 (4.433초)
  adPulseAt: 50,
  adLightAt: 60,
  edgeAt: 55, // 상태바 밑 회색 띠 (스크롤 55 넘으면)
  // 스크롤 막대 (critic.md G4 와 달리 녹화에 있음: 2.417초 스크롤 시작 프레임에 나타나 홈을 떠날 때까지 그대로, 어두운 막대 31 위 22).
  // 길이 = 길 × 보이는 높이 ÷ 전체 높이, 길 = 화면 위 58 – 아래에서 59 (녹화: 스크롤 0 에서 58 – 522.9, 끝에서 바닥 793)
  indTop: 58,
  indBottom: 59,
} as const;
