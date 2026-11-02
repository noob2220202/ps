import { useSyncExternalStore } from "react";
import { RESTART_EVENT } from "../platform/recorder";

// 이번 실행에서 마친 이체 (KbankDone 이 '보내는 중이에요' 끝 무렵에 알림). 녹화:
//  - 홈 종 뱃지가 295 → 296 (F560 · F1290) → KbankHome 이 295 + count
//  - 상태바 왼쪽에 케이뱅크 'K' 알림 아이콘이 '보냈어요' 0.22초 전(38.20초)에 생기고, 받는 은행이 카카오뱅크면 0.63초 뒤(38.83초) 'B' 가
//    그 앞에 붙어 끝까지 남음 (PhoneFrame KbankNotifs)
// '● 녹화' 를 새로 시작하면(RESTART_EVENT) 처음 상태로
type Sent = { count: number; kakao: boolean };
const EMPTY: Sent = { count: 0, kakao: false };
const B_MS = 630;
let sent = EMPTY;
let bTimer = 0;
const listeners = new Set<() => void>();
const emit = (next: Sent) => {
  sent = next;
  listeners.forEach((fn) => fn());
};
export function noteKbankSent(bankCode: string) {
  emit({ ...sent, count: sent.count + 1 });
  if (bankCode === "kakao" && !sent.kakao) {
    clearTimeout(bTimer);
    bTimer = window.setTimeout(() => emit({ ...sent, kakao: true }), B_MS);
  }
}
export const useKbankSent = () =>
  useSyncExternalStore(
    (fn) => (listeners.add(fn), () => void listeners.delete(fn)),
    () => sent,
  );
window.addEventListener(RESTART_EVENT, () => {
  clearTimeout(bTimer);
  emit(EMPTY);
});
