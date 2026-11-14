// 이체 끝(S7 → S8) 화면에 넘기는 값 (location.state.send). 확인 화면이 이체를 마치고 replace 로 넘김
export interface SendDoneState {
  kind: "move" | "send"; // 옮기다 / 보내다
  label: string; // 받는 쪽 이름 (내 영하나플러스 통장 · 김철수)
  particle: string; // 으로 / 로 / 님에게
  amount: number;
  outTxId: string; // 내 통장 출금 거래 (메모 남기기)
}
export const SENDING_MIN = 1400; // 보내는 중(S7) 최소 (B 66.708 → 68.108)
export const CHECK_DELAY = 200; // 완료 체크 앞 빈자리
export const readDone = (state: unknown): SendDoneState | null => {
  const s = (state as { send?: SendDoneState } | null)?.send;
  return s && typeof s.amount === "number" && typeof s.outTxId === "string" ? s : null;
};
