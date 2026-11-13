import { useEffect } from "react";
import { useTossFlow } from "../flow";
import { TossStub } from "../stub";
import { tossToastReady } from "../toast";

// 기초 단계 자리 — A2 account 영역이 진짜 화면으로 바꿈. /bank/:accountId — 통장 + 긴 상품 메뉴.
// 내용이 그려지면 toast.ts tossToastReady() 를 부를 것 (홈에서 올 때의 "토스뱅크로 이동했어요" 가 그 100ms 뒤 나감)
export function BankScreen() {
  const { goSend } = useTossFlow();
  useEffect(() => {
    tossToastReady();
  }, []);
  return (
    <TossStub
      title="토스뱅크 통장"
      area="account"
      links={[
        { label: "거래내역", to: "/bank/main/history" },
        { label: "보내기 (LOAD → 송금)", onPress: () => goSend({ from: "main" }) },
      ]}
    />
  );
}
