import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { paths } from "../api/endpoints";
import type { Bank } from "../api/types";
import { useApi } from "../api/useApi";
import { localAsset } from "../assets/Asset";
import { nhBankList } from "./banks";
import { NhBankIcon, NhHeader } from "./common";
import { withNhLoading } from "./loading";
import { openedFromSheet } from "./nhPickerHint";
import "./nh-bankpicker.css";

// 은행선택·계좌번호 시트의 둥근 사각 은행 아이콘. 녹화1에서 잘라 온 nh-bank-<code>.png (scripts/nh-crops/picker.py).
// 없으면 공용 동그라미 아이콘
export function NhBankSquare({ bank, size }: { bank: Bank; size: number }) {
  const src = localAsset(`nh-bank-${bank.code}`);
  if (!src) return <NhBankIcon bank={bank} size={size} />;
  return <img className="nh-bank-sq" src={src} alt="" width={size} height={size} draggable={false} />;
}

// 돋보기: 고리 바깥지름 16.7, 굵기 1.5, 손잡이 45° (녹화1 30초에서 잰 모양)
function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="11.5" cy="10.85" r="7.6" />
      <path d="M16.9 16.2 20.8 20.1" />
    </svg>
  );
}

const NO_BANKS: Bank[] = [];

// 열기 전 점 3개 로딩은 여는 쪽이 보여 줌 — 콕송금 'NH농협 ⌄': NhSendWho 1.17초 / 계좌번호 시트의 은행 이름: NhNumberSheet (내려가는 시트 위 105ms).
// 여기서는 은행 목록을 아직 못 받았을 때만 받을 때까지 점 3개.
// 로딩이 걷힌 뒤 나타나는 시간 (섞임비, 아이콘 없는 y 60~280px@480 에서 잼):
//   시트에서 녹화1 20ms .52 · 41ms .90 · 61ms .93 · 86ms 1 → 80ms / 콕송금에서 녹화2 16ms .92 · 33ms .92 · 49ms 1 → 30ms
// 걷힌 뒤 나타나기 시작까지 녹화1(시트에서) 약 10ms, 녹화2(콕송금에서) 약 25ms — 콕송금 쪽은 NhSendWho 가 35ms 있다가 열어 주므로 0
const SHOW_MS = { send: 30, sheet: 80 } as const;
const SHOW_GAP = { send: 0, sheet: 15 } as const;
// 처음 열릴 때 아이콘이 뜨는 시각 (나타나기 시작한 때부터 ms). 7개는 바로, 나머지는 받는 대로 한 번에 툭 뜸
//   녹화1 29.54~: 7개 0 → NH·국민·SC +117 → 나머지 +161 / 녹화2 4.58~: 7개 0 → NH +45 → 국민·SC 등 +160 → 나머지 +180~210
const ICON_AT: Record<string, number> = { ibk: 0, shinhan: 0, woori: 0, hana: 0, kakao: 0, kbank: 0, toss: 0, nh: 80, kb: 135, sc: 135 };
const ICON_REST = 165;
// 돋보기: 시트에서 열 때 +85ms 늦게 뜸 (녹화1 29.62), 콕송금에서 열 때는 바로 (녹화2 4.59)
const SEARCH_AT = { send: 0, sheet: 85 } as const;
// 닫을 때(타일·X·뒤로가기): 85ms 직선으로 사라짐 (녹화1 47.92 → 48.005, 녹화2 5.71 → 5.80)
const LEAVE_MS = 85;

type Phase = "loading" | "in" | "out";

