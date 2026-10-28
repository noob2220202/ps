import { useCallback, useState } from "react";
import { Route, Routes, type Location } from "react-router-dom";
import { OsSwitch, PhoneFrame } from "./components/PhoneFrame";
import { RecordingBar } from "./components/RecordingBar";
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
import { prefetch } from "./api/useApi";
import { paths } from "./api/endpoints";

type Boot = "pick" | "splash" | "loading" | "ready";

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

  return (
    <StatusBarProvider>
      <PhoneFrame>
        {boot === "pick" && <ProfilePicker onEnter={toSplash} />}
        {boot === "splash" && (APP === "nh" ? <NhSplash onDone={toReady} /> : <Splash onDone={toLoading} />)}
        {boot === "loading" && <BootLoading onDone={toReady} />}
        {boot === "ready" && <ScreenStack render={APP === "nh" ? renderNhRoute : renderRoute} />}
        {APP === "nh" && <NhLoadingLayer />}
      </PhoneFrame>
      <OsSwitch />
      <RecordingBar />
    </StatusBarProvider>
  );
}
