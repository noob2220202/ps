// 간편비밀번호 화면 (launch.md §2.7, 녹화 C1 6.217–9.917). 초록 #0C8F2D 웹 화면 + 네이티브 보안 키패드(흰색 504 → 852, 아래 띠까지 덮음).
//  - 보이기만 하는 잠금: 아무 숫자 6개면 통과. 누른 숫자는 어디에도 두지 않음 — 몇 개 눌렀는지(점 개수)만 이 화면 상태로, 화면이 사라지면 같이 사라짐.
//    서버 · 저장소 · 콘솔로 가는 것 없음 (로그인은 원래 쿠키 세션)
//  - 키패드 숫자 자리는 화면이 뜰 때 한 번 섞고(0–9 를 열 칸에) 누르는 동안 그대로. ↻ 다시 섞기, ⌫ 마지막 점 지우기. 눌림 표시 없음 (녹화)
//  - 점은 누른 프레임에 막대 자리를 바로 바꿔 채움. 6번째 → onComplete (부르는 쪽이 +67ms 에 로딩 막 · 키패드 없앰)
//  - 지구 · 메뉴 · 로그인 방식 변경하기 · 간편비밀번호 재등록: 아무 일 없음. 자동로그인: 동그라미만 켜고 끔
//  - 컴퓨터에서는 숫자 키 · Backspace 도 키패드처럼
// 자리는 화면 pt (녹화 C1 7.333 에서 잰 잉크 상자, y = px / 3.000). CSS 는 launch.css (.ao-ln-pin*)
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { localAsset } from "../../assets/Asset";
import { AoGlobeIcon, AoNativePortal } from "../ui";

const TITLE = localAsset("allone-launch-pin-title");
const AO_PIN_LENGTH = 6;

