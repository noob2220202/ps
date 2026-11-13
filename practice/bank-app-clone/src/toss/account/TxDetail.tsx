import { TossStub } from "../stub";

// 기초 단계 자리 — A2 account 영역이 진짜 화면으로 바꿈. /tx/:txId
// '증명서 발급하기' 는 state { certDepth: 1 } 로 /cert (증명서 흐름의 '확인했어요' 가 history.go(-certDepth) 로 여기로 돌아옴)
export function TxDetail() {
  return <TossStub title="상세 내역" area="account" links={[{ label: "증명서 발급하기", to: "/cert", state: { certDepth: 1 } }]} />;
}
