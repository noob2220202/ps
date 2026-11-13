import { TossStub } from "../stub";

// 기초 단계 자리 — A3 transfer 영역이 진짜 화면으로 바꿈. S5 /send/confirm (cut)
export function SendConfirm() {
  return <TossStub title="토스뱅크 송금" area="transfer" links={[{ label: "받는 분에게 표시", to: "/send/memo" }, { label: "보내기", to: "/send/done", replace: true }]} />;
}
