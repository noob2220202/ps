import { useCallback, useEffect, useState } from "react";
import { Route, Routes, useNavigate, type Location } from "react-router-dom";
import { OsSwitch, PhoneFrame } from "./components/PhoneFrame";
import { FakeCursor, RecordingBar } from "./components/RecordingBar";
import { ScreenStack } from "./components/ScreenStack";
import { StatusBarProvider } from "./hooks/useStatusBar";
import { ProfilePicker } from "./profile/ProfilePicker";
import { currentProfileId } from "./profile/session";
import { IbkLoadingLayer } from "./ibk/common";
import { IbkSplash } from "./ibk/IbkSplash";
import { IbkHome } from "./ibk/IbkHome";
import { IbkSend } from "./ibk/IbkSend";
import { IbkDone } from "./ibk/IbkDone";
import { IbkHistory } from "./ibk/IbkHistory";
import { IbkMenu } from "./ibk/IbkMenu";
import { IbkResults } from "./ibk/IbkResults";
import { IbkCertificate } from "./ibk/IbkCertificate";
import { prefetch } from "./api/useApi";
import { paths } from "./api/endpoints";
import { RESTART_EVENT } from "./platform/recorder";
import { checkAuth, useAuth } from "./auth/auth";
import { LoginScreen } from "./auth/LoginScreen";
import { useStatusBar } from "./hooks/useStatusBar";

type Boot = "off" | "pick" | "splash" | "loading" | "ready";

// IBK기업은행 i-ONE Bank (단독 앱). 거래 상세는 거래내역 화면 위 시트, 이체확인증은 이체결과조회에서 들어감
const renderIbkRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<IbkHome />} />
    <Route path="/send" element={<IbkSend />} />
    <Route path="/send/done" element={<IbkDone />} />
    <Route path="/history/:accountId" element={<IbkHistory />} />
    <Route path="/menu" element={<IbkMenu />} />
    <Route path="/results" element={<IbkResults />} />
    <Route path="/results/:transferId" element={<IbkCertificate />} />
  </Routes>
);

// 개발 중 매번 스플래시 보기 귀찮으면 주소 뒤에 ?skip
const skipSplash = new URLSearchParams(location.search).has("skip");

export default function App() {
  // 이번 세션에 고른 프로필이 없으면 프로필 고르기부터
  const [boot, setBoot] = useState<Boot>(!currentProfileId() ? "pick" : skipSplash ? "ready" : "splash");
  const toSplash = useCallback(() => {
    prefetch(paths.home); // 스플래시 도는 동안 그 프로필의 홈 데이터를 미리 받아 둠
    setBoot(skipSplash ? "ready" : "splash");
  }, []);
  // onDone이 렌더마다 새 함수면 Splash의 effect가 다시 돌아서 타이머가 리셋됨 → useCallback
  const toReady = useCallback(() => setBoot("ready"), []);
  // 로그인: 켜질 때 확인 → 안 돼 있으면 로그인 화면. 로그인하면 (다른 계정일 수 있으니) 프로필 고르기부터
  const auth = useAuth();
  const userId = auth.status === "in" ? auth.user.id : null;
  useEffect(() => {
    checkAuth();
  }, []);
  const [seenUser, setSeenUser] = useState<string | null | undefined>(undefined);
  if (userId !== seenUser) {
    if (seenUser !== undefined && userId) setBoot(currentProfileId() ? boot : "pick"); // 방금 로그인
    setSeenUser(userId);
  }
  // 녹화 시작: 검은 화면(off) → (인트로 영상, 켜 뒀으면) → 앱을 처음부터 (시작화면). 녹화에 앱이 켜지는 모습까지 찍히게
  const navigate = useNavigate();
  useEffect(() => {
    const onRestart = (e: Event) => {
      if ((e as CustomEvent).detail === "off") {
        navigate("/", { replace: true });
        setBoot("off");
      } else {
        prefetch(paths.home);
        setBoot(currentProfileId() ? "splash" : "pick");
      }
    };
    window.addEventListener(RESTART_EVENT, onRestart);
    return () => window.removeEventListener(RESTART_EVENT, onRestart);
  }, [navigate]);

  return (
    <StatusBarProvider>
      <PhoneFrame overlay={<IbkLoadingLayer />}>
        {auth.status === "checking" && <PhoneOff />}
        {auth.status === "out" && <LoginScreen message={auth.message} />}
        {auth.status === "in" && boot === "off" && <PhoneOff />}
        {auth.status === "in" && boot === "pick" && <ProfilePicker onEnter={toSplash} />}
        {auth.status === "in" && boot === "splash" && <IbkSplash onDone={toReady} />}
        {auth.status === "in" && boot === "ready" && <ScreenStack render={renderIbkRoute} />}
      </PhoneFrame>
      <OsSwitch />
      <RecordingBar />
      <FakeCursor />
    </StatusBarProvider>
  );
}

// 앱이 꺼진 상태 (녹화 시작 직전): 검은 화면
function PhoneOff() {
  useStatusBar("#000000", "light");
  return <div style={{ position: "absolute", inset: 0, background: "#000" }} />;
}
