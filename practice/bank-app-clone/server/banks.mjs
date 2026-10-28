// 카카오뱅크 '은행선택' 화면에 나오는 순서 그대로의 은행/증권사 목록.
// short   = 이체 화면에서 계좌번호 앞에 붙는 짧은 이름 ("농협 3020000000000")
// color   = 동그라미 아이콘 대표색 (실제 아이콘 가장자리 색을 뽑은 값. 로고 이미지가 없을 때 이 색 원 + 글자로 그림)
// pattern = 계좌번호 자리수 묶음(하이픈 위치). 없으면 숫자 10~14자리 아무거나
// 로고 이미지는 상표라 저장소에 넣지 않는다 → scripts/extract-bank-icons.py 가 src/assets/local/bank-<code>.png 로 만들어 줌
const B = (code, name, short, color, pattern) => ({ code, name, short, color, section: "bank", ...(pattern && { pattern }) });
const S = (code, name, color) => ({ code, name, short: name, color, section: "securities" });

export const BANKS = [
  B("kakao", "카카오뱅크", "카카오뱅크", "#F9E208", [4, 2, 7]),
  B("kb", "국민은행", "국민", "#766B66", [6, 2, 6]),
  B("ibk", "기업은행", "기업", "#09469E", [3, 6, 2, 3]),
  B("nh", "농협은행", "농협", "#399F56", [3, 4, 4, 2]),
  B("shinhan", "신한은행", "신한", "#0740F5", [3, 3, 6]),
  B("im", "iM뱅크", "iM뱅크", "#08C5A3"),
  B("kdb", "산업은행", "산업", "#08337B"),
  B("woori", "우리은행", "우리", "#0886C5", [4, 3, 6]),
  B("citi", "한국씨티은행", "씨티", "#0564AE"),
  B("hana", "하나은행", "하나", "#1A7E6F", [3, 6, 5]),
  B("sc", "SC제일은행", "SC제일", "#0970E8", [3, 2, 6]),
  B("kn", "경남은행", "경남", "#D11829"),
  B("kj", "광주은행", "광주", "#195FAC"),
  B("deutsche", "도이치은행", "도이치", "#0E04AF"),
  B("boa", "뱅크오브아메리카", "BOA", "#DC1439"),
  B("busan", "부산은행", "부산", "#D61928"),
  B("nfcf", "산림조합중앙회", "산림조합", "#09215A"),
  B("savings", "저축은행", "저축은행", "#47A445"),
  B("mg", "새마을금고", "새마을", "#06C8F5", [4, 2, 6, 1]),
  B("suhyup", "수협", "수협", "#0765AB", [3, 2, 6]),
  B("shinhyup", "신협중앙회", "신협", "#0861A7"),
  B("post", "우체국", "우체국", "#D64631", [6, 2, 6]),
  B("jb", "전북은행", "전북", "#1D60A7"),
  B("jeju", "제주은행", "제주", "#0747F1"),
  B("ccb", "중국건설은행", "중국건설", "#2F46A1"),
  B("icbc", "중국공상은행", "중국공상", "#C80711"),
  B("boc", "중국은행", "중국", "#AD072C"),
  B("bnp", "BNP파리바은행", "BNP파리바", "#099277"),
  B("hsbc", "HSBC은행", "HSBC", "#F21908"),
  B("jpm", "JP모간체이스은행", "JP모간", "#085BA6"),
  B("kbank", "케이뱅크", "케이뱅크", "#0213A5", [3, 3, 6]),
  B("toss", "토스뱅크", "토스뱅크", "#DBE9FE", [4, 4, 4]),

  S("kyobo", "교보증권", "#073B73"),
  S("daishin", "대신증권", "#21918A"),
  S("dbsec", "DB증권", "#FFFFFF"),
  S("meritz", "메리츠증권", "#E5402A"),
  S("mirae", "미래에셋증권", "#074175"),
  S("bookook", "부국증권", "#17429A"),
  S("samsung", "삼성증권", "#063DD0"),
  S("shinyoung", "신영증권", "#53893F"),
  S("shinhansec", "신한투자증권", "#0747F1"),
  S("sks", "에스케이증권", "#D81F3A"),
  S("hmsec", "현대차증권", "#064487"),
  S("yuanta", "유안타증권", "#0865AC"),
  S("eugene", "유진투자증권", "#B92329"),
  S("ls", "LS증권", "#0A1D58"),
  S("cape", "케이프투자증권", "#0862A1"),
  S("kiwoom", "키움증권", "#033C72"),
  S("wooriinv", "우리투자증권", "#2190C8"),
  S("hanasec", "하나증권", "#1E7E72"),
  S("imsec", "iM증권", "#1FC6AD"),
  S("kis", "한국투자증권", "#612F06"),
  S("sangsangin", "상상인증권", "#28B7B4"),
  S("hanwha", "한화투자증권", "#ED762A"),
  S("kbsec", "KB증권", "#756B61"),
  S("daol", "다올투자증권", "#1C1C1A"),
  S("bnksec", "BNK투자증권", "#CE1820"),
  S("nhsec", "NH투자증권", "#295C98"),
  S("kakaopaysec", "카카오페이증권", "#F6E225"),
  S("ibksec", "IBK투자증권", "#074A9C"),
  S("tosssec", "토스증권", "#DBEAFE"),
];

export const bankByCode = (code) => BANKS.find((b) => b.code === code);

export const digitsOf = (raw) => String(raw ?? "").replace(/\D/g, "");

// 은행 형식에 맞는 계좌번호인지. 틀리면 화면에 보여줄 메시지, 맞으면 null
export function checkNumber(bank, digits) {
  if (bank.pattern) {
    const n = bank.pattern.reduce((a, b) => a + b, 0);
    return digits.length === n ? null : `${bank.name} 계좌번호는 숫자 ${n}자리예요`;
  }
  return digits.length >= 10 && digits.length <= 14 ? null : "계좌번호는 숫자 10~14자리예요";
}

// 숫자만 남기고 은행 형식에 맞춰 하이픈을 넣는다: "30200001234501" → "302-0000-1234-50"
// 형식을 모르는 은행은 숫자 그대로
export function formatAccountNumber(code, raw) {
  const bank = bankByCode(code);
  const digits = digitsOf(raw);
  if (!bank?.pattern) return digits;
  const parts = [];
  let i = 0;
  for (const len of bank.pattern) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + len));
    i += len;
  }
  return parts.join("-");
}

// 응답에 넣을 은행 정보
export const bankInfo = (bank) => ({ code: bank.code, name: bank.name, short: bank.short, color: bank.color, section: bank.section, ...(bank.pattern && { pattern: bank.pattern }) });
