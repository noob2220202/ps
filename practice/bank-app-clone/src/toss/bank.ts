// 토스 은행 이름 · 은행 고르기 목록 (transfer.md §2.3 · §4.3). 은행 코드는 server/banks.mjs 와 같음.
// 앱 id "toss" 와 은행 코드 "toss"(토스뱅크)는 다른 것 (infra.md §4). code.startsWith("toss") 로 보지 말 것 (tosssec 도 걸림)

export interface TossBankTile {
  label: string; // 타일 글자 (녹화 그대로, 줄바꿈은 자동)
  code: string | null; // null = 코드 없음 (교보SBI저축은행: 타일은 보이고 눌러도 아무 일 없음)
}

// 은행 선택 시트 순서 (녹화 그대로)
export const TOSS_BANK_TILES: TossBankTile[] = [
  { label: "NH농협", code: "nh" },
  { label: "카카오뱅크", code: "kakao" },
  { label: "KB국민", code: "kb" },
  { label: "토스뱅크", code: "toss" },
  { label: "신한", code: "shinhan" },
  { label: "우리", code: "woori" },
  { label: "IBK기업", code: "ibk" },
  { label: "하나", code: "hana" },
  { label: "새마을", code: "mg" },
  { label: "부산", code: "busan" },
  { label: "iM뱅크(대구)", code: "im" },
  { label: "케이뱅크", code: "kbank" },
  { label: "신협", code: "shinhyup" },
  { label: "우체국", code: "post" },
  { label: "SC제일", code: "sc" },
  { label: "경남", code: "kn" },
  { label: "광주", code: "kj" },
  { label: "수협", code: "suhyup" },
  { label: "전북", code: "jb" },
  { label: "저축은행", code: "savings" },
  { label: "제주", code: "jeju" },
  { label: "씨티", code: "citi" },
  { label: "KDB산업", code: "kdb" },
  { label: "산림조합", code: "nfcf" },
  { label: "교보SBI저축은행", code: null },
  { label: "BOA", code: "boa" },
  { label: "중국", code: "boc" },
  { label: "HSBC", code: "hsbc" },
  { label: "중국공상", code: "icbc" },
  { label: "도이치", code: "deutsche" },
  { label: "JP모건", code: "jpm" },
  { label: "BNP파리바", code: "bnp" },
  { label: "중국건설", code: "ccb" },
];
// "증권사 선택" 아래
export const TOSS_SEC_TILES: TossBankTile[] = [
  { label: "토스증권", code: "tosssec" },
  { label: "카카오페이증권", code: "kakaopaysec" },
  { label: "미래에셋", code: "mirae" },
  { label: "키움", code: "kiwoom" },
  { label: "한국투자", code: "kis" },
  { label: "신한투자", code: "shinhansec" },
  { label: "삼성증권", code: "samsung" },
  { label: "KB증권", code: "kbsec" },
  { label: "NH투자", code: "nhsec" },
  { label: "유안타", code: "yuanta" },
  { label: "대신", code: "daishin" },
  { label: "IBK투자", code: "ibksec" },
  { label: "하나증권", code: "hanasec" },
  { label: "한화투자", code: "hanwha" },
  { label: "유진투자", code: "eugene" },
  { label: "아이엠증권", code: "imsec" },
  { label: "교보", code: "kyobo" },
  { label: "메리츠증권", code: "meritz" },
  { label: "SK", code: "sks" },
  { label: "LS", code: "ls" },
  { label: "현대차증권", code: "hmsec" },
  { label: "DB증권", code: "dbsec" },
  { label: "우리투자증권", code: "wooriinv" },
  { label: "신영", code: "shinyoung" },
  { label: "다올투자증권", code: "daol" },
  { label: "케이프투자", code: "cape" },
  { label: "BNK투자", code: "bnksec" },
  { label: "부국", code: "bookook" },
  { label: "상상인증권", code: "sangsangin" },
];

// 목록 줄에 쓰는 짧은 이름 (하나 · NH농협 · 우리 · KB국민 · 카카오뱅크 · IBK기업 …). 없으면 타일 이름 → 서버 short
const SHORT: Record<string, string> = Object.fromEntries([...TOSS_BANK_TILES, ...TOSS_SEC_TILES].filter((t) => t.code).map((t) => [t.code!, t.label]));
SHORT.im = "iM뱅크";

// 금액 · 확인 화면에 쓰는 이름 (하나은행 · NH농협 · …). 서버 name 과 다른 것만
const FULL: Record<string, string> = {
  nh: "NH농협",
  kb: "KB국민은행",
  ibk: "IBK기업은행",
  kdb: "KDB산업은행",
  citi: "씨티은행",
  im: "iM뱅크",
  nfcf: "산림조합",
  shinhyup: "신협",
  mg: "새마을금고",
};

export const tossBankShort = (code: string, fallback?: string) => SHORT[code] ?? fallback ?? code;
export const tossBankFull = (code: string, fallback?: string) => FULL[code] ?? fallback ?? SHORT[code] ?? code;
// 토스뱅크 은행인지 (토스증권 tosssec 은 아님)
export const isTossBank = (code: string | undefined | null) => code === "toss";
