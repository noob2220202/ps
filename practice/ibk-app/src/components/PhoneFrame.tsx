import { useState, type ReactNode } from "react";
import { localAsset } from "../assets/Asset";
import { useStatusBarStyle } from "../hooks/useStatusBar";
import { setBattery, setClock, syncClock, useDeviceStatus, useNow } from "../platform/deviceStatus";
import { OS } from "../platform/platform";
import { canRecord, recordPhone, useRecorder } from "../platform/recorder";
import { setIntro, useIntro } from "../platform/intro";
import { THEME } from "../platform/theme";
import { APP } from "../profile/session";
import "./PhoneFrame.css";

function useClock() {
  const now = useNow();
  return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function AndroidIcons() {
  const { battery } = useDeviceStatus();
  return (
    <span className="statusbar__right">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 9.5a14 14 0 0 1 18 0l-2 2.3a11 11 0 0 0-14 0Zm4 4.6a8 8 0 0 1 10 0l-2 2.3a5 5 0 0 0-6 0ZM12 20l-2.3-2.6a3.5 3.5 0 0 1 4.6 0Z" />
      </svg>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 20h3v-4H3Zm5 0h3v-8H8Zm5 0h3V8h-3Zm5 0h3V4h-3Z" />
      </svg>
      <span>{battery}%</span>
      <span className="statusbar__battery" style={{ ["--lv" as string]: `${battery}%` }} />
    </span>
  );
}

// iOS 상태바: 셀룰러 4칸 + 와이파이 부채꼴 + 둥근 배터리(옅은 테두리, 잔량만큼 채움)
function IosIcons() {
  const { battery } = useDeviceStatus();
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
        <span className={`ios-battery__level${battery <= 20 ? " ios-battery__level--low" : ""}`} style={{ width: `${battery}%` }} />
      </span>
    </span>
  );
}

// i-ONE Bank 녹화 기기 상태바 오른쪽 (spec/home.md 2-1, 클론 x): "LTE⁺"(아래 옅은 ↑↓) 288.7~306.8 · 신호 막대 4개 310.3~319.8
// · "38%" 325.6~350.0 · 세로 배터리 352.6~359.9 (위 꼭지, 위쪽 #bebebe · 아래 잔량만큼 #454545). 막대·글자 기준선 녹화 y 20.2
// 인트로 영상(녹화 기기 홈 화면) 상태바 왼쪽의 알림 아이콘 4개(카메라 접근 중 2개·메일·점)를 그 영상에서
// 그대로 잘라 옴 (x 60~138, y 3~27) — 인트로가 끝나고 이 상태바로 넘어올 때 알림 아이콘이 안 달라지게
function IbkNotifIcons() {
  const src = localAsset("ibk-sb-notif");
  if (!src) return null;
  return <img className="ibk-sb-notif" src={src} alt="" aria-hidden />;
}

function IbkIcons() {
  const { battery } = useDeviceStatus();
  const fill = Math.min(10.5, (battery / 100) * 10.5 + 0.5);
  const shift = (String(battery).length - 2) * 7.86; // "100%" 처럼 글자가 길면 LTE·신호를 그만큼 왼쪽으로
  return (
    <span className="statusbar__right statusbar__right--ibk">
      <IbkNotifIcons />
      <svg className="ibk-sb-icons" width="384" height="29.4" viewBox="0 0 384 29.4" aria-hidden>
        <g transform={`translate(${-shift} 0)`}>
          <path
            d="M290.55 9.7v5.35h3M293.18 10.25h4.49M295.72 10.25v5.4M302.36 10.25h-3.04v4.85h3.04M299.32 12.95h2.9M305.59 9.25v3.1M304.02 10.8h3.12"
            fill="none"
            stroke="#4d4d4d"
            strokeWidth="1.35"
          />
          <path d="M294.45 21.1v-3.9m-1 1 1-1 1 1M298.36 17.2v3.9m-1-1 1 1 1-1" fill="none" stroke="#c9c9c9" strokeWidth="0.9" />
          <g fill="#454545">
            <rect x="310.4" y="17.6" width="1.27" height="2.7" />
            <rect x="312.82" y="15.2" width="1.27" height="5.1" />
            <rect x="315.7" y="12.3" width="1.27" height="8" />
            <rect x="318.6" y="9.3" width="1.27" height="11" />
          </g>
        </g>
        <g transform="translate(352.7 8.3)">
          <rect x="1.76" width="3.42" height="2" rx="0.4" fill="#bcbcbc" />
          <rect y="1.7" width="7.3" height="10.5" rx="0.9" fill="#c4c4c4" />
          <path d={`M0 ${12.2 - fill}h7.3v${fill - 0.9}a.9.9 0 0 1-.9.9H.9a.9.9 0 0 1-.9-.9Z`} fill="#4a4a4a" />
        </g>
      </svg>
      <span className="ibk-sb-pct">{battery}%</span>
    </span>
  );
}

// 이음새 그림자 색: 바탕이 그라데이션이면 마지막 색(위→아래 그라데이션의 아래끝). 그대로 넣으면 box-shadow 값이 틀려 통째로
// 무시되고, 반 픽셀 이음새로 폰 바탕(검정)이 비쳐 상태바 아래 어두운 1px 줄이 생김 (IBK 전체메뉴: 안드로이드 y 29, iOS y 54)
function seamColor(bg: string) {
  if (!bg.includes("gradient(")) return bg;
  const args = bg.slice(bg.indexOf("(") + 1, bg.lastIndexOf(")")).split(/,(?![^(]*\))/); // 괄호 밖 쉼표로만 나눔
  return args[args.length - 1].trim().replace(/(\s+-?[\d.]+(%|px)?)+$/, ""); // 정지점 위치 떼기
}

