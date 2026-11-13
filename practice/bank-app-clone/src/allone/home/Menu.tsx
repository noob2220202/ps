// 전체메뉴 (home.md §2.18, C3 38.946–39.85). 홈 ≡ → menu 프로필(스피너만 317ms → 막 50ms)로 들어옴. 탭 바 없음.
//  - 머리줄: 이름 › · 로그아웃(아무 일 없음) · 지구 · 톱니(아무 일 없음) · 집 · × (둘 다 홈으로 그냥 뒤로, 홈은 새로 불러오지 않음)
//  - 검색 줄 → 통합검색 (search 프로필). AI톡 타일은 열린 뒤 317ms 에 한 프레임에 나타남 (누름 → 아무 일 없음)
//  - 왼쪽 목록(124 폭, 줄 50)은 오른쪽 목록의 스크롤을 따라감 (scroll-spy), 누르면 그 칸으로
//  - 오른쪽: 머리글 + 줄 간격 52. 만든 화면으로 가는 줄(거래내역조회 · 계좌이체 · 잔액채우기)은 menuLink 막 뒤 이동, 나머지 · 핀은 아무 일 없음
//  - 최근 이용메뉴: 이 프로필에서 마지막에 연 만든 화면 3개 (prefs). 처음 한 프레임은 비어 있다가 +50ms 에 들어옴
import { useEffect, useRef, useState } from "react";
import { useApi } from "../../api/useApi";
import { useStatusBar } from "../../hooks/useStatusBar";
import { aoPaths, type AoHome } from "../api";
import { useAoFlow } from "../flow";
import { aoPrefs, useAoPrefs } from "../prefs";
import { AoCloseIcon, AoGearIcon, AoGlobeIcon, AoHomeIcon, AoMagnifierIcon, AoPinIcon } from "../ui";
import { Art } from "./art";
import { MENU_QUICK, MENU_RECENT, MENU_SECTIONS, type AoMenuItem } from "./content";
import { useMenuLink } from "./links";
import "./menu.css";

const AI_AFTER = 317; // AI톡 타일 (C3 38.946 → 39.263)
const RECENT_AFTER = 50; // 최근 이용메뉴 줄 (38.996 → 39.03)

