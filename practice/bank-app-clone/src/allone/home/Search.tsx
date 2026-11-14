// 통합검색 (home.md §2.19, C3 39.979 → 45.54). 전체메뉴 검색 줄 → search 프로필로 들어옴. × → 전체메뉴로 그냥 뒤로.
//  - 검색 칸: 누르면 초록 테 + 파란 커서 + iOS 한국어 키보드(AoKeyboard, 네이티브 층). 웹뷰는 줄지 않고 키보드가 아래를 덮음.
//    지우기 ⊗ 는 칸을 고른 동안만 (C3 43.246 칸을 떠나면 사라짐)
//  - 자동완성 스위치 (기본 꺼짐, 이 브라우저 · 프로필에 기억). 켜져 있으면 두 글자부터 칸 아래에 낱말 목록 (C3 42.413–43.06):
//    흰 판 (칸 아래 191 → 줄 42, 다섯 줄 반에서 잘림 426) + 그 아래 검정 .30 막. 두벌식 자모로 앞이 맞는 낱말, 맞은 글자는 초록.
//    목록은 칠 때마다 33ms 뒤 새 목록이 검정 글자로, 다시 33ms 뒤 초록 (녹화 그대로 한두 프레임 검정). 낱말을 누르면 그 말로 찾기
//  - 찾기 (↵ · 돋보기 · 인기 검색어 · 낱말): 막 + 스피너 바로 (C3 43.079), +150 키보드 내려감, +167 결과 (칸을 떠남, 낱말 목록 걷힘),
//    +600 막 · 스피너 같이 걷힘 (43.679). 검은 막이 있는 동안만 '메뉴 N건' 아래 회색 줄이 보임 (찾기 막 · 링크 막 모두, 녹화 그대로)
//  - 결과: '메뉴 N건' (N 초록) + 줄마다 경로 (기타 > 고객센터 > … >) 와 초록 밑줄 메뉴 이름 (줄 간격 68). 아래에 AI톡 알약 (누름만).
//    결과 화면에서는 자동완성 줄이 없음. 메뉴 이름을 누르면: 만든 화면은 그 이동 (이의제기 신청 및 조회 = disputeLink 막), 나머지는 누름만
import { useEffect, useMemo, useRef, useState } from "react";
import { localAsset } from "../../assets/Asset";
import { useStatusBar } from "../../hooks/useStatusBar";
import { useLayerActive } from "../../platform/LayerContext";
import { useAoFlow } from "../flow";
import { showAoLoading, useAoLoading } from "../loading";
import { aoLock, aoUnlock, useAoBack } from "../nav";
import { aoPrefs, useAoPrefs } from "../prefs";
import { AoCaret, AoHeader, AoKeyboard, AoMagnifierIcon, AoSwitch } from "../ui";
import { SEARCH_AITALK, SEARCH_CATALOG, SEARCH_POPULAR, SEARCH_SUGGEST, type AoSearchItem } from "./content";
import { useMenuLink } from "./links";
import "./menu.css";
import "./home.css";

// 찾기 시각표 (ms, 손 뗀 때부터 — C3 43.079 막 · 43.229 키보드 · 43.246 결과 · 43.679 걷힘)
const FIND = { keyboard: 150, results: 167, off: 600 };
// 낱말 목록: 새 목록 (검정) · 초록 (C3 42.596 → 42.629 → 42.779, 42.813 → 42.846 → 42.879)
const SUGGEST_LIST = 33;
const SUGGEST_MARK = 66;
const SUGGEST_MAX = 10;

