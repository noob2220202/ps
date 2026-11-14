// 이의제기 화면의 글 (녹화 C4 0.0–12.4 의 화면 모양만 따름). 짧은 화면 이름 · 버튼 글은 녹화 그대로, 긴 문장은 같은 뜻 · 비슷한 길이로 새로 씀
// (줄바꿈 · 높이가 녹화와 비슷하게 — 안내 문구 3줄, 확인 항목 2 · 2 · 3 · 2 · 2 · 4줄). 법령 조문 · 실제 영업점 정보는 쓰지 않음
// 영업점 목록은 지어낸 것 (이름 · 주소 · 전화 모두 예시)

export const DISPUTE_TITLE = "이의제기 신청 및 조회";

// /dispute 첫 화면
export const DISPUTE_INTRO = {
  headline: ["타인의 신고 때문에", "내 계좌에 지급정지가 걸리면", "이의를 제기할 수 있어요"],
  targetTitle: "신청 대상",
  target: ["지급정지된 NH농협은행 입출금 계좌를", "가진 내국인 (만 19세 이상)"],
  targetNote: "영업점 창구에서도 신청 가능해요. (미성년자·외국인도 가능)",
  stepsTitle: "신청절차",
  steps: ["신청 전 확인 사항을 읽고 하나씩 확인해요.", "보완자료를 낼 영업점을 골라요.", "은행이 내용을 살펴본 뒤 결과를 알려 드려요."],
  history: "신청내역 조회",
  apply: "이의제기 신청",
};

// /dispute/check 신청 전 확인 6항목 (5번은 영업점 칸, 나머지는 확인함 버튼)
export const DISPUTE_CHECK_TITLE = "신청 전 확인해 주세요";
export const DISPUTE_CHECK_ITEMS = [
  "1. 지급정지가 걸린 계좌가 NH농협은행 계좌일 때만 신청이 가능해요.",
  "2. 물건값 같은 정상적인 거래로 받은 돈이거나, 돈을 보낸 분의 이의제기가 받아들여졌다면 신청해 주세요.",
  "3. 받은 돈이 정상 거래임을 보여 줄 객관적인 자료가 있을 때 신청해 주세요. 종이 문서가 아닌 자료(예: 영상, 통화 녹음 등)는 NH농협은행 영업점에 직접 가져와 주세요.",
  "4. 낯선 사람이 보낸 돈 때문에 지급정지된 경우(예: 통장협박)는 NH농협은행 영업점에 방문해서 신청해 주세요.",
  "5. 나중에 낼 보완자료는 아래 영업점에서 받아요. 원하는 영업점이 따로 있다면 바꿔 주세요.",
  "6. 「통신사기피해환급법」 등 관련 법령에 따라, 내 계좌에 걸린 지급정지나 전자금융거래 제한, 채권소멸 절차에 대해 위에서 확인한 내용으로 이의제기를 신청할 수 있어요. 자세한 기준은 법령과 은행 안내를 따라요.",
] as const;
export const DISPUTE_BRANCH_ITEM = 4; // 0부터 — 5번 항목
export const DISPUTE_CONFIRM = "확인함";
export const DISPUTE_NEXT = "다음";

// /dispute/branch 영업점검색
export const BRANCH_TITLE = "영업점검색";
export const BRANCH_PLACEHOLDER = "영업점명, 지역검색";
export const BRANCH_HINTS = [
  ["영업점명", "(본점)"],
  ["지역명", "(서대문)"],
] as const;
export const BRANCH_NONE = "검색 결과가 없어요";

export interface AoBranch {
  name: string;
  address: string;
  phone: string;
}

// 지어낸 영업점 (지역 몇 곳에 나눔). 이름 · 주소로 찾음
export const BRANCHES: AoBranch[] = [
  { name: "본점영업1부", address: "서울특별시 중구 예시로 120", phone: "02-000-0000" },
  { name: "본점영업부", address: "서울특별시 중구 예시로 124 2F", phone: "02-000-0010" },
  { name: "서대문지점", address: "서울특별시 서대문구 샘플대로 45", phone: "02-000-0120" },
  { name: "신촌역지점", address: "서울특별시 서대문구 가상길 17", phone: "02-000-0130" },
  { name: "강남중앙지점", address: "서울특별시 강남구 예시대로 301", phone: "02-000-0450" },
  { name: "판교테크노지점", address: "경기도 성남시 분당구 샘플로 88", phone: "031-000-0230" },
  { name: "부산중앙지점", address: "부산광역시 중구 가상대로 52", phone: "051-000-0110" },
  { name: "대전둔산지점", address: "대전광역시 서구 예시로 210", phone: "042-000-0340" },
];

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
// 영업점명 또는 주소(지역)에 검색어가 들어간 것 (띄어쓰기 무시)
export function searchBranches(query: string): AoBranch[] {
  const q = norm(query);
  if (!q) return [];
  return BRANCHES.filter((b) => norm(b.name).includes(q) || norm(b.address).includes(q));
}
