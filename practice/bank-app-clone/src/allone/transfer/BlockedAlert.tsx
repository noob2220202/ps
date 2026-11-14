// 지급정지 '안내' 팝업 (AoAlert + 새로 쓴 문구). 언제 띄우는지 · 도우미는 blocked.ts
// 문구는 녹화와 다르게 새로 씀 — 본문 두 줄 · 빨간 줄 두 줄을 문장 단위로 끊어 녹화와 같은 높이 (낱말 가운데서 안 끊김). 코드 · 고객센터 번호는 지어낸 값
// enter: 계좌 비밀번호 뒤는 막이 걷히는 프레임에 엶("hidden"), 잔액채우기 · 이체 확인 보내기는 막이 걷히기 33ms 전 막 밑에서 엶("cut")
import { AoAlert } from "../ui";

export function BlockedAlert({ open, onClose, enter = "hidden" }: { open: boolean; onClose: () => void; enter?: "hidden" | "cut" }) {
  return (
    <AoAlert
      open={open}
      onClose={onClose}
      enter={enter}
      code={
        <>
          오류코드 : AOE00403
          <br />
          지급정지 계좌 출금 제한
        </>
      }
      tel={{ label: "고객센터", numbers: ["0000-0000", "0000-0001"] }}
    >
      지급정지된 계좌는 출금이 제한돼요.
      <br />
      영업점이나 고객센터로 문의해 주세요.
    </AoAlert>
  );
}
