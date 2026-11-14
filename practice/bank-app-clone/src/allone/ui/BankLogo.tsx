// NH올원뱅크 은행 타일 (plan.md §3.3, §5.2; infra.md §8; transfer.md §7; home.md §2.4; account.md §2.1)
// - 녹화에 나온 7 은행 (전북 jb · 신한 · 카카오뱅크 · 하나 · KB kb · 케이뱅크 kbank · NH nh): 녹화에서 자른 36pt 타일
//   allone-bank-<code>.png (144px, 초타원 알파 — scripts/allone-crops/shared.py)
// - NH 가 36 이 아닌 크기(홈 카드 32, 거래내역 계좌 줄 40)거나 radius 를 주면: #0052B3 타일 + 흰 "NH" 를 SVG 로 (녹화에서 잰 글자 모양,
//   크기에 비례: 대문자 높이 = 타일의 0.25, 폭 0.6). 녹화의 32 · 40 타일도 36 과 같은 초타원이라 radius 를 안 주면 초타원
// - 그 밖의 은행: 은행 색 초타원 타일 + hana-bank-<code> 글리프 (어두운 타일은 흰 마스크, 밝은 타일은 원래 색), 글리프가 없으면 짧은 이름
// 타일 모양: 녹화 타일 윤곽에 맞춘 초타원 |x|^2.6 + |y|^2.6 = 1 (가장자리 평균 오차 0.12 px). radius 를 주면 보통 둥근 네모
import type { CSSProperties } from "react";
import { localAsset } from "../../assets/Asset";

const CROPS = ["jb", "shinhan", "kakao", "hana", "kb", "kbank", "nh"]; // src/allone/bank.ts AO_CROPPED_BANKS 와 같음
export const AO_NH_BLUE = "#0052B3";

// 짧은 이름 · 대표색 (server/banks.mjs BANKS 와 같은 값)
const BANKS: Record<string, [short: string, color: string]> = {
  kakao: ["카카오뱅크", "#F9E208"],
  kb: ["국민", "#766B66"],
  ibk: ["기업", "#09469E"],
  nh: ["농협", "#399F56"],
  shinhan: ["신한", "#0740F5"],
  im: ["iM뱅크", "#08C5A3"],
  kdb: ["산업", "#08337B"],
  woori: ["우리", "#0886C5"],
  citi: ["씨티", "#0564AE"],
  hana: ["하나", "#1A7E6F"],
  sc: ["SC제일", "#0970E8"],
  kn: ["경남", "#D11829"],
  kj: ["광주", "#195FAC"],
  deutsche: ["도이치", "#0E04AF"],
  boa: ["BOA", "#DC1439"],
  busan: ["부산", "#D61928"],
  nfcf: ["산림조합", "#09215A"],
  savings: ["저축은행", "#47A445"],
  mg: ["새마을", "#06C8F5"],
  suhyup: ["수협", "#0765AB"],
  shinhyup: ["신협", "#0861A7"],
  post: ["우체국", "#D64631"],
  jb: ["전북", "#1D60A7"],
  jeju: ["제주", "#0747F1"],
  ccb: ["중국건설", "#2F46A1"],
  icbc: ["중국공상", "#C80711"],
  boc: ["중국", "#AD072C"],
  bnp: ["BNP파리바", "#099277"],
  hsbc: ["HSBC", "#F21908"],
  jpm: ["JP모간", "#085BA6"],
  kbank: ["케이뱅크", "#0213A5"],
  toss: ["토스뱅크", "#DBE9FE"],
  kyobo: ["교보증권", "#073B73"],
  daishin: ["대신증권", "#21918A"],
  dbsec: ["DB증권", "#FFFFFF"],
  meritz: ["메리츠증권", "#E5402A"],
  mirae: ["미래에셋증권", "#074175"],
  bookook: ["부국증권", "#17429A"],
  samsung: ["삼성증권", "#063DD0"],
  shinyoung: ["신영증권", "#53893F"],
  shinhansec: ["신한투자증권", "#0747F1"],
  sks: ["에스케이증권", "#D81F3A"],
  hmsec: ["현대차증권", "#064487"],
  yuanta: ["유안타증권", "#0865AC"],
  eugene: ["유진투자증권", "#B92329"],
  ls: ["LS증권", "#0A1D58"],
  cape: ["케이프투자증권", "#0862A1"],
  kiwoom: ["키움증권", "#033C72"],
  wooriinv: ["우리투자증권", "#2190C8"],
  hanasec: ["하나증권", "#1E7E72"],
  imsec: ["iM증권", "#1FC6AD"],
  kis: ["한국투자증권", "#612F06"],
  sangsangin: ["상상인증권", "#28B7B4"],
  hanwha: ["한화투자증권", "#ED762A"],
  kbsec: ["KB증권", "#756B61"],
  daol: ["다올투자증권", "#1C1C1A"],
  bnksec: ["BNK투자증권", "#CE1820"],
  nhsec: ["NH투자증권", "#295C98"],
  kakaopaysec: ["카카오페이증권", "#F6E225"],
  ibksec: ["IBK투자증권", "#074A9C"],
  tosssec: ["토스증권", "#DBEAFE"],
};

