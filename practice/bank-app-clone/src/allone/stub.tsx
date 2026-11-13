// 아직 안 만든 올원 화면 자리 (기초 단계). 영역(launch · home · account · transfer)이 자기 폴더의 파일을 진짜 화면으로 바꿈.
// 웹뷰(59–818) 안 흰 화면 + 머리줄(50pt) + 이동 시험용 버튼들. 모양은 allone.css .ao-stub
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useStatusBar } from "../hooks/useStatusBar";
import { useAoBack } from "./nav";

export interface AoStubLink {
  label: string;
  onPress: () => unknown;
}

export function AoStub({
  title,
  area,
  links = [],
  back = "back",
  onClose,
  children,
}: {
  title: string;
  area: string;
  links?: AoStubLink[];
  back?: "back" | "close" | false;
  onClose?: () => unknown;
  children?: ReactNode;
}) {
  useStatusBar("#ffffff", "dark");
  const loc = useLocation();
  const goBack = useAoBack();
  const close = onClose ?? goBack;
  return (
    <div className="ao-stub">
      <header className="ao-stub__head">
        {back === "back" && (
          <button className="ao-stub__back" aria-label="뒤로" onClick={() => close()}>
            <svg width="11" height="20" viewBox="0 0 11 20" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9.5 1.5 1.5 10l8 8.5" />
            </svg>
          </button>
        )}
        <h1 className="ao-stub__title">{title}</h1>
        {back === "close" && (
          <button className="ao-stub__close" aria-label="닫기" onClick={() => close()}>
            <svg width="16" height="16" viewBox="0 0 16 16" stroke="#000" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="M2 2l12 12M14 2 2 14" />
            </svg>
          </button>
        )}
      </header>
      <div className="ao-stub__body">
        <p className="ao-stub__sub">
          {area} · {loc.pathname}
          {loc.search}
        </p>
        {children}
        {links.map((l) => (
          <button key={l.label} className="ao-stub__link" onClick={() => void l.onPress()}>
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
