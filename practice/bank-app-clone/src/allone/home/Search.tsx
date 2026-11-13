// [기초 단계 자리 — home 영역이 이 파일을 진짜 통합검색(검색 칸 · 자동완성 · 인기 검색어 · 결과 · iOS 키보드)으로 바꿈]
// 지금은 이동 시험용 버튼만. × = 뒤로 (전체메뉴로)
import { useAoFlow } from "../flow";
import { AoStub } from "../stub";

export function Search() {
  const flow = useAoFlow();
  return (
    <AoStub
      title="통합검색"
      area="home"
      back="close"
      links={[
        { label: "거래내역조회", onPress: () => flow.goHistory("main", "menuLink") },
        { label: "계좌이체", onPress: () => flow.goSend({ from: "main", origin: "menu" }) },
        { label: "잔액채우기", onPress: () => flow.goTopup({ to: "main", origin: "menu" }) },
      ]}
    />
  );
}
