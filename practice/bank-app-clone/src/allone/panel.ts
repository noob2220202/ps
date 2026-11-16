// 🔔 관리 패널(src/dev-panel/DevPanel.tsx)이 allone 칸(home/NoticePanel.tsx 등)에 넘기는 것
// run(fn, 성공 문구): 서버 요청을 하고 패널 아래에 결과 알림 (실패하면 서버가 준 오류 문구). 성공하면 true
export type AoPanelRun = (fn: () => Promise<unknown>, success: string) => Promise<boolean>;
