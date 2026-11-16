// 🔔 관리 패널 기본 탭의 '정기점검 안내' 칸 (plan §2.6, ALLONE 일 때 src/dev-panel/DevPanel.tsx 가 그림).
//  - 보이기 / 안 보이게 (서버 profile.noticeOn)
//  - 1쪽 항목 2개 (제목 ≤ 30 · 일시 ≤ 40) 저장 — 서버 profile.noticeItems. '날짜 자동' = null (오늘로 계산한 기본 문구)
//  - 1일동안 안보기 지우기 (이 브라우저에만 저장된 값)
// run(fn, 성공 문구) = 서버 요청 → 패널 아래 알림. 저장은 aoApi.updateNotice (PATCH /api/profile noticeOn · noticeItems)
import { useState } from "react";
import type { AoHome, AoNoticeItem } from "../api";
import { aoApi } from "../api";
import type { AoPanelRun } from "../panel";
import { aoPrefs, useAoPrefs } from "../prefs";
import { noticeDefaultItems } from "./content";

export function NoticePanel({ run, home }: { run: AoPanelRun; home: AoHome }) {
  const notice = home.ao?.notice;
  const on = notice?.on ?? home.profile.noticeOn ?? true;
  const items = notice?.items ?? home.profile.noticeItems ?? null;
  // 서버 값이 바뀌면 입력칸을 다시 채움
  return <NoticeForm key={JSON.stringify([on, items])} run={run} on={on} items={items} />;
}

function NoticeForm({ run, on, items }: { run: AoPanelRun; on: boolean; items: AoNoticeItem[] | null }) {
  const auto = items === null;
  const [rows, setRows] = useState<AoNoticeItem[]>(() => {
    const base = items ?? noticeDefaultItems();
    return [0, 1].map((i) => ({ title: base[i]?.title ?? "", when: base[i]?.when ?? "" }));
  });
  const snoozed = useAoPrefs(aoPrefs.isNoticeSnoozed);
  const set = (i: number, k: keyof AoNoticeItem, v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  const filled = rows.filter((r) => r.title.trim());

  return (
    <>
      <h3 className="tab__h">정기점검 안내</h3>
      <div className="row">
        <button className="btn btn--sm" onClick={() => run(() => aoApi.updateNotice({ noticeOn: !on }), on ? "정기점검 안내를 껐어요" : "정기점검 안내를 켰어요")}>
          {on ? "안 보이게" : "보이게"}
        </button>
        <button className="btn btn--sm" disabled={!snoozed} onClick={() => run(async () => aoPrefs.clearNoticeSnooze(), "1일동안 안보기를 지웠어요")}>
          1일동안 안보기 지우기
        </button>
      </div>
      <p className="tab__hint">
        {on ? "새로 불러온 홈(로그인 · 취소 · 이체 완료)에서 막이 걷힌 뒤 나와요." : "지금은 안 보여요."}
        {snoozed ? " 이 브라우저는 오늘 안 보기로 해 두었어요." : ""} 1쪽 {auto ? "일시는 오늘로 계산 중" : "문구는 직접 넣은 것"}이에요.
      </p>
      {rows.map((r, i) => (
        <div key={i}>
          <label className="field">
            <span className="field__label">{i + 1}번째 제목</span>
            <input value={r.title} maxLength={30} onChange={(e) => set(i, "title", e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">{i + 1}번째 일시</span>
            <input value={r.when} maxLength={40} placeholder="11/13(금) 23:50 ~ 11/14(토) 02:00" onChange={(e) => set(i, "when", e.target.value)} />
          </label>
        </div>
      ))}
      <div className="row">
        <button
          className="btn btn--sm"
          disabled={!filled.length}
          onClick={() => run(() => aoApi.updateNotice({ noticeItems: filled.map((r) => ({ title: r.title.trim(), when: r.when.trim() })) }), "정기점검 문구를 저장했어요")}
        >
          문구 저장
        </button>
        <button className="btn btn--sm" disabled={auto} onClick={() => run(() => aoApi.updateNotice({ noticeItems: null }), "날짜를 오늘로 다시 계산해요")}>
          날짜 자동
        </button>
      </div>
    </>
  );
}
