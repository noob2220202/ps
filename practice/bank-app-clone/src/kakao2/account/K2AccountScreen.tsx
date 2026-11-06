// 임시(stub): kakao2 통장(거래내역) 화면이 만들어지면 이 파일 내용을 바꿈 (경로 · 이름 · props 는 그대로).
// 지금은 카카오뱅크 화면: /account/:id = 계좌 화면, /account/:id/history = 거래내역 (새 화면은 두 주소 모두 같은 화면).
// K2Inset(54pt 띠)으로 감쌈 — 새 화면은 y 0 부터 직접 그리므로 K2Inset 없이
import { useMatch } from "react-router-dom";
import { AccountDetailScreen } from "../../screens/account/AccountDetailScreen";
import { HistoryScreen } from "../../screens/history/HistoryScreen";
import { K2Inset } from "../K2Inset";

export function K2AccountScreen() {
  const history = useMatch("/account/:accountId/history");
  return <K2Inset>{history ? <HistoryScreen /> : <AccountDetailScreen />}</K2Inset>;
}
