// 🔔 관리 패널(src/dev-panel/DevPanel.tsx)이 토스 칸에 넘기는 것. run(요청, 성공 메시지) → 성공 여부 (패널이 알림을 띄움)
export type TossRun = (fn: () => Promise<unknown>, success: string) => Promise<boolean>;
