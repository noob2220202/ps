// 지급정지 계좌에서 보낼 때의 '안내' 팝업을 언제 띄우는지 · 도우미 (팝업은 BlockedAlert.tsx, 모양 · 시각은 ui/Alert.tsx). 녹화 C3 12.713–19.479 잔액채우기 · 33.229–33.996 계좌 비밀번호 뒤
//  - T2 계좌 비밀번호 4번째 숫자: password 막 동안 출금계좌를 새로 받아 보고(캐시 없이) 지급정지면 막이 걷히는 프레임에 팝업 (이체 확인으로 안 감)
//  - 이체 확인 보내기 · 잔액채우기: 서버 403 ACCOUNT_BLOCKED → 막이 걷히기 33ms 전(cut)에 팝업
import { ApiError } from "../../api/client";
import { aoFetch } from "../api";

// T2 가 미리 확인해서 막을 때 던지는 것 (서버 403 과 같게 다룸)
export class AoBlockedError extends Error {
  constructor() {
    super("지급정지된 계좌라 출금할 수 없어요");
  }
}
export const isAoBlocked = (e: unknown) => e instanceof AoBlockedError || (e instanceof ApiError && e.code === "ACCOUNT_BLOCKED");

// 출금계좌를 새로 받아 지급정지인지 봄 (useApi 캐시를 거치지 않는 GET, client.ts 가 no-store)
export const checkNotBlocked = (accountId: string) =>
  aoFetch.account(accountId).then((a) => {
    if (a.blocked) throw new AoBlockedError();
  });

// 팝업을 닫은 뒤 T2 키패드 판이 다시 들어오기까지 (C3 33.996 팝업 사라짐 → 34.079 T2 배치가 바뀌며 판이 올라오기 시작 = 5프레임).
// 팝업이 사라지는 프레임의 rAF 부터 세는 타이머: 75ms 에 바꾸면 그다음 프레임(+83.3)에 그려짐 (프레임 경계 사이 가운데쯤이라 흔들려도 같은 프레임)
export const BLOCKED_PANEL_DELAY = 75;

// ---------- T5 에서 닫으면 밑의 T2 판이 T5 위로 ----------
// 녹화(C3 19.479–19.663): 잔액채우기 화면의 '안내'를 닫으면 밑에 숨어 있던 T2 키패드 판이 잔액채우기 화면 위로 올라와 그대로 남음
// (네이티브 판이 웹 팝업이 닫힐 때 다시 보이는 것). 잔액채우기를 닫고 T2 로 돌아오면 판은 사라졌다가 늘 하던 대로 다시 들어옴
const overListeners = new Set<() => void>();
export const onPanelOverTopup = (fn: () => void) => {
  overListeners.add(fn);
  return () => void overListeners.delete(fn);
};
export const showPanelOverTopup = () => overListeners.forEach((fn) => fn());