export function Menu() {
  useStatusBar("#ffffff", "dark");
  const flow = useAoFlow();
  const home = useApi<AoHome>(aoPaths.home);
  const go = useMenuLink();
  const name = home.data?.profile.userName ?? "";
  const recentKeys = useAoPrefs(aoPrefs.recentMenus);
  const [ai, setAi] = useState(false);
  const [recentOn, setRecentOn] = useState(false);
  useEffect(() => {
    const a = window.setTimeout(() => setAi(true), AI_AFTER);
    const b = window.setTimeout(() => setRecentOn(true), RECENT_AFTER);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);
  const recent: AoMenuItem[] = recentOn ? recentKeys.map((k) => MENU_RECENT[k]).filter(Boolean) : [];
  const sections = MENU_SECTIONS.map((s) => (s.key === "recent" ? { ...s, items: recent } : s));

  // ---- scroll-spy ----
  const list = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const secs = useRef<(HTMLElement | null)[]>([]);
  const [sel, setSel] = useState(0);
  const jumping = useRef(0); // 왼쪽 줄을 눌러 미끄러지는 동안은 따라가지 않음 (타이머 번호)
  useEffect(() => () => window.clearTimeout(jumping.current), []);
  const spy = () => {
    const el = list.current;
    if (!el || jumping.current) return;
    const st = el.scrollTop;
    let i = 0;
    secs.current.forEach((s, k) => {
      if (s && s.offsetTop - 2 <= st) i = k;
    });
    if (st >= el.scrollHeight - el.clientHeight - 1) i = sections.length - 1;
    setSel(i);
  };
  useEffect(() => {
    // 고른 줄이 왼쪽 목록 밖이면 보이게
    const r = rail.current;
    const row = r?.children[sel] as HTMLElement | undefined;
    if (!r || !row) return;
    if (row.offsetTop < r.scrollTop) r.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > r.scrollTop + r.clientHeight) r.scrollTop = row.offsetTop + row.offsetHeight - r.clientHeight;
  }, [sel]);
  const jump = (k: number) => {
    const el = list.current;
    const s = secs.current[k];
    if (!el || !s) return;
    setSel(k);
    window.clearTimeout(jumping.current);
    jumping.current = window.setTimeout(() => (jumping.current = 0), 700);
    el.scrollTo({ top: s.offsetTop, behavior: "smooth" });
  };

  return (
    <div className="ao-home-menu">
      <header className="ao-home-menu__hdr">
        <button type="button" className="ao-home-menu__name">
          {name && (
            <>
              <b>{name}</b>님
            </>
          )}
          <svg width="6.33" height="12" viewBox="0 0 6.33 12" aria-hidden>
            <path d="M0.9 0.9L5.43 6L0.9 11.1" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="ao-home-menu__logout">로그아웃</span>
        </button>
        <button type="button" className="ao-home-menu__icon" style={{ left: 219 }} aria-label="언어">
          <AoGlobeIcon color="#000" style={{ left: 11.81, top: 11.33 }} />
        </button>
        <button type="button" className="ao-home-menu__icon" style={{ left: 259 }} aria-label="설정">
          <AoGearIcon color="#000" style={{ left: 12.11, top: 12 }} />
        </button>
        <button type="button" className="ao-home-menu__icon" style={{ left: 299 }} aria-label="홈" onClick={() => void flow.goHome()}>
          <AoHomeIcon color="#000" style={{ left: 12.74, top: 12.67 }} />
        </button>
        <button type="button" className="ao-home-menu__icon" style={{ left: 339 }} aria-label="닫기" onClick={() => void flow.goHome()}>
          <AoCloseIcon color="#000" style={{ left: 13.71, top: 13.67 }} />
        </button>
      </header>

      <button type="button" className="ao-home-menu__search" onClick={() => void flow.goSearch()}>
        <AoMagnifierIcon color="#000" style={{ position: "absolute", left: 31.64, top: 15.75 }} />
        <span>검색으로 더 많은 정보를 찾아보세요.</span>
      </button>
      {ai && (
        <button type="button" className="ao-home-menu__ai" aria-label="AI톡">
          <Art name="allone-home-menu-ai" />
        </button>
      )}

      <div className="ao-home-menu__quick">
        {MENU_QUICK.map((q, i) => (
          <button key={q.label} type="button" className="ao-home-menu__qbtn" style={{ left: 24.3 + i * 88.25 }}>
            <Art name={q.art} x={QUICK_ART[i][0] - 24.3 - i * 88.25} y={QUICK_ART[i][1] - 176} />
            <span className="ao-home-menu__qlabel">{q.label}</span>
          </button>
        ))}
      </div>

      <div className="ao-home-menu__rail" ref={rail}>
        {sections.map((s, k) => (
          <button key={s.key} type="button" className={`ao-home-menu__rrow${k === sel ? " ao-home-menu__rrow--on" : ""}`} onClick={() => jump(k)}>
            {s.rail}
          </button>
        ))}
      </div>
      <div className="ao-home-menu__list" ref={list} onScroll={spy}>
        {sections.map((s, k) => (
          <section
            key={s.key}
            className="ao-home-menu__sec"
            ref={(el) => {
              secs.current[k] = el;
            }}
          >
            <h2 className="ao-home-menu__h">{s.title}</h2>
            {s.items.map((it) => (
              <button key={it.label} type="button" className="ao-home-menu__item" onClick={() => go(it.link)}>
                {it.label}
                {s.key === "recent" && <AoPinIcon className="ao-home-menu__pin" />}
              </button>
            ))}
          </section>
        ))}
        <div className="ao-home-menu__tail" />
      </div>
    </div>
  );
}

// 바로가기 그림 잉크 왼쪽 위 (C3 39.750, 화면 pt). 칸 가운데 68.4 / 156.7 / 244.9 / 333.2 (글 가운데)
const QUICK_ART: [number, number][] = [
  [57.21, 190],
  [145.13, 188.5],
  [232.64, 189],
  [319.82, 190],
];