// ---- 두벌식 키 열 (겹모음 · 겹받침은 두 키) — 치는 중인 글자(이읮)도 '이의제기'의 앞과 맞게 ----
const JUNG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅗㅏ", "ㅗㅐ", "ㅗㅣ", "ㅛ", "ㅜ", "ㅜㅓ", "ㅜㅔ", "ㅜㅣ", "ㅠ", "ㅡ", "ㅡㅣ", "ㅣ"];
const JONG = ["", "ㄱ", "ㄲ", "ㄱㅅ", "ㄴ", "ㄴㅈ", "ㄴㅎ", "ㄷ", "ㄹ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ", "ㄹㅅ", "ㄹㅌ", "ㄹㅍ", "ㄹㅎ", "ㅁ", "ㅂ", "ㅂㅅ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const COMPAT: Record<string, string> = { ㅘ: "ㅗㅏ", ㅙ: "ㅗㅐ", ㅚ: "ㅗㅣ", ㅝ: "ㅜㅓ", ㅞ: "ㅜㅔ", ㅟ: "ㅜㅣ", ㅢ: "ㅡㅣ", ㄳ: "ㄱㅅ", ㄵ: "ㄴㅈ", ㄶ: "ㄴㅎ", ㄺ: "ㄹㄱ", ㄻ: "ㄹㅁ", ㄼ: "ㄹㅂ", ㄽ: "ㄹㅅ", ㄾ: "ㄹㅌ", ㄿ: "ㄹㅍ", ㅀ: "ㄹㅎ", ㅄ: "ㅂㅅ" };
function keysOf(ch: string) {
  const c = ch.charCodeAt(0) - 0xac00;
  if (c >= 0 && c < 11172) return CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28];
  return COMPAT[ch] ?? ch.toLowerCase();
}
const keyLine = (s: string) => [...s.replace(/\s+/g, "")].map(keysOf).join("");

interface Suggest {
  word: string;
  mark: number; // 초록 글자 수 (앞에서부터)
}
function suggestFor(q: string): Suggest[] {
  const t = q.replace(/\s+/g, "");
  if ([...t].length < 2) return [];
  const kq = keyLine(t);
  const out: Suggest[] = [];
  for (const w of SEARCH_SUGGEST) {
    if (!keyLine(w).startsWith(kq)) continue;
    // 키가 다 들어간 글자까지 초록 (치는 중인 마지막 글자는 아직 아님)
    let acc = 0;
    let mark = 0;
    [...w].forEach((ch, i) => {
      if (/\s/.test(ch)) return;
      acc += keysOf(ch).length;
      if (acc <= kq.length) mark = i + 1;
    });
    out.push({ word: w, mark });
    if (out.length >= SUGGEST_MAX) break;
  }
  return out;
}

const plain = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const findMenus = (q: string) => SEARCH_CATALOG.filter((it) => plain([...it.path, it.label].join("")).includes(plain(q)));

