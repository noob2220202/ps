// [기초 단계 자리 — home 영역이 이 파일을 진짜 🔔 관리 패널 '정기점검 안내' 칸(보이기 · 1쪽 항목 2 × 제목 + 일시 · 날짜 자동 · 1일동안 안보기 지우기)으로 바꿈]
// 관리 패널 기본 탭이 ALLONE 일 때 그림 (src/dev-panel/DevPanel.tsx). 계약: export function NoticePanel({ run, home }: { run: AoPanelRun; home: AoHome })
// run(fn, 성공 문구) = 서버 요청 → 패널 아래 알림 (실패하면 서버 오류 문구). 저장은 aoApi.updateNotice (PATCH /api/profile noticeOn · noticeItems)
import type { AoHome } from "../api";
import { aoApi } from "../api";
import type { AoPanelRun } from "../panel";
import { aoPrefs } from "../prefs";

export function NoticePanel({ run, home }: { run: AoPanelRun; home: AoHome }) {
  const on = home.ao?.notice?.on ?? true;
  return (
    <>
      <h3 className="tab__h">정기점검 안내</h3>
      <div className="row">
        <button className="btn btn--sm" onClick={() => run(() => aoApi.updateNotice({ noticeOn: !on }), on ? "정기점검 안내를 껐어요" : "정기점검 안내를 켰어요")}>
          {on ? "안 보이게" : "보이게"}
        </button>
        <button className="btn btn--sm" onClick={() => run(async () => aoPrefs.clearNoticeSnooze(), "1일동안 안보기를 지웠어요")}>
          1일동안 안보기 지우기
        </button>
      </div>
    </>
  );
}
