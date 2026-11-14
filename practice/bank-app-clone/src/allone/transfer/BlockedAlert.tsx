// 지급정지 '안내' 팝업 (AoAlert + 녹화 C3 12.75 · 15.0 과 같은 문구). 언제 띄우는지 · 도우미는 blocked.ts
// 본문 · 오류코드 EFAB03743 · 고객행복센터 번호는 녹화 그대로. 본문 줄바꿈도 녹화처럼 "가 / 까운" — Pretendard 가 iOS 글꼴보다 좁아 저절로는 "가까 / 운" 이 되므로 <br /> 로 박음.
// 오류코드 뒤 긴 번호는 녹화의 형식만 따라 팝업을 열 때 만듦: 기기 시각 yyMMddHHmmss + OEFABINOPT + 숫자 10자리 (녹화의 번호는 그 녹화의 거래 번호라 쓰지 않음)
// enter: 계좌 비밀번호 뒤는 막이 걷히는 프레임에 엶("hidden"), 잔액채우기 · 이체 확인 보내기는 막이 걷히기 33ms 전 막 밑에서 엶("cut")
import { useState } from "react";
import { useDeviceStatus } from "../../platform/deviceStatus";
import { AoAlert } from "../ui";

const p2 = (n: number) => String(n).padStart(2, "0");
function traceNo(offset: number | null) {
  const d = new Date(Date.now() + (offset ?? 0)); // 상태바와 같은 시계 (관리 패널에서 시각을 정했으면 그 시각)
  const stamp = [d.getFullYear() % 100, d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].map(p2).join("");
  const tail = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  return `${stamp}OEFABINOPT${tail}`;
}

export function BlockedAlert({ open, onClose, enter = "hidden" }: { open: boolean; onClose: () => void; enter?: "hidden" | "cut" }) {
  const { offset } = useDeviceStatus();
  // 열릴 때마다 새 번호 (닫히는 동안은 그대로)
  const [shown, setShown] = useState(() => ({ open, no: traceNo(offset) }));
  if (shown.open !== open) setShown({ open, no: open ? traceNo(offset) : shown.no });
  return (
    <AoAlert
      open={open}
      onClose={onClose}
      enter={enter}
      code={
        <>
          (EFAB03743 :
          <br />
          {shown.no})
        </>
      }
      tel={{ label: "고객행복센터", numbers: ["1661-3000", "1522-3000"] }}
    >
      통신사기피해환급법에 따라 출금할 수 없어요. 가
      <br />
      까운 영업점 또는 고객행복센터로 문의해 주세요.
    </AoAlert>
  );
}
