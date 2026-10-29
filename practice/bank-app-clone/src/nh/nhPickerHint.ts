// 은행선택을 '계좌번호 시트의 은행 이름'으로 열었는지 표시 (NhNumberSheet 가 남기고 NhBankPicker 가 읽음).
// 부르는 쪽(NhSend)이 from 을 넘기지 않아도 시트에서 연 경우의 나타나는 시각(돋보기 +85ms 등)을 쓰게
let sheetHintAt = -Infinity;

export function notePickerFromSheet() {
  sheetHintAt = performance.now();
}

// 방금(300ms 안에) 시트에서 열었으면 true
export const openedFromSheet = () => performance.now() - sheetHintAt < 300;
