import { Route, Routes, type Location } from "react-router-dom";
import { AdCoupon } from "./home/AdCoupon";
import { AdPayback } from "./home/AdPayback";
import { AllMenu } from "./home/AllMenu";
import { TabPlaceholder } from "./home/TabPlaceholder";
import { TossHome } from "./home/TossHome";
import { BankScreen } from "./account/BankScreen";
import { History } from "./account/History";
import { OtherAccount } from "./account/OtherAccount";
import { TxDetail } from "./account/TxDetail";
import { SendAmount } from "./transfer/SendAmount";
import { SendConfirm } from "./transfer/SendConfirm";
import { SendDone } from "./transfer/SendDone";
import { SendMemo } from "./transfer/SendMemo";
import { SendNumber } from "./transfer/SendNumber";
import { SendWho } from "./transfer/SendWho";
import { CertAccount } from "./cert/CertAccount";
import { CertDoc } from "./cert/CertDoc";
import { CertDone } from "./cert/CertDone";
import { CertHome } from "./cert/CertHome";
import { CertIntro } from "./cert/CertIntro";
import { CertIssuing } from "./cert/CertIssuing";
import { CertItems } from "./cert/CertItems";
import { CertMethod } from "./cert/CertMethod";
import { Assets } from "./assets/Assets";
import { MyAccounts } from "./assets/MyAccounts";
import { Spend } from "./assets/Spend";
import { UiGallery } from "./UiGallery";
import "./toss.css";
import "./ui/ui.css";
import "./nav.css";

// 토스 (APP=toss 로 띄운 서버, 9117). 화면 표는 plan.md §1.1, 전환은 nav.ts tossAnimFor. 데이터도 따로 (server/data-toss)
// 주소가 다른 앱과 겹쳐도 됨 (서버 하나는 앱 하나만). 증명서 문서(/cert/doc)는 /cert/transfer/ 밖에 둠 ('증명서 단계'는 앞부분으로 가림)
export const renderTossRoute = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<TossHome />} />
    <Route path="/tab/all" element={<AllMenu />} />
    <Route path="/tab/:tab" element={<TabPlaceholder />} />
    <Route path="/ad/coupon" element={<AdCoupon />} />
    <Route path="/ad/payback" element={<AdPayback />} />
    <Route path="/bank/:accountId" element={<BankScreen />} />
    <Route path="/bank/:accountId/history" element={<History />} />
    <Route path="/tx/:txId" element={<TxDetail />} />
    <Route path="/account/:accountId" element={<OtherAccount />} />
    <Route path="/send" element={<SendWho />} />
    <Route path="/send/number" element={<SendNumber />} />
    <Route path="/send/amount" element={<SendAmount />} />
    <Route path="/send/confirm" element={<SendConfirm />} />
    <Route path="/send/memo" element={<SendMemo />} />
    <Route path="/send/done" element={<SendDone />} />
    <Route path="/cert" element={<CertHome />} />
    <Route path="/cert/transfer" element={<CertIntro />} />
    <Route path="/cert/transfer/account" element={<CertAccount />} />
    <Route path="/cert/transfer/items" element={<CertItems />} />
    <Route path="/cert/transfer/method" element={<CertMethod />} />
    <Route path="/cert/transfer/issuing" element={<CertIssuing />} />
    <Route path="/cert/transfer/done" element={<CertDone />} />
    <Route path="/cert/doc" element={<CertDoc />} />
    <Route path="/spend" element={<Spend />} />
    <Route path="/assets" element={<Assets />} />
    <Route path="/assets/accounts" element={<MyAccounts />} />
    {/* 공용 부품 견본 (녹화에 없음, 기초 단계 확인용) */}
    <Route path="/dev/ui" element={<UiGallery />} />
  </Routes>
);