// ---------- 은행선택 (전체 화면, 콕송금 위에 덮어 그림) ----------
// 녹화1 29.5~48초: 위 X(헤더, 고정) 아래로 [검색칸 · 은행/증권사 탭 · 3칸 타일]이 함께 스크롤됨.
// 아주 빨리 나타남 → 아이콘이 차례로 뜸. 고르거나 X·뒤로가기를 누르면 85ms 동안 사라진 뒤 onPick/onClose.
// 열려 있는 동안 방문 기록을 한 칸 쌓아 두어서 (안드로이드) 뒤로가기는 은행선택만 닫음
export function NhBankPicker({
  banks: given,
  from: fromProp,
  onPick,
  onClose,
}: {
  banks?: Bank[];
  from?: "send" | "sheet"; // 어디서 열었는지 (나타나는 시각이 조금 다름). 없으면 NhNumberSheet 표시로 판단
  onPick: (b: Bank) => void;
  onClose: () => void;
}) {
  const [from] = useState<"send" | "sheet">(() => fromProp ?? (openedFromSheet() ? "sheet" : "send"));
  const fetched = useApi<Bank[]>(paths.banks);
  const banks = given?.length ? given : (fetched.data ?? NO_BANKS);
  const ready = banks.length > 0;
  const [phase, setPhase] = useState<Phase>(ready ? "in" : "loading");
  const [fresh, setFresh] = useState(ready); // 막 나타난 참 (아이콘이 차례로 뜨는 동안)
  const [tab, setTab] = useState<"bank" | "securities" | "tax">("bank");
  const [query, setQuery] = useState("");
  const leaveTimer = useRef(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // 목록을 아직 못 받았으면 받을 때까지 점 3개 → 나타남. 못 받으면(오류) 닫음
  const waiting = phase === "loading";
  const release = useRef<() => void>(() => {});
  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    let done = () => {};
    withNhLoading(() => new Promise<void>((r) => (done = r)), 0).then(() => {
      if (!alive) return;
      setPhase("in");
      setFresh(true);
    });
    release.current = () => done();
    return () => {
      alive = false;
      done();
    };
  }, [waiting]);
  const failed = !ready && fetched.status === "error";
  useEffect(() => {
    if (ready) release.current();
    if (failed) {
      release.current();
      onCloseRef.current();
    }
  }, [ready, failed]);
  useEffect(() => {
    if (!fresh) return;
    const t = window.setTimeout(() => setFresh(false), 400);
    return () => window.clearTimeout(t);
  }, [fresh]);
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const leave = (done: () => void) => {
    if (phase !== "in") return;
    setPhase("out");
    leaveTimer.current = window.setTimeout(done, LEAVE_MS);
  };
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  });

  // 보이는 동안 방문 기록 한 칸 (주소·라우터 상태는 그대로라 화면 스택은 안 바뀜). 뒤로가기 → 닫기, 다른 이유로 닫히면 그 칸을 되돌림.
  // 쌓기는 한 박자 늦게: 개발 모드(StrictMode)가 effect 를 두 번 돌려도 한 칸만 쌓이게
  const shown = phase !== "loading";
  useEffect(() => {
    if (!shown) return;
    let pushed = false;
    let popped = false;
    const onPop = () => {
      popped = true;
      window.removeEventListener("popstate", onPop);
      leaveRef.current(() => onCloseRef.current());
    };
    const t = window.setTimeout(() => {
      window.history.pushState({ ...window.history.state, nhBankPicker: true }, "");
      pushed = true;
      window.addEventListener("popstate", onPop);
    });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("popstate", onPop);
      // 우리가 쌓은 칸에 그대로 있을 때만 (다른 화면으로 이동해서 닫힌 거면 건드리지 않음)
      if (pushed && !popped && window.history.state?.nhBankPicker) window.history.back();
    };
  }, [shown]);

  // 대소문자·띄어쓰기 상관없이, 화면 이름·은행 이름·줄임말 어디든 들어 있으면
  const q = query.replace(/\s/g, "").toLowerCase();
  const list = useMemo(
    () => (tab === "tax" ? [] : nhBankList(banks, tab)).filter((b) => !q || [b.label, b.name, b.short].some((s) => s.replace(/\s/g, "").toLowerCase().includes(q))),
    [banks, tab, q],
  );
  return (
    <div
      className={`screen nh nh-banks nh-banks--${phase} ${fresh ? "nh-banks--fresh" : ""}`}
      style={{
        ["--nh-search-at" as string]: `${SHOW_GAP[from] + SEARCH_AT[from]}ms`,
        ["--nh-show-gap" as string]: `${SHOW_GAP[from]}ms`,
        ["--nh-show-ms" as string]: `${SHOW_MS[from]}ms`,
      }}
    >
      <NhHeader onClose={() => leave(onClose)} />
      <div className="nh-banks__scroll">
        <label className="nh-banks__search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="은행/증권사명을 입력해 주세요" />
          <SearchIcon />
        </label>
        <div className="nh-banks__tabs" role="tablist">
          <button role="tab" aria-selected={tab === "bank"} className={tab === "bank" ? "on" : ""} onClick={() => setTab("bank")}>
            은행
          </button>
          <button role="tab" aria-selected={tab === "securities"} className={tab === "securities" ? "on" : ""} onClick={() => setTab("securities")}>
            증권사
          </button>
          <button role="tab" aria-selected={tab === "tax"} className={tab === "tax" ? "on" : ""} onClick={() => setTab("tax")}>
            국세/지방세
          </button>
        </div>
        <div className="nh-banks__grid">
          {list.map((b) => (
            <button key={b.code} data-code={b.code} onClick={() => leave(() => onPick(b))} style={{ ["--nh-icon-at" as string]: `${SHOW_GAP[from] + (ICON_AT[b.code] ?? ICON_REST)}ms` } as CSSProperties}>
              <NhBankSquare bank={b} size={36} />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
        {tab === "tax" ? (
          <p className="nh-empty">국세·지방세 납부는 준비 중이에요.</p>
        ) : (
          !list.length && banks.length > 0 && <p className="nh-empty">검색 결과가 없어요.</p>
        )}
      </div>
    </div>
  );
}
