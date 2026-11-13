import { TossStub } from "../stub";

// 기초 단계 자리 — A3 transfer 영역이 진짜 화면으로 바꿈. S1 /send?from=
export function SendWho() {
  return <TossStub title="어디로 보낼까요?" area="transfer" links={[{ label: "계좌번호 입력", to: "/send/number" }, { label: "금액 (예시)", to: "/send/amount?to=hana" }]} />;
}
