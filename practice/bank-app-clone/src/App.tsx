import { useCallback, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { PhoneFrame } from "./components/PhoneFrame";
import { StatusBarProvider } from "./hooks/useStatusBar";
import { Splash } from "./screens/boot/Splash";
import { BootLoading } from "./screens/boot/BootLoading";
import { HomeScreen } from "./screens/home/HomeScreen";
import { AccountDetailScreen } from "./screens/account/AccountDetailScreen";
import { HistoryScreen } from "./screens/history/HistoryScreen";
import { TxDetailScreen } from "./screens/tx/TxDetailScreen";
import { MiniScreen } from "./screens/mini/MiniScreen";

type Boot = "splash" | "loading" | "ready";

// 개발 중 매번 스플래시 보기 귀찮으면 주소 뒤에 ?skip
const skipSplash = new URLSearchParams(location.search).has("skip");

export default function App() {
  const [boot, setBoot] = useState<Boot>(skipSplash ? "ready" : "splash");
  // onDone이 렌더마다 새 함수면 Splash의 effect가 다시 돌아서 타이머가 리셋됨 → useCallback
  const toLoading = useCallback(() => setBoot("loading"), []);
  const toReady = useCallback(() => setBoot("ready"), []);

  return (
    <StatusBarProvider>
      <PhoneFrame>
        {boot === "splash" && <Splash onDone={toLoading} />}
        {boot === "loading" && <BootLoading onDone={toReady} />}
        {boot === "ready" && (
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/account/:accountId" element={<AccountDetailScreen />} />
            <Route path="/account/:accountId/history" element={<HistoryScreen />} />
            <Route path="/account/:accountId/tx/:txId" element={<TxDetailScreen />} />
            <Route path="/mini" element={<MiniScreen />} />
          </Routes>
        )}
      </PhoneFrame>
    </StatusBarProvider>
  );
}
