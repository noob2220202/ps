// 임시(stub): kakao2 거래상세 화면이 만들어지면 이 파일 내용을 바꿈 (경로 · 이름 · props 는 그대로). 지금은 카카오뱅크 거래 상세를 K2Inset(54pt 띠)으로 감쌈 — 새 화면은 y 0 부터 직접 그리므로 K2Inset 없이
import { TxDetailScreen } from "../../screens/tx/TxDetailScreen";
import { K2Inset } from "../K2Inset";

export function K2TxDetail() {
  return (
    <K2Inset>
      <TxDetailScreen />
    </K2Inset>
  );
}
