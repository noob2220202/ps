// 정기점검 안내 시트 (launch.md §2.10, plan §1.3 · Q10 · Q11). 새로 불러온 홈에서 막이 걷힌 뒤 +583ms 에 미끄러짐 없이 나타남
// (배경막만 300ms ease). 닫기 · 1일동안 안보기 → 시트와 배경막이 한 프레임에 사라짐. 배경막을 눌러도 아무 일 없음.
// 5쪽: 1쪽은 녹화의 정기점검 공지 모양 (달 · 날짜는 오늘로 계산, 🔔 관리 패널에서 바꾼 문구가 있으면 그것), 2–5쪽은 지어낸 안내.
// 4초마다 300ms 로 다음 쪽 (끝에서 첫 쪽으로), 손으로 넘김, ❚❚ ↔ ▶.
// 자리: 시트 위끝 491 (C1 13.300, y px/3) 기준 pt
import { useEffect, useMemo, useState } from "react";
import type { AoNoticeItem } from "../api";
import { AO_NOTICE } from "../motion";
import { aoPrefs } from "../prefs";
import { AoSheet } from "../ui";
import { Art } from "./art";
import { noticePages } from "./content";
import { mod, useLoopPager, visibleSlots } from "./pager";

const SHEET_TOP = 491;

export function NoticeSheet({ open, items, onClose }: { open: boolean; items: AoNoticeItem[] | null; onClose: () => void }) {
  return (
    <AoSheet open={open} enter="pop" exit="cut" top={SHEET_TOP} scrimClose={false} className="ao-home-notice">
      {open && <NoticeBody items={items} onClose={onClose} />}
    </AoSheet>
  );
}

function NoticeBody({ items, onClose }: { items: AoNoticeItem[] | null; onClose: () => void }) {
  const pages = useMemo(() => noticePages(items), [items]);
  const n = pages.length;
  const [paused, setPaused] = useState(false);
  const pager = useLoopPager({ count: n, pitch: 393, snapMs: AO_NOTICE.slide, stepMs: AO_NOTICE.slide });
  const { step } = pager;
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => step(1), AO_NOTICE.autoAdvance);
    return () => window.clearInterval(t);
  }, [paused, step]);

  // 쪽 표시: 지금 쪽은 초록 알약 20.6 × 10.3, 나머지는 회색 점 Ø 10.3 — x 140.5 부터 점 간격 18 (알약 뒤는 +10), 그 뒤 ❚❚ (x 242.8)
  const markLeft = (i: number) => 140.5 + 18 * i + (i > pager.index ? 10 : 0);

  return (
    <div className="ao-home-notice__box">
      <div className="ao-home-notice__pages" {...pager.bind}>
        {visibleSlots(pager.pos, n).map((k) => {
          const p = pages[mod(k, n)];
          return (
            <section key={k} className="ao-home-notice__page" style={{ transform: `translateX(${(k - pager.pos) * 393}px)` }}>
              <h2 className="ao-home-notice__title">
                {p.title[0]}
                <em>{p.title[1]}</em>
                {p.title[2]}
              </h2>
              {p.items.slice(0, 2).map((it, i) => (
                <div key={i}>
                  <p className="ao-home-notice__item" style={{ top: 106 + i * 66 }}>
                    {it.title}
                  </p>
                  {it.when && (
                    <p className="ao-home-notice__when" style={{ top: 130.67 + i * 66.67 }}>
                      · {it.when}
                    </p>
                  )}
                </div>
              ))}
              <Art name="allone-home-notice-bell" x={297.59} y={141.42} />
            </section>
          );
        })}
      </div>
      {pages.map((_, i) => (
        <i key={i} className={`ao-home-notice__mark${i === pager.index ? " ao-home-notice__mark--on" : ""}`} style={{ left: markLeft(i) }} />
      ))}
      <button
        type="button"
        className={`ao-home-notice__pause${paused ? " ao-home-notice__pause--play" : ""}`}
        aria-label={paused ? "자동 넘기기 켜기" : "자동 넘기기 멈춤"}
        onClick={() => setPaused((p) => !p)}
      />
      <button
        type="button"
        className="ao-home-notice__btn ao-home-notice__btn--snooze"
        onClick={() => {
          aoPrefs.snoozeNotice(1);
          onClose();
        }}
      >
        1일동안 안보기
      </button>
      <button type="button" className="ao-home-notice__btn ao-home-notice__btn--close" onClick={onClose}>
        닫기
      </button>
    </div>
  );
}
