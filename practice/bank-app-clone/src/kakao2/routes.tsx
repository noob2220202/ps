import { Route, Routes, type Location } from "react-router-dom";
import { BankAccountScreen } from "../screens/bank/BankAccountScreen";
import { AmountScreen } from "../screens/transfer/AmountScreen";
import { TransferDoneScreen } from "../screens/transfer/TransferDoneScreen";
import { K2AccountScreen } from "./account/K2AccountScreen";
import { K2Home } from "./home/K2Home";
import { K2Inset } from "./K2Inset";
import { K2Transfer } from "./transfer/K2Transfer";
import { K2TxDetail } from "./txdetail/K2TxDetail";

// 카카오뱅크 kakao2 (9115, session.ts KAKAO2): 새 녹화(아이폰)에 나온 화면은 src/kakao2/ 의 K2* 로, 녹화에 없는 화면
// (다른 은행 계좌 · 금액 입력 · 이체 완료)은 카카오뱅크 화면을 그대로 쓰되 K2Inset 으로 감쌈 (상태바 54pt 띠)
export const renderKakao2Route = (location: Location) => (
  <Routes location={location}>
    <Route path="/" element={<K2Home />} />
    <Route path="/account/:accountId" element={<K2AccountScreen />} />
    <Route path="/account/:accountId/history" element={<K2AccountScreen />} />
    <Route path="/account/:accountId/tx/:txId" element={<K2TxDetail />} />
    <Route path="/transfer" element={<K2Transfer />} />
    <Route path="/bank/:accountId" element={<K2Inset><BankAccountScreen /></K2Inset>} />
    <Route path="/transfer/amount" element={<K2Inset><AmountScreen /></K2Inset>} />
    <Route path="/transfer/done" element={<K2Inset><TransferDoneScreen /></K2Inset>} />
  </Routes>
);
