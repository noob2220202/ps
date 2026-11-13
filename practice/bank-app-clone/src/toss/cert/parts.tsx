// 증명서 화면 작은 부품: 녹화에서 잰 선 아이콘 (cert.md §2), 계좌 타일, 큰 제목
import type { CSSProperties, ReactNode } from "react";
import type { Bank } from "../../api/types";
import { useTossBack } from "../nav";
import { TossBankLogo } from "../ui/BankLogo";
import { TossPressable } from "../ui/Pressable";

interface IconProps {
  className?: string;
  style?: CSSProperties;
  color?: string;
}
const round = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

// 돋보기 (H 머리줄): 24 상자 (335, 42), 잉크 336.2–357.7 · 43.2–64.7, 선 2.4 #9094a1
export const CertSearchIcon = ({ className, style, color = "#9094a1" }: IconProps) => (
  <svg className={className} style={style} width={24} height={24} viewBox="0 0 24 24" aria-hidden>
    <circle cx="9.9" cy="9.9" r="7.5" stroke={color} strokeWidth="2.4" fill="none" />
    <path d="M15.2 15.2 21.5 21.5" stroke={color} strokeWidth="2.4" {...round} />
  </svg>
);
// 검색칸 돋보기 (L): 16 상자, 선 1.8 #9c9b9e
export const CertFieldSearchIcon = ({ className, style, color = "#9c9b9e" }: IconProps) => (
  <svg className={className} style={style} width={16} height={16} viewBox="0 0 16 16" aria-hidden>
    <circle cx="6.6" cy="6.6" r="5.7" stroke={color} strokeWidth="1.8" fill="none" />
    <path d="m10.9 10.9 4.2 4.2" stroke={color} strokeWidth="1.8" {...round} />
  </svg>
);
// 칩 ⌄ (L): 잉크 9.6 × 5.6 #95969b
export const CertChevronDown = ({ className, style, color = "#95969b" }: IconProps) => (
  <svg className={className} style={style} width={10.2} height={6.4} viewBox="0 0 10.2 6.4" aria-hidden>
    <path d="M.75.75 5.1 5.4 9.45.75" stroke={color} strokeWidth="1.5" {...round} />
  </svg>
);
// 줄 › (M): 잉크 5.5 × 10.2, 선 1.6 #515053
export const CertChevronRight = ({ className, style, color = "#515053" }: IconProps) => (
  <svg className={className} style={style} width={5.5} height={10.2} viewBox="0 0 5.5 10.2" aria-hidden>
    <path d="M.8.8 4.7 5.1.8 9.4" stroke={color} strokeWidth="1.6" {...round} />
  </svg>
);
// 고른 계좌 ✓ (A): 잉크 16 × 11, 선 2 #3182f6
export const CertCheck = ({ className, style, color = "#3182f6" }: IconProps) => (
  <svg className={className} style={style} width={16} height={11} viewBox="0 0 16 11" aria-hidden>
    <path d="M1 5.6 5.6 10 15 1" stroke={color} strokeWidth="2" {...round} />
  </svg>
);
// ✓ 동그라미 ⌀22 (L): 안 고름 = 2dp 테 + ✓ (#58575a), 고름 = 파랑으로 채우고 ✓ 는 바탕색으로 뚫음
export const CertCheckCircle = ({ on, className, style, color = "#58575a", knock = "#171619" }: IconProps & { on?: boolean; knock?: string }) => (
  <svg className={className} style={style} width={22} height={22} viewBox="0 0 22 22" aria-hidden>
    {on ? <circle cx="11" cy="11" r="10.6" fill="#3182f6" /> : <circle cx="11" cy="11" r="10" stroke={color} strokeWidth="2" fill="none" />}
    <path d="M6.3 10.9 9.6 14.1 15.7 8.1" stroke={on ? knock : color} strokeWidth="2" {...round} />
  </svg>
);
// 공유 (V 머리줄): 열린 상자 + 위 화살표, 잉크 19 × 20 #e1e0e3
export const CertShareIcon = ({ className, style, color = "#e1e0e3" }: IconProps) => (
  <svg className={className} style={style} width={25.2} height={25.2} viewBox="0 0 24 24" aria-hidden>
    <path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M12 3v12M7 8l5-5 5 5" stroke={color} strokeWidth="2" {...round} />
  </svg>
);

// 계좌 타일 28 × 28 (A): #100f12 둥근 네모(모서리 8) 위에 토스 심볼 ≈18dp, 다른 은행은 은행 색을 옅게 깐 19.2 네모 + 글리프 (녹화 A 71.773)
export function CertTile({ code, bank, className, style }: { code: string; bank?: Bank; className?: string; style?: CSSProperties }) {
  if (code === "toss")
    return <TossBankLogo className={`toss-cert-tile${className ? ` ${className}` : ""}`} code="toss" size={28} surface="tile" glyph={0.63} style={{ borderRadius: 8, ...style }} />;
  return (
    <span className={`toss-cert-tile${className ? ` ${className}` : ""}`} style={style} aria-hidden>
      <TossBankLogo code={code} bank={bank} size={19.2} fill={`color-mix(in srgb, ${bank?.color ?? "#8a8a90"} 11%, #100f12)`} glyph={0.54} style={{ borderRadius: 3 }} />
    </span>
  );
}

// 큰 제목 22 B (모든 단계). top = 화면 y (잉크 가운데 − 0.54em)
export function CertTitle({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <h1 className={`toss-cert-title${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </h1>
  );
}

// ← (증명서 머리줄): 잉크 x 18.9–38.0 · y 45.8–63.2 (19.1 × 17.4), 선 2 둥근 끝. 24 상자 (16.5, 42.5)
export const CertBackIcon = ({ className, style, color = "#ffffff" }: IconProps) => (
  <svg className={className} style={style} width={24} height={24} viewBox="0 0 24 24" aria-hidden>
    <path d="M20.5 12H3.4M11.1 4.3 3.4 12l7.7 7.7" stroke={color} strokeWidth="2" {...round} />
  </svg>
);

// 머리줄 28 – 81.6 (공용 TossAppBar 와 같은 클래스 · 자리, ← 만 녹화 증명서 화면 잉크에 맞춘 것 — 공용 ← 는 잉크가 1.3dp 왼쪽).
// title 은 x 72 (17 SB), right 는 화면마다 CSS 로 자리, progress 는 y 80 진행 막대
export function CertBar({ title, right, progress, bg = "var(--toss-bg)" }: { title?: ReactNode; right?: ReactNode; progress?: ReactNode; bg?: string }) {
  const back = useTossBack();
  return (
    <header className="toss-appbar toss-appbar--solid toss-cert-bar" style={{ ["--toss-appbar-bg" as string]: bg }}>
      <div className="toss-appbar__bg" />
      <TossPressable className="toss-appbar__back toss-cert-bar__back" radius={24} onPress={back} ariaLabel="뒤로">
        <CertBackIcon />
      </TossPressable>
      {title != null && <div className="toss-appbar__title">{title}</div>}
      {right && <div className="toss-appbar__right">{right}</div>}
      {progress && <div className="toss-appbar__progress">{progress}</div>}
    </header>
  );
}

// 녹화 글꼴은 띄어쓰기와 괄호가 Pretendard 보다 좁음 (17dp 줄 글자에서 띄어쓰기 −0.6, 괄호 −1.2 씩) → 괄호를 따로 감싸 좁힘
export function CertLabel({ text }: { text: string }) {
  const parts = text.split(/([()])/);
  return (
    <>
      {parts.map((p, i) =>
        p === "(" || p === ")" ? (
          <span key={i} className="toss-cert-paren">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