function StatusBar() {
  const { bg, fg } = useStatusBarStyle();
  const time = useClock();
  const seam = seamColor(bg);
  // 그라데이션 밑 바탕색도 그 색으로: 아이폰은 바탕색이 200ms 전환이라, 비워 두면(투명) 단색 화면으로 돌아갈 때 검정에서 밝아짐
  const background = seam === bg ? bg : `${bg} ${seam}`;
  return (
    // 콕뱅크: 28px 상태바가 기기 52.5px 에서 끝나 반 픽셀에 어두운 이음새가 생김 → 같은 색 그림자 1px 로 덮음
    <div className={`statusbar statusbar--${fg} statusbar--${OS}`} style={{ background, boxShadow: `0 1px 0 ${seam}` }}>
      <span className="statusbar__time">{time}</span>
      {OS === "ios" ? <IosIcons /> : APP === "ibk" ? <IbkIcons /> : <AndroidIcons />}
    </div>
  );
}

// i-ONE Bank 녹화 기기의 3버튼 내비게이션 바 (Ⅲ 최근 앱 · ▢ 홈 · < 뒤로, 흰 바탕 44dp, 아이콘 #8a8a8a). spec/home.md 2-2 를
// 녹화 정지 프레임에서 다시 잼 (클론 x, 바 위 기준 y): Ⅲ 막대 가운데 77.50 / 83.19 / 88.83, 15.4~29.05, 두께 1.8 (끝 각짐)
// ▢ 선 중심 184.33~197.37 × 15.6~28.75, r 4.4, 1.62 / < 꼭짓점 (295.66, 22.17), 끝 (301.55, 16.1 · 28.2), 1.75 끝 둥글게.
// PC 에서 < 는 앱 안 뒤로가기 (화면이 쌓아 둔 기록 칸 — 시트·이체 단계 — 이 있으면 그것부터)
function NavKeys() {
  const back = () => {
    const st = window.history.state as { idx?: number; ibkBack?: number } | null;
    if ((st?.idx ?? 0) > 0 || (st?.ibkBack ?? 0) > 0) window.history.back();
  };
  return (
    <div className="phone__navbar phone__navbar--keys">
      <svg className="navkeys" width="384" height="44" viewBox="0 0 384 44" fill="none" stroke="currentColor" aria-hidden>
        <path d="M77.5 15.4v13.65M83.19 15.4v13.65M88.83 15.4v13.65" strokeWidth="1.9" />
        <rect x="184.33" y="15.6" width="13.04" height="13.15" rx="4.4" strokeWidth="1.8" />
        <path d="M301.55 16.1 295.66 22.17l5.89 6.03" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <button className="navkey navkey--back" onClick={back} aria-label="뒤로" />
    </div>
  );
}

// overlay: 상태바까지 폰 전체를 덮는 것 (콕뱅크 로딩 막)
export function PhoneFrame({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  const { fg } = useStatusBarStyle();
  // 콕뱅크·하나원큐(갤럭시): 실제 화면처럼 아래 15dp 검은 제스처바 + 회색 손잡이를 따로 둠
  const navbar = OS === "android";
  const recording = useRecorder().status === "recording";
  return (
    <div className={`phone phone--${OS}`}>
      {/* 녹화 중엔 진짜 아이폰처럼 다이나믹 아일랜드 왼쪽에 빨간 녹화 표시 (영상에도 찍힘) */}
      {OS === "ios" && (
        <div className={`dynamic-island${recording ? " dynamic-island--rec" : ""}`}>
          <i />
        </div>
      )}
      <StatusBar />
      <div className="phone__viewport">{children}</div>
      {navbar && APP === "ibk" ? (
        <NavKeys />
      ) : navbar ? (
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
      <IntroToggle />
      <DeviceStatusControls />
      {/* 녹화: 누르면 앱을 처음(시작화면)부터 다시 띄우며 폰 화면만 녹화 */}
      {canRecord() && (
        <button className="os-switch os-switch--rec" onClick={recordPhone}>
          <i />
          녹화
        </button>
      )}
    </div>
  );
}

// 녹화 인트로 on/off: 켜면 녹화 시작할 때 실제 기기 인트로 영상(홈 화면 → 앱 찾기 → 탭)을 먼저 붙여서 녹화
function IntroToggle() {
  const on = useIntro();
  return (
    <nav className="os-switch" title="녹화 인트로 (홈 화면에서 앱 찾아 켜는 영상을 녹화 앞에 이어붙임)">
      <a href="#" className={on ? "on" : ""} onClick={(e) => (e.preventDefault(), setIntro(true))}>
        인트로 켜기
      </a>
      <a href="#" className={!on ? "on" : ""} onClick={(e) => (e.preventDefault(), setIntro(false))}>
        인트로 끄기
      </a>
    </nav>
  );
}

// 배터리 잔량 · 시계(정한 시각부터 흐름) · 실제 시각으로
function DeviceStatusControls() {
  const { battery, offset } = useDeviceStatus();
  const now = useNow();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [draft, setDraft] = useState<string | null>(null); // 시각 입력 중인 값
  return (
    <div className="os-switch os-switch--status">
      <label title="배터리 잔량">
        <span aria-hidden>🔋</span>
        <input type="number" min={0} max={100} value={battery} onChange={(e) => e.target.value !== "" && setBattery(Number(e.target.value))} />%
      </label>
      <label title="상태바 시각 (정한 시각부터 흘러감)">
        <span aria-hidden>🕐</span>
        <input
          type="time"
          value={draft ?? hhmm}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft) setClock(draft);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </label>
      <button className={offset === null ? "on" : ""} onClick={syncClock} title="실제 시각으로 맞추기">
        실제 시간
      </button>
    </div>
  );
}
