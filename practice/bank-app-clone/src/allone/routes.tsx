import { Route, Routes, type Location } from "react-router-dom";
// 공용 CSS 를 화면 모듈보다 먼저: 번들에서 영역 CSS 가 뒤에 오므로 같은 특이도면 영역 규칙이 이김 (.ao-switch 를 클래스 하나로 옮기는 것 등)
import "./allone.css";
import "./ui/ui.css";
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
import { DisputeIntro } from "./dispute/DisputeIntro";
import { DisputeCheck } from "./dispute/DisputeCheck";
import { BranchSearch } from "./dispute/BranchSearch";
import { AoGallery } from "./ui/Gallery";

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
    {/* 이의제기 신청 및 조회 (통합검색 '이의제기' → 결과, 녹화 C3 42.4– · C4 0–12.4). 본인인증부터는 만들지 않음 — 확인 화면 '다음'은 더 진행하지 않음 */}
    <Route path="/dispute" element={<DisputeIntro />} />
    <Route path="/dispute/check" element={<DisputeCheck />} />
    <Route path="/dispute/branch" element={<BranchSearch />} />
    {/* 공용 부품 견본 (녹화에 없음, 기초 단계 확인용) */}
    <Route path="/dev/ui" element={<AoGallery />} />
  </Routes>
);