// 36 × 36 초타원 (n 2.6) 윤곽 — 녹화 타일에 맞춤
const SQUIRCLE_N = 2.6;
const SQUIRCLE_PATH = (() => {
  const pts: string[] = [];
  const steps = 160;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = 18 + 18 * Math.sign(c) * Math.abs(c) ** (2 / SQUIRCLE_N);
    const y = 18 + 18 * Math.sign(s) * Math.abs(s) ** (2 / SQUIRCLE_N);
    pts.push(`${x.toFixed(3)} ${y.toFixed(3)}`);
  }
  return `M${pts.join("L")}Z`;
})();

// 흰 "NH" (36 칸 기준, 녹화 NH 타일에서 잼: 잉크 x 7.2–28.8 · y 13.45–22.55, 획 ≈ 2.1, H 가로대 1.6)
const NH_LETTERS =
  "M7.2 22.55V13.45H9.5L15.15 19.6V13.45H17.3V22.55H15L9.35 16.4V22.55Z" + // N
  "M19.2 13.45H21.35V17.2H26.65V13.45H28.8V22.55H26.65V18.8H21.35V22.55H19.2Z"; // H

// hana-bank-<code> 글리프 중 모양이 알파가 아니라 색에 있는 것 (불투명 부분 안 밝기 표준편차 > 30 — 우리 · 기업처럼 원 · 네모 안에 그림).
// 흰 마스크로 칠하면 흰 덩어리가 되므로 흰 타일 위에 원래 색으로
const COLOUR_GLYPHS = new Set(["bnp", "kj", "kakaopaysec", "jeju", "shinhansec", "daol", "ls", "woori", "wooriinv", "eugene", "savings", "ibk", "ibksec", "kiwoom", "kdb", "bookook", "shinyoung", "kis", "sks", "hmsec"]);

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 186;
};

export interface AoBankLogoProps {
  code: string;
  /** pt (CSS px). 기본 36 = 목록 · 시트 타일 */
  size?: number;
  /** 주면 초타원 대신 이 반지름(pt)의 둥근 네모 */
  radius?: number;
  /** 서버 Bank 를 가지고 있으면 넘겨도 됨 (이름 · 색). 없으면 위 표 */
  bank?: { name?: string; short?: string; color?: string };
  className?: string;
  style?: CSSProperties;
}

export function AoBankLogo({ code, size = 36, radius, bank, className, style }: AoBankLogoProps) {
  const [short0, color0] = BANKS[code] ?? [code, "#8E8E93"];
  const short = bank?.short ?? short0;
  const label = bank?.name ?? (code === "nh" ? "NH농협은행" : short);
  // 자리(position · display · flex-shrink)는 클래스 .ao-banklogo (ui.css, 0 특이도 :where) — 영역 className 이 position: absolute 같은 걸 주면 그게 이김.
  // 크기만 인라인 (style 은 그 위에 덮음)
  const box: CSSProperties = { width: size, height: size, ...style };
  const cls = `ao-banklogo${className ? ` ${className}` : ""}`;

  const crop = CROPS.includes(code) && !(code === "nh" && (size !== 36 || radius !== undefined)) ? localAsset(`allone-bank-${code}`) : undefined;
  if (crop)
    return (
      <img
        src={crop}
        alt={label}
        width={size}
        height={size}
        draggable={false}
        className={cls}
        style={{ ...box, ...(radius !== undefined && { borderRadius: radius }) }}
      />
    );

  const glyph = code === "nh" ? undefined : localAsset(`hana-bank-${code}`);
  const colourGlyph = !!glyph && COLOUR_GLYPHS.has(code);
  const fill = code === "nh" ? AO_NH_BLUE : colourGlyph ? "#FFFFFF" : (bank?.color ?? color0);
  const light = isLight(fill);
  const shape =
    radius !== undefined ? (
      <rect x="0" y="0" width="36" height="36" rx={(radius * 36) / size} fill={fill} stroke={light ? "rgba(0,0,0,0.08)" : "none"} strokeWidth="0.6" />
    ) : (
      <path d={SQUIRCLE_PATH} fill={fill} stroke={light ? "rgba(0,0,0,0.08)" : "none"} strokeWidth="0.6" />
    );
  const mark = short.replace(/(은행|증권|투자)$/, "").slice(0, 3);
  return (
    <span role="img" aria-label={label} className={cls} style={box}>
      <svg viewBox="0 0 36 36" width={size} height={size} style={{ position: "absolute", inset: 0, display: "block" }} aria-hidden>
        {shape}
        {code === "nh" && <path d={NH_LETTERS} fill="#ffffff" />}
      </svg>
      {code !== "nh" &&
        (glyph ? (
          light ? (
            <img src={glyph} alt="" draggable={false} style={{ position: "absolute", inset: "21%", width: "58%", height: "58%", objectFit: "contain" }} />
          ) : (
            <span
              style={{
                position: "absolute",
                inset: "21%",
                backgroundColor: "#ffffff",
                WebkitMask: `url("${glyph}") center / contain no-repeat`,
                mask: `url("${glyph}") center / contain no-repeat`,
              }}
            />
          )
        ) : (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: light ? "#1c1c1c" : "#ffffff",
              fontSize: size * (mark.length >= 3 ? 0.27 : mark.length === 2 ? 0.33 : 0.46),
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {mark}
          </span>
        ))}
    </span>
  );
}
