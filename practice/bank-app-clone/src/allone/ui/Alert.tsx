// AoAlert: 웹 '안내' 팝업 (지급정지 계좌에서 보낼 때, C3 12.713–19.479 · 33.229–33.996). 모양 · 시각은 녹화에서 잼:
//  - 화면 층(.layer, 웹뷰 59–818)에 붙어 그 안만 덮음 — 위 · 아래 흰 띠는 그대로. 배경막 rgba(0,0,0,.30) (흰색 → 178)
//  - 카드: 흰 바탕, 둥글기 12, 좌우 24 (x 24.3–369.0), 웹뷰 가운데에 세로 가운데 (C3 33.8: y 282.33–595.0)
//    제목 "안내" 왼쪽 · 굵게, 본문 가운데 두 줄, 빨간 코드 줄, 전화 아이콘 + 번호(밑줄) 줄, 초록 테 확인 (높이 48, 둥글기 12, 1pt #12a434)
//  - 나타남 (크기 · 자리는 그대로, 불투명도만): 카드 365ms cubic-bezier(.215,.61,.355,1), 배경막 350ms cubic-bezier(.33,1,.68,1).
//    그려진 프레임에서 잰 시작 시각 (막이 걷히는 프레임 = 0): 계좌 비밀번호 뒤 카드 +15.5 · 배경막 +62.5, 잔액채우기 카드 −14 · 배경막 +45.5
//    → enter "hidden"(막이 걷히는 프레임에 엶) · "cut"(막이 걷히기 33ms 전, 막 밑에서 엶) 마다 지연을 ui.css 에 둠.
//    크롬은 붙인 프레임을 움직임 0ms 로 그림 (CDP 화면 캡처로 확인)
//  - 사라짐: 확인을 뗀 프레임에 한 번에 (C3 33.996 · 19.479). 누른 모양 없음. 배경막을 눌러도 닫히지 않음
//  - 닫힌 뒤 300ms 동안 보이지 않는 막이 웹 누름을 받음 (확인 두 번 누름의 둘째가 밑 화면으로 새지 않게)
//  - 브라우저 뒤로 = 확인 (화면은 그대로): 떠 있는 동안 방문 기록 한 칸을 쌓음 (주소 · 라우터 칸은 그대로라 화면 스택은 안 바뀜).
//    확인으로 닫히면 그 칸을 되돌림. 칸을 쌓고 되돌리는 것 · 되돌린 칸에 앞으로 가기로 오면 바로 다시 뒤로 · 녹화 다시 시작의 칸 셈은 nav.ts
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLayerActive } from "../../platform/LayerContext";
import { aoAlertHere, aoPopAlert, aoPushAlert, onAoPopFirst } from "../nav";
import { AoButton } from "./Button";

export interface AoAlertProps {
  open: boolean;
  onClose: () => void; // 확인 · 브라우저 뒤로
  title?: ReactNode; // 기본 "안내"
  children?: ReactNode; // 본문 (가운데, 15/400 #1f1f1f)
  code?: ReactNode; // 빨간 줄 (가운데, #f00)
  tel?: { label: string; numbers: string[] }; // 전화 아이콘 + "label : 번호, 번호" (번호에 밑줄, 누름 없음)
  confirmLabel?: string; // 기본 "확인"
  enter?: "hidden" | "cut"; // 언제 여는지 (나타나는 시각): 로딩 막이 걷히는 프레임(onHidden, 기본) | 막이 걷히기 33ms 전(cut 의 onError)
  className?: string;
  host?: HTMLElement | null; // 붙일 곳 (기본: 가장 가까운 화면 층 .layer)
}

const GUARD_MS = 300;
type Phase = "closed" | "open" | "guard";

