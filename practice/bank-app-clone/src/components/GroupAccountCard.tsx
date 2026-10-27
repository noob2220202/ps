import type { GroupAccount } from "../types/bank";

// SPEC.md의 "Home 화면 > 모임 관리" 참고 (보너스 과제)
// 요구사항: 모임 이름, 멤버 수, 회비 미납 인원이 있으면 안내 문구 표시

interface GroupAccountCardProps {
  group: GroupAccount;
}

export function GroupAccountCard({ group }: GroupAccountCardProps) {
  return <div>TODO: GroupAccountCard 구현 ({group.name})</div>;
}
