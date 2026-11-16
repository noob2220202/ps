// 전체메뉴 · 통합검색 줄 → 만든 화면 (plan §1.6): 거래내역조회 · 전체계좌조회 · 이체내역 → 거래내역조회 (첫 NH 계좌),
// 계좌이체 → 누구에게 보낼까요 (origin menu), 잔액채우기 → 잔액채우기 (origin menu). 모두 menuLink 막 뒤 이동, 최근 이용메뉴에 기록
import { useApi } from "../../api/useApi";
import { aoPaths, isAoNh, type AoHome } from "../api";
import { aoVisit, useAoFlow } from "../flow";
import type { AoMenuLink } from "./content";

export function useMenuLink() {
  const flow = useAoFlow();
  const home = useApi<AoHome>(aoPaths.home);
  const main = home.data?.accounts.find(isAoNh)?.id ?? "main";
  return (link: AoMenuLink | undefined) => {
    if (!link) return;
    aoVisit(link);
    if (link === "history") void flow.goHistory(main, "menuLink");
    else if (link === "send") void flow.goSend({ from: main, origin: "menu" });
    else void flow.goTopup({ to: main, origin: "menu" });
  };
}
