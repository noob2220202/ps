// /dispute/branch — 영업점검색 (녹화 C4 6.391–10.141). 신청 전 확인의 영업점 칸 → branchOpen (흰 막 + 스피너 217ms) 뒤 cut
//  - 머리줄: 왼쪽 제목 + × (공용 close 머리줄) · × = 고르지 않고 뒤로
//  - 칸: 누르면 초록 테 + 파란 커서 + 한국어 키보드 (AoKeyboard). 글자가 있으면 지우기 ⊗ (칸을 떠나면 사라짐)
//  - 안내 두 줄 (· 영업점명 (본점) / · 지역명 (서대문)) → 찾으면 결과 목록 (지어낸 영업점, 이름 · 주소로 찾음)
//  - ↵ · 돋보기: 흰 막 + 스피너, 184ms 에 스피너 · 200ms 에 결과와 함께 막이 걷힘 (C4 9.157 → 9.341 · 9.357). 키보드는 그대로
//  - 결과를 누르면: 키보드가 내려가기 시작하고 칸을 떠남, 100ms 뒤 신청 전 확인으로 뒤로 (고른 영업점은 그 화면이 이미 받아 둠, C4 10.041 → 10.141)
import { useEffect, useRef, useState } from "react";
import { useLayerActive } from "../../platform/LayerContext";
import { showAoLoading } from "../loading";
import { useAoBack } from "../nav";
import { AoCaret, AoHeader, AoKeyboard, AoPage } from "../ui";
import { BRANCH_HINTS, BRANCH_NONE, BRANCH_PLACEHOLDER, BRANCH_TITLE, searchBranches, type AoBranch } from "./content";
import { DisputeVeil, DspMagnifier } from "./parts";
import { pickDisputeBranch, useTimers } from "./store";
import "./dispute.css";

const SEARCH_SPINNER_OFF = 184;
const SEARCH_RESULTS = 200;
const PICK_BACK = 83; // + 라우터 전환 한 프레임 = 녹화의 100

export function BranchSearch() {
  const back = useAoBack("/dispute/check");
  const active = useLayerActive();
  const later = useTimers();
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [veil, setVeil] = useState(false);
  const [results, setResults] = useState<AoBranch[] | null>(null);
  const busy = useRef(false); // 찾는 중 · 고른 뒤 (두 번 누름 막기)
  const hideLoading = useRef<null | ((o?: { spinnerLead?: number }) => void)>(null);
  useEffect(() => {
    const hiding = hideLoading;
    return () => hiding.current?.({ spinnerLead: 0 }); // 찾는 중에 화면이 사라짐 (뒤로)
  }, []);

  const search = () => {
    const q = query.trim();
    if (!active || busy.current || !q) return;
    busy.current = true;
    setVeil(true);
    const hide = showAoLoading({ spinner: true, dim: false });
    hideLoading.current = hide;
    later(SEARCH_SPINNER_OFF, () => {
      hide({ spinnerLead: 0 });
      hideLoading.current = null;
    });
    later(SEARCH_RESULTS, () => {
      setResults(searchBranches(q));
      setVeil(false);
      busy.current = false;
    });
  };

  const pick = (b: AoBranch) => {
    if (!active || busy.current) return;
    busy.current = true;
    pickDisputeBranch(b);
    setFocus(false);
    later(PICK_BACK, () => {
      if (!back()) busy.current = false;
    });
  };

  return (
    <div className="ao-dsp">
      <AoPage className="ao-dsp-page" header={<AoHeader variant="close" title={BRANCH_TITLE} onClose={() => !busy.current && back()} />}>
        <div className="ao-dsp-branch">
          <div
            className={`ao-dsp-branch__field${focus ? " ao-dsp-branch__field--on" : ""}`}
            data-ao-kb-field
            role="searchbox"
            aria-label={BRANCH_PLACEHOLDER}
            onPointerDown={(e) => e.preventDefault()} // 이미 고른 칸을 다시 눌러도 진짜 키보드 입력이 끊기지 않게
            onClick={() => active && !busy.current && setFocus(true)}
          >
            {query ? (
              <span className="ao-dsp-branch__text">
                {query}
                {focus && <AoCaret height={24} color="#2a57fd" />}
              </span>
            ) : (
              <span className="ao-dsp-branch__text ao-dsp-branch__text--ph">
                {focus && <AoCaret height={24} color="#2a57fd" className="ao-dsp-branch__caret0" />}
                {BRANCH_PLACEHOLDER}
              </span>
            )}
            {query && focus && (
              <button
                type="button"
                className="ao-dsp-branch__clear"
                aria-label="지우기"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuery("");
                }}
              >
                <svg width="7" height="7" viewBox="0 0 7 7" aria-hidden>
                  <path d="M.75.75l5.5 5.5M6.25.75L.75 6.25" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="ao-dsp-branch__go"
              aria-label="검색"
              onClick={(e) => {
                e.stopPropagation();
                search();
              }}
            >
              <DspMagnifier />
            </button>
          </div>

          {results === null ? (
            <ul className="ao-dsp-branch__hints">
              {BRANCH_HINTS.map(([label, ex]) => (
                <li key={label}>
                  {label} <span>{ex}</span>
                </li>
              ))}
            </ul>
          ) : results.length ? (
            <div className="ao-dsp-branch__list">
              {results.map((b) => (
                <button key={b.name} type="button" className="ao-dsp-branch__row" onClick={() => pick(b)}>
                  <strong>{b.name}</strong>
                  <span>{b.address}</span>
                  <span className="ao-dsp-branch__tel">{b.phone}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="ao-dsp-branch__none">{BRANCH_NONE}</p>
          )}
        </div>
      </AoPage>
      <DisputeVeil on={veil} />
      <AoKeyboard open={focus} kind="ko" value={query} onChange={setQuery} maxLength={20} onDone={() => setFocus(false)} onEnter={search} />
    </div>
  );
}
