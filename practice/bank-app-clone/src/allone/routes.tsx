import { Route, Routes, type Location } from "react-router-dom";
import { Home } from "./home/Home";
import { Menu } from "./home/Menu";
import { Search } from "./home/Search";
import { History } from "./account/History";
import { TxDetail } from "./account/TxDetail";
import { SendWho } from "./transfer/SendWho";
import { SendAmount } from "./transfer/SendAmount";
import { SendConfirm } from "./transfer/SendConfirm";
import { SendDone } from "./transfer/SendDone";
import { Topup } from "./transfer/Topup";
import { AoGallery } from "./ui/Gallery";
import "./allone.css";
import "./ui/ui.css";

// NH올원뱅크 (APP=allone 으로 띄운 서버, 9119). 화면 표는 plan.md §1.2 — 화면 사이는 모두 CUT (ScreenStack allone 갈래),
// 기다림은 로딩 막 프로필 (nav.ts LOAD · flow.ts). 데이터도 따로 (server/data-allone). 주소가 다른 앱과 겹쳐도 됨 (서버 하나는 앱 하나만)
// 시작 흐름(흰 화면 · 스플래시 · 간편비밀번호 · 로그인 로딩)은 주소가 아니라 App.tsx 의 boot "splash" (launch/AlloneSplash.tsx)
export const renderAlloneRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<Home />} />
    <Route path="/menu" element={<Menu />} />
    <Route path="/search" element={<Search />} />
    <Route path="/history/:accountId" element={<History />} />
    <Route path="/tx/:txId" element={<TxDetail />} />
    <Route path="/send" element={<SendWho />} />
    <Route path="/send/amount" element={<SendAmount />} />
    <Route path="/send/confirm" element={<SendConfirm />} />
    <Route path="/send/done" element={<SendDone />} />
    <Route path="/topup" element={<Topup />} />
    {/* 공용 부품 견본 (녹화에 없음, 기초 단계 확인용) */}
    <Route path="/dev/ui" element={<AoGallery />} />
  </Routes>
);
