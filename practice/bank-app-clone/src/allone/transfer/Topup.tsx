// [기초 단계 자리 — transfer 영역이 이 파일을 진짜 T5 잔액채우기(입금계좌 · 출금계좌 · 금액 · T6 출금계좌 선택 · T7 금액 입력)로 바꿈]
// 지금은 이동 시험용: × = 뒤로. 출금계좌가 있으면 1,000원 채우기 (topupSubmit 막) → origin amount 면 닫고 T2 로, 아니면 그대로 + 토스트
import { useSearchParams } from "react-router-dom";
import { useApi } from "../../api/useApi";
import { aoApi, aoPaths, type AoAccount, type AoHome } from "../api";
import { aoLoad } from "../loading";
import { useAoBack } from "../nav";
import { AoStub } from "../stub";
import { aoToast } from "../toast";

export function Topup() {
  const [params] = useSearchParams();
  const home = useApi<AoHome>(aoPaths.home);
  const back = useAoBack();
  const to = home.data?.accounts.find((a) => a.id === (params.get("to") ?? "main"));
  const from: AoAccount | undefined = home.data?.accounts.find((a) => a.id === params.get("from"));
  const origin = params.get("origin");
  return (
    <AoStub
      title="잔액채우기"
      area="transfer"
      back="close"
      links={
        to && from
          ? [
              {
                label: "1,000원 채우기",
                onPress: () =>
                  aoLoad("topupSubmit", {
                    task: () => aoApi.topup(from.id, to, 1000),
                    onCut: () => {
                      if (origin === "amount") {
                        back();
                        aoToast("잔액을 채웠어요", { bottom: 419 });
                      } else aoToast("잔액을 채웠어요");
                    },
                  }),
              },
            ]
          : []
      }
    >
      <p className="ao-stub__sub">
        {to?.label} ← {from?.label ?? "출금계좌 선택"}
      </p>
    </AoStub>
  );
}
