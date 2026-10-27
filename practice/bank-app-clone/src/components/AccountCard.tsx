import type { Account } from "../types/bank";

// SPEC.md의 "Home 화면 > 계좌 카드" 참고
// 요구사항:
// - 즐겨찾기(isStarred) 계좌는 손흔드는 이모지 + 별 뱃지 + 밝은 배경으로 강조
// - 잔액은 천단위 콤마 + "원" 포맷 (예: 452,300원)
// - 오른쪽에 "이체" 버튼 (pill 모양)
// - 클릭하면 계좌 상세 페이지로 이동 (onClick prop 사용)

interface AccountCardProps {
  account: Account;
  onClick?: () => void;
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  return <div onClick={onClick}>TODO: AccountCard 구현 ({account.nickname})</div>;
}
