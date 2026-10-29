// 송금 확인 화면에서 X·취소로 돌아오면 콕송금이 '1원을 보낼게요' 단계 그대로 다시 열리게, 이동하기 직전 입력값을 /send 기록에 남겨 둠.
// 단 '받는 분을 다시 입력할게요.'로 돌아올 땐 처음(누구에게 보낼까요?)부터.
import type { Recipient } from "../api/types";

export interface NhSendRestore {
  bankCode: string;
  digits: string;
  to: Recipient;
  amount: number;
  memoTo: string | null;
  memoMe: string;
  memo: string;
}

let fresh = false;
export const sendFromScratchOnReturn = () => {
  fresh = true;
};
// 한 번 읽으면 지워짐
export function takeFresh() {
  const f = fresh;
  fresh = false;
  return f;
}