// 0–9 를 열 칸에 고르게 섞음 (Fisher–Yates, 가능하면 crypto 난수)
function shuffled(): number[] {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const rnd = new Uint32Array(a.length);
  try {
    crypto.getRandomValues(rnd);
  } catch {
    for (let i = 0; i < rnd.length; i++) rnd[i] = Math.floor(Math.random() * 2 ** 32);
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 자동로그인 체크 동그라미 (녹화 C1 7.333: 고리 가운데 (160.33, 306.8) 반지름 7.5 두께 1.08, 체크 잉크 156.9–163.5 × 305.0–309.7, 두께 1).
// 켜면 흰 원 + 초록 체크 (지어낸 모양 — 녹화엔 끈 모습만)
function AutoCheck({ on }: { on: boolean }) {
  return (
    <svg className="ao-ln-pin__check" viewBox="0 0 16.1 16.1" width={16.1} height={16.1} aria-hidden>
      <circle cx="8.05" cy="8.05" r="7.5" fill={on ? "#ffffff" : "none"} stroke="#ffffff" strokeWidth="1.08" />
      <path d="M5.07 8.15L7.07 10.35L10.77 6.75" fill="none" stroke={on ? "#0c8f2d" : "#ffffff"} strokeWidth={on ? 1.3 : 1} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ↻ 다시 섞기 (잉크 54.6–77.3 × 765.0–791.0): 왼쪽 · 오른쪽 호 두 개(가운데 (66.05, 777.9), 반지름 10.95, 위아래 ±18° 가 빔)
// + 빈 자리에 꺾쇠 — 위는 왼쪽을 향한 <, 아래는 오른쪽을 향한 >. 상자 왼쪽 위 = 화면 (54, 764)
const Reshuffle = () => (
  <svg className="ao-ln-pad__icon ao-ln-pad__icon--shuffle" viewBox="0 0 24 28" width={24} height={28} aria-hidden>
    <path d="M8.65 3.49A10.95 10.95 0 0 0 8.65 24.31M15.45 3.49A10.95 10.95 0 0 1 15.45 24.31" fill="none" stroke="#000" strokeWidth="1.05" />
    <path d="M13.8 1L10.5 4.3L13.8 7.4M10.2 20.4L13.8 23.5L10.2 27" fill="none" stroke="#000" strokeWidth="1.1" strokeLinejoin="miter" />
  </svg>
);
// ⌫ 지우기 (녹화 C1 7.333 선 가운데: 뾰족한 끝 (311.91, 777.89), 위 · 아래 모서리 x 321.94 · 322.01, 위 768.0 · 아래 788.0, 오른쪽 342.35,
// 두께 ≈ 1.3) + 안쪽 × (가운데 (330.34, 778.0), 잉크 10 × 10). 상자 왼쪽 위 = 화면 (310, 766) — 상자는 정수 자리, 소수 자리는 선 좌표에
const Backspace = () => (
  <svg className="ao-ln-pad__icon ao-ln-pad__icon--back" viewBox="0 0 34 24" width={34} height={24} aria-hidden>
    <path d="M1.91 11.89L11.94 2H32.35V22H12.01Z" fill="none" stroke="#000" strokeWidth="1.3" strokeLinejoin="miter" />
    <path d="M15.78 7.44L24.9 16.56M24.9 7.44L15.78 16.56" fill="none" stroke="#000" strokeWidth="1.3" />
  </svg>
);

// 머리글 메뉴(검색) 아이콘: 공용 AoMenuSearchIcon 보다 녹화가 위 줄이 0.7 높고 아래 줄이 2.7 길며 돋보기가 조금 큼 → 녹화 C1 7.333 에서 잰 대로.
// 상자 왼쪽 위 = 화면 (345, 74), 좌표는 상자 기준 (선 가운데: 줄 y 76.93 · 83.95 · 90.94, 돋보기 가운데 (360.96, 85.28) 반지름 4.45)
const MenuSearch = () => (
  <svg viewBox="0 0 24 20" width={24} height={20} aria-hidden>
    <path d="M3.16 2.93H20.92M3.16 9.95H9.03M3.16 16.94H10.93M19.11 14.43L21.61 16.92" fill="none" stroke="#fff" strokeWidth="1.52" strokeLinecap="round" />
    <circle cx="15.96" cy="11.28" r="4.45" fill="none" stroke="#fff" strokeWidth="1.46" />
  </svg>
);

// 키 칸: 3 열 — 녹화 숫자 가운데가 65.9 / 196.5 / 326.9 (간격 130.5, 양옆 0.75 안쪽), 4 줄 (숫자 잉크 가운데 544.3 / 622.3 / 700.2 / 778.3
// → 판 위끝 504 기준, 칸 높이 78). 열 번째 숫자는 4줄 가운데. 왼쪽은 판 폭의 % (넓은 폰 화면에서도 세 칸)
const ROWS = [544.33, 622.33, 700.17, 778.33].map((y) => y - 504 - 39);
const at = (col: number, row: number) => ({ left: `calc(0.75px + ${col} * (100% - 1.5px) / 3)`, top: ROWS[row] });
const cell = (i: number) => (i < 9 ? at(i % 3, Math.floor(i / 3)) : at(1, 3));

export function AlloneLaunchPin({ keypad, locked, onComplete }: { keypad: boolean; locked: boolean; onComplete: () => void }) {
  const [count, setCount] = useState(0);
  const [order, setOrder] = useState(shuffled);
  const [auto, setAuto] = useState(false);
  const open = keypad && !locked;

  // 점 개수 (숫자 자체는 두지 않음). 빠른 연타에도 정확하게 ref 로 셈, 6개가 되면 한 번만 onComplete
  const filled = useRef(0);
  const live = useRef({ open, onComplete });
  useLayoutEffect(() => {
    live.current = { open, onComplete };
  });
  const [keys] = useState(() => ({
    press: () => {
      if (!live.current.open || filled.current >= AO_PIN_LENGTH) return;
      filled.current += 1;
      setCount(filled.current);
      if (filled.current === AO_PIN_LENGTH) live.current.onComplete();
    },
    back: () => {
      if (!live.current.open || filled.current === 0 || filled.current >= AO_PIN_LENGTH) return;
      filled.current -= 1;
      setCount(filled.current);
    },
  }));
  const { press, back } = keys;

  // 컴퓨터 키보드: 숫자 · Backspace (키패드가 보일 때만, 입력칸에 있으면 그대로 둠)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, press, back]);

  return (
    <div className={`ao-ln-pin${keypad && !locked ? " ao-ln-pin--pad" : ""}`}>
      <div className="ao-ln-pin__head">
        {TITLE ? <span className="ao-ln-pin__title" role="img" aria-label="NH올원뱅크" style={{ ["--ao-ln-title" as string]: `url("${TITLE}")` }} /> : <span className="ao-ln-pin__title-text">NH올원뱅크</span>}
        <button type="button" className="ao-ln-pin__globe" aria-label="언어">
          <AoGlobeIcon size={20.5} color="#ffffff" />
        </button>
        <button type="button" className="ao-ln-pin__menu" aria-label="메뉴">
          <MenuSearch />
        </button>
      </div>
      <p className="ao-ln-pin__prompt">
        <span className="ao-ln-pin__prompt1">간편비밀번호</span>
        <br />
        <span className="ao-ln-pin__prompt2">6자리를 입력해주세요</span>
      </p>
      <div className="ao-ln-pin__slots" aria-label={`${count}자리 입력됨`}>
        {Array.from({ length: AO_PIN_LENGTH }, (_, i) => (
          <span key={i} className={i < count ? "ao-ln-pin__dot" : "ao-ln-pin__bar"} style={{ ["--i" as string]: i }} />
        ))}
      </div>
      <button type="button" className="ao-ln-pin__auto" aria-pressed={auto} onClick={() => setAuto((v) => !v)}>
        <AutoCheck on={auto} />
        <span>자동로그인</span>
      </button>
      <div className="ao-ln-pin__links">
        <button type="button">로그인 방식 변경하기</button>
        <i aria-hidden />
        <button type="button">간편비밀번호 재등록</button>
      </div>
      {keypad && !locked && (
        <AoNativePortal layer="panel">
          <div className="ao-ln-pad" role="group" aria-label="보안 키패드">
            {order.map((digit, i) => (
              <button key={i} type="button" className="ao-ln-pad__key" style={cell(i)} onClick={press} aria-label={String(digit)}>
                <span>{digit}</span>
              </button>
            ))}
            <Reshuffle />
            <Backspace />
            <button type="button" className="ao-ln-pad__key ao-ln-pad__key--shuffle" style={at(0, 3)} aria-label="재배열" onClick={() => setOrder(shuffled())} />
            <button type="button" className="ao-ln-pad__key ao-ln-pad__key--back" style={at(2, 3)} aria-label="지우기" onClick={back} />
          </div>
        </AoNativePortal>
      )}
    </div>
  );
}
