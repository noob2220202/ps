// 통합검색 (home.md §2.19, C3 39.979 →). 전체메뉴 검색 줄 → search 프로필로 들어옴. × → 전체메뉴로 그냥 뒤로.
//  - 검색 칸: 누르면 초록 테 + 파란 커서 + iOS 한국어 키보드(AoKeyboard, 네이티브 층). 웹뷰는 줄지 않고 키보드가 아래를 덮음
//  - 자동완성 스위치 (기본 꺼짐, 이 브라우저 · 프로필에 기억). 켜져 있으면 치는 대로 결과, 꺼져 있으면 ↵ · 돋보기에서 결과
//  - 결과(지어냄 — 녹화의 결과 화면은 쓰지 않음): 전체메뉴 줄 중 이름에 검색어가 들어간 것 10개까지, 맞는 부분 초록. 누르면 메뉴와 같은 이동
//  - 인기 검색어를 누르면 칸을 채우고 결과
import { useState } from "react";
import { useStatusBar } from "../../hooks/useStatusBar";
import { useAoBack } from "../nav";
import { aoPrefs, useAoPrefs } from "../prefs";
import { AoCaret, AoHeader, AoKeyboard, AoMagnifierIcon, AoSwitch } from "../ui";
import { SEARCH_CATALOG, SEARCH_POPULAR } from "./content";
import { useMenuLink } from "./links";
import "./menu.css";

export function Search() {
  useStatusBar("#ffffff", "dark");
  const back = useAoBack("/menu");
  const go = useMenuLink();
  const auto = useAoPrefs(aoPrefs.autocomplete);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const q = query.trim();
  const showResults = q !== "" && (auto || submitted === q);
  const results = showResults ? SEARCH_CATALOG.filter((it) => it.label.toLowerCase().includes(q.toLowerCase())).slice(0, 10) : [];
  const submit = () => {
    setSubmitted(q);
    setFocus(false);
  };

  return (
    <div className="ao-home-search">
      <AoHeader variant="modal" title="통합검색" weight={700} onClose={back} />
      <div className={`ao-home-search__field${focus ? " ao-home-search__field--on" : ""}`} data-ao-kb-field role="searchbox" aria-label="검색어" onClick={() => setFocus(true)}>
        {/* 비어 있으면 눌러도 안내 글은 그대로, 커서만 그 앞에 (C3 41.100–41.800) */}
        {query ? (
          <span className="ao-home-search__text">
            {query}
            {focus && <AoCaret />}
          </span>
        ) : (
          <span className="ao-home-search__text ao-home-search__text--ph">
            {focus && <AoCaret className="ao-home-search__caret0" />}
            검색어를 입력해 주세요
          </span>
        )}
        {query && (
          <button
            type="button"
            className="ao-home-search__clear"
            aria-label="지우기"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              setSubmitted(null);
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
              <path d="M1 1l6 6M7 1L1 7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="ao-home-search__go"
          aria-label="검색"
          onClick={(e) => {
            e.stopPropagation();
            submit();
          }}
        >
          <AoMagnifierIcon size={19.98} stroke={1.45} color="#000" />
        </button>
      </div>
      <span className="ao-home-search__auto">자동완성</span>
      <AoSwitch size="lg" checked={auto} onChange={(v) => aoPrefs.setAutocomplete(v)} aria-label="자동완성" className="ao-home-search__switch" />

      {showResults ? (
        <div className="ao-home-search__results">
          {results.length ? (
            results.map((it) => {
              const i = it.label.toLowerCase().indexOf(q.toLowerCase());
              return (
                <button key={it.label} type="button" className="ao-home-search__row" onClick={() => go(it.link)}>
                  {it.label.slice(0, i)}
                  <em>{it.label.slice(i, i + q.length)}</em>
                  {it.label.slice(i + q.length)}
                </button>
              );
            })
          ) : (
            <p className="ao-home-search__none">검색 결과가 없어요</p>
          )}
        </div>
      ) : (
        <>
          <h2 className="ao-home-search__h">인기 검색어</h2>
          {SEARCH_POPULAR.map((w, i) => (
            <button
              key={w}
              type="button"
              className="ao-home-search__pop"
              style={{ top: 239.67 + i * 58 }}
              onClick={() => {
                setQuery(w);
                setSubmitted(w);
              }}
            >
              <i>{i + 1}.</i>
              <span>{w}</span>
            </button>
          ))}
        </>
      )}

      <AoKeyboard open={focus} kind="ko" value={query} onChange={setQuery} maxLength={30} onDone={() => setFocus(false)} onEnter={submit} />
    </div>
  );
}
