// 영상에서 프레임 단위로 잰 타이밍(ms). 값만 바꿔서 속도 조절 가능.
export const TIMING = {
  splash: {
    launch: 350, // 아이콘이 화면 전체로 커지는 시간
    logoIn: 700, // B 로고 등장 시점
    wordmarkIn: 1700, // B가 작아지며 워드마크+광고 등장 시점
    end: 4300,
  },
  bootLoading: 1400, // 검은 화면 + 스피너 (영상은 약 5초, 네트워크 대기)
  homeSecondWave: 450, // 홈 1차 렌더 후 광고/AI배너/카드 섹션이 끼어드는 시점
  balanceResolve: 700, // 타행 계좌 잔액 "?원" → 실제 값
  pillSpinner: 450, // AI 배너 문구 바뀌기 전 스피너
  typeSpeed: 45, // 글자당 타이핑 속도
  apiLatency: 420, // 화면 데이터 로딩(스켈레톤 노출 시간)
  pressDelay: 300, // 계좌 눌렀을 때 스피너 돈 뒤 이동
  nav: { android: 240, ios: 420 }, // 화면 전환 (iOS push는 더 길고 스프링 느낌)
  swipeRelease: 260, // 스와이프 뒤로가기 손 뗀 뒤 마무리 애니메이션
};