export function Search() {
  useStatusBar("#ffffff", "dark");
  const back = useAoBack("/menu");
  const flow = useAoFlow();
  const go = useMenuLink();
  const active = useLayerActive();
  const auto = useAoPrefs(aoPrefs.autocomplete);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [kbDown, setKbDown] = useState(false); // 찾기: 키보드는 칸을 떠나기 한 프레임 전에 내려가기 시작 (C3 43.229 · 43.246)
  const [results, setResults] = useState<AoSearchItem[] | null>(null);
  const dimUp = !!useAoLoading()?.dim; // 결과 아래 회색 줄은 검은 막이 떠 있는 동안만 (찾기 막 C3 43.246–43.663 · 링크 막 44.796–)
  const [list, setList] = useState<{ items: Suggest[]; marked: boolean } | null>(null);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const hideRef = useRef<null | ((o?: { spinnerLead?: number }) => void)>(null);
  const later = (ms: number, fn: () => void) => void timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => {
    const ts = timers.current;
    const hiding = hideRef;
    return () => {
      ts.forEach((t) => window.clearTimeout(t));
      // 막 도중 뒤로 (화면이 사라짐): 막을 걷고 찾기가 건 이동 잠금도 풂
      if (hiding.current) {
        hiding.current({ spinnerLead: 0 });
        aoUnlock();
      }
    };
  }, []);

  // 낱말 목록: 33ms 뒤 새 목록(검정) → 33ms 뒤 초록. 목록이 없어지면 바로
  const target = useMemo(() => (auto && focus ? suggestFor(query) : []), [auto, focus, query]);
  useEffect(() => {
    if (!target.length) {
      const t = window.setTimeout(() => setList(null), 0); // 그리기는 아래 showList 가 바로 숨김
      return () => window.clearTimeout(t);
    }
    const a = window.setTimeout(() => setList({ items: target, marked: false }), SUGGEST_LIST);
    const b = window.setTimeout(() => setList({ items: target, marked: true }), SUGGEST_MARK);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [target]);

  const find = (raw?: string) => {
    const q = (raw ?? query).trim();
    if (!q || !active || busy.current || !aoLock(FIND.off)) return; // 막이 있는 동안 다른 이동도 막음
    busy.current = true;
    const hide = showAoLoading();
    hideRef.current = hide;
    later(FIND.keyboard, () => setKbDown(true));
    later(FIND.results, () => {
      setFocus(false);
      setResults(findMenus(q));
      setList(null);
    });
    later(FIND.off, () => {
      hideRef.current = null;
      hide({ spinnerLead: 0 });
      setKbDown(false);
      busy.current = false;
    });
  };
  const pickWord = (w: string) => {
    setQuery(w);
    find(w);
  };
  const open = (it: AoSearchItem) => {
    if (!it.link || !active) return; // 만들지 않은 화면: 누름만
    if (it.link === "dispute") void flow.goDispute();
    else go(it.link);
  };

  const showList = list && target.length > 0;
  const ai = localAsset("allone-dispute-aitok");

  return (
    <div className="ao-home-search">
      <AoHeader variant="modal" title="통합검색" weight={700} onClose={back} />
      <div
        className={`ao-home-search__field${focus ? " ao-home-search__field--on" : ""}`}
        data-ao-kb-field
        role="searchbox"
        aria-label="검색어"
        onPointerDown={(e) => e.preventDefault()} // 이미 고른 칸을 다시 눌러도 진짜 키보드 입력(숨은 입력칸 포커스)이 끊기지 않게
        onClick={() => active && setFocus(true)}
      >
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
        {query && focus && (
          <button
            type="button"
            className="ao-home-search__clear"
            aria-label="지우기"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
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
            find();
          }}
        >
          <AoMagnifierIcon size={19.98} stroke={1.45} color="#000" />
        </button>
      </div>

      {results ? (
        <>
          <div className="ao-home-search-res">
            <p className="ao-home-search-res__count">
              메뉴 <em>{results.length}</em>건
            </p>
            {dimUp && <i className="ao-home-search-res__line" aria-hidden />}
            {results.length ? (
              results.map((it) => (
                <div key={it.label} className="ao-home-search-res__row">
                  <p className="ao-home-search-res__path">{it.path.join(" > ")} &gt;</p>
                  <button type="button" className="ao-home-search-res__link" onClick={() => open(it)}>
                    {it.label}
                  </button>
                </div>
              ))
            ) : (
              <p className="ao-home-search__none">검색 결과가 없어요</p>
            )}
          </div>
          <button type="button" className="ao-home-search-ai" aria-label="AI톡">
            <span>{SEARCH_AITALK}</span>
            {ai && <img src={ai} alt="" aria-hidden draggable={false} />}
          </button>
        </>
      ) : (
        <>
          <span className="ao-home-search__auto">자동완성</span>
          <AoSwitch size="lg" checked={auto} onChange={(v) => aoPrefs.setAutocomplete(v)} aria-label="자동완성" className="ao-home-search__switch" />
          <h2 className="ao-home-search__h">인기 검색어</h2>
          {SEARCH_POPULAR.map((w, i) => (
            <button key={w} type="button" className="ao-home-search__pop" style={{ top: 239.67 + i * 58 }} onClick={() => pickWord(w)}>
              <i>{i + 1}.</i>
              <span>{w}</span>
            </button>
          ))}
        </>
      )}

      {showList && (
        <div className="ao-home-search-sug">
          <div className="ao-home-search-sug__list" data-ao-kb-field>
            {list.items.map((s) => (
              <button key={s.word} type="button" className="ao-home-search-sug__row" onClick={() => pickWord(s.word)}>
                {list.marked && s.mark > 0 ? (
                  <>
                    <em>{s.word.slice(0, s.mark)}</em>
                    {s.word.slice(s.mark)}
                  </>
                ) : (
                  s.word
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <AoKeyboard open={focus && !kbDown} kind="ko" value={query} onChange={setQuery} maxLength={30} onDone={() => setFocus(false)} onEnter={() => find()} />
    </div>
  );
}
