import { useCallback, useEffect, useState } from "react";
import { Route, Routes, useNavigate, type Location } from "react-router-dom";
import { OsSwitch, PhoneFrame } from "./components/PhoneFrame";
import { FakeCursor, RecordingBar } from "./components/RecordingBar";
import { ScreenStack } from "./components/ScreenStack";
import { StatusBarProvider } from "./hooks/useStatusBar";
import { Splash } from "./screens/boot/Splash";
import { BootLoading } from "./screens/boot/BootLoading";
import { HomeScreen } from "./screens/home/HomeScreen";
import { AccountDetailScreen } from "./screens/account/AccountDetailScreen";
import { HistoryScreen } from "./screens/history/HistoryScreen";
import { TxDetailScreen } from "./screens/tx/TxDetailScreen";
import { BankAccountScreen } from "./screens/bank/BankAccountScreen";
import { TransferScreen } from "./screens/transfer/TransferScreen";
import { AmountScreen } from "./screens/transfer/AmountScreen";
import { TransferDoneScreen } from "./screens/transfer/TransferDoneScreen";
import { ProfilePicker } from "./profile/ProfilePicker";
import { APP, currentProfileId } from "./profile/session";
import { NhSplash } from "./nh/NhSplash";
import { NhLoadingLayer } from "./nh/common";
import { NhHome } from "./nh/NhHome";
import { NhSend } from "./nh/NhSend";
import { NhConfirm } from "./nh/NhConfirm";
import { NhDone } from "./nh/NhDone";
import { NhAccounts, NhRegister } from "./nh/NhAccounts";
import { NhHistory } from "./nh/NhHistory";
import { NhTxDetail } from "./nh/NhTxDetail";
import "./nh/nh-light.css"; // 콕뱅크 라이트모드 (화면 CSS 뒤에)
import { HanaSplash } from "./hana/HanaSplash";
import { HanaHome } from "./hana/HanaHome";
import { HanaSend } from "./hana/HanaSend";
import { HanaDone } from "./hana/HanaDone";
import { HanaHistory } from "./hana/HanaHistory";
import { HanaTxDetail } from "./hana/HanaTxDetail";
import { prefetch } from "./api/useApi";
import { paths } from "./api/endpoints";
import { RESTART_EVENT } from "./platform/recorder";
import { checkAuth, useAuth } from "./auth/auth";
import { LoginScreen } from "./auth/LoginScreen";
import { useStatusBar } from "./hooks/useStatusBar";

type Boot = "off" | "pick" | "splash" | "loading" | "ready";

// ScreenStack이 화면마다 "그 화면의 주소"로 이 함수를 불러서 그린다
const renderRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<HomeScreen />} />
    <Route path="/account/:accountId" element={<AccountDetailScreen />} />
    <Route path="/account/:accountId/history" element={<HistoryScreen />} />
    <Route path="/account/:accountId/tx/:txId" element={<TxDetailScreen />} />
    <Route path="/bank/:accountId" element={<BankAccountScreen />} />
    <Route path="/transfer" element={<TransferScreen />} />
    <Route path="/transfer/amount" element={<AmountScreen />} />
    <Route path="/transfer/done" element={<TransferDoneScreen />} />
  </Routes>
);

// NH 콕뱅크 (APP=nh 로 띄운 서버, 9103). 데이터도 카카오뱅크와 따로
const renderNhRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<NhHome />} />
    <Route path="/send" element={<NhSend />} />
    <Route path="/send/confirm" element={<NhConfirm />} />
    <Route path="/send/done" element={<NhDone />} />
    <Route path="/accounts" element={<NhAccounts />} />
    <Route path="/register" element={<NhRegister />} />
    <Route path="/history/:accountId" element={<NhHistory />} />
    <Route path="/tx/:txId" element={<NhTxDetail />} />
  </Routes>
);

// 하나원큐 (APP=hana 로 띄운 서버, 9105). 데이터도 따로
const renderHanaRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<HanaHome />} />
    <Route path="/send" element={<HanaSend />} />
    <Route path="/send/done" element={<HanaDone />} />
    <Route path="/history/:accountId" element={<HanaHistory />} />
    <Route path="/tx/:txId" element={<HanaTxDetail />} />
  </Routes>
);
const ROUTES = { kakao: renderRoute, nh: renderNhRoute, hana: renderHanaRoute };

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
  const toLoading = useCallback(() => setBoot("loading"), []);
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
  // 녹화 시작: 검은 화면(off) → 앱을 처음부터 (시작화면). 녹화에 앱이 켜지는 모습까지 찍히게
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
      <PhoneFrame overlay={APP === "nh" ? <NhLoadingLayer /> : undefined}>
        {auth.status === "checking" && <PhoneOff />}
        {auth.status === "out" && <LoginScreen message={auth.message} />}
        {auth.status === "in" && boot === "off" && <PhoneOff />}
        {auth.status === "in" && boot === "pick" && <ProfilePicker onEnter={toSplash} />}
        {auth.status === "in" &&
          boot === "splash" &&
          (APP === "nh" ? <NhSplash onDone={toReady} /> : APP === "hana" ? <HanaSplash onDone={toReady} /> : <Splash onDone={toLoading} />)}
        {auth.status === "in" && boot === "loading" && <BootLoading onDone={toReady} />}
        {auth.status === "in" && boot === "ready" && <ScreenStack render={ROUTES[APP]} />}
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
