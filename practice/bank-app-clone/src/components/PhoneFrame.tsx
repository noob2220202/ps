import { useEffect, useState, type ReactNode } from "react";
import { useStatusBarStyle } from "../hooks/useStatusBar";
import { OS } from "../platform/platform";
import { THEME } from "../platform/theme";
import { APP } from "../profile/session";
import "./PhoneFrame.css";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);
  return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function AndroidIcons() {
  return (
    <span className="statusbar__right">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 9.5a14 14 0 0 1 18 0l-2 2.3a11 11 0 0 0-14 0Zm4 4.6a8 8 0 0 1 10 0l-2 2.3a5 5 0 0 0-6 0ZM12 20l-2.3-2.6a3.5 3.5 0 0 1 4.6 0Z" />
      </svg>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 20h3v-4H3Zm5 0h3v-8H8Zm5 0h3V8h-3Zm5 0h3V4h-3Z" />
      </svg>
      <span>62%</span>
      <span className="statusbar__battery" />
    </span>
  );
}

// iOS 상태바: 셀룰러 4칸 + 와이파이 부채꼴 + 둥근 배터리(옅은 테두리, 잔량만큼 채움)
function IosIcons() {
  return (
    <span className="statusbar__right statusbar__right--ios">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden>
        <rect x="0" y="8" width="3" height="4" rx="1" />
        <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
        <rect x="10" y="3" width="3" height="9" rx="1" />
        <rect x="15" y="0" width="3" height="12" rx="1" />
      </svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
        <path d="M8 2.4c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.6 10.6 0 0 0 8 .6 10.6 10.6 0 0 0 .5 3.6l1.2 1.3A9 9 0 0 1 8 2.4Zm0 3.5c1.5 0 2.9.6 4 1.6l1.2-1.3A7.4 7.4 0 0 0 8 4.1a7.4 7.4 0 0 0-5.2 2.1L4 7.5a5.7 5.7 0 0 1 4-1.6ZM8 12l2.6-2.8a3.7 3.7 0 0 0-5.2 0Z" />
      </svg>
      <span className="ios-battery">
        <span className="ios-battery__level" style={{ width: "62%" }} />
      </span>
    </span>
  );
}

function StatusBar() {
  const { bg, fg } = useStatusBarStyle();
  const time = useClock();
  return (
    // 콕뱅크: 28px 상태바가 기기 52.5px 에서 끝나 반 픽셀에 어두운 이음새가 생김 → 같은 색 그림자 1px 로 덮음
    <div className={`statusbar statusbar--${fg} statusbar--${OS}`} style={{ background: bg, ...(APP === "nh" && { boxShadow: `0 1px 0 ${bg}` }) }}>
      <span className="statusbar__time">{time}</span>
      {OS === "ios" ? <IosIcons /> : <AndroidIcons />}
    </div>
  );
}

// overlay: 상태바까지 폰 전체를 덮는 것 (콕뱅크 로딩 막)
export function PhoneFrame({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  const { fg } = useStatusBarStyle();
  // 콕뱅크(갤럭시): 실제 화면처럼 아래 15dp 검은 제스처바 + 회색 손잡이를 따로 둠
  const navbar = APP === "nh" && OS === "android";
  return (
    <div className={`phone phone--${OS}`}>
      {OS === "ios" && <div className="dynamic-island" />}
      <StatusBar />
      <div className="phone__viewport">{children}</div>
      {navbar ? (
        <div className="phone__navbar">
          <i />
        </div>
      ) : (
        <div className={`phone__home-indicator phone__home-indicator--${fg}`} />
      )}
      {overlay}
    </div>
  );
}

// PC에서만 보이는 기기/테마 전환 스위치 (선택은 localStorage에 기억됨)
export function OsSwitch() {
  return (
    <div className="switches">
      <nav className="os-switch">
        <a href="/?os=android" className={OS === "android" ? "on" : ""}>
          Galaxy
        </a>
        <a href="/?os=ios" className={OS === "ios" ? "on" : ""}>
          iPhone
        </a>
      </nav>
      <nav className="os-switch">
        <a href="/?theme=light" className={THEME === "light" ? "on" : ""}>
          라이트
        </a>
        <a href="/?theme=dark" className={THEME === "dark" ? "on" : ""}>
          다크
        </a>
      </nav>
    </div>
  );
}
