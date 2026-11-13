// [기초 단계 자리 — home 영역이 이 파일을 진짜 전체메뉴(머리줄 · 검색 줄 · AI톡 · 바로가기 · 왼쪽 목록 · 최근 이용메뉴)로 바꿈]
// 지금은 이동 시험용 버튼만. × = 뒤로 (홈은 새로 불러오지 않음)
import { useAoFlow } from "../flow";
import { AoStub } from "../stub";

export function Menu() {
  const flow = useAoFlow();
  return (
    <AoStub
      title="전체메뉴"
      area="home"
      back="close"
      links={[
        { label: "통합검색", onPress: () => flow.goSearch() },
        { label: "거래내역조회", onPress: () => flow.goHistory("main", "menuLink") },
        { label: "계좌이체", onPress: () => flow.goSend({ from: "main", origin: "menu" }) },
        { label: "잔액채우기", onPress: () => flow.goTopup({ to: "main", origin: "menu" }) },
        { label: "홈", onPress: () => flow.goHome() },
      ]}
    />
  );
}