export function AoAlert({ open, onClose, title = "안내", children, code, tel, confirmLabel = "확인", enter = "hidden", className, host }: AoAlertProps) {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  if (open && phase !== "open") setPhase("open");
  if (!open && phase === "open") setPhase("guard");

  useEffect(() => {
    if (phase !== "guard") return;
    const t = window.setTimeout(() => setPhase("closed"), GUARD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // 브라우저 뒤로 = 확인. 쌓기는 한 박자 늦게 (개발 모드 StrictMode 가 effect 를 두 번 돌려도 한 칸만).
  // 이 화면 층이 맨 위일 때만 (밑에 숨은 층의 팝업이 지금 화면의 뒤로를 가로채지 않게)
  const active = useLayerActive();
  const shown = phase === "open" && active;
  useEffect(() => {
    if (!shown) return;
    let id = 0; // 쌓은 칸의 표시 (0 = 아직. 여러 팝업이 겹쳐도 자기 칸만 알아봄)
    let popped = false;
    const off = onAoPopFirst(() => {
      if (!id || popped || aoAlertHere() === id) return;
      popped = true;
      closeRef.current();
    });
    const t = window.setTimeout(() => void (id = aoPushAlert()));
    return () => {
      window.clearTimeout(t);
      off();
      // 우리 칸에 그대로 있을 때만 되돌림 (뒤로로 닫혔거나 다른 화면 · 첫 칸으로 떠났으면 그대로)
      if (id) aoPopAlert(id);
    };
  }, [shown]);

  // 붙일 화면 층 (그리기 전에 찾음 — 첫 프레임부터 제자리)
  const anchor = useRef<HTMLSpanElement>(null);
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (host !== undefined) return;
    setLayer(anchor.current?.closest<HTMLElement>(".layer") ?? anchor.current?.closest<HTMLElement>(".phone__viewport") ?? null);
  }, [host]);
  const target = host !== undefined ? host : layer;

  const titleId = useId();
  const node =
    phase === "closed" ? null : phase === "guard" ? (
      <div className="ao-alert ao-alert--guard" aria-hidden />
    ) : (
      <div className={`ao-alert ao-alert--${enter}${className ? ` ${className}` : ""}`}>
        <div className="ao-alert__scrim" />
        <div className="ao-alert__card" role="alertdialog" aria-modal aria-labelledby={titleId}>
          <h2 className="ao-alert__title" id={titleId}>
            {title}
          </h2>
          {children != null && <div className="ao-alert__body">{children}</div>}
          {code != null && <p className="ao-alert__code">{code}</p>}
          {tel && (
            <p className="ao-alert__tel">
              <AoPhoneRingIcon />
              <span className="ao-alert__tellabel">{tel.label} : </span>
              {tel.numbers.map((n, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span className="ao-alert__telnum">{n}</span>
                </span>
              ))}
            </p>
          )}
          <AoButton variant="outlineGreen" className="ao-alert__ok" height={48} radius={12} size={16} weight={500} onPress={() => closeRef.current()}>
            {confirmLabel}
          </AoButton>
        </div>
      </div>
    );

  return (
    <>
      <span ref={anchor} hidden />
      {node && (target ? createPortal(node, target) : node)}
    </>
  );
}

// 전화 아이콘: 동그라미 테 안에 수화기 (C3 33.8: 20.33 × 20.33, 가운데 (86.1, 485.17) · 수화기 잉크 x 5.33–14.98 · y 5.33–15.33).
// 테는 가운데 반지름 9.24 · 굵기 1.38 (바깥 9.93 — 상자 끝에 잘리지 않게), 색은 글자(#888)보다 옅은 #919191 (수화기 속 145 · 글자 속 136–138)
function AoPhoneRingIcon() {
  return (
    <svg className="ao-alert__telicon" width="20.33" height="20.33" viewBox="0 0 20.33 20.33" aria-hidden>
      <circle cx="10.165" cy="10.165" r="9.24" fill="none" stroke="currentColor" strokeWidth="1.38" />
      <path
        d="M7.15 5.3 8.6 5 9.85 7.65 8.75 8.75c.6 1.3 1.45 2.15 2.75 2.75l1.1-1.1 2.65 1.25-.3 1.45c-.2.9-1 1.45-1.9 1.35C9.75 14.1 6.25 10.6 5.9 7.2c-.1-.9.4-1.7 1.25-1.9Z"
        fill="currentColor"
        transform="translate(10.15 10.33) scale(1.08) translate(-10.5 -9.5)"
      />
    </svg>
  );
}
