// LOAD 빈 화면 + "잠시만 기다려주세요." 상자 그림 (상태는 loading.ts). TossOverlay 가 폰 화면 위에 한 번 그림
//  LOAD: 상태바 아래(28–853.33) #171619 + 회색 스피너 ⌀30 가운데 (192, 433). 아래 내비 띠는 그 위에 그대로
//  상자: x 10–374 · y 418–496, 모서리 20, #1f1e21, 파란 원호 ⌀20 (x 48–66) + "잠시만 기다려주세요." 15 R (x 96)
import { useTossLoading } from "../loading";
import { TossSpinner } from "./Spinner";

export function TossLoadingLayer() {
  const { load, wait } = useTossLoading();
  return (
    <>
      {load !== null && (
        <div className="toss-load" aria-busy="true">
          <TossSpinner className="toss-load__spin" />
        </div>
      )}
      {wait !== null && (
        <div className="toss-wait" role="status">
          <TossSpinner variant="blue" className="toss-wait__spin" />
          <span className="toss-wait__text">잠시만 기다려주세요.</span>
        </div>
      )}
    </>
  );
}
